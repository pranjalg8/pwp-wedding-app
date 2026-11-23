/**
 * Budget sync: keeps the Google Sheet "Wedding budget by day" in step with the PwP wedding planner website.
 *
 * Pull design: this script runs every 30 minutes (and on demand from the "Budget sync" menu), calls the read-only
 * Supabase edge function `sheet-snapshot` with a shared token, and writes the website's numbers into the sheet's
 * typed INPUT cells only. It covers the WEDDING budget only (no gold, no post-wedding), Pranjal's share.
 *
 * What it may write (everything else is read-only to it):
 *   'Day-wise budget'!D80      the website's wedding total, typed, for the tie-out (E80 compares it with D74)
 *   Workings!B5, B6            Shri Kanth room rate, extra bed rate
 *   Workings!B11               Shri Kanth dinner rate (from the 12 Feb dinner line)
 *   Workings!B12, B13, B14     Hotel Sai room rate, breakfast rate, people per room
 *   Workings!B23               Hotel Sai GST
 *   Workings!B25:C29           rooms by night: Shri Kanth (B) and Hotel Sai, Pranjal's side (C)
 *   Workings!B33:B35           Shri Kanth meal headcounts (12, 13 and 16 Feb)
 * It NEVER writes the "Proposed" column (E) or any cell that holds a formula, and it never inserts, deletes or
 * edits rows. When the website has something the sheet has no row for, or a figure it cannot map, it appends a
 * line to the "Sync log" tab (timestamp, item, website value, sheet value) and leaves the sheet alone.
 *
 * Configuration lives in Script Properties (Project Settings > Script properties), never in this file:
 *   SNAPSHOT_URL    https://qutawbofxpcqxkxrzebv.supabase.co/functions/v1/sheet-snapshot
 *   SNAPSHOT_TOKEN  the shared secret (same value as the SHEET_SYNC_TOKEN edge function secret)
 *   DRY_RUN         optional; "true" makes the scheduled run only report, never write
 */

var DAY_SHEET = 'Day-wise budget';
var WORKINGS = 'Workings';
var LOG_SHEET = 'Sync log';
var MAX_AGE_MINUTES = 15; // refuse a snapshot older than this
var EPS = 0.005;

// Every cell this script is allowed to write, with a pattern the row's label (column A for Workings, column C for
// Day-wise) must match. If someone moves rows, the label no longer matches and the write is skipped and logged.
var LABEL_GUARDS = {
  'Day-wise budget!D80': { col: 3, re: /website/i },
  'Workings!B5': { col: 1, re: /Shri Kanth room rate/i },
  'Workings!B6': { col: 1, re: /Shri Kanth extra bed/i },
  'Workings!B11': { col: 1, re: /Shri Kanth dinner/i },
  'Workings!B12': { col: 1, re: /Hotel Sai room rate/i },
  'Workings!B13': { col: 1, re: /Hotel Sai breakfast/i },
  'Workings!B14': { col: 1, re: /People per room/i },
  'Workings!B23': { col: 1, re: /GST/i },
  'Workings!B25': { col: 1, re: /^12 Feb/ }, 'Workings!C25': { col: 1, re: /^12 Feb/ },
  'Workings!B26': { col: 1, re: /^13 Feb/ }, 'Workings!C26': { col: 1, re: /^13 Feb/ },
  'Workings!B27': { col: 1, re: /^14 Feb/ }, 'Workings!C27': { col: 1, re: /^14 Feb/ },
  'Workings!B28': { col: 1, re: /^15 Feb/ }, 'Workings!C28': { col: 1, re: /^15 Feb/ },
  'Workings!B29': { col: 1, re: /^16 Feb/ }, 'Workings!C29': { col: 1, re: /^16 Feb/ },
  'Workings!B33': { col: 1, re: /^12 Feb/ },
  'Workings!B34': { col: 1, re: /^13 Feb/ },
  'Workings!B35': { col: 1, re: /^16 Feb/ }
};

// Night (website date) -> Workings row of the rooms-by-night table.
var NIGHT_ROW = { '2027-02-12': 25, '2027-02-13': 26, '2027-02-14': 27, '2027-02-15': 28, '2027-02-16': 29 };

// ---------------------------------------------------------------------------------------------------------------
// Menu, trigger, entry points
// ---------------------------------------------------------------------------------------------------------------

/** Simple trigger: only builds the menu (simple triggers may not call external services). */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Budget sync')
    .addItem('Refresh now', 'refreshNow')
    .addItem('Dry run (show changes, write nothing)', 'dryRunNow')
    .addSeparator()
    .addItem('Install 30-minute timer', 'installTrigger')
    .addItem('Remove timer', 'removeTrigger')
    .addToUi();
}

/** Menu: Budget sync > Refresh now. */
function refreshNow() {
  var res = runSync_({ dryRun: false });
  alertResult_(res);
}

/** Menu: shows what a refresh would change and writes nothing (not even the Sync log). */
function dryRunNow() {
  var res = runSync_({ dryRun: true });
  alertResult_(res);
}

/** Time-driven trigger target. DRY_RUN=true in Script Properties makes it report only. */
function scheduledSync() {
  var dry = String(prop_('DRY_RUN') || '').toLowerCase() === 'true';
  runSync_({ dryRun: dry });
}

/** Creates the every-30-minutes trigger once (removes older copies of it first). */
function installTrigger() {
  removeTrigger_();
  ScriptApp.newTrigger('scheduledSync').timeBased().everyMinutes(30).create();
  toast_('Timer installed: refreshes every 30 minutes.');
}

function removeTrigger() {
  removeTrigger_();
  toast_('Timer removed.');
}

function removeTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scheduledSync') ScriptApp.deleteTrigger(t);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The sync
// ---------------------------------------------------------------------------------------------------------------

/**
 * @param {{dryRun: boolean}} opts
 * @return {{ok: boolean, dryRun: boolean, message: string, writes: Array, logs: Array}}
 */
function runSync_(opts) {
  var dryRun = !!opts.dryRun;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, dryRun: dryRun, message: 'Another sync is running.', writes: [], logs: [] };
  try {
    var snap = fetchSnapshot_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var plan = buildPlan_(snap, ss);
    var writes = [];
    var logs = plan.logs.slice();

    plan.targets.forEach(function (t) {
      var r = checkTarget_(ss, t);
      if (r.error) { logs.push([t.label + ' (' + t.key + ')', t.value, r.error]); return; }
      if (Math.abs(num_(r.current) - t.value) > EPS || typeof r.current !== 'number') {
        writes.push({ key: t.key, label: t.label, from: r.current, to: t.value });
      }
    });

    if (!dryRun) {
      writes.forEach(function (w) {
        var p = splitKey_(w.key);
        ss.getSheetByName(p.sheet).getRange(p.a1).setValue(w.to); // typed input cells only (checked above)
      });
      SpreadsheetApp.flush();
    }

    // Cross-checks run after the writes (or against the current sheet in a dry run).
    logs = logs.concat(crossChecks_(snap, ss));

    if (!dryRun) {
      appendLogs_(ss, logs);
      PropertiesService.getScriptProperties().setProperty('LAST_SYNC', new Date().toISOString());
    }

    var msg = (dryRun ? 'DRY RUN. ' : '') + writes.length + ' cell(s) ' + (dryRun ? 'would change' : 'updated') + ', ' + logs.length + ' item(s) for the Sync log.';
    Logger.log(msg + '\n' + JSON.stringify({ writes: writes, logs: logs }, null, 1));
    return { ok: true, dryRun: dryRun, message: msg, writes: writes, logs: logs };
  } catch (e) {
    Logger.log('Budget sync failed: ' + e);
    return { ok: false, dryRun: dryRun, message: 'Budget sync failed: ' + e.message, writes: [], logs: [] };
  } finally {
    lock.releaseLock();
  }
}

/** Fetches and validates the snapshot. Throws with a short message on anything unexpected. */
function fetchSnapshot_() {
  var url = prop_('SNAPSHOT_URL');
  var token = prop_('SNAPSHOT_TOKEN');
  if (!url || !token) throw new Error('Set SNAPSHOT_URL and SNAPSHOT_TOKEN in Script Properties (see README).');
  var resp = UrlFetchApp.fetch(url, { method: 'get', headers: { 'x-sheet-token': token }, muteHttpExceptions: true });
  var code = resp.getResponseCode();
  if (code === 401) throw new Error('The website refused the token (401). Check SNAPSHOT_TOKEN matches SHEET_SYNC_TOKEN.');
  if (code !== 200) throw new Error('The website answered ' + code + '.');
  var snap;
  try { snap = JSON.parse(resp.getContentText()); } catch (e) { throw new Error('The website answer was not JSON.'); }
  if (!snap || snap.scope !== 'wedding' || snap.share !== 'pranjal' || !snap.wedding || typeof snap.wedding.total !== 'number') {
    throw new Error('Unexpected snapshot shape; nothing written.');
  }
  var age = (Date.now() - new Date(snap.generated_at).getTime()) / 60000;
  if (!(age >= -2 && age <= MAX_AGE_MINUTES)) throw new Error('Snapshot is stale or has a bad timestamp; nothing written.');
  return snap;
}

/**
 * Turns the snapshot into the list of typed-cell targets and a list of things it could not map.
 * Targets: {key: 'Sheet!A1', label, value}. Logs: [item, website value, sheet value/reason].
 */
function buildPlan_(snap, ss) {
  var targets = [];
  var logs = [];
  var add = function (key, label, value) { targets.push({ key: key, label: label, value: value }); };

  add('Day-wise budget!D80', 'Website wedding total (typed for tie-out)', snap.wedding.total);

  // ---- Shri Kanth lines
  var skLines = (snap.vendors && snap.vendors.shri_kanth) || [];
  skLines.forEach(function (l) {
    var item = String(l.item || '');
    if (/: rooms$/i.test(item)) {
      if (l.rate != null) add('Workings!B5', 'Shri Kanth room rate', l.rate);
    } else if (/extra beds/i.test(item)) {
      if (l.rate != null) add('Workings!B6', 'Shri Kanth extra bed rate', l.rate);
    } else if (/^12 Feb/.test(item) && l.unit === 'people') {
      if (l.quantity != null) add('Workings!B33', 'Shri Kanth 12 Feb dinner headcount', l.quantity);
      if (l.rate != null) add('Workings!B11', 'Shri Kanth dinner rate', l.rate);
    } else if (/^13 Feb/.test(item) && l.unit === 'people') {
      if (l.quantity != null) add('Workings!B34', 'Shri Kanth 13 Feb meals headcount', l.quantity);
    } else if (/^16 Feb/.test(item) && l.unit === 'people') {
      if (l.quantity != null) add('Workings!B35', 'Shri Kanth 16 Feb meals headcount', l.quantity);
    } else {
      logs.push(['Shri Kanth line with no row in the sheet: ' + item, l.amount, '']);
    }
  });

  // ---- Hotel Sai lines
  var hsLines = (snap.vendors && snap.vendors.hotel_sai) || [];
  hsLines.forEach(function (l) {
    var item = String(l.item || '');
    if (l.unit === 'room-nights') {
      if (l.rate != null) add('Workings!B12', 'Hotel Sai room rate', l.rate);
      var note = String(l.note || '');
      var gst = /GST\s+(\d+(?:\.\d+)?)\s*%/i.exec(note);
      var bf = /Breakfast\s+₹\s*([\d,]+)\s+a person,\s*(\d+)\s+a room/i.exec(note);
      if (gst) add('Workings!B23', 'Hotel Sai GST', parseFloat(gst[1]) / 100);
      else logs.push(['Hotel Sai GST not found in the website note', '', '']);
      if (bf) {
        add('Workings!B13', 'Hotel Sai breakfast rate', parseFloat(bf[1].replace(/,/g, '')));
        add('Workings!B14', 'Hotel Sai people per room', parseInt(bf[2], 10));
      } else {
        logs.push(['Hotel Sai breakfast rate and people per room not found in the website note', '', '']);
      }
    } else {
      logs.push(['Hotel Sai line with no row in the sheet: ' + item, l.amount, '']);
    }
  });

  // ---- Rooms by night (Shri Kanth in B, Hotel Sai Pranjal's side in C). A night the website has no row for is 0.
  var rooms = { B: {}, C: {} };
  Object.keys(NIGHT_ROW).forEach(function (n) { rooms.B[n] = 0; rooms.C[n] = 0; });
  [['B', 'shri_kanth', 'Shri Kanth'], ['C', 'hotel_sai', 'Hotel Sai']].forEach(function (s) {
    ((snap.stay_nights && snap.stay_nights[s[1]]) || []).forEach(function (n) {
      if (NIGHT_ROW[n.night]) rooms[s[0]][n.night] = n.rooms;
      else logs.push([s[2] + ' rooms on ' + n.night + ' (no row in the sheet)', n.rooms, '']);
    });
  });
  Object.keys(NIGHT_ROW).forEach(function (n) {
    var r = NIGHT_ROW[n];
    add('Workings!B' + r, 'Shri Kanth rooms ' + n, rooms.B[n]);
    add('Workings!C' + r, 'Hotel Sai (mine) rooms ' + n, rooms.C[n]);
  });
  return { targets: targets, logs: logs };
}

/** Returns {current} or {error}. Refuses anything not on the whitelist, moved, merged, or holding a formula. */
function checkTarget_(ss, t) {
  var guard = LABEL_GUARDS[t.key];
  if (!guard) return { error: 'not an allowed input cell' };
  var p = splitKey_(t.key);
  var sheet = ss.getSheetByName(p.sheet);
  if (!sheet) return { error: 'tab "' + p.sheet + '" not found' };
  if (/^E\d+$/.test(p.a1)) return { error: 'Proposed column is never written' };
  var cell = sheet.getRange(p.a1);
  if (cell.getFormula()) return { error: 'cell holds a formula, left alone' };
  var label = String(sheet.getRange(cell.getRow(), guard.col).getDisplayValue());
  if (!guard.re.test(label)) return { error: 'row label is now "' + label + '", not what was expected; left alone' };
  return { current: cell.getValue() };
}

/** Compares website quantities with what the sheet's own formulas now say, and reports differences. */
function crossChecks_(snap, ss) {
  var logs = [];
  var w = ss.getSheetByName(WORKINGS);
  var d = ss.getSheetByName(DAY_SHEET);
  if (!w || !d) return logs;
  var sk = (snap.vendors && snap.vendors.shri_kanth) || [];
  var hs = (snap.vendors && snap.vendors.hotel_sai) || [];
  var skRoomNights = w.getRange('B30').getValue();
  var hsRoomNights = w.getRange('E30').getValue();
  var bedsPerRoom = w.getRange('B7').getValue();

  sk.forEach(function (l) {
    if (/: rooms$/i.test(l.item) && l.quantity != null && Math.abs(l.quantity - num_(skRoomNights)) > EPS)
      logs.push(['Shri Kanth room-nights', l.quantity, skRoomNights]);
    if (/extra beds/i.test(l.item) && l.quantity != null && Math.abs(l.quantity - num_(skRoomNights) * num_(bedsPerRoom)) > EPS)
      logs.push(['Shri Kanth extra bed-nights', l.quantity, num_(skRoomNights) * num_(bedsPerRoom)]);
    if (/: rooms$/i.test(l.item) && l.adjustment != null) {
      var adv = w.getRange('B51').getValue();
      if (Math.abs(-l.adjustment - num_(adv)) > EPS) logs.push(['Shri Kanth advance paid', -l.adjustment, adv]);
    }
  });
  hs.forEach(function (l) {
    if (l.unit === 'room-nights' && l.quantity != null && Math.abs(l.quantity - num_(hsRoomNights)) > EPS)
      logs.push(['Hotel Sai room-nights (both sides)', l.quantity, hsRoomNights]);
  });

  // Tie-out: sheet total D74 against the typed website total in D80.
  var total = num_(d.getRange('D74').getValue());
  if (Math.abs(total - snap.wedding.total) > EPS) logs.push(['Sheet total (D74) differs from the website wedding total', snap.wedding.total, total]);
  return logs;
}

// ---------------------------------------------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------------------------------------------

/** Appends rows to "Sync log" (creates the tab if missing). The same item/values are not logged twice in a row. */
function appendLogs_(ss, logs) {
  if (!logs.length) return;
  var sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(['Timestamp', 'Item', 'Website value', 'Sheet value']);
    sh.setFrozenRows(1);
  }
  var last = sh.getLastRow();
  var seen = {};
  if (last > 1) {
    sh.getRange(Math.max(2, last - 199), 2, Math.min(200, last - 1), 3).getValues().forEach(function (r) {
      seen[r.join('|')] = true;
    });
  }
  var now = new Date();
  logs.forEach(function (l) {
    var key = [l[0], l[1], l[2]].join('|');
    if (seen[key]) return; // already reported and nothing has changed since
    seen[key] = true;
    sh.appendRow([now, l[0], l[1], l[2]]);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

function prop_(name) { return PropertiesService.getScriptProperties().getProperty(name); }
function num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function splitKey_(key) { var i = key.lastIndexOf('!'); return { sheet: key.slice(0, i), a1: key.slice(i + 1) }; }
function toast_(m) { SpreadsheetApp.getActiveSpreadsheet().toast(m, 'Budget sync', 6); }

function alertResult_(res) {
  var lines = [res.message];
  res.writes.slice(0, 15).forEach(function (w) { lines.push((res.dryRun ? 'Would set ' : 'Set ') + w.label + ': ' + w.from + ' -> ' + w.to); });
  if (res.writes.length > 15) lines.push('... and ' + (res.writes.length - 15) + ' more');
  res.logs.slice(0, 10).forEach(function (l) { lines.push('Log: ' + l[0] + ' (website ' + l[1] + ', sheet ' + l[2] + ')'); });
  SpreadsheetApp.getUi().alert('Budget sync', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

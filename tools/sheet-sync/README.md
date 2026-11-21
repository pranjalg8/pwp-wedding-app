# Sheet sync: keeps "Wedding budget by day" in step with the planner

A Google Apps Script inside the sheet pulls a read-only snapshot from a Supabase edge function every 30 minutes and
types the website's numbers into the sheet's **input cells**. Nothing is pushed from the website, and no Google
credentials are stored anywhere except the sheet itself.

```
Apps Script (every 30 min, or menu "Refresh now")
   └─ GET sheet-snapshot  with header x-sheet-token  ──►  edge function (service role, read-only)
                                                          wedding group only, Pranjal's share only
```

**Scope: the wedding budget only.** Gold (jewellery), post-wedding (honeymoon, new home) and the contingency buffer are
never sent to the sheet. Every figure is Pranjal's share: amount minus min(Paridhi's amount, amount).

## What it writes (and nothing else)

| Cell | Value |
|---|---|
| `Day-wise budget!D80` | the website's wedding total (paid + pending), typed. `E80` then says OK or the difference against `D74` |
| `Workings!B5`, `B6` | Shri Kanth room rate, extra bed rate |
| `Workings!B11` | Shri Kanth dinner rate (from the 12 Feb dinner line) |
| `Workings!B12`, `B13`, `B14` | Hotel Sai room rate, breakfast rate, people per room |
| `Workings!B23` | Hotel Sai GST (read from the Hotel Sai balance line's note: "GST 5%") |
| `Workings!B25:C29` | rooms per night, 12 to 16 Feb: Shri Kanth (B) and Hotel Sai, Pranjal's side (C). A night the website has no row for is 0 |
| `Workings!B33:B35` | Shri Kanth meal headcounts for 12, 13 and 16 Feb |

It never touches the **Proposed** column, any formula cell, the Hotel Sai rooms for Paridhi's side (`D25:D29`, the
website does not hold them), the meal rates `B9:B10` (the website keeps breakfast and lunch inside one rate), the
photographer and outfit inputs (the website has no separate lines to read), the Hotel Sai token (`B44`) or the Shri
Kanth advance (`B51`; these two are only compared and reported). It never inserts, deletes or edits rows.

Safety checks before every single write: the cell must be on the allow-list, must not hold a formula, and its row
label must still read as expected (if rows are moved the write is skipped and logged). A snapshot that is stale
(over 15 minutes old), is not scope `wedding`, or has the wrong shape writes nothing.

### The "Sync log" tab

When the website has something the sheet has no row for (a new Shri Kanth line, a night outside 12 to 16 Feb), or a
figure the sheet's own formulas disagree with (room-nights, extra bed-nights, the advance, the sheet total `D74` vs
the website total), the script appends a row: **timestamp, item, website value, sheet value**. It does not edit the
sheet to match. The same item with the same values is not logged twice in a row. The tab is created on first use.

### Dry run

*Budget sync > Dry run* shows what would change and writes nothing, not even the log. For the timer, add a Script
Property `DRY_RUN` = `true` and it only reports (see *Executions* in the Apps Script editor for the output).

## One-time setup (about 10 minutes)

These steps need you (they involve secrets and Google permissions); the code does not do them for you.

1. **Make a token** (keep it out of chat and git):
   ```bash
   openssl rand -hex 32
   ```
2. **Set it as the edge function secret** (Supabase dashboard > Edge Functions > Secrets, or the CLI):
   ```bash
   supabase secrets set SHEET_SYNC_TOKEN=<the token> --project-ref qutawbofxpcqxkxrzebv
   ```
3. **Deploy the function.** It has its own token check, and Apps Script has no Supabase login, so JWT checking is
   turned off for this one function:
   ```bash
   supabase functions deploy sheet-snapshot --no-verify-jwt --project-ref qutawbofxpcqxkxrzebv
   ```
   Check it: no token must answer 401, and the right token must answer JSON.
   ```bash
   curl -i https://qutawbofxpcqxkxrzebv.supabase.co/functions/v1/sheet-snapshot
   curl -s -H "x-sheet-token: $TOKEN" https://qutawbofxpcqxkxrzebv.supabase.co/functions/v1/sheet-snapshot
   ```
4. **Add the script to the sheet.** Open the sheet > *Extensions > Apps Script*. Replace the contents of `Code.gs` with
   [`Code.gs`](./Code.gs) from this folder and save.
5. **Script Properties** (Apps Script > *Project Settings* (gear) > *Script properties* > *Add script property*):
   - `SNAPSHOT_URL` = `https://qutawbofxpcqxkxrzebv.supabase.co/functions/v1/sheet-snapshot`
   - `SNAPSHOT_TOKEN` = the same token as step 1
6. **Approve permissions.** In the editor pick `onOpen` in the function dropdown and press *Run*. Google asks to
   authorise: it needs this spreadsheet (read and write) and "connect to an external service" (the function URL). Click
   *Review permissions*, choose your account, and *Advanced > Go to project (unsafe)* then *Allow* (it is your own
   script; Google shows that warning for every unpublished script).
7. **Try it.** Back in the sheet, reload. A **Budget sync** menu appears. Run *Dry run* first and read the list, then
   *Refresh now*.
8. **Start the timer.** *Budget sync > Install 30-minute timer* (or Apps Script > *Triggers* > *Add trigger* >
   `scheduledSync`, time-driven, every 30 minutes).

`onOpen` only builds the menu: Google does not let that trigger call outside services, so the data refresh is the
timer and the menu item, not opening the file.

### Rotating the token

Make a new token (step 1), set the secret (step 2), then update `SNAPSHOT_TOKEN` (step 5). Until both match the sync
fails with "The website refused the token (401)" and writes nothing.

## The edge function

`supabase/functions/sheet-snapshot/` (`rules.ts` has the shaping and the token check, covered by
`web/src/lib/__tests__/sheetSnapshot.test.ts`).

- 401 unless `x-sheet-token` matches `SHEET_SYNC_TOKEN` (constant-time comparison; a missing secret never matches).
- Reads only, with the service role inside the function. Returns: wedding-group total, paid and pending (ledger
  entries counted once; cancelled lines and lines tracked outside the budget are left out); per-vendor lines for Shri
  Kanth Hotel and Hotel Sai, Bawal (quantity, unit, rate, fixed adjustment, amount, Paridhi's amount, Pranjal's
  amount, due date, note); `stay_nights` for the two hotels; the wedding's `total_budget` and Pranjal's funds
  figures; and `generated_at`. No guest, contact or login data is read, and no CORS headers are sent.

## Troubleshooting

- **"Set SNAPSHOT_URL and SNAPSHOT_TOKEN"**: step 5.
- **401**: the two tokens differ (watch for a trailing space).
- **A cell was skipped with "row label is now ..."**: someone moved rows on the sheet. Either move them back or update
  `LABEL_GUARDS` in `Code.gs`.
- **"Differs by ..." in E80** after a sync: the website total moved in a way the inputs cannot explain (a new line,
  say). The Sync log says which item; fix the sheet row by hand.

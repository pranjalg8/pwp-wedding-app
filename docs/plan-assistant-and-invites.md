# Plan: quote reader, WhatsApp send links, a smarter Ask (Nov 2026)

Origin: a review of wedd.ai's public marketing page (it is closed source; nothing was copied or taken apart). We keep our own design and our own rules. Everything below is free-tier only.

## Ground rules (apply to every phase)
- **Nothing writes money or tasks directly from AI.** Proposals go into the existing Suggestions inbox (migration 0012); a person accepts. That keeps the audit trail (who approved, which device).
- **Budget rules hold:** Royal Pepper is out of scope; package inclusions are not added as our own rows; new-home costs split 1:2; photography 50/50.
- **Privacy:** guest names, phone numbers and emails never go to Gemini. Quotes may contain bank details: the extractor is told to ignore them and they are never stored. Free-tier Gemini may use prompts for product improvement, so each upload asks first.
- **Never auto-send WhatsApp.** We build tap-to-send links; a person presses send. No Business API, no ban risk, no cost.
- One PR per slice, each with a release note (`releases.json`), tests, and a visual check in the browser pane.

## Phase 0: housekeeping (today)
- Merge PR #79 (Ask panel polish). Check the deployed Ask panel signed in.

## Phase 1: quote and contract reader (about 2 days, 3 PRs)
Goal: photograph or upload a vendor quote or contract; get proposed payment rows and tasks to review.

1. **Schema + storage (migration 0050).**
   - Private storage bucket `documents`, read/write only for `is_allowed_user()`. Size cap 10 MB; images and PDF only.
   - `documents` table: id, storage path, file name, topic_id (optional), uploaded_by, status (`uploaded|read|failed`), summary, created_at. Audit trigger like other tables.
   - Widen `suggestions.kind` to add `new_payment` and `new_task`; extend `accept_suggestion` to insert into `payment_schedule` (payee, amount, due_date, topic_id, note, is_estimate, paridhi_amount) or `tasks`. `involves_money = true` for payments. Add `document_id` to suggestions so every proposal links back to its source file.
   - Proof: run the accept function inside a rolled-back transaction before merge.
2. **Edge function `doc-extract`.**
   - Caller's JWT, reads the file through storage RLS, sends it to Gemini as inline data with a JSON response schema (vendor, line items, amounts, due dates, advance and balance, cancellation terms, validity).
   - Prompt carries the topic list and the budget rules above, and tells the model to flag inclusions that overlap an existing package.
   - Validates and normalises the output (numbers, ISO dates, known topics only), drops anything malformed, de-duplicates against existing rows (same payee, amount and date), inserts `suggestions` rows with a rationale that quotes the line it came from, plus one "contract terms" planner note.
   - Rate limit per user; clear errors (`not_configured`, `too_big`, `unreadable`).
3. **UI.**
   - "Add a quote" on Budget and a paperclip in the Ask panel; on phones it opens the camera.
   - Consent line, upload progress, then "3 suggestions ready, review" linking to Activity, Suggestions.
   - Suggestions page renders the two new kinds with the editable-override fields it already has, and a link to the source file.
- Done when: a real quote photo produces correct proposals, accepting one lands a `payment_schedule` row with the right split, rejecting leaves nothing behind.

## Phase 2: WhatsApp send links (about 1 day)
Depends on: the invite site going live (it is built locally, not published).
- Message templates (English, Hindi, Hinglish) for invite and reminder, filled with the household's personal link code (`invite_codes`).
- Guests page "Send queue": households with a phone number, one tap opens `wa.me` with the message filled in (uses `whatsappUrl`), then marks it sent in a new `invite_sends` log (household, template, sent_at, by). Reminder queue = invited households with no reply in `invite_responses`.
- Reply review already exists (PR #75); this just feeds it.
- Done when: sending to 5 households logs 5 sends and the reminder queue shrinks as replies arrive.

## Phase 3: Ask that can help, not just read (about 1.5 days)
- Give the planner digest to Ask alongside the Knowledge pages: open tasks and due dates, next payments, RSVP counts per day (aggregates only, no names).
- Add propose-only tools to `kb-chat` (Gemini function calling): `propose_task`, `propose_payment`, `propose_note`. They write Suggestions, never planner tables. The panel shows "Proposed: ... Review".
- Questions it should answer: "what is due this week", "how many rooms for 14 Feb", "add: confirm the dhol wala by Friday".
- Done when: a proposed task appears in Suggestions with the chat as its source and nothing changes until accepted.

## Phase 4: payment reminders (about 1 day)
- Home gets a "Due soon" card (next 14 days, unpaid, from `payment_schedule`).
- Daily job (pg_cron on Supabase) queues `notification_outbox` rows 7, 2 and 0 days before a payment; delivery uses the existing email path. Check first that the SNS email path is actually configured (docs/aws-notifications-setup.md).

## Phase 5: wedding-week tools (about 2 days)
- **Transport board:** aggregate the arrival and travel details already in invite replies into arrivals per day and time, with a vehicle estimate.
- **Check-in mode:** per function, a household list to tick as arrived; works with poor signal (queue writes and sync).
- **Photos:** a QR page that points to one shared Google Photos or Drive album. No face recognition.

## Not doing
Aadhaar and passport collection (sensitive, little value), face-recognition gallery (privacy and cost), logo, hashtag and muhurat tools, multi-wedding dashboards.

## Order and effort
Phase 0, then 1, 2, 3, 4, 5. About 7.5 working days in total, in 10 to 12 small PRs. Phase 1 is the biggest win and is independent of the others.

## Decisions needed from Pranjal
1. Is the invite site going live soon? (Phase 2 waits on it.)
2. Are you comfortable with quote photos going to Gemini's free tier, with an ask-first prompt on each upload?
3. Do emails to you and Paridhi via the notification path work today? (Phase 4.)
4. Anything to add or drop, or a different order?

## Risks
- Gemini free-tier limits: queue and show "try again" rather than failing silently; the keyword-search fallback pattern from Ask applies here too.
- Wrong extraction: mitigated by review-before-accept, overrides, and quoting the source line.
- Storage: 1 GB free; 10 MB cap and a periodic look at usage.
- Merge conflicts: migration numbers must stay unique (0044 and 0045 both exist twice already; check before each new one).

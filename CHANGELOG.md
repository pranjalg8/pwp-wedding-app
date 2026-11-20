# What's new

Every version of the planner, newest first. This file is generated from `web/src/data/releases.json`; edit that file and run `npm run changelog`. The same list shows in the app under Activity, What's new.

## 1.14 - 2026-11-21: Quote reader

**New**

- Add a quote: on Budget (and in the Ask panel) photograph or upload a vendor quote or contract. Claude reads it and proposes payments, tasks and a note of the terms in Suggestions. Nothing is added until you accept; bank details are ignored and never saved, and each upload asks before it goes to Gemini. Payments with no due date in the document are left out until you add them.

**Improved**

- Suggestions now show proposed payments and tasks, with Edit and accept, and a link to the source file.

## 1.13 - 2026-11-20: A reviewer for the budget

**New**

- Budget review: a panel at the top of Budget checks the numbers every time the page loads and every night. It looks for sums that do not add up (quantity times rate), Paridhi's share that does not follow the amount or the split in the note, notes that state a different total, payments missing from or counted twice in the ledger, hotel nights that differ from the room plan, overdue or too-early due dates, headers over budget, rough figures not marked as estimates, GST not stated, and page totals that differ from the database.
- Each finding comes as a short question (written by the same Gemini set-up as the chatbot, once it is switched on). Fix opens the normal editor; It is right and Dismiss remember your answer; all three ask for the PIN. The reviewer never changes a figure itself.

## 1.12 - 2026-11-20: A guided tour and a timeline

**New**

- Guided tour: twelve short stops that open each page in the order work flows, from deciding in Tasks to paying in Budget and sharing a link. It is offered once on each device, and you can take it again from the menu or from Home.
- Timeline on Home: every dated task, payment and function up to the honeymoon, by month, with overdue items on top. Switch between Planning (tasks) and Executing (payments, functions, the trip), and tap any line to open it where it is handled. Payments due on the same day are grouped into one line.

## 1.12 - 2026-11-19: Gift wishlist

**New**

- Gift wishlist: collect what we need for the new home. Paste a link from Amazon, Flipkart or any shop and the name, picture and price are filled in where the shop allows it, or add a picture and a price range by hand.
- A page for friends (no login) that shows the list by room and budget. A friend taps "I'll gift this" and types their name so nobody buys the same thing; the page only says an item is taken, and you see who took what in the planner. It stays closed until you switch it on.

## 1.11 - 2026-11-18: Easier on the phone, faster everywhere

**New**

- Phone: a tab bar at the bottom for Home, Tasks, Guests and Budget, with More for everything else, and a lock button in the header to unlock editing.

**Improved**

- Add and edit buttons now show even when locked. Tapping one asks for the PIN, then carries on. The PIN box is ready to type in and checks itself after the fourth digit.
- Forms: Enter saves, they fill the screen on a phone with Save always in reach, a tap outside no longer throws away what you typed, and a short message confirms each save. Payments put the amount first, default to today, and offer UPI, bank transfer, card or cash.
- Deleting something asks in the app's own dialog instead of a browser pop-up.
- Share links: bigger plus and minus buttons for RSVP counts, a clear Saved message, and tap-to-call contacts.
- Pages show a placeholder while they load instead of an empty list, a Retry button if loading fails, and friendlier messages when there is nothing yet.
- A new look for sign-in, page titles and the countdown, and dark mode fixes.
- Faster: pages load on demand, live updates are batched, and the database answers common questions with less work.

**Fixed**

- After an update the app offers a Reload instead of showing a blank page, and live updates no longer get lost when you switch pages quickly.

## 1.10 - 2026-11-17: Ask panel, tidier

**Improved**

- Ask: starter questions that match the page you are on, page links under each answer that open that Knowledge page, Copy and Try AI again buttons, a New chat button, and Ctrl/Cmd+K to open it. On a phone it slides up from the bottom, and the chat is remembered until you close the tab.

## 1.9 - 2026-11-17: Ask the knowledge base

**New**

- Ask button on every page: type a question about the wedding and get a short answer from the Knowledge page, with the page named. Until AI answers are switched on it shows the matching lines instead.

## 1.8 - 2026-11-14: Guest contacts

**New**

- Guests: each household shows its saved phone numbers and emails under Contacts, with tap-to-call and tap-to-email. Search also finds a household by number, email or person.

## 1.7 - 2026-11-12: Knowledge base

**New**

- Knowledge page: a short reference for the wedding (dates, stay and food, money rules, the home move) with search, kept in step with the planner.

## 1.6 - 2026-10-09: Function decks, results and this log

**New**

- Swipe decks for every function: Haldi, wedding-day colours and outfits, mandap, entry and varmala decor, gifts, photography and video, and Sangeet dance.
- Functions, Results: for every function, where you both said yes, where you disagree and what is still waiting.
- Activity, What's new: this log of every version, with a badge when there is something you have not seen.

**Improved**

- The Swipe page uses a deck dropdown when there are many decks.

## 1.5 - 2026-10-09: Money, functions and installing

**New**

- Payments ledger on the Budget page: each payment with its receipt reference, a Receipt checked or Not verified badge, and a warning if the totals ever disagree with the planner.
- Functions page: Tilak, Mehndi, Sagai, Sangeet, Haldi and the wedding day, by date and half of the day, with theme and colours.
- Sangeet and Mehndi swipe decks (colours, combinations and outfit styles).
- Daily due-date reminders are queued for each person's items. Emails stay off until the email setup is finished.
- Install the planner on your phone from the browser (Add to Home Screen).
- Task-based planner: tasks with options and details, linked to the messages behind them.
- Guest page you can share through expiring links.

## 1.4 - 2026-10-08: Shared dates, owners and vendors

**New**

- Owners and due dates on items, with one shared list called Our due items.

**Improved**

- Shared dates and values live in one place, so every page and the chat reader see the same thing.
- Vendors are cards grouped by area, with call, email and a WhatsApp chat link.

## 1.3 - 2026-10-07: Checks and notifications groundwork

**New**

- Notification queue: finished swipe decks and weekly reminders are lined up for each person. Nothing is emailed yet.

**Improved**

- A grounding audit checks every amount against the chat messages it came from.

## 1.2 - 2026-10-05: Suggestions inbox

**New**

- Activity, Suggestions: chat messages and bill images become proposed changes, and nothing is applied until one of you accepts it.

## 1.1 - 2026-10-04: Swipe cards and honeymoon planning

**New**

- Swipe cards: yes or no on options, with real photos, facts and links, and a Results tab for where you agree.
- Honeymoon Getting there page with route options and timelines.

**Improved**

- The honeymoon page follows the route you chose and the 4 lakh budget.
- Every number shows where it came from and when.
- The activity log records who changed what and from which device, and save errors are visible.
- Database access is limited to the two signed-in accounts.

## 1.0 - 2026-10-03: First version

**New**

- A planner by area, with decisions, to-dos, vendors and budget lines.
- Countdown home page and a warm design that works on a phone.
- Budget page that adds up money across every area.
- Vendors page with contact details.
- Device nickname, so the activity log says which device made a change.
- Changes appear live for both of you.

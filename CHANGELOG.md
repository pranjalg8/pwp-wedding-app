# What's new

Every version of the planner, newest first. This file is generated from `web/src/data/releases.json`; edit that file and run `npm run changelog`. The same list shows in the app under Activity, What's new.

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

# Planner roadmap

Updated 18 November 2026, after the second senior-engineer review. The wedding starts on 12 February 2027.

The order changed: safety and accuracy now come before new features, and the backup moved up from the final cleanup.

## Done

- **Phase 0, safety net:** share-link fixes, live updates, tests in CI.
- **Phase 1, stays with dates:** room stay dates, the room board as the only placement screen, invite replies.
- **Phase 2, part 1:** vendors, quantity × rate, lines outside the budget, ₹0 included lines.

## Now

| Step | What | Who |
| --- | --- | --- |
| 1 | Update the funds figure and decide how the budget gap closes | Pranjal |
| 2 | Rotate the service-role key (`docs/rotate-service-role-key.md`) | Pranjal |
| 3 | Nightly encrypted backup and one test restore (`docs/backup-and-restore.md`) | Claude builds, Pranjal adds two secrets |
| 4 | Type-check edge functions in CI and harden `invite-rsvp` | Claude |
| 5 | Renumber and merge the quote reader (PR #81, migration `0051`) | Quote reader session |

## Next: accuracy, before replies open

- Keep replied arrival and leaving dates on the household, so they apply whenever it is placed.
- Flag and release rooms held by households that no longer need one.
- Make Fill rooms respect room capacity and pair half-room households.
- Total vendor payments from the ledger.
- Let ₹0 and outside-budget lines be closed without a payment.
- Stop a part payment from being added back through quantity × rate.
- Show an error when the Budget or Rooms data fails to load.

## Then: go live with replies

1. Push the invite site to GitHub and merge `feature/rsvp-replies`.
2. Publish it with `rsvpEndpoint` set, and add its address in Guests > Replies.
3. Invite the remaining households, make the codes and send the links.
4. Open replies. Freeze the room plan by mid-December.

## December: money that follows the plan

- Hotel and meal lines that follow the rooms booked and the room board (done in migration `0053`).
- Staff and driver meals from `guests.kind` and a token count. This needs the number of staff, the days and the thali
  rate first.
- A shared way to load data with visible errors: done for Home, Tasks, Guests, Rooms, Budget, Functions, Vendors and
  Knowledge. Task details, Suggestions, Activity and the older dashboard still load the old way.

The Anvaya link is dropped from this phase: it adds risk and nothing depends on it before the wedding.

## January: one schedule

- Function times and venues, and a meals table for 12 to 16 February.
- The invite site's schedule built from the database.

## Last: housekeeping

- Drop `guest_invites` and `guest_stays`, delete merged remote branches and the retired `gemini-ping` function.
- Move older access rules to `is_allowed_user()`, clear the remaining lint warnings.
- Decide on the queued notifications and the auto-sync job.

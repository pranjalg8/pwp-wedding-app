# Planner roadmap

Updated 18 November 2026. The wedding starts on 12 February 2027.

The order changed: safety and accuracy now come before new features, and the backup moved up from the final cleanup.

## Done

- **Phase 0, safety net:** share-link fixes, live updates, tests in CI.
- **Phase 1, stays with dates:** room stay dates, the room board as the only placement screen, invite replies.
- **Accuracy fixes:** reply dates, rooms that are no longer needed, room sizes in Fill rooms, vendor totals.
- **Safety net:** nightly backup workflow, edge functions checked in CI, a harder reply function.
- **Phone and speed update (1.11):** tab bar, shared forms, lazy-loaded pages, faster database rules.

## Now

| Step | What | Who |
| --- | --- | --- |
| 1 | Update the funds figure and decide how the budget gap closes | Pranjal |
| 2 | Rotate the service-role key (`docs/rotate-service-role-key.md`) | Pranjal |
| 3 | Add the two backup secrets, run the backup once and try one restore (`docs/backup-and-restore.md`) | Pranjal |
| 4 | Update the quote reader (PR #81): resolve its conflicts and renumber its migration to `0051` | Quote reader session |

## Then: go live with replies

1. Push the invite site to GitHub and merge `feature/rsvp-replies`.
2. Publish it with `rsvpEndpoint` set, and add its address in Guests > Replies.
3. Invite the remaining households, make the codes and send the links.
4. Open replies. Freeze the room plan by mid-December.

## Phase 2: money that follows the plan

Done:

- Vendors, quantity × rate, lines outside the budget and ₹0 included lines.
- Vendor totals from the payments ledger, and part payments that keep the line's working correct.
- Hotel and meal lines that follow the rooms booked and the room board.
- Visible errors when data fails to load, on every main screen.

Still open:

- Staff and driver meals. This needs the number of people, the days and the thali rate.

The Anvaya link is dropped from this phase: it adds risk and nothing depends on it before the wedding.

## January: one schedule

- Function times and venues, and a meals table for 12 to 16 February.
- The invite site's schedule built from the database.

## Last: housekeeping

- Drop `guest_invites` and `guest_stays`, delete merged remote branches and the retired `gemini-ping` function.
- Move older access rules to `is_allowed_user()`, clear the remaining lint warnings.
- Decide on the queued notifications and the auto-sync job.

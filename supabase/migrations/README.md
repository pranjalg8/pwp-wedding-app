# Migrations

Files are applied in filename order. Early on, several migrations were written in parallel and share a number
(`0018`, `0019` and `0021` each appear twice). They are independent of each other, so the order inside a pair does
not matter, and they were already applied to the live database under their own timestamped versions. They are left
as they are rather than renamed, so the files still match the live migration history.

New migrations: take the next free number, one file per change, and keep each one additive where you can. Never
reuse a number, even one that looks free in the middle (`0051` is kept for the quote reader in PR #81; `0044` and `0018`
to `0021` are older pairs), and never edit a migration that has been applied: write a new one. The next number is `0068`.
Older tables no longer read or written by the app, safe to drop later: `guest_invites` (replaced by `guest_rsvps` in
`0030`) and the unused `status` and `persons_attending` columns it carried, and `guest_stays` (rooms per place,
replaced by the room board's `room_stays` in `0040`; empty since).

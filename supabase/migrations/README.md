# Migrations

Files are applied in filename order. Early on, several migrations were written in parallel and share a number
(`0018`, `0019` and `0021` each appear twice). They are independent of each other, so the order inside a pair does
not matter, and they were already applied to the live database under their own timestamped versions. They are left
as they are rather than renamed, so the files still match the live migration history.

New migrations: take the next free number, one file per change, and keep each one additive where you can.
Two older tables are no longer read or written by the app and are safe to drop later: `guest_invites` (replaced by
`guest_rsvps` in `0030`), and the unused `status` and `persons_attending` columns it carried.

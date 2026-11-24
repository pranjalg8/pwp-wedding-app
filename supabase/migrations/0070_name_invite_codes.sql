-- Invite codes made from the guest's name: the name people call them (up to 9 letters) and 3 digits, e.g. ASHA472.
-- Letters may now include I and O; digits stay 2-9, so there is still no 0/O or 1/I mix-up. The older random codes
-- (8 letters and digits without I, O, 0, 1) still match, so links already sent keep working.

alter table invite_codes drop constraint invite_codes_code_check;
alter table invite_codes add constraint invite_codes_code_check check (code ~ '^[A-Z2-9]{6,12}$');

-- Family-only functions: ceremonies for the family where no guest is invited (13 Feb). They show on Functions and
-- Home, but do not make a guest RSVP day, an invite option or a room night.
alter table wedding_functions add column if not exists family_only boolean not null default false;

-- 13 Feb, from the groom's notebook and Paridhi's notes (21-24 Oct 2026). Times are not fixed yet.
insert into wedding_functions (key, name, event_date, slot, sort_order, notes, status, family_only) values
  ('mehendi_bride', 'Mehendi (bride and her mother)', '2027-02-13', 'first_half', 1,
   'Daytime. Bride side. Time to be confirmed.', 'open', true),
  ('mandap_cheekat', 'Mandap, cheekat, mayan pooja, tel and kannar (groom side)', '2027-02-13', 'first_half', 2,
   'Groom side: mandap gada, cheekat (gift by mama, teeka by mummy), mayan pooja (about 30 min), tel chadhna with the groom, kannar with dhaga/kalava, kajal and mandir. Katha is cancelled. Time to be confirmed.', 'open', true),
  ('satyanarayan_matkor', 'Satyanarayana puja, Marwa matkor and haldi (bride side)', '2027-02-13', 'second_half', 3,
   'Evening. Bride side: a small mandap of mitti, haldi and tel; the ladies and the bride bring mitti from outside; haldi applied with durva. Time to be confirmed.', 'open', true);

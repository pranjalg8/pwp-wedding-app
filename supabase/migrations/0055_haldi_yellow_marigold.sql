-- Haldi is yellow and marigold, not pastel (Pranjal, 19 Nov). Reword the haldi theme and the three haldi cards
-- that said pastel. The matching colour swatches (haldi-lemon-pastel.svg, haldi-combo-pastel-pair.svg) are recoloured in the app.
update wedding_functions set theme = 'Yellow and marigold shades' where key = 'haldi';

update swipe_cards set
  title = 'Lemon and marigold',
  detail = 'Light lemon with a marigold-orange accent. Soft and warm, but marks show more. Haldi is messy, so pick outfits you do not mind staining.',
  facts = replace(facts::text, '#F8D9E0', '#F2A93B')::jsonb,
  links = replace(replace(links::text, 'lemon+yellow+pastel+haldi+outfit', 'lemon+yellow+marigold+haldi+outfit'), 'pastel', 'marigold')::jsonb
where id = 'a364cb13-1472-4c43-8007-3fb17b42f272';

update swipe_cards set
  title = 'Yellow and marigold pair',
  subtitle = 'Soft yellow with a marigold kurta',
  detail = 'Bride in soft lemon or yellow, groom in a marigold or mustard kurta. Warm and cheerful, and easy to keep in the haldi colours.'
where id = 'e487e0c8-6dd6-4504-a3d6-ceceaebcd291';

update swipe_cards set
  title = 'Marigold kurta and jacket',
  detail = 'A marigold or mustard kurta with an ivory or printed jacket. Dressier, and the jacket keeps it from being yellow-on-yellow.',
  links = replace(links::text, 'groom+pastel+kurta+jacket+haldi', 'groom+marigold+kurta+jacket+haldi')::jsonb
where id = '5e7b1175-f8c3-45a9-be3f-0c2625e8bc00';

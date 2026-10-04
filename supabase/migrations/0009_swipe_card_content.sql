-- Rich swipe cards: real photos (self-hosted, CC-licensed, credited), longer descriptions,
-- practical facts and links. Photos live in web/public/cards/ and are served by the app itself.

alter table swipe_cards
  add column if not exists image_credit text,
  add column if not exists image_source_url text,
  add column if not exists facts jsonb not null default '[]'::jsonb,
  add column if not exists links jsonb not null default '[]'::jsonb;

update swipe_cards sc set
  detail = $q$A villa with its own plunge or lap pool turns the whole stay into the activity: breakfast delivered, a swim before the day starts, nobody else around. Samui has a lot of these, from simple 1-bedroom pool villas to cliff-top ones with ocean views. For a 5-night honeymoon it is the single biggest upgrade over a normal hotel room.$q$,
  image_url = $q$cards/01.jpg$q$,
  image_credit = $q$Photo: ChrisWDD, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Koh_Samui_Luxury_Villa_Pool.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "Rs 12-20k a night (Feb is peak, expect more)"}, {"label": "Best areas", "value": "Choeng Mon, Bophut, Taling Ngam"}, {"label": "Look for", "value": "Private pool, breakfast included, airport transfer"}]$q$::jsonb,
  links = $q$[{"label": "Search pool villas for 20-25 Feb", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}, {"label": "Same dates on Booking.com", "url": "https://www.booking.com/searchresults.html?ss=Koh+Samui&checkin=2027-02-20&checkout=2027-02-25&group_adults=2&no_rooms=1"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Private pool villa$q$;

update swipe_cards sc set
  detail = $q$Choeng Mon and Bophut are calm, sheltered bays on the north-east coast, good for easy swims and sunrise walks. Both are close to the airport and to Fisherman's Village, so you spend little time in transfers. Chaweng and Lamai are livelier and busier if you want more going on.$q$,
  image_url = $q$cards/02.jpg$q$,
  image_credit = $q$Photo: Damian Moore, CC BY-SA 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Choeng_Mon_Beach,_Koh_Samui_(28034183446).jpg$q$,
  facts = $q$[{"label": "Vibe", "value": "Calm bay, sunrise side, quiet evenings"}, {"label": "Airport", "value": "About 10-20 minutes"}, {"label": "Nearby", "value": "Fisherman's Village, Big Buddha, Wat Plai Laem"}]$q$::jsonb,
  links = $q$[{"label": "Choeng Mon on the map", "url": "https://www.google.com/maps/search/?api=1&query=Choeng+Mon+Beach+Koh+Samui"}, {"label": "Bophut, map", "url": "https://www.google.com/maps/search/?api=1&query=Bophut+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Beachfront stay$q$;

update swipe_cards sc set
  detail = $q$The south-west and west coasts (Taling Ngam, Lipa Noi) are the quiet side of Samui. Villas sit up on the hills with long sea views, and this is where the island's best sunsets are. You will want a driver or a hired car, because it is far from the night markets.$q$,
  image_url = $q$cards/03.jpg$q$,
  image_credit = $q$Photo: Steve Jurvetson from Los Altos, USA, CC BY 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Koh_Samui_Sunset_(2158547784).jpg$q$,
  facts = $q$[{"label": "Best for", "value": "Privacy, big views, sunsets"}, {"label": "Trade-off", "value": "Needs a car or driver; further from restaurants"}, {"label": "Typical price", "value": "Rs 15-30k a night for views like this"}]$q$::jsonb,
  links = $q$[{"label": "Taling Ngam on the map", "url": "https://www.google.com/maps/search/?api=1&query=Taling+Ngam+Koh+Samui"}, {"label": "Villas with sea views, our dates", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Hillside sunset villa$q$;

update swipe_cards sc set
  detail = $q$Adults-only resorts keep things quiet: no kids' pool noise, fewer crowds at breakfast, a more couple-focused service. Several on Samui are well rated, including SAii Koh Samui Villas (about Rs 17k a night in our search, rated 4.7).$q$,
  image_url = $q$cards/04.jpg$q$,
  image_credit = $q$Photo: Jpatokal, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Sala_Choengmon_Pool_Villa.jpg$q$,
  facts = $q$[{"label": "Example", "value": "SAii Koh Samui Villas (adults 12+)"}, {"label": "Typical price", "value": "About Rs 17k a night"}, {"label": "Great for", "value": "Quiet pool time, spa, long dinners"}]$q$::jsonb,
  links = $q$[{"label": "Search adult-only stays, our dates", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}, {"label": "SAii Koh Samui Villas on the map", "url": "https://www.google.com/maps/search/?api=1&query=SAii+Koh+Samui+Villas"}, {"label": "Booking.com, same dates", "url": "https://www.booking.com/searchresults.html?ss=Koh+Samui&checkin=2027-02-20&checkout=2027-02-25&group_adults=2&no_rooms=1"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Adult-only resort$q$;

update swipe_cards sc set
  detail = $q$If this is the one trip to go big on, a 5-star villa resort changes the experience: private beach, in-villa dining, proper spa. Silavadee Pool Spa Resort came up around Rs 32k a night (rated 4.7), and flagship names like Vana Belle or W go much higher. Plan on the trip landing near Rs 3.5-4L with a splurge stay.$q$,
  image_url = $q$cards/05.jpg$q$,
  image_credit = $q$Photo: Sean McGrath from Saint John, NB, Canada, CC BY 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Alila_Infinity_Pool_(HDR)_(1365818884).jpg$q$,
  facts = $q$[{"label": "Example", "value": "Silavadee Pool Spa Resort, about Rs 32k a night"}, {"label": "Trip total", "value": "About Rs 3.5-4L with flights and extras"}, {"label": "Check", "value": "Feb prices run higher than our current search"}]$q$::jsonb,
  links = $q$[{"label": "Search luxury villas, our dates", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}, {"label": "Silavadee on the map", "url": "https://www.google.com/maps/search/?api=1&query=Silavadee+Pool+Spa+Resort+Koh+Samui"}, {"label": "Booking.com, same dates", "url": "https://www.booking.com/searchresults.html?ss=Koh+Samui&checkin=2027-02-20&checkout=2027-02-25&group_adults=2&no_rooms=1"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Luxury splurge$q$;

update swipe_cards sc set
  detail = $q$Samui has plenty of good 4-5 star villas for Rs 8-10k a night, like Pavilion Samui or Outrigger Koh Samui Beach Resort in our search. Keeping the room simple frees up budget for the spa, the Ang Thong trip, a driver, and the special dinner.$q$,
  image_url = $q$cards/06.jpg$q$,
  image_credit = $q$Photo: Ssuri, CC BY-SA 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Koh_Samui_Panoramic.jpg$q$,
  facts = $q$[{"label": "Examples", "value": "Pavilion Samui Villas, OUTRIGGER Koh Samui"}, {"label": "Typical price", "value": "Rs 8-10k a night"}, {"label": "Total trip", "value": "About Rs 2.3L with flights"}]$q$::jsonb,
  links = $q$[{"label": "Search mid-range stays, our dates", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}, {"label": "Booking.com, same dates", "url": "https://www.booking.com/searchresults.html?ss=Koh+Samui&checkin=2027-02-20&checkout=2027-02-25&group_adults=2&no_rooms=1"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Keep the stay modest$q$;

update swipe_cards sc set
  detail = $q$One base means no packing, no check-out mornings, and a rhythm: slow breakfast, pool, an outing, dinner. Samui is small enough (about an hour around) that a single location works for everything. Lamai and Chaweng are the longer beaches; Choeng Mon and Bophut are quieter.$q$,
  image_url = $q$cards/07.jpg$q$,
  image_credit = $q$Photo: Fabio Achilli from Milano, Italy, CC BY 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Lamai_Beach,_Koh_Samui_(48107316796).jpg$q$,
  facts = $q$[{"label": "Island size", "value": "About an hour around by road"}, {"label": "Benefit", "value": "No transfers, more downtime"}, {"label": "Pick a base near", "value": "The beach you want most"}]$q$::jsonb,
  links = $q$[{"label": "Lamai on Wikipedia", "url": "https://en.wikipedia.org/wiki/Lamai"}, {"label": "Chaweng, map", "url": "https://www.google.com/maps/search/?api=1&query=Chaweng+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Stay put all 5 nights$q$;

update swipe_cards sc set
  detail = $q$Thai massage and herbal-compress treatments are everywhere, from beachfront sala huts to resort spas with couple suites. A 60-90 minute side-by-side massage is the classic honeymoon afternoon. Resort spas cost more than village ones; village ones are good value.$q$,
  image_url = $q$cards/08.jpg$q$,
  image_credit = $q$Photo: Hartmann Linge, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:201304021320a_Hartmann_Massage.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "About Rs 2.5-8k each (Thai massage to resort package)"}, {"label": "Duration", "value": "60-120 minutes"}, {"label": "Tip", "value": "Book in advance for the same slot together"}]$q$::jsonb,
  links = $q$[{"label": "About Thai massage", "url": "https://en.wikipedia.org/wiki/Thai_massage"}, {"label": "Spas on Samui, map", "url": "https://www.google.com/maps/search/?api=1&query=couples+spa+Koh+Samui"}, {"label": "Search: Spa experiences", "url": "https://www.google.com/search?q=Koh+Samui+spa"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Couples spa$q$;

update swipe_cards sc set
  detail = $q$Many resorts set up a table on the sand: lanterns, a set menu or fresh seafood, waves in the background. It is usually a pre-booked add-on, often with a minimum spend. Do it on a night with clear weather, which is most of Feb.$q$,
  image_url = $q$cards/09.jpg$q$,
  image_credit = $q$Photo: alhafis, CC BY 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Sun_Set_Romantic_Dinner_-_panoramio.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "Rs 10-15k for two (varies by resort)"}, {"label": "Book", "value": "Ask your resort 1-2 days ahead"}, {"label": "Best night", "value": "Wednesday, our second-to-last evening"}]$q$::jsonb,
  links = $q$[{"label": "Beachfront restaurants, map", "url": "https://www.google.com/maps/search/?api=1&query=beachfront+restaurant+Koh+Samui"}, {"label": "Koh Samui dining guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}, {"label": "Search resorts, our dates", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Private candlelit beach dinner$q$;

update swipe_cards sc set
  detail = $q$Choeng Mon faces east, so the sun comes up over calm water with the small island visible offshore. Walk down early, it is quiet, and then go back for breakfast by the pool.$q$,
  image_url = $q$cards/10.jpg$q$,
  image_credit = $q$Photo: ::::=UT=::::, CC BY-SA 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Ban_Krud_Beach_Sunrise_-_panoramio.jpg$q$,
  facts = $q$[{"label": "Sunrise", "value": "Around 6:30 AM in late Feb"}, {"label": "Cost", "value": "Free"}, {"label": "Combine with", "value": "Breakfast at the villa, then a slow morning"}]$q$::jsonb,
  links = $q$[{"label": "Choeng Mon beach, map", "url": "https://www.google.com/maps/search/?api=1&query=Choeng+Mon+Beach+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Sunrise at Choeng Mon$q$;

update swipe_cards sc set
  detail = $q$A couple of hours on the water at dusk with drinks and a view of the island turning gold. Resorts and local operators run them around Samui and sometimes to the nearby islands. It is relaxed, not sporty.$q$,
  image_url = $q$cards/11.jpg$q$,
  image_credit = $q$Photo: Phuket@photographer.net, CC BY 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Sunset_at_sea_with_catamaran._Thailand_-_29026060483.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "Rs 5-9k each (check inclusions)"}, {"label": "Duration", "value": "About 2-3 hours"}, {"label": "Best for", "value": "Golden hour, photos"}]$q$::jsonb,
  links = $q$[{"label": "Search: Sunset cruises", "url": "https://www.google.com/search?q=Koh+Samui+sunset+cruise"}, {"label": "Marinas on the map", "url": "https://www.google.com/maps/search/?api=1&query=Koh+Samui+sunset+catamaran"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Sunset catamaran cruise$q$;

update swipe_cards sc set
  detail = $q$Plan one day with nothing in it: breakfast late, pool, book, nap, maybe a walk on the beach at dusk. After a wedding and a long flight this is often the day you will want most.$q$,
  image_url = $q$cards/12.jpg$q$,
  image_credit = $q$Photo: Caitriana Nicholson from 北京 ~ Beijing, 中国 ~ China, CC BY-SA 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Beach_at_Koh_Phi_Phi_(4463480595).jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Free"}, {"label": "Suggested slot", "value": "Day 2 or 3"}, {"label": "Pairs well with", "value": "A late lunch and a spa evening"}]$q$::jsonb,
  links = $q$[{"label": "Beaches on Samui", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}, {"label": "Lamai Beach, map", "url": "https://www.google.com/maps/search/?api=1&query=Lamai+Beach+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$A full do-nothing day$q$;

update swipe_cards sc set
  detail = $q$Local photographers do 1-2 hour couple sessions on the beach or in a garden, usually at sunset. Good keepsake photos from the trip, and they know the best spots. Booking ahead gives you the best slot.$q$,
  image_url = $q$cards/13.jpg$q$,
  image_credit = $q$Photo: Damian Moore, CC BY-SA 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Chaweng_Beach,_Koh_Samui_(27953535942).jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "Rs 8-20k depending on length and edits (check)"}, {"label": "Best light", "value": "Shortly before sunset"}, {"label": "Where", "value": "Beach, Fisherman's Village, hillside viewpoints"}]$q$::jsonb,
  links = $q$[{"label": "Search: Photographers", "url": "https://www.google.com/search?q=Koh+Samui+photo+shoot"}, {"label": "Chaweng Beach, map", "url": "https://www.google.com/maps/search/?api=1&query=Chaweng+Beach+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Photo shoot at golden hour$q$;

update swipe_cards sc set
  detail = $q$A national marine park of about 40 limestone islands north-west of Samui, with turquoise bays and a lookout over the Emerald Lake. Day trips run by speedboat or catamaran, usually 8-9 hours with lunch. Pick the views-and-beaches version and skip the kayaking.$q$,
  image_url = $q$cards/14.jpg$q$,
  image_credit = $q$Photo: Vyacheslav Argenberg, CC BY 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Mu_Ko_Ang_Thong,_Bay,_Thailand.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "About Rs 4-7k each (park fee often included)"}, {"label": "Duration", "value": "Full day, early start"}, {"label": "Feb conditions", "value": "Calm seas, dry season"}]$q$::jsonb,
  links = $q$[{"label": "Ang Thong on Wikipedia", "url": "https://en.wikipedia.org/wiki/Mu_Ko_Ang_Thong_National_Park"}, {"label": "Search: Ang Thong tours", "url": "https://www.google.com/search?q=Ang+Thong+Marine+Park+from+Koh+Samui"}, {"label": "Ang Thong on the map", "url": "https://www.google.com/maps/search/?api=1&query=Ang+Thong+National+Marine+Park"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Ang Thong Marine Park day trip$q$;

update swipe_cards sc set
  detail = $q$Big Buddha (Wat Phra Yai) is a golden seated Buddha about 12 metres tall on a small islet joined to the north coast by a causeway, with views over the bay. Nearby Wat Plai Laem has an 18-armed Guanyin statue beside a lake. Both are short stops; dress modestly (shoulders and knees covered).$q$,
  image_url = $q$cards/15.jpg$q$,
  image_credit = $q$Photo: Maksim Sundukov, CC BY-SA 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Big_Buddha_in_Big_Buddha_Temple_(Wat_Phra_Yai).jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Free to visit"}, {"label": "Time needed", "value": "About 1-2 hours together"}, {"label": "Dress code", "value": "Covered shoulders and knees"}]$q$::jsonb,
  links = $q$[{"label": "Big Buddha on Wikipedia", "url": "https://en.wikipedia.org/wiki/Wat_Phra_Yai"}, {"label": "Wat Plai Laem on Wikipedia", "url": "https://en.wikipedia.org/wiki/Wat_Plai_Laem"}, {"label": "Both on the map", "url": "https://www.google.com/maps/search/?api=1&query=Wat+Plai+Laem+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Big Buddha and Wat Plai Laem$q$;

update swipe_cards sc set
  detail = $q$A hand-built garden in the hills inland, filled with stone statues, set among trees and rocks. It was built by a local farmer and is a real pocket of quirky art, great for photos. There is a short drive up and a small entry fee, so go with a driver.$q$,
  image_url = $q$cards/16.jpg$q$,
  image_credit = $q$Photo: Roma Neus, CC BY 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Samui_2013_May_-_panoramio_(97).jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Small entry fee"}, {"label": "Time needed", "value": "About 1-2 hours"}, {"label": "Best with", "value": "A driver for the day"}]$q$::jsonb,
  links = $q$[{"label": "Secret Buddha Garden, map", "url": "https://www.google.com/maps/search/?api=1&query=Secret+Buddha+Garden+Koh+Samui"}, {"label": "Search: Tours", "url": "https://www.google.com/search?q=Secret+Buddha+Garden+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Secret Buddha Garden$q$;

update swipe_cards sc set
  detail = $q$Bring a small sketchbook and a watercolour set, and pick a view: the bay at Bophut, the Choeng Mon beach at sunrise, the temples. Keep the phones in the bag for an hour. If you want a guided session, ask your resort or look for a watercolour or batik workshop.$q$,
  image_url = $q$cards/17.jpg$q$,
  image_credit = $q$Photo: Paul Mollomo Jr. Sally Wickham Mollomo, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Courtyard_of_Lions,_Alhambra,_Spain,_watercolor_by_Sally_Wickham_Mollomo.jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Supplies about Rs 1-2k; classes extra"}, {"label": "Best spots", "value": "Choeng Mon bay, Fisherman's Village, Wat Plai Laem"}, {"label": "Tip", "value": "Pack a travel watercolour set before you leave"}]$q$::jsonb,
  links = $q$[{"label": "Search: art classes in Koh Samui", "url": "https://www.google.com/search?q=Koh+Samui+art+class"}, {"label": "Fisherman's Village, map", "url": "https://www.google.com/maps/search/?api=1&query=Fisherman%27s+Village+Bophut+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Sketch or paint together$q$;

update swipe_cards sc set
  detail = $q$A car with a driver for a day lets you stack three or four stops without arranging taxis: Big Buddha, Wat Plai Laem, the Secret Buddha Garden, a waterfall, a sunset on the west coast. It is more comfortable than a scooter and easy to arrange through your resort.$q$,
  image_url = $q$cards/18.jpg$q$,
  image_credit = $q$Photo: Chi King, CC BY 2.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Koh_Samui_(THAILAND-LANDSCAPE)_(4567666381).jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "About Rs 7-9k for the day"}, {"label": "Good day", "value": "Day 2, the sightseeing day"}, {"label": "Ask for", "value": "English-speaking driver, flexible route"}]$q$::jsonb,
  links = $q$[{"label": "Search: Private driver", "url": "https://www.google.com/search?q=Koh+Samui+private+tour+driver"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Hire a driver for a day$q$;

update swipe_cards sc set
  detail = $q$Na Muang Falls is the best known on the island, with a pool at the bottom and a second, taller waterfall up the path. In Feb (dry season) the flow is lighter, but it is still pretty and cool in the shade. Easy to fit into a driver day.$q$,
  image_url = $q$cards/19.jpg$q$,
  image_credit = $q$Photo: Maksim Sundukov, CC BY-SA 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Namuang_Waterfall.jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Free or a small fee"}, {"label": "Feb flow", "value": "Lower in dry season"}, {"label": "Time needed", "value": "About 1 hour"}]$q$::jsonb,
  links = $q$[{"label": "Na Muang Falls, map", "url": "https://www.google.com/maps/search/?api=1&query=Na+Muang+Waterfall+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Waterfalls$q$;

update swipe_cards sc set
  detail = $q$Samui has a few places where you can watch and feed rescued elephants without riding them. Pick one that is clearly viewing-only, with no rides, no shows, no chains. Read recent reviews before booking.$q$,
  image_url = $q$cards/20.jpg$q$,
  image_credit = $q$Photo: gracemontse, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Elefante_en_Mae_Wang,_Chiang_Mai.jpg$q$,
  facts = $q$[{"label": "What to look for", "value": "No riding, no performances"}, {"label": "Typical price", "value": "Rs 3-5k each (check)"}, {"label": "Time needed", "value": "2-3 hours"}]$q$::jsonb,
  links = $q$[{"label": "Search: Elephant sanctuaries", "url": "https://www.google.com/search?q=Koh+Samui+elephant+sanctuary"}, {"label": "On the map", "url": "https://www.google.com/maps/search/?api=1&query=elephant+sanctuary+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Ethical elephant sanctuary$q$;

update swipe_cards sc set
  detail = $q$Beachfront seafood restaurants grill the catch of the day: giant prawns, whole fish, squid, crab, served with chilli-lime sauces and rice. Bophut and Bang Po are good areas for a sunset table. Choose fish from the display and agree on the price by weight.$q$,
  image_url = $q$cards/21.jpg$q$,
  image_credit = $q$Photo: PattayaPatrol, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:DFC_5516_Freshly_grilled_prawns_lined_up_for_sale_at_a_local_market_in_Sattahip_Thailand.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "Rs 1.5-3k per person for a good meal"}, {"label": "Where", "value": "Bophut, Bang Po, Hua Thanon"}, {"label": "Veg option", "value": "Most places do veg dishes too"}]$q$::jsonb,
  links = $q$[{"label": "Seafood restaurants, map", "url": "https://www.google.com/maps/search/?api=1&query=beachfront+seafood+restaurant+Koh+Samui"}, {"label": "Search: Food tours", "url": "https://www.google.com/search?q=Koh+Samui+food+tour"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Seafood grills on the beach$q$;

update swipe_cards sc set
  detail = $q$A half-day class that starts at the market and ends with you eating what you cooked: curry paste, tom yum, pad thai, mango sticky rice. Classes cater to veg and non-veg. A good shared activity that also gives you recipes to take home.$q$,
  image_url = $q$cards/22.jpg$q$,
  image_credit = $q$Photo: Thai Secret Cooking School, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Thai-Cooking-Class-Chiang-Mai-Thailand.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "About Rs 3-5k each"}, {"label": "Duration", "value": "3-4 hours"}, {"label": "Dietary", "value": "Veg and non-veg options"}]$q$::jsonb,
  links = $q$[{"label": "Search: Cooking classes", "url": "https://www.google.com/search?q=Koh+Samui+Thai+cooking+class"}, {"label": "Cooking schools on the map", "url": "https://www.google.com/maps/search/?api=1&query=Thai+cooking+class+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Thai cooking class$q$;

update swipe_cards sc set
  detail = $q$Fisherman's Village in Bophut has a lively walking street with shops, music and food stalls, and Chaweng has its own night market. Good for street food, souvenirs and a slow stroll after dinner. Weekly walking-street nights vary by village, so check which fall on your dates.$q$,
  image_url = $q$cards/23.jpg$q$,
  image_credit = $q$Photo: Slyronit, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Hua_Hin_Night_Market_02.jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Free to walk; food Rs 200-800 each"}, {"label": "Best time", "value": "After sunset"}, {"label": "Walking street", "value": "Fisherman's Village runs it on Fridays (check)"}]$q$::jsonb,
  links = $q$[{"label": "Fisherman's Village, map", "url": "https://www.google.com/maps/search/?api=1&query=Fisherman%27s+Village+Bophut+Koh+Samui"}, {"label": "Chaweng night market, map", "url": "https://www.google.com/maps/search/?api=1&query=Chaweng+Night+Market+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Night markets$q$;

update swipe_cards sc set
  detail = $q$Pick one evening for a proper dress-up dinner at a top restaurant: a tasting menu, a clifftop table, or a candlelit terrace. Reserve ahead, especially for sunset tables, and check the dress code.$q$,
  image_url = $q$cards/24.jpg$q$,
  image_credit = $q$Photo: PattayaPatrol, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:DZ6_2629_A_cozy_table_for_two_-_soft_lights_a_single_orchid_and_the_promise_of_a_perfect_evening.jpg$q$,
  facts = $q$[{"label": "Typical price", "value": "Rs 5-12k for two (varies widely)"}, {"label": "Book", "value": "Reserve 2-3 days ahead"}, {"label": "Tip", "value": "Ask for a sunset or sea-view table"}]$q$::jsonb,
  links = $q$[{"label": "Fine dining on Samui, map", "url": "https://www.google.com/maps/search/?api=1&query=fine+dining+Koh+Samui"}, {"label": "Koh Samui dining guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$One fancy tasting dinner$q$;

update swipe_cards sc set
  detail = $q$Slow afternoons: iced Thai tea, fresh coconut, smoothie bowls, and mango sticky rice at a beachside cafe. Easy, cheap, and a good break between bigger plans.$q$,
  image_url = $q$cards/25.jpg$q$,
  image_credit = $q$Photo: Muzirian, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Mango_sticky_rice.jpg$q$,
  facts = $q$[{"label": "Cost", "value": "Rs 300-800 per cafe stop"}, {"label": "Try", "value": "Mango sticky rice, Thai iced tea"}, {"label": "Where", "value": "Bophut, Chaweng, Mae Nam"}]$q$::jsonb,
  links = $q$[{"label": "About mango sticky rice", "url": "https://en.wikipedia.org/wiki/Mango_sticky_rice"}, {"label": "Cafes on the map", "url": "https://www.google.com/maps/search/?api=1&query=cafe+Koh+Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Cafe hopping$q$;

update swipe_cards sc set
  detail = $q$After a few days of Thai food, a North Indian vegetarian dinner is a comfort break. Chaweng and Bophut have several well-reviewed Indian restaurants with proper thalis and paneer. A good pick if one of you wants something familiar.$q$,
  image_url = $q$cards/26.jpg$q$,
  image_credit = $q$Photo: Rajeeb Dutta, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:North_Indian_Vegetarian_Thali-MB51.jpg$q$,
  facts = $q$[{"label": "Where", "value": "Chaweng and Bophut"}, {"label": "Typical price", "value": "Rs 1-2k per person"}, {"label": "Order", "value": "Thali, paneer, dal, naan"}]$q$::jsonb,
  links = $q$[{"label": "Indian restaurants, map", "url": "https://www.google.com/maps/search/?api=1&query=Indian+vegetarian+restaurant+Koh+Samui"}, {"label": "Ko Samui travel guide", "url": "https://en.wikivoyage.org/wiki/Ko_Samui"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Indian veg dinner one night$q$;

update swipe_cards sc set
  detail = $q$Fly Delhi to Bangkok on Saturday evening (nonstop about 4 hours), sleep near the airport, then take the early Bangkok to Samui flight on Sunday. It cuts about Rs 18.7k off the flights, minus the hotel and transfer. The catch is a 3:45 AM wake-up on your first honeymoon morning.$q$,
  image_url = $q$cards/27.jpg$q$,
  image_credit = $q$Photo: Azreey, CC BY-SA 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Bangkok_-_City_skyline_at_sunset.JPG$q$,
  facts = $q$[{"label": "Flights saved", "value": "About Rs 18.7k, net Rs 11-16k after the hotel"}, {"label": "Hotel", "value": "Airport hotel, about Rs 2-9k"}, {"label": "Downside", "value": "6 AM flight, early start"}]$q$::jsonb,
  links = $q$[{"label": "Delhi to Bangkok flights, 20 Feb", "url": "https://www.google.com/travel/flights?q=Flights%20from%20DEL%20to%20BKK%20on%202027-02-20"}, {"label": "Suvarnabhumi hotels, map", "url": "https://www.google.com/maps/search/?api=1&query=hotels+near+Suvarnabhumi+Airport"}, {"label": "Suvarnabhumi Airport", "url": "https://en.wikipedia.org/wiki/Suvarnabhumi_Airport"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Bangkok night on the way$q$;

update swipe_cards sc set
  detail = $q$Delhi to Bangkok in the morning, a second flight to Samui in the evening. You arrive about 7:50 PM and have all five nights on the island. On two separate tickets, so leave a long gap between flights.$q$,
  image_url = $q$cards/28.jpg$q$,
  image_credit = $q$Photo: Roma Neus, CC BY 3.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Samui_Airport,_2015_febr._-_panoramio.jpg$q$,
  facts = $q$[{"label": "Flights", "value": "About Rs 1.27L for two"}, {"label": "Arrive", "value": "Samui about 7:50 PM"}, {"label": "Risk", "value": "Separate tickets, no airline protection"}]$q$::jsonb,
  links = $q$[{"label": "Samui Airport on Wikipedia", "url": "https://en.wikipedia.org/wiki/Samui_Airport"}, {"label": "Samui Airport, map", "url": "https://www.google.com/maps/search/?api=1&query=Samui+International+Airport"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Same-day to Samui$q$;

update swipe_cards sc set
  detail = $q$One booking from Delhi to Samui (one stop) and one back to Kolkata. If a flight runs late, the airline rebooks you onto the next connection. It costs more, about Rs 1.72L for flights, but removes the connection risk.$q$,
  image_url = $q$cards/29.jpg$q$,
  image_credit = $q$Photo: U.S. Department of Agriculture, Public domain, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:A_wing_tip_of_an_airplane_(40118125441).jpg$q$,
  facts = $q$[{"label": "Flights", "value": "About Rs 1.72L for two"}, {"label": "Benefit", "value": "Airline is responsible for missed connections"}, {"label": "Trade-off", "value": "About Rs 45k more than separate tickets"}]$q$::jsonb,
  links = $q$[{"label": "Samui Airport on Wikipedia", "url": "https://en.wikipedia.org/wiki/Samui_Airport"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$Protected single ticket$q$;

update swipe_cards sc set
  detail = $q$Swap the last Samui night for a Bangkok day: Chatuchak Weekend Market, street art in Talat Noi, a canal-side Artist's House, dinner on Yaowarat Road. It adds markets and art to a beach trip, at the cost of a shorter Samui stay.$q$,
  image_url = $q$cards/30.jpg$q$,
  image_credit = $q$Photo: Christophe95, CC BY-SA 4.0, via Wikimedia Commons$q$,
  image_source_url = $q$https://commons.wikimedia.org/wiki/File:Chatuchak_Weekend_Market_2.jpg$q$,
  facts = $q$[{"label": "Chatuchak", "value": "Weekends only"}, {"label": "Also see", "value": "Talat Noi, Wat Arun, Yaowarat"}, {"label": "Cost", "value": "Extra hotel night plus food"}]$q$::jsonb,
  links = $q$[{"label": "Chatuchak on Wikipedia", "url": "https://en.wikipedia.org/wiki/Chatuchak_Weekend_Market"}, {"label": "Chatuchak, map", "url": "https://www.google.com/maps/search/?api=1&query=Chatuchak+Weekend+Market"}, {"label": "Search: Bangkok tours", "url": "https://www.google.com/search?q=Bangkok+Chatuchak+market"}]$q$::jsonb
from swipe_decks d
where d.id = sc.deck_id and d.key = 'honeymoon-samui' and sc.title = $q$One Bangkok day at the end$q$;

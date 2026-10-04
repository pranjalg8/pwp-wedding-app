-- Two more honeymoon cards: the Surat Thani + ferry route, and a west-coast villa near the ferry pier.
insert into swipe_cards (deck_id, title, subtitle, detail, emoji, category, image_url, image_credit, image_source_url, facts, links, sort_order)
select d.id, c.title, c.subtitle, c.detail, c.emoji, c.category, c.image_url, c.image_credit, c.image_source_url, c.facts::jsonb, c.links::jsonb, c.sort_order
from swipe_decks d,
(values
  (
    $q$Fly to Surat Thani, then ferry$q$,
    $q$Cheapest route, with an overnight flight$q$,
    $q$Delhi to Surat Thani via Don Mueang on Thai AirAsia (about Rs 46k for two), landing Sunday morning, then a bus plus ferry across to Samui (about 2.5 to 4.5 hours). It is the cheapest route we found, around Rs 0.91-0.95L for flights and ferries. The trade-offs: you sleep on the plane on Saturday night, and the return is a long day that ends at 11:55 PM in Kolkata.$q$,
    $q$⛴️$q$,
    $q$Flights$q$,
    $q$cards/31.jpg$q$,
    $q$Photo: Per Meistrup, CC BY-SA 4.0, via Wikimedia Commons$q$,
    $q$https://commons.wikimedia.org/wiki/File:Raja_9_ferry_IMG_9556_Raja-9.jpg$q$,
    $q$[{"label": "Flights", "value": "Rs 46,050 out + Rs 39-40k back, for two"}, {"label": "Bus + ferry", "value": "About 500-850 THB each way per person"}, {"label": "Saves", "value": "About Rs 15-35k vs the other options"}, {"label": "Downside", "value": "Overnight flight, 11:55 PM landing in Kolkata"}]$q$,
    $q$[{"label": "Surat Thani Airport", "url": "https://en.wikipedia.org/wiki/Surat_Thani_Airport"}, {"label": "Surat Thani to Samui guide", "url": "https://unchartedlens.com/routes/thailand/surat-thani-to-koh-samui-airport/"}, {"label": "Don Sak to Samui ferry", "url": "https://www.phuketferry.com/route-samui-island-donsak.html"}, {"label": "Delhi to Surat Thani, 20 Feb", "url": "https://www.google.com/travel/flights?q=Flights%20from%20DEL%20to%20URT%20on%202027-02-20"}]$q$,
    31
  ),
  (
    $q$West-coast villa near the ferry pier$q$,
    $q$Quiet side, sunsets, short transfer$q$,
    $q$If you arrive by ferry at Lipa Noi or Nathon, a villa on the west or south-west coast (Lipa Noi, Taling Ngam) keeps the transfer short and puts you on the sunset side of the island. It is the quiet end of Samui, so plan on a driver for the night markets and sightseeing.$q$,
    $q$🏡$q$,
    $q$Stay$q$,
    $q$cards/32.jpg$q$,
    $q$Photo: Manfred Werner, CC BY-SA 3.0, via Wikimedia Commons$q$,
    $q$https://commons.wikimedia.org/wiki/File:Koh_Samui_Lipa_Noi2.jpg$q$,
    $q$[{"label": "Best with", "value": "The Surat Thani ferry route"}, {"label": "Transfer", "value": "Short from Lipa Noi pier; longer to Choeng Mon"}, {"label": "Trade-off", "value": "Further from restaurants, needs a driver"}]$q$,
    $q$[{"label": "Lipa Noi, map", "url": "https://www.google.com/maps/search/?api=1&query=Lipa+Noi+Koh+Samui"}, {"label": "Taling Ngam, map", "url": "https://www.google.com/maps/search/?api=1&query=Taling+Ngam+Koh+Samui"}, {"label": "Search villas, our dates", "url": "https://www.google.com/travel/search?q=Koh+Samui+pool+villa&checkin=2027-02-20&checkout=2027-02-25&adults=2"}]$q$,
    32
  )
) as c(title, subtitle, detail, emoji, category, image_url, image_credit, image_source_url, facts, links, sort_order)
where d.key = 'honeymoon-samui';

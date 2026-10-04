// Route options for the Koh Samui honeymoon, 20-25 Feb 2027, Delhi -> Samui -> Kolkata.
// Fares are Google Flights quotes for 2 adults, taxes included, taken on 4 Oct 2026.
// They move, so treat them as estimates and re-check before booking.

export type EventKind = 'flight' | 'transfer' | 'ferry' | 'wait' | 'hotel' | 'activity';

export type TravelEvent = {
  day: string;
  time?: string;
  kind: EventKind;
  title: string;
  detail?: string;
  cost?: string;
  warn?: string;
};

export type TravelOption = {
  id: string;
  name: string;
  tag?: string;
  total: string;
  stats: { label: string; value: string }[];
  summary: string;
  pros: string[];
  cons: string[];
  checklist: string[];
  events: TravelEvent[];
};

export const KIND_ICON: Record<EventKind, string> = {
  flight: '✈️',
  transfer: '🚐',
  ferry: '⛴️',
  wait: '⏳',
  hotel: '🏨',
  activity: '🌴',
};

const SAMUI_DAYS: TravelEvent[] = [
  {
    day: 'Mon 22 Feb',
    kind: 'activity',
    title: 'Sightseeing day with a driver',
    detail: 'Big Buddha, Wat Plai Laem, Secret Buddha Garden, then a west-coast sunset. A car and driver is about Rs 7-9k for the day.',
  },
  {
    day: 'Tue 23 Feb',
    kind: 'activity',
    title: 'Ang Thong day trip, or a lazy day',
    detail: 'Speedboat trip to the limestone islands (about 8-9 hours, Rs 4-7k each). Skip it for a pool day if you would rather not start early.',
  },
  {
    day: 'Wed 24 Feb',
    kind: 'activity',
    title: 'Spa, candlelit beach dinner, pack',
    detail: 'Couples spa in the afternoon, then the private beach dinner. Pack tonight so the last morning is easy.',
  },
];

const RETURN_FROM_SAMUI_BKK: TravelEvent[] = [
  {
    day: 'Thu 25 Feb',
    time: '05:15',
    kind: 'transfer',
    title: 'Villa to Samui airport',
    detail: 'Leave early for the 07:15 flight. Ask the villa to book a taxi the night before.',
  },
  {
    day: 'Thu 25 Feb',
    time: '07:15 → 08:50',
    kind: 'flight',
    title: 'Samui (USM) → Bangkok (BKK)',
    detail: 'Short flight, 1h35.',
    cost: 'Rs 29,157 for two',
  },
  {
    day: 'Thu 25 Feb',
    time: '08:50 → 15:10',
    kind: 'wait',
    title: 'Six hours at Bangkok airport',
    detail: 'Separate tickets: collect your bags, re-check them, and go through immigration again. Use the gap for a proper lunch, or a day room near the airport.',
    warn: 'No airline protection between these two flights, which is why the gap is long on purpose.',
  },
  {
    day: 'Thu 25 Feb',
    time: '15:10 → 16:15',
    kind: 'flight',
    title: 'Bangkok (BKK) → Kolkata (CCU)',
    detail: 'Nonstop, about 2h35. Lands 16:15 India time.',
    cost: 'Rs 30,250 for two',
  },
];

export const OPTIONS: TravelOption[] = [
  {
    id: 'surat',
    name: 'Surat Thani + ferry',
    tag: 'Cheapest',
    total: 'Rs 0.91-0.95L',
    stats: [
      { label: 'Flights + ferry', value: 'Rs 0.91-0.95L' },
      { label: 'Samui nights', value: '4' },
      { label: 'Reach Samui', value: 'Sun, early afternoon' },
      { label: 'Land in Kolkata', value: 'Thu 23:55' },
    ],
    summary: 'Fly Delhi to Surat Thani overnight, then a bus and ferry across to Samui. Both flights are single tickets with a connection at Bangkok Don Mueang (DMK).',
    pros: ['Cheapest route, about Rs 15-35k less than the others', 'Both flights are one booking each, so the airline covers the connection', 'No Bangkok hotel night'],
    cons: ['You sleep on the plane on Saturday night', 'Only one outbound flight showed up', 'The return is a long day and lands at 23:55', 'Ferry pier is on the west side, so a west-coast villa makes sense'],
    checklist: ['Book the Delhi to Surat Thani flight as one ticket', 'Pre-book the bus and ferry combo (about 500-850 THB each) for both directions', 'Pick a villa on the west or south-west coast, near the Lipa Noi or Nathon pier', 'Fill in the Thailand arrival card within 72 hours of arrival'],
    events: [
      {
        day: 'Sat 20 Feb',
        time: '20:55',
        kind: 'flight',
        title: 'Delhi (DEL) → Surat Thani (URT)',
        detail: 'Overnight, one stop at Bangkok Don Mueang (DMK) for 4h15. Thai AirAsia X and Thai AirAsia. About 9h45 in total.',
        cost: 'Rs 46,050 for two',
      },
      {
        day: 'Sun 21 Feb',
        time: '08:10',
        kind: 'flight',
        title: 'Land in Surat Thani',
        detail: 'Immigration, collect bags. Local time is 1h30 ahead of India.',
      },
      {
        day: 'Sun 21 Feb',
        time: '08:45',
        kind: 'transfer',
        title: 'Bus or van to Don Sak pier',
        detail: 'Sold as a combo with the ferry from the airport. Faster catamaran combos (such as Lomprayah) take about 2.5 hours in total; the car ferries (Raja, Seatran) take up to about 4.5.',
        cost: '500-850 THB each, combo',
      },
      {
        day: 'Sun 21 Feb',
        time: '10:30',
        kind: 'ferry',
        title: 'Ferry to Koh Samui',
        detail: 'Arrives at the west side of the island (Lipa Noi or Nathon). Expect to reach your villa between about 11:00 and 13:00.',
      },
      {
        day: 'Sun 21 Feb',
        kind: 'hotel',
        title: 'Check in, slow afternoon',
        detail: 'Ask the villa for early check-in. Pool, a nap, and an easy dinner. First night of four on Samui.',
      },
      ...SAMUI_DAYS,
      {
        day: 'Thu 25 Feb',
        time: '09:30',
        kind: 'transfer',
        title: 'Villa to the pier',
        detail: 'Leave the villa by about 09:30 to allow for the ferry, the bus to the airport, and international check-in.',
      },
      {
        day: 'Thu 25 Feb',
        time: '10:30',
        kind: 'ferry',
        title: 'Ferry and bus to Surat Thani airport',
        detail: 'About 2.5-4.5 hours door to door. Aim to be at the airport by about 14:40.',
        cost: '500-850 THB each, combo',
      },
      {
        day: 'Thu 25 Feb',
        time: '17:40 → 23:55',
        kind: 'flight',
        title: 'Surat Thani (URT) → Kolkata (CCU)',
        detail: 'One stop at Bangkok Don Mueang (3h50). Thai AirAsia. Lands 23:55 India time. There is also a 20:00 departure for Rs 40,043 with a tighter 1h30 connection.',
        cost: 'Rs 39,129 for two',
        warn: 'Late arrival, so arrange a pick-up or taxi in Kolkata.',
      },
    ],
  },
  {
    id: 'bkk-night',
    name: 'Bangkok night, then Samui',
    total: 'Rs 1.10-1.17L',
    stats: [
      { label: 'Flights', value: 'Rs 1.08L' },
      { label: 'Plus hotel', value: 'Rs 2-9k' },
      { label: 'Samui nights', value: '4' },
      { label: 'Land in Kolkata', value: 'Thu 16:15' },
    ],
    summary: 'Fly Delhi to Bangkok in the afternoon, sleep near the airport, then catch the 6 AM flight to Samui. The Samui to Bangkok leg is a cheap one-seat fare.',
    pros: ['About Rs 19k cheaper than flying straight through on Saturday', 'Nonstop flights both ways to Bangkok', 'A relaxed first evening, then Samui next morning', 'Lands in Kolkata mid-afternoon'],
    cons: ['3:45 AM wake-up on your first honeymoon morning', 'The Rs 15,125 Bangkok to Samui fare is a single seat bucket and may sell out', 'Separate tickets with no airline protection', 'Four Samui nights, not five'],
    checklist: ['Book the Bangkok to Samui flight first, since the cheap seat may go', 'Book an airport hotel near Suvarnabhumi (about Rs 2-9k), with a late check-in', 'Ask the hotel about a 3:45 AM taxi or shuttle', 'Leave a long gap before the Bangkok to Kolkata flight on the return'],
    events: [
      {
        day: 'Sat 20 Feb',
        time: '15:20 → 21:05',
        kind: 'flight',
        title: 'Delhi (DEL) → Bangkok (BKK)',
        detail: 'Nonstop, about 4 hours. Lands 21:05 Bangkok time.',
        cost: 'Rs 33,262 for two',
      },
      {
        day: 'Sat 20 Feb',
        time: '21:45',
        kind: 'transfer',
        title: 'Immigration, then taxi to an airport hotel',
        detail: 'Short ride to a hotel near Suvarnabhumi, 15-40 minutes.',
        cost: 'About Rs 1k',
      },
      {
        day: 'Sat 20 Feb',
        kind: 'hotel',
        title: 'Night near Bangkok airport',
        detail: 'About five hours of sleep. A simple airport hotel is fine; Park Nine is the nicest of the ones we looked at.',
        cost: 'Rs 2-9k',
      },
      {
        day: 'Sun 21 Feb',
        time: '03:45',
        kind: 'transfer',
        title: 'Wake-up and back to the airport',
        warn: 'Very early start on day one.',
      },
      {
        day: 'Sun 21 Feb',
        time: '06:00 → 07:10',
        kind: 'flight',
        title: 'Bangkok (BKK) → Samui (USM)',
        detail: 'About 1h10. This one flight is the Rs 15,125 fare; other times that day are about Rs 33k.',
        cost: 'Rs 15,125 for two',
        warn: 'Single cheap seat bucket. If it sells out, the same flight later costs about double.',
      },
      {
        day: 'Sun 21 Feb',
        time: '07:30',
        kind: 'transfer',
        title: 'Samui airport to the villa',
        detail: '15-40 minutes depending on which part of the island. Drop bags and have breakfast; check-in is usually from about 14:00.',
        cost: 'Rs 1-2k',
      },
      {
        day: 'Sun 21 Feb',
        kind: 'hotel',
        title: 'Pool, nap, easy dinner',
        detail: 'First of four nights on Samui. Fisherman’s Village is a good first evening.',
      },
      ...SAMUI_DAYS,
      ...RETURN_FROM_SAMUI_BKK,
    ],
  },
  {
    id: 'same-day',
    name: 'Same day via Bangkok',
    total: 'Rs 1.27L',
    stats: [
      { label: 'Flights', value: 'Rs 1.27L' },
      { label: 'Samui nights', value: '5' },
      { label: 'Reach Samui', value: 'Sat 19:50' },
      { label: 'Land in Kolkata', value: 'Thu 16:15' },
    ],
    summary: 'Fly Delhi to Bangkok in the morning, then Bangkok to Samui in the evening, so you have all five nights on the island. Two separate tickets.',
    pros: ['All five nights in Samui', 'No early-morning wake-up', 'Nonstop to Bangkok, then a short hop'],
    cons: ['Separate tickets: a delayed first flight could miss the second', 'About Rs 19k more than the Bangkok-night option', 'Long Saturday, arriving at the villa around 21:00'],
    checklist: ['Keep the 4h30 gap in Bangkok, do not shorten it', 'Book both flights on the same day, same airline if possible for easier rebooking', 'Tell the villa to expect a late check-in at about 21:00', 'Fill in the Thailand arrival card within 72 hours of arrival'],
    events: [
      {
        day: 'Sat 20 Feb',
        time: '08:20 → 14:10',
        kind: 'flight',
        title: 'Delhi (DEL) → Bangkok (BKK)',
        detail: 'Nonstop, about 4h20. Lands 14:10 Bangkok time.',
        cost: 'Rs 33,736 for two',
      },
      {
        day: 'Sat 20 Feb',
        time: '14:10 → 18:40',
        kind: 'wait',
        title: 'Four and a half hours at Bangkok airport',
        detail: 'Immigration, collect and re-check bags, lunch. Plenty of buffer for a late arrival.',
        warn: 'Separate tickets, so a delay on the first flight is your risk.',
      },
      {
        day: 'Sat 20 Feb',
        time: '18:40 → 19:50',
        kind: 'flight',
        title: 'Bangkok (BKK) → Samui (USM)',
        detail: 'About 1h10.',
        cost: 'Rs 33,355 for two',
      },
      {
        day: 'Sat 20 Feb',
        time: '20:15',
        kind: 'transfer',
        title: 'Samui airport to the villa',
        detail: '15-40 minutes. Arrive about 21:00 for a late check-in and a simple dinner.',
        cost: 'Rs 1-2k',
      },
      {
        day: 'Sun 21 Feb',
        kind: 'activity',
        title: 'Beach and pool day',
        detail: 'Sunrise at Choeng Mon if you wake early, a slow morning, dinner at Fisherman’s Village.',
      },
      ...SAMUI_DAYS,
      ...RETURN_FROM_SAMUI_BKK,
    ],
  },
  {
    id: 'protected',
    name: 'Protected single tickets',
    tag: 'Safest',
    total: 'Rs 1.72L',
    stats: [
      { label: 'Flights', value: 'Rs 1.72L' },
      { label: 'Samui nights', value: '5' },
      { label: 'Reach Samui', value: 'Sat 19:50' },
      { label: 'Land in Kolkata', value: 'Thu 16:15' },
    ],
    summary: 'One booking from Delhi to Samui and one back to Kolkata, each with one stop. If a flight runs late, the airline rebooks you.',
    pros: ['The airline is responsible for missed connections', 'Bags checked through', 'All five Samui nights, back mid-afternoon'],
    cons: ['About Rs 45k more than separate tickets', 'The stop is one airport, shown by Google as 1 stop (check which)'],
    checklist: ['Book as a single itinerary each way, not as separate tickets', 'Confirm your bags are checked through to Samui and Kolkata', 'Fill in the Thailand arrival card within 72 hours of arrival'],
    events: [
      {
        day: 'Sat 20 Feb',
        time: '11:00 → 19:50',
        kind: 'flight',
        title: 'Delhi (DEL) → Samui (USM)',
        detail: 'One stop, about 7h20 in total, on a single ticket.',
        cost: 'Rs 98,930 for two',
      },
      {
        day: 'Sat 20 Feb',
        time: '20:15',
        kind: 'transfer',
        title: 'Samui airport to the villa',
        detail: '15-40 minutes. Arrive about 21:00.',
        cost: 'Rs 1-2k',
      },
      {
        day: 'Sun 21 Feb',
        kind: 'activity',
        title: 'Beach and pool day',
        detail: 'Sunrise at Choeng Mon if you wake early, a slow morning, dinner at Fisherman’s Village.',
      },
      ...SAMUI_DAYS,
      {
        day: 'Thu 25 Feb',
        time: '05:15',
        kind: 'transfer',
        title: 'Villa to Samui airport',
        detail: 'Leave early for the 07:15 flight.',
      },
      {
        day: 'Thu 25 Feb',
        time: '07:15 → 16:15',
        kind: 'flight',
        title: 'Samui (USM) → Kolkata (CCU)',
        detail: 'One stop, about 10h30 in total on a single ticket. Lands 16:15 India time.',
        cost: 'Rs 72,828 for two',
      },
    ],
  },
];

// What a guest sees. It is written by hand in the Share page and stored as one document, so nothing from
// the planner (amounts, phone numbers, chat messages, notes) can leak into a link by accident.

export interface GuestPage {
  version: 1;
  publishedAt: string;
  title: string;
  intro: string;
  dates: { label: string; text: string }[];
  sections: { heading: string; status: string; chosen: string[]; note: string }[];
}

export const emptyGuestPage = (): GuestPage => ({
  version: 1,
  publishedAt: '',
  title: 'Pranjal & Paridhi',
  intro: '',
  dates: [],
  sections: [],
});

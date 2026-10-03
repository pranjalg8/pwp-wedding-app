export const WEDDING_DATE = new Date('2027-02-14T00:00:00+05:30');

export const TOPIC_EMOJI: Record<string, string> = {
  dates_logistics: '🗓️',
  jewellery: '💍',
  outfits: '👗',
  decor: '🌼',
  photography: '📸',
  mehndi: '🌿',
  dance: '💃',
  events: '🎉',
  accommodations: '🏨',
  gifts: '🎁',
  shopping: '🛍️',
  reception: '🥂',
  honeymoon: '🏝️',
  post_wedding: '🏡',
};

export const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  in_progress: 'blue',
  decided: 'teal',
  done: 'gray',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  decided: 'Decided',
  done: 'Done',
};

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function daysUntilWedding() {
  const ms = WEDDING_DATE.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

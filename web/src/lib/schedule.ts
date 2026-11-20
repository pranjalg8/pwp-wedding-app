// How a function's time reads in the planner.

const SLOT_LABEL = { first_half: 'First half', second_half: 'Second half' } as const;

// "09:00:00" -> "9:00 am", "00:00" -> "12:00 am"
export function clockLabel(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// The time when one is set ("9:00 am to 1:00 pm"), otherwise the half of the day.
export function whenLabel(fn: { slot: 'first_half' | 'second_half'; start_time?: string | null; end_time?: string | null }) {
  if (!fn.start_time) return SLOT_LABEL[fn.slot];
  return fn.end_time ? `${clockLabel(fn.start_time)} to ${clockLabel(fn.end_time)}` : clockLabel(fn.start_time);
}

export const FUNCTION_STATUS_LABEL = { open: 'Open', in_progress: 'In progress', decided: 'Decided' } as const;

// One soft tint per function so the cards are easy to tell apart at a glance.
const TINTS = ['rose', 'grape', 'blue', 'teal', 'orange', 'pink'];
export const tintFor = (index: number) => TINTS[index % TINTS.length];

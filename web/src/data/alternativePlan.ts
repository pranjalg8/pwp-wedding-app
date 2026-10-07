import type { TravelEvent } from './travelOptions';

// Shape of an alternative honeymoon plan. The content itself lives in the database
// (table trip_alternatives) and is only readable by profiles that have been granted access.

export type AltMoment = { icon: string; time: string; label: string };

export type AltDay = {
  day: string;
  date: string;
  place: string;
  emoji: string;
  title: string;
  note: string;
  moments: AltMoment[];
  dinner: string;
  image: string;
};

export type AltBudget = { flights: number; stays: number; food: number; activities: number; local: number };

export type AltOption = {
  id: string;
  name: string;
  tag?: string;
  routeLine: string;
  badges: string[];
  budget: AltBudget;
  summary: string;
  pros: string[];
  cons: string[];
  travel: { label: string; value: string }[];
  lockFirst: { flights: string; stay: string; dinner: string };
  days: AltDay[];
  timeline?: TravelEvent[];
};

export type AltImage = { file: string; credit: string; source: string };

export type AltPlan = {
  label: string;
  emoji: string;
  title: string;
  tagline: string;
  heroImage: string;
  cap: number;
  defaultOption: string;
  images: Record<string, AltImage>;
  options: AltOption[];
  facts: { icon: string; label: string; value: string }[];
  links: { label: string; url: string }[];
  notes: string[];
  priceNote?: string;
  budgetNote?: string;
};

export type AltRow = { key: string; label: string; data: AltPlan };

export const altTotal = (b: AltBudget) => b.flights + b.stays + b.food + b.activities + b.local;

export const altImageUrl = (plan: AltPlan, key: string) => {
  const img = plan.images[key];
  return img ? `${import.meta.env.BASE_URL}${img.file}` : null;
};

// The chosen option for each plan is remembered per plan and shared by the Honeymoon and Getting there tabs.
const optionStorageKey = (planKey: string) => `pwp-alt-option-${planKey}`;

export function getAltOptionId(plan: AltPlan, planKey: string): string {
  try {
    const v = localStorage.getItem(optionStorageKey(planKey));
    if (v && plan.options.some((o) => o.id === v)) return v;
  } catch {
    // storage unavailable: use the default
  }
  return plan.defaultOption;
}

export function setAltOptionId(planKey: string, id: string) {
  try {
    localStorage.setItem(optionStorageKey(planKey), id);
  } catch {
    // ignore: the choice just will not persist
  }
}

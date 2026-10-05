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

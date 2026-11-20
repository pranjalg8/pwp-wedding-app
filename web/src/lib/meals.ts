// Meals for the wedding days: one row per meal served (day, meal, where, for whom, people, rate per head).

export const MEAL_DAYS = ['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15', '2027-02-16'] as const;
export const MEAL_ORDER = ['breakfast', 'lunch', 'hi_tea', 'dinner', 'late_night'] as const;
export type MealKind = (typeof MEAL_ORDER)[number];
export const MEAL_LABEL: Record<MealKind, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  hi_tea: 'Hi-tea',
  dinner: 'Dinner',
  late_night: 'Late night',
};

export type Meal = {
  id: string;
  meal_date: string;
  meal: MealKind;
  site_id: string | null;
  place_text: string | null;
  for_whom: string;
  people: number | null;
  rate: number | null;
  menu: string | null;
  notes: string | null;
  schedule_id: string | null;
};

export type LineForMeals = { id: string; payee: string; quantity: number | null; rate: number | null };

export const mealCost = (m: Pick<Meal, 'people' | 'rate'>) => (m.people != null && m.rate != null ? Math.round(m.people * m.rate) : null);

// Every wedding day, even one with no meals yet, so a missing day is easy to see. Meals in serving order.
export function mealsByDay(meals: Meal[], days: readonly string[] = MEAL_DAYS) {
  const all = [...new Set([...days, ...meals.map((m) => m.meal_date)])].sort();
  return all.map((date) => ({
    date,
    meals: meals
      .filter((m) => m.meal_date === date)
      .sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal) || a.for_whom.localeCompare(b.for_whom)),
  }));
}

// The planner's meals against the budget lines they point to. The line is compared on quantity x rate (before any
// part-payment adjustment), so a paid advance does not look like a mismatch. A line with meals that cost nothing yet
// (no people or rate) is left out rather than reported as zero.
export function mealLineChecks(meals: Meal[], lines: LineForMeals[]) {
  const out: { line: LineForMeals; meals: number; budget: number; diff: number; unpriced: number }[] = [];
  for (const line of lines) {
    const mine = meals.filter((m) => m.schedule_id === line.id);
    if (mine.length === 0 || line.quantity == null || line.rate == null) continue;
    const costs = mine.map(mealCost);
    const priced = costs.filter((c): c is number => c != null);
    const total = priced.reduce((a, b) => a + b, 0);
    const budget = Math.round(line.quantity * line.rate);
    out.push({ line, meals: total, budget, diff: total - budget, unpriced: costs.length - priced.length });
  }
  return out;
}

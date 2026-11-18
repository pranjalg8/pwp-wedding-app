import { supabase } from '../lib/supabase';
import { oneOf, rowsOf } from '../lib/liveData';
import { useLiveData } from './useLiveData';
import { splitByBudget, type AreaBudget, type BudgetSettings, type ItemMoney, type PaidRow, type Scheduled, type TopicRef, type Vendor } from '../lib/budgetPlan';

type Loaded = {
  schedule: Scheduled[]; // lines that count in the budget
  outside: Scheduled[]; // lines tracked outside the budget (paid by someone else)
  vendors: Vendor[];
  settings: BudgetSettings | null;
  areas: AreaBudget[];
  paid: PaidRow[];
  items: ItemMoney[];
  topics: TopicRef[];
};

const num = (v: unknown) => Number(v) || 0;

const EMPTY: Loaded = { schedule: [], outside: [], vendors: [], settings: null, areas: [], paid: [], items: [], topics: [] };

async function loadBudget(): Promise<Loaded> {
  const [s, st, a, p, i, t, v] = await Promise.all([
    supabase.from('payment_schedule').select('id, payee, amount, due_date, topic_id, note, is_estimate, status, paid_payment_id, paridhi_amount, paridhi_due_date, paridhi_plan, vendor_id, quantity, unit, rate, in_budget, adjustment, basis, basis_site_id, basis_night, basis_multiplier, basis_extra').order('due_date'),
    supabase.from('budget_settings').select('total_budget, funds_available, funds_as_of, monthly_addition, paridhi_funds_available, paridhi_monthly_addition, post_wedding_budget, gold_budget').eq('id', 1).maybeSingle(),
    supabase.from('budget_areas').select('id, topic_id, allocation'),
    supabase.from('payments').select('id, paid_on, payee, amount, topic_id, paridhi_amount, vendor_id'),
    supabase.from('planning_items').select('topic_id, status, amount, amount_kind, slug').not('amount', 'is', null),
    supabase.from('topics').select('id, key, label, budget_group').order('sort_order'),
    supabase.from('vendors').select('id, name, kind, planning_item_id, notes').order('name'),
  ]);
  const lines = rowsOf<Scheduled>(s).map((r) => ({
    ...r,
    amount: num(r.amount),
    paridhi_amount: num(r.paridhi_amount),
    quantity: r.quantity == null ? null : num(r.quantity),
    rate: r.rate == null ? null : num(r.rate),
    adjustment: num(r.adjustment),
    basis_multiplier: r.basis_multiplier == null ? 1 : num(r.basis_multiplier),
    basis_extra: num(r.basis_extra),
    paridhi_plan: ((r.paridhi_plan ?? []) as { on: string; amount: number | string }[]).map((i) => ({ on: i.on, amount: num(i.amount) })),
  }));
  const { inBudget, outside } = splitByBudget(lines);
  const st0 = oneOf<{ total_budget: number | string | null; funds_available: number | string | null; funds_as_of: string | null; monthly_addition: number | string; paridhi_funds_available: number | string | null; paridhi_monthly_addition: number | string; post_wedding_budget: number | string | null; gold_budget: number | string | null }>(st);
  return {
    schedule: inBudget,
    outside,
    vendors: rowsOf<Vendor>(v),
    settings: st0
      ? {
          total_budget: st0.total_budget === null ? null : num(st0.total_budget),
          funds_available: st0.funds_available === null ? null : num(st0.funds_available),
          funds_as_of: st0.funds_as_of,
          monthly_addition: num(st0.monthly_addition),
          paridhi_funds_available: st0.paridhi_funds_available === null ? null : num(st0.paridhi_funds_available),
          paridhi_monthly_addition: num(st0.paridhi_monthly_addition),
          post_wedding_budget: st0.post_wedding_budget === null ? null : num(st0.post_wedding_budget),
          gold_budget: st0.gold_budget === null ? null : num(st0.gold_budget),
        }
      : null,
    areas: rowsOf<AreaBudget>(a).map((r) => ({ ...r, allocation: num(r.allocation) })),
    paid: rowsOf<PaidRow>(p).map((r) => ({ ...r, amount: num(r.amount), paridhi_amount: num(r.paridhi_amount) })),
    items: rowsOf<ItemMoney>(i).map((r) => ({ ...r, amount: r.amount === null ? null : num(r.amount) })),
    topics: rowsOf<TopicRef>(t),
  };
}

// Everything the budget page needs, in one place, kept live: the schedule of payments still to make, the paid
// ledger, the funds settings, the per-area budgets, and the planner items that carry an amount.
export function useBudgetPlan() {
  const { data, loaded, loadError, reload } = useLiveData({
    tables: ['payment_schedule', 'budget_settings', 'budget_areas', 'payments', 'planning_items', 'vendors'],
    load: loadBudget,
    initial: EMPTY,
  });
  return { ...data, loaded, loadError, reload };
}

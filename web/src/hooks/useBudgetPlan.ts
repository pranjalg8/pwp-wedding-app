import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../lib/supabase';
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

// Everything the budget page needs, in one place, kept live: the schedule of payments still to make, the paid
// ledger, the funds settings, the per-area budgets, and the planner items that carry an amount.
export function useBudgetPlan() {
  const [data, setData] = useState<Loaded>({ schedule: [], outside: [], vendors: [], settings: null, areas: [], paid: [], items: [], topics: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const channelName = `budget_plan_${useId()}`;

  const reload = useCallback(async () => {
    const [s, st, a, p, i, t, v] = await Promise.all([
      supabase.from('payment_schedule').select('id, payee, amount, due_date, topic_id, note, is_estimate, status, paid_payment_id, paridhi_amount, paridhi_due_date, paridhi_plan, vendor_id, quantity, unit, rate, in_budget').order('due_date'),
      supabase.from('budget_settings').select('total_budget, funds_available, funds_as_of, monthly_addition, paridhi_funds_available, paridhi_monthly_addition, post_wedding_budget, gold_budget').eq('id', 1).maybeSingle(),
      supabase.from('budget_areas').select('id, topic_id, allocation'),
      supabase.from('payments').select('id, paid_on, payee, amount, topic_id, paridhi_amount, vendor_id'),
      supabase.from('planning_items').select('topic_id, status, amount, amount_kind, slug').not('amount', 'is', null),
      supabase.from('topics').select('id, key, label, budget_group').order('sort_order'),
      supabase.from('vendors').select('id, name, kind, planning_item_id, notes').order('name'),
    ]);
    // A failed load must not look like an empty budget: keep what is on screen and say so.
    const failed = [s, st, a, p, i, t, v].find((r) => r.error);
    if (failed?.error) {
      setLoadError(failed.error.message);
      setLoaded(true);
      return;
    }
    setLoadError(null);
    const lines = ((s.data ?? []) as Scheduled[]).map((r) => ({
      ...r,
      amount: num(r.amount),
      paridhi_amount: num(r.paridhi_amount),
      quantity: r.quantity == null ? null : num(r.quantity),
      rate: r.rate == null ? null : num(r.rate),
      paridhi_plan: ((r.paridhi_plan ?? []) as { on: string; amount: number | string }[]).map((i) => ({ on: i.on, amount: num(i.amount) })),
    }));
    const { inBudget, outside } = splitByBudget(lines);
    const st0 = st.data as { total_budget: number | string | null; funds_available: number | string | null; funds_as_of: string | null; monthly_addition: number | string; paridhi_funds_available: number | string | null; paridhi_monthly_addition: number | string; post_wedding_budget: number | string | null; gold_budget: number | string | null } | null;
    setData({
      schedule: inBudget,
      outside,
      vendors: (v.data ?? []) as Vendor[],
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
      areas: ((a.data ?? []) as AreaBudget[]).map((r) => ({ ...r, allocation: num(r.allocation) })),
      paid: ((p.data ?? []) as PaidRow[]).map((r) => ({ ...r, amount: num(r.amount), paridhi_amount: num(r.paridhi_amount) })),
      items: ((i.data ?? []) as ItemMoney[]).map((r) => ({ ...r, amount: r.amount === null ? null : num(r.amount) })),
      topics: (t.data ?? []) as TopicRef[],
    });
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_schedule' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_settings' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_areas' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, reload)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload, channelName]);

  return { ...data, loaded, loadError, reload };
}

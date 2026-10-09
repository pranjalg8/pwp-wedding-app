import { createClient } from '@supabase/supabase-js';
import { DEVICE_NICKNAME_KEY } from './device';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy web/.env.example to web/.env.local');
}

// Adds the device nickname to every request so the database audit trigger can record it.
const fetchWithDeviceName: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  try {
    const nickname = localStorage.getItem(DEVICE_NICKNAME_KEY);
    if (nickname) headers.set('x-device-name', nickname);
  } catch {
    // storage unavailable: send without a nickname
  }
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(url, anonKey, { global: { fetch: fetchWithDeviceName } });

export type Topic = {
  id: string;
  key: string;
  label: string;
  chat_match: string | null;
  sort_order: number;
};

export type PlanningItem = {
  id: string;
  slug: string | null;
  topic_id: string;
  type: 'decision' | 'todo' | 'vendor' | 'budget_line' | 'note';
  title: string;
  detail: string | null;
  status: 'open' | 'in_progress' | 'decided' | 'done';
  amount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
  source: 'manual' | 'sync';
  source_msg_ids: string[];
  amount_note: string | null;
  as_of: string | null;
  amount_kind: 'paid' | 'planned' | 'quote' | null;
  owner: 'pranjal' | 'paridhi' | 'both' | null;
  due_date: string | null;
  task_id: string | null;
  option_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  title: string;
  topic_id: string | null;
  owner: 'pranjal' | 'paridhi' | 'both' | null;
  priority: 'high' | 'normal' | 'low';
  due_date: string | null;
  status: 'open' | 'in_progress' | 'decided' | 'done';
  summary: string | null;
  sort_order: number;
  source_msg_ids: string[];
  created_at: string;
  updated_at: string;
};

export type TaskOption = {
  id: string;
  task_id: string;
  name: string;
  status: 'chosen' | 'shortlisted' | 'considering' | 'on_hold' | 'rejected';
  summary: string | null;
  why_note: string | null;
  metadata: Record<string, unknown>;
  sort_order: number;
  source_msg_ids: string[];
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  chat_jid: string;
  chat_name: string;
  msg_id: string;
  sender_name: string | null;
  from_me: boolean;
  timestamp: string;
  text: string | null;
  media_type: string | null;
  media_caption: string | null;
};

export type AuditEntry = {
  id: string;
  actor_type: 'manual' | 'sync';
  actor_name: string;
  device_info: Record<string, unknown> | null;
  table_name: string;
  record_id: string | null;
  action: 'insert' | 'update' | 'delete';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
};

export type SwipeDeck = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  destination: string | null;
  feature: string | null;
};

export type SwipeCard = {
  id: string;
  deck_id: string;
  title: string;
  subtitle: string | null;
  detail: string | null;
  emoji: string | null;
  category: string | null;
  image_url: string | null;
  image_credit: string | null;
  image_source_url: string | null;
  facts: { label: string; value: string }[];
  links: { label: string; url: string }[];
  sort_order: number;
};

export type SwipeChoice = 'yes' | 'no';

export type Swipe = {
  id: string;
  card_id: string;
  profile_id: string;
  choice: SwipeChoice;
};

export type SuggestionPayload = {
  type?: PlanningItem['type'];
  title?: string;
  detail?: string | null;
  status?: PlanningItem['status'];
  amount?: number | null;
  amount_kind?: PlanningItem['amount_kind'];
  amount_note?: string | null;
  metadata?: Record<string, unknown>;
};

export type Suggestion = {
  id: string;
  created_at: string;
  run_id: string;
  kind: 'new_item' | 'update_item';
  topic_id: string;
  target_item_id: string | null;
  base_updated_at: string | null;
  payload: SuggestionPayload;
  source_msg_ids: string[];
  confidence: 'high' | 'medium' | 'low';
  involves_money: boolean;
  rationale: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

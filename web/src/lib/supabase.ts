import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy web/.env.example to web/.env.local');
}

export const supabase = createClient(url, anonKey);

export type Topic = {
  id: string;
  key: string;
  label: string;
  chat_match: string | null;
  sort_order: number;
};

export type PlanningItem = {
  id: string;
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
  created_by: string | null;
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

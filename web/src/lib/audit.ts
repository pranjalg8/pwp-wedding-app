import { supabase } from './supabase';
import { getDeviceInfo } from './device';

export async function recordManualChange(opts: {
  actorName: string;
  tableName: string;
  recordId: string | null;
  action: 'insert' | 'update' | 'delete';
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const { error } = await supabase.from('audit_log').insert({
    actor_type: 'manual',
    actor_name: opts.actorName,
    device_info: getDeviceInfo(),
    table_name: opts.tableName,
    record_id: opts.recordId,
    action: opts.action,
    before: opts.before ?? null,
    after: opts.after ?? null,
  });
  if (error) console.error('Failed to record audit log entry:', error.message);
}

// app/src/lib/audit-log.ts
import { createClient } from './supabase/client';
import type { ThacUser } from '@/types/database';

export type AuditAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'unlock'
  | 'force_approve';

export interface AuditLogEntry {
  action: AuditAction;
  target_type: 'budget_plan' | 'actual_entry';
  showroom_code: string;
  unit_id: string;
  year: number;
  month: number;
  comment?: string;
  meta?: Record<string, unknown>;
}

/**
 * Ghi 1 bản ghi audit log. Fire-and-forget (không throw).
 */
export async function writeAuditLog(
  actor: ThacUser,
  entry: AuditLogEntry
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('thaco_audit_log').insert({
    actor_id:     actor.id,
    actor_email:  actor.email,
    actor_role:   actor.role,
    action:       entry.action,
    target_type:  entry.target_type,
    target_id:    `${entry.year}-${entry.month}-${entry.showroom_code}`,
    showroom_code: entry.showroom_code,
    unit_id:      entry.unit_id,
    year:         entry.year,
    month:        entry.month,
    comment:      entry.comment ?? null,
    meta:         entry.meta ?? {},
  });

  if (error) {
    // Không throw — audit log không được gây crash flow chính
    console.warn('[AuditLog] Write failed:', error.message);
  }
}

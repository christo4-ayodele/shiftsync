'use server';

import { createClient } from '@/lib/supabase/server';

export async function getAuditLogs(filters?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  locationId?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from('audit_log')
    .select('*, changed_by_profile:profiles!changed_by(*)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filters?.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }
  if (filters?.entityId) {
    query = query.eq('entity_id', filters.entityId);
  }
  if (filters?.action) {
    query = query.eq('action', filters.action);
  }
  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getShiftHistory(shiftId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*, changed_by_profile:profiles!changed_by(*)')
    .eq('entity_id', shiftId)
    .in('entity_type', ['shift', 'shift_assignment'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function exportAuditLogs(filters: {
  startDate: string;
  endDate?: string;
  action?: string;
  locationId?: string;
}) {
  const logs = await getAuditLogs(filters);

  // Convert to CSV
  const headers = [
    'Timestamp',
    'Action',
    'Entity Type',
    'Entity ID',
    'Changed By',
    'Before',
    'After',
  ];
  const rows = (logs || []).map((log) => [
    log.created_at,
    log.action,
    log.entity_type,
    log.entity_id,
    (log as any).changed_by_profile?.full_name || log.changed_by,
    JSON.stringify(log.before_state || {}),
    JSON.stringify(log.after_state || {}),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');
  return csv;
}

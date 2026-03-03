'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseISO, differenceInHours } from 'date-fns';
import { DEFAULT_EDIT_CUTOFF_HOURS } from '@/lib/utils/constants';

export async function getSchedules(locationId: string, weekStart?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('schedules')
    .select('*, location:locations(*)')
    .eq('location_id', locationId)
    .order('week_start', { ascending: false });

  if (weekStart) {
    query = query.eq('week_start', weekStart);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getOrCreateSchedule(
  locationId: string,
  weekStart: string,
) {
  const supabase = await createClient();

  // Try to get existing
  const { data: existing } = await supabase
    .from('schedules')
    .select('*, location:locations(*)')
    .eq('location_id', locationId)
    .eq('week_start', weekStart)
    .single();

  if (existing) return existing;

  // Create new
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      location_id: locationId,
      week_start: weekStart,
      status: 'draft',
      edit_cutoff_hours: 48,
    })
    .select('*, location:locations(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function publishSchedule(scheduleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: schedule, error: fetchError } = await supabase
    .from('schedules')
    .select('*, location:locations(*)')
    .eq('id', scheduleId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('schedules')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq('id', scheduleId);

  if (error) throw error;

  // Get all staff assigned to shifts in this schedule
  const { data: assignments } = await supabase
    .from('shift_assignments')
    .select('staff_id, shift:shifts!inner(schedule_id)')
    .eq('shift.schedule_id', scheduleId)
    .eq('status', 'assigned');

  if (assignments) {
    const uniqueStaffIds = [...new Set(assignments.map((a) => a.staff_id))];

    // Create notifications for all assigned staff
    const notifications = uniqueStaffIds.map((staffId) => ({
      user_id: staffId,
      type: 'schedule_published',
      title: 'Schedule Published',
      message: `The schedule for ${(schedule as any).location?.name || 'your location'} has been published.`,
      link: '/dashboard/my-shifts',
      is_read: false,
      delivery_method: 'in_app' as const,
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    entity_type: 'schedule',
    entity_id: scheduleId,
    action: 'update',
    changed_by: user.id,
    before_state: { status: 'draft' },
    after_state: { status: 'published' },
  });

  revalidatePath('/dashboard/schedule');
  return { success: true };
}

export async function unpublishSchedule(scheduleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Enforce edit cutoff: block unpublish if any shift starts within cutoff window
  const { data: schedule } = await supabase
    .from('schedules')
    .select('edit_cutoff_hours')
    .eq('id', scheduleId)
    .single();

  const cutoffHours =
    (schedule as any)?.edit_cutoff_hours ?? DEFAULT_EDIT_CUTOFF_HOURS;

  const { data: shifts } = await supabase
    .from('shifts')
    .select('start_time')
    .eq('schedule_id', scheduleId);

  if (shifts && shifts.length > 0) {
    const now = new Date();
    const tooClose = shifts.find((s) => {
      const hoursUntil = differenceInHours(parseISO(s.start_time), now);
      return hoursUntil < cutoffHours && hoursUntil >= 0;
    });
    if (tooClose) {
      const hoursUntil = differenceInHours(parseISO(tooClose.start_time), now);
      throw new Error(
        `Cannot unpublish: a shift starts in ${hoursUntil}h, which is within the ${cutoffHours}h edit cutoff.`,
      );
    }
  }

  const { error } = await supabase
    .from('schedules')
    .update({
      status: 'draft',
      published_at: null,
      published_by: null,
    })
    .eq('id', scheduleId);

  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'schedule',
    entity_id: scheduleId,
    action: 'update',
    changed_by: user.id,
    before_state: { status: 'published' },
    after_state: { status: 'draft' },
  });

  revalidatePath('/dashboard/schedule');
  return { success: true };
}

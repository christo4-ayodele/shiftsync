'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  ConstraintViolation,
  CoverageCandidate,
} from '@/lib/types/database';
import type { Json } from '@/lib/supabase/database.types';
import {
  MINIMUM_GAP_HOURS,
  OVERTIME_WARNING_HOURS,
  OVERTIME_LIMIT_HOURS,
  DAILY_HARD_BLOCK_HOURS,
  DAILY_WARNING_HOURS,
  CONSECUTIVE_DAY_WARNING,
  CONSECUTIVE_DAY_BLOCK,
  DEFAULT_EDIT_CUTOFF_HOURS,
} from '@/lib/utils/constants';
import {
  doShiftsOverlap,
  getShiftDurationHours,
  getGapBetweenShifts,
  isShiftFullyWithinAvailability,
} from '@/lib/utils/timezone';
import {
  parseISO,
  startOfWeek,
  endOfWeek,
  format,
  eachDayOfInterval,
  isSameDay,
  differenceInHours,
} from 'date-fns';

export async function getShifts(scheduleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shifts')
    .select(
      `
      *,
      required_skill:skills(*),
      location:locations(*),
      shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
    `,
    )
    .eq('schedule_id', scheduleId)
    .order('start_time');

  if (error) throw error;
  return data;
}

export async function getShiftsByLocation(
  locationId: string,
  startDate: string,
  endDate: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shifts')
    .select(
      `
      *,
      required_skill:skills(*),
      location:locations(*),
      schedule:schedules(*),
      shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
    `,
    )
    .eq('location_id', locationId)
    .gte('start_time', startDate)
    .lte('start_time', endDate)
    .order('start_time');

  if (error) throw error;
  return data;
}

export async function getShift(shiftId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shifts')
    .select(
      `
      *,
      required_skill:skills(*),
      location:locations(*),
      schedule:schedules(*),
      shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
    `,
    )
    .eq('id', shiftId)
    .single();

  if (error) throw error;
  return data;
}

export async function createShift(data: {
  schedule_id: string;
  location_id: string;
  required_skill_id: string;
  start_time: string;
  end_time: string;
  headcount_needed: number;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: shift, error } = await supabase
    .from('shifts')
    .insert(data)
    .select('*')
    .single();

  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'shift',
    entity_id: shift.id,
    action: 'create',
    changed_by: user.id,
    after_state: data as unknown as Json,
  });

  revalidatePath('/dashboard/schedule');
  revalidatePath('/dashboard/shifts');
  return shift;
}

export async function updateShift(
  shiftId: string,
  data: {
    required_skill_id?: string;
    start_time?: string;
    end_time?: string;
    headcount_needed?: number;
    notes?: string;
  },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get before state
  const { data: before } = await supabase
    .from('shifts')
    .select('*, schedule:schedules(*)')
    .eq('id', shiftId)
    .single();

  // Enforce edit cutoff: block edits if shift starts within cutoff window
  if (before) {
    const schedule = before.schedule as any;
    const cutoffHours =
      schedule?.edit_cutoff_hours ?? DEFAULT_EDIT_CUTOFF_HOURS;
    const shiftStart = parseISO(before.start_time);
    const hoursUntilShift = differenceInHours(shiftStart, new Date());
    if (hoursUntilShift < cutoffHours && schedule?.status === 'published') {
      throw new Error(
        `Cannot edit shift: it starts in ${hoursUntilShift}h, which is within the ${cutoffHours}h edit cutoff for published schedules.`,
      );
    }
  }

  const { data: shift, error } = await supabase
    .from('shifts')
    .update(data)
    .eq('id', shiftId)
    .select('*')
    .single();

  if (error) throw error;

  // Auto-cancel pending swap requests for this shift
  const { data: assignments } = await supabase
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftId);

  if (assignments && assignments.length > 0) {
    const assignmentIds = assignments.map((a) => a.id);
    const { data: pendingSwaps } = await supabase
      .from('swap_requests')
      .select('*, requesting_assignment:shift_assignments(staff_id)')
      .in('requesting_assignment_id', assignmentIds)
      .in('status', ['pending_peer', 'pending_manager']);

    if (pendingSwaps && pendingSwaps.length > 0) {
      await supabase
        .from('swap_requests')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
        .in(
          'id',
          pendingSwaps.map((s) => s.id),
        );

      // Notify affected staff
      for (const swap of pendingSwaps) {
        const staffId = (swap.requesting_assignment as any)?.staff_id;
        if (staffId) {
          await supabase.from('notifications').insert({
            user_id: staffId,
            type: 'swap_cancelled',
            title: 'Swap Request Cancelled',
            message:
              'Your swap request was automatically cancelled because the shift was modified.',
            link: '/dashboard/swap-requests',
            is_read: false,
            delivery_method: 'in_app',
          });
        }
      }
    }
  }

  await supabase.from('audit_log').insert({
    entity_type: 'shift',
    entity_id: shiftId,
    action: 'update',
    changed_by: user.id,
    before_state: before as unknown as Json,
    after_state: shift as unknown as Json,
  });

  revalidatePath('/dashboard/schedule');
  revalidatePath('/dashboard/shifts');
  return shift;
}

export async function deleteShift(shiftId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: before } = await supabase
    .from('shifts')
    .select('*, shift_assignments(staff_id)')
    .eq('id', shiftId)
    .single();

  // Notify assigned staff
  if (before?.shift_assignments) {
    for (const assignment of before.shift_assignments) {
      await supabase.from('notifications').insert({
        user_id: assignment.staff_id,
        type: 'shift_removed',
        title: 'Shift Removed',
        message: 'A shift you were assigned to has been removed.',
        link: '/dashboard/my-shifts',
        is_read: false,
        delivery_method: 'in_app',
      });
    }
  }

  const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
  if (error) throw error;

  await supabase.from('audit_log').insert({
    entity_type: 'shift',
    entity_id: shiftId,
    action: 'delete',
    changed_by: user.id,
    before_state: before as unknown as Json,
  });

  revalidatePath('/dashboard/schedule');
  revalidatePath('/dashboard/shifts');
}

// ============================================
// CONSTRAINT CHECKING
// ============================================

export async function checkConstraints(
  staffId: string,
  shiftId: string,
): Promise<ConstraintViolation[]> {
  const supabase = await createClient();
  const violations: ConstraintViolation[] = [];

  // Get the shift details
  const { data: shift } = await supabase
    .from('shifts')
    .select('*, required_skill:skills(*), location:locations(*)')
    .eq('id', shiftId)
    .single();

  if (!shift)
    return [
      {
        type: 'double_booking',
        severity: 'error',
        message: 'Shift not found',
        details: {},
      },
    ];

  // 1. Check skill requirement
  const { data: staffSkills } = await supabase
    .from('staff_skills')
    .select('skill_id')
    .eq('staff_id', staffId);

  const hasSkill = staffSkills?.some(
    (s) => s.skill_id === shift.required_skill_id,
  );
  if (!hasSkill) {
    violations.push({
      type: 'missing_skill',
      severity: 'error',
      message: `Staff member does not have the "${shift.required_skill?.name}" skill required for this shift.`,
      details: { required_skill: shift.required_skill?.name },
    });
  }

  // 2. Check location certification
  const { data: staffLocations } = await supabase
    .from('staff_locations')
    .select('location_id')
    .eq('staff_id', staffId)
    .is('decertified_at', null);

  const isCertified = staffLocations?.some(
    (l) => l.location_id === shift.location_id,
  );
  if (!isCertified) {
    violations.push({
      type: 'not_certified',
      severity: 'error',
      message: `Staff member is not certified to work at ${shift.location?.name}.`,
      details: { location: shift.location?.name },
    });
  }

  // 3. Check availability (day-of-week + time-range)
  const shiftStart = parseISO(shift.start_time);
  const shiftEnd = parseISO(shift.end_time);
  // Convert JS day (0=Sun) to DB/UI day (0=Mon, 6=Sun)
  const dayOfWeek = (shiftStart.getDay() + 6) % 7;

  const { data: availabilities } = await supabase
    .from('availability')
    .select('*')
    .eq('staff_id', staffId);

  // Check for exception (specific date override)
  const shiftDate = format(shiftStart, 'yyyy-MM-dd');
  const exceptions = availabilities?.filter(
    (a) => a.type === 'exception' && a.specific_date === shiftDate,
  );

  if (exceptions && exceptions.length > 0) {
    const isBlocked = exceptions.some((e) => !e.is_available);
    if (isBlocked) {
      violations.push({
        type: 'not_available',
        severity: 'error',
        message: 'Staff member has marked this date as unavailable.',
        details: { date: shiftDate },
      });
    } else {
      // Exception allows this date — verify entire shift fits within time window
      const availableExceptions = exceptions.filter((e) => e.is_available);
      const fitsTimeWindow = availableExceptions.some((avail) => {
        const tz = avail.timezone || shift.location?.timezone || 'UTC';
        return isShiftFullyWithinAvailability(
          shiftStart,
          shiftEnd,
          avail.start_time,
          avail.end_time,
          tz,
        );
      });
      if (!fitsTimeWindow) {
        const windows = availableExceptions
          .map((a) => `${a.start_time}–${a.end_time}`)
          .join(', ');
        violations.push({
          type: 'not_available',
          severity: 'error',
          message: `Shift time falls outside the staff member's available window (${windows}) on ${shiftDate}.`,
          details: {
            date: shiftDate,
            available_windows: availableExceptions.map((a) => ({
              start: a.start_time,
              end: a.end_time,
            })),
          },
        });
      }
    }
  } else {
    // Check recurring availability
    const recurring = availabilities?.filter(
      (a) => a.type === 'recurring' && a.day_of_week === dayOfWeek,
    );

    if (!recurring || recurring.length === 0) {
      violations.push({
        type: 'not_available',
        severity: 'error',
        message: `Staff member has no availability set for ${format(shiftStart, 'EEEE')}.`,
        details: { day: format(shiftStart, 'EEEE') },
      });
    } else {
      // Has day availability — verify entire shift fits within time window
      const fitsTimeWindow = recurring.some((avail) => {
        const tz = avail.timezone || shift.location?.timezone || 'UTC';
        return isShiftFullyWithinAvailability(
          shiftStart,
          shiftEnd,
          avail.start_time,
          avail.end_time,
          tz,
        );
      });
      if (!fitsTimeWindow) {
        const windows = recurring
          .map((a) => `${a.start_time}–${a.end_time}`)
          .join(', ');
        violations.push({
          type: 'not_available',
          severity: 'error',
          message: `Shift time falls outside the staff member's available window (${windows}) on ${format(shiftStart, 'EEEE')}s.`,
          details: {
            day: format(shiftStart, 'EEEE'),
            available_windows: recurring.map((a) => ({
              start: a.start_time,
              end: a.end_time,
            })),
          },
        });
      }
    }
  }

  // 4. Check double-booking (overlapping shifts across all locations)
  const { data: existingAssignments } = await supabase
    .from('shift_assignments')
    .select('*, shift:shifts(*)')
    .eq('staff_id', staffId)
    .eq('status', 'assigned');

  if (existingAssignments) {
    for (const assignment of existingAssignments) {
      const existingShift = assignment.shift;
      if (!existingShift || existingShift.id === shiftId) continue;

      if (
        doShiftsOverlap(
          shift.start_time,
          shift.end_time,
          existingShift.start_time,
          existingShift.end_time,
        )
      ) {
        violations.push({
          type: 'double_booking',
          severity: 'error',
          message: `Staff member is already assigned to a shift from ${existingShift.start_time} to ${existingShift.end_time} that overlaps with this shift.`,
          details: {
            conflicting_shift_id: existingShift.id,
            conflicting_start: existingShift.start_time,
            conflicting_end: existingShift.end_time,
          },
        });
      }

      // 5. Check minimum 10-hour gap
      const gap1 = getGapBetweenShifts(
        existingShift.end_time,
        shift.start_time,
      );
      const gap2 = getGapBetweenShifts(
        shift.end_time,
        existingShift.start_time,
      );
      const minGap = Math.min(gap1, gap2);

      if (
        minGap < MINIMUM_GAP_HOURS &&
        !doShiftsOverlap(
          shift.start_time,
          shift.end_time,
          existingShift.start_time,
          existingShift.end_time,
        )
      ) {
        violations.push({
          type: 'minimum_gap',
          severity: 'error',
          message: `Only ${minGap.toFixed(1)} hours between this shift and another (minimum ${MINIMUM_GAP_HOURS}h required).`,
          details: {
            gap_hours: minGap,
            required_gap: MINIMUM_GAP_HOURS,
            conflicting_shift_id: existingShift.id,
          },
        });
      }
    }
  }

  // 6. Check overtime rules
  const weekStartDate = startOfWeek(shiftStart, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(shiftStart, { weekStartsOn: 1 });

  // Calculate weekly hours
  const weeklyAssignments =
    existingAssignments?.filter((a) => {
      if (!a.shift) return false;
      const assignmentStart = parseISO(a.shift.start_time);
      return assignmentStart >= weekStartDate && assignmentStart <= weekEndDate;
    }) || [];

  let weeklyHours = weeklyAssignments.reduce((sum, a) => {
    if (!a.shift) return sum;
    return sum + getShiftDurationHours(a.shift.start_time, a.shift.end_time);
  }, 0);

  const thisShiftHours = getShiftDurationHours(
    shift.start_time,
    shift.end_time,
  );
  const projectedWeeklyHours = weeklyHours + thisShiftHours;

  if (projectedWeeklyHours > OVERTIME_LIMIT_HOURS) {
    violations.push({
      type: 'overtime_weekly',
      severity: 'warning',
      message: `This assignment would bring the staff member to ${projectedWeeklyHours.toFixed(1)}h this week (overtime threshold: ${OVERTIME_LIMIT_HOURS}h).`,
      details: {
        current_hours: weeklyHours,
        shift_hours: thisShiftHours,
        projected_hours: projectedWeeklyHours,
      },
    });
  } else if (projectedWeeklyHours >= OVERTIME_WARNING_HOURS) {
    violations.push({
      type: 'overtime_weekly',
      severity: 'warning',
      message: `This assignment would bring the staff member to ${projectedWeeklyHours.toFixed(1)}h this week (approaching overtime at ${OVERTIME_LIMIT_HOURS}h).`,
      details: {
        current_hours: weeklyHours,
        shift_hours: thisShiftHours,
        projected_hours: projectedWeeklyHours,
      },
    });
  }

  // Daily hours check
  if (thisShiftHours > DAILY_HARD_BLOCK_HOURS) {
    violations.push({
      type: 'overtime_daily',
      severity: 'error',
      message: `This shift is ${thisShiftHours.toFixed(1)}h long, exceeding the ${DAILY_HARD_BLOCK_HOURS}h daily hard limit.`,
      details: { shift_hours: thisShiftHours, limit: DAILY_HARD_BLOCK_HOURS },
    });
  } else if (thisShiftHours > DAILY_WARNING_HOURS) {
    violations.push({
      type: 'overtime_daily',
      severity: 'warning',
      message: `This shift is ${thisShiftHours.toFixed(1)}h long, exceeding the ${DAILY_WARNING_HOURS}h daily recommended maximum.`,
      details: { shift_hours: thisShiftHours, limit: DAILY_WARNING_HOURS },
    });
  }

  // 7. Consecutive days check
  const shiftDate2 = format(shiftStart, 'yyyy-MM-dd');
  const daysWorked = new Set<string>();
  existingAssignments?.forEach((a) => {
    if (a.shift) {
      daysWorked.add(format(parseISO(a.shift.start_time), 'yyyy-MM-dd'));
    }
  });
  daysWorked.add(shiftDate2);

  // Count consecutive days including this one
  let consecutiveDays = 1;
  const checkDate = parseISO(shiftDate2);
  for (let i = 1; i <= 7; i++) {
    const prevDate = new Date(checkDate);
    prevDate.setDate(prevDate.getDate() - i);
    if (daysWorked.has(format(prevDate, 'yyyy-MM-dd'))) {
      consecutiveDays++;
    } else {
      break;
    }
  }
  // Also check forward
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(checkDate);
    nextDate.setDate(nextDate.getDate() + i);
    if (daysWorked.has(format(nextDate, 'yyyy-MM-dd'))) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  if (consecutiveDays >= CONSECUTIVE_DAY_BLOCK) {
    violations.push({
      type: 'consecutive_days',
      severity: 'error',
      message: `This would be ${consecutiveDays} consecutive days worked. 7+ consecutive days requires manager override with documented reason.`,
      details: { consecutive_days: consecutiveDays },
    });
  } else if (consecutiveDays >= CONSECUTIVE_DAY_WARNING) {
    violations.push({
      type: 'consecutive_days',
      severity: 'warning',
      message: `This would be day ${consecutiveDays} in a row for this staff member.`,
      details: { consecutive_days: consecutiveDays },
    });
  }

  return violations;
}

// ============================================
// ASSIGNMENT
// ============================================

export async function assignStaffToShift(
  staffId: string,
  shiftId: string,
  overrideWarnings: boolean = false,
  overrideReason?: string,
): Promise<{
  success: boolean;
  violations?: ConstraintViolation[];
  message?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Run constraint checks
  const violations = await checkConstraints(staffId, shiftId);

  // Separate consecutive day violations (overridable) from hard errors
  const consecutiveViolations = violations.filter(
    (v) => v.type === 'consecutive_days',
  );
  const hardErrors = violations.filter(
    (v) => v.severity === 'error' && v.type !== 'consecutive_days',
  );
  const warnings = violations.filter((v) => v.severity === 'warning');

  // Hard errors block assignment unconditionally
  if (hardErrors.length > 0) {
    return { success: false, violations: hardErrors };
  }

  // Consecutive day violations require override reason
  if (consecutiveViolations.length > 0 && !overrideReason) {
    return { success: false, violations: consecutiveViolations };
  }

  // Other warnings require override flag
  if (warnings.length > 0 && !overrideWarnings) {
    return { success: false, violations: warnings };
  }

  // Check if already assigned
  const { data: existing } = await supabase
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftId)
    .eq('staff_id', staffId)
    .single();

  if (existing) {
    return {
      success: false,
      message: 'Staff member is already assigned to this shift.',
    };
  }

  // Create assignment first (rely on DB constraints for atomicity)
  const { error } = await supabase.from('shift_assignments').insert({
    shift_id: shiftId,
    staff_id: staffId,
    status: 'assigned',
    assigned_by: user.id,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        message: 'Staff member was just assigned by another manager.',
      };
    }
    throw error;
  }

  // Atomically verify headcount AFTER insert to close the race window.
  // If another manager inserted at the same time, one of us will exceed headcount.
  const { data: shift } = await supabase
    .from('shifts')
    .select('headcount_needed, shift_assignments(id)')
    .eq('id', shiftId)
    .single();

  if (
    shift &&
    shift.shift_assignments &&
    shift.shift_assignments.filter((a: any) => a.id).length >
      shift.headcount_needed
  ) {
    // Roll back our insert — we lost the race
    await supabase
      .from('shift_assignments')
      .delete()
      .eq('shift_id', shiftId)
      .eq('staff_id', staffId);
    return {
      success: false,
      message:
        'This shift was just filled by another manager. Please refresh and try again.',
    };
  }

  // Handle consecutive day override
  if (overrideReason && consecutiveViolations.length > 0) {
    const shiftData = await supabase
      .from('shifts')
      .select('start_time')
      .eq('id', shiftId)
      .single();
    if (shiftData.data) {
      const weekStart = format(
        startOfWeek(parseISO(shiftData.data.start_time), { weekStartsOn: 1 }),
        'yyyy-MM-dd',
      );
      await supabase.from('overtime_overrides').insert({
        staff_id: staffId,
        week_start: weekStart,
        manager_id: user.id,
        reason: overrideReason,
      });
    }
  }

  // Notify staff
  await supabase.from('notifications').insert({
    user_id: staffId,
    type: 'shift_assigned',
    title: 'New Shift Assigned',
    message: 'You have been assigned to a new shift.',
    link: '/dashboard/my-shifts',
    is_read: false,
    delivery_method: 'in_app',
  });

  // Audit log
  await supabase.from('audit_log').insert({
    entity_type: 'shift_assignment',
    entity_id: shiftId,
    action: 'create',
    changed_by: user.id,
    after_state: { staff_id: staffId, shift_id: shiftId } as unknown as Json,
    metadata: (overrideWarnings
      ? {
          override_reason: overrideReason,
          warnings: JSON.parse(JSON.stringify(warnings)),
        }
      : undefined) as Json | undefined,
  });

  revalidatePath('/dashboard/schedule');
  revalidatePath('/dashboard/shifts');
  revalidatePath('/dashboard/my-shifts');
  return { success: true };
}

export async function unassignStaffFromShift(assignmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: assignment } = await supabase
    .from('shift_assignments')
    .select(
      '*, shift:shifts(*), profile:profiles!shift_assignments_staff_id_fkey(*)',
    )
    .eq('id', assignmentId)
    .single();

  if (!assignment) throw new Error('Assignment not found');

  const { error } = await supabase
    .from('shift_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;

  // Notify staff
  await supabase.from('notifications').insert({
    user_id: assignment.staff_id,
    type: 'shift_removed',
    title: 'Shift Unassigned',
    message: 'You have been removed from a shift.',
    link: '/dashboard/my-shifts',
    is_read: false,
    delivery_method: 'in_app',
  });

  await supabase.from('audit_log').insert({
    entity_type: 'shift_assignment',
    entity_id: assignmentId,
    action: 'delete',
    changed_by: user.id,
    before_state: assignment as unknown as Json,
  });

  revalidatePath('/dashboard/schedule');
  revalidatePath('/dashboard/shifts');
  revalidatePath('/dashboard/my-shifts');
}

// ============================================
// COVERAGE CANDIDATES
// ============================================

export async function findCoverageCandidates(
  shiftId: string,
): Promise<CoverageCandidate[]> {
  const supabase = await createClient();

  // ── 1. Fetch shift details ──────────────────────────────────────────
  const { data: shift } = await supabase
    .from('shifts')
    .select('*, required_skill:skills(*), location:locations(*)')
    .eq('id', shiftId)
    .single();

  if (!shift) return [];

  const shiftStart = parseISO(shift.start_time);
  const shiftEnd = parseISO(shift.end_time);
  const shiftDate = format(shiftStart, 'yyyy-MM-dd');
  const dayOfWeek = (shiftStart.getDay() + 6) % 7;
  const thisShiftHours = getShiftDurationHours(
    shift.start_time,
    shift.end_time,
  );
  const weekStartDate = startOfWeek(shiftStart, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(shiftStart, { weekStartsOn: 1 });

  // ── 2. Bulk-fetch all data in parallel ──────────────────────────────
  const [staffResult, currentResult, allAssignmentsResult, allAvailResult] =
    await Promise.all([
      // All staff with skills & locations
      supabase
        .from('profiles')
        .select(
          `*, staff_skills(skill_id), staff_locations(location_id, decertified_at)`,
        )
        .eq('role', 'staff'),
      // Already-assigned staff for this shift
      supabase
        .from('shift_assignments')
        .select('staff_id')
        .eq('shift_id', shiftId),
      // All assignments with shift data for all staff (for overlap/gap/hours)
      supabase
        .from('shift_assignments')
        .select('staff_id, status, shift:shifts(id, start_time, end_time)')
        .eq('status', 'assigned'),
      // All availability for all staff
      supabase.from('availability').select('*'),
    ]);

  const allStaff = staffResult.data || [];
  const assignedStaffIds = new Set(
    currentResult.data?.map((a) => a.staff_id) || [],
  );
  const allAssignments = allAssignmentsResult.data || [];
  const allAvailability = allAvailResult.data || [];

  // ── 3. Index bulk data by staff_id for O(1) lookups ─────────────────
  const assignmentsByStaff = new Map<string, typeof allAssignments>();
  for (const a of allAssignments) {
    const list = assignmentsByStaff.get(a.staff_id) || [];
    list.push(a);
    assignmentsByStaff.set(a.staff_id, list);
  }

  const availByStaff = new Map<string, typeof allAvailability>();
  for (const a of allAvailability) {
    const list = availByStaff.get(a.staff_id) || [];
    list.push(a);
    availByStaff.set(a.staff_id, list);
  }

  // ── 4. Evaluate each candidate in-memory (zero extra queries) ───────
  const candidates: CoverageCandidate[] = [];

  for (const staff of allStaff) {
    if (assignedStaffIds.has(staff.id)) continue;

    const violations: ConstraintViolation[] = [];

    // 4a. Skill requirement
    const hasSkill = staff.staff_skills?.some(
      (s: { skill_id: string }) => s.skill_id === shift.required_skill_id,
    );
    if (!hasSkill) {
      violations.push({
        type: 'missing_skill',
        severity: 'error',
        message: `Staff member does not have the "${shift.required_skill?.name}" skill required for this shift.`,
        details: { required_skill: shift.required_skill?.name },
      });
    }

    // 4b. Location certification
    const isCertified = staff.staff_locations?.some(
      (l: { location_id: string; decertified_at: string | null }) =>
        l.location_id === shift.location_id && !l.decertified_at,
    );
    if (!isCertified) {
      violations.push({
        type: 'not_certified',
        severity: 'error',
        message: `Staff member is not certified to work at ${shift.location?.name}.`,
        details: { location: shift.location?.name },
      });
    }

    // 4c. Availability
    const staffAvail = availByStaff.get(staff.id) || [];
    const exceptions = staffAvail.filter(
      (a) => a.type === 'exception' && a.specific_date === shiftDate,
    );

    if (exceptions.length > 0) {
      const isBlocked = exceptions.some((e) => !e.is_available);
      if (isBlocked) {
        violations.push({
          type: 'not_available',
          severity: 'error',
          message: 'Staff member has marked this date as unavailable.',
          details: { date: shiftDate },
        });
      } else {
        const availableExceptions = exceptions.filter((e) => e.is_available);
        const fitsTimeWindow = availableExceptions.some((avail) => {
          const tz = avail.timezone || shift.location?.timezone || 'UTC';
          return isShiftFullyWithinAvailability(
            shiftStart,
            shiftEnd,
            avail.start_time,
            avail.end_time,
            tz,
          );
        });
        if (!fitsTimeWindow) {
          const windows = availableExceptions
            .map((a) => `${a.start_time}–${a.end_time}`)
            .join(', ');
          violations.push({
            type: 'not_available',
            severity: 'error',
            message: `Shift time falls outside the staff member's available window (${windows}) on ${shiftDate}.`,
            details: {
              date: shiftDate,
              available_windows: availableExceptions.map((a) => ({
                start: a.start_time,
                end: a.end_time,
              })),
            },
          });
        }
      }
    } else {
      const recurring = staffAvail.filter(
        (a) => a.type === 'recurring' && a.day_of_week === dayOfWeek,
      );
      if (!recurring || recurring.length === 0) {
        violations.push({
          type: 'not_available',
          severity: 'error',
          message: `Staff member has no availability set for ${format(shiftStart, 'EEEE')}.`,
          details: { day: format(shiftStart, 'EEEE') },
        });
      } else {
        const fitsTimeWindow = recurring.some((avail) => {
          const tz = avail.timezone || shift.location?.timezone || 'UTC';
          return isShiftFullyWithinAvailability(
            shiftStart,
            shiftEnd,
            avail.start_time,
            avail.end_time,
            tz,
          );
        });
        if (!fitsTimeWindow) {
          const windows = recurring
            .map((a) => `${a.start_time}–${a.end_time}`)
            .join(', ');
          violations.push({
            type: 'not_available',
            severity: 'error',
            message: `Shift time falls outside the staff member's available window (${windows}) on ${format(shiftStart, 'EEEE')}s.`,
            details: {
              day: format(shiftStart, 'EEEE'),
              available_windows: recurring.map((a) => ({
                start: a.start_time,
                end: a.end_time,
              })),
            },
          });
        }
      }
    }

    // 4d. Double-booking & minimum gap
    const staffAssignments = assignmentsByStaff.get(staff.id) || [];
    for (const assignment of staffAssignments) {
      const existingShift = assignment.shift as unknown as {
        id: string;
        start_time: string;
        end_time: string;
      } | null;
      if (!existingShift || existingShift.id === shiftId) continue;

      if (
        doShiftsOverlap(
          shift.start_time,
          shift.end_time,
          existingShift.start_time,
          existingShift.end_time,
        )
      ) {
        violations.push({
          type: 'double_booking',
          severity: 'error',
          message: `Staff member is already assigned to a shift from ${existingShift.start_time} to ${existingShift.end_time} that overlaps with this shift.`,
          details: {
            conflicting_shift_id: existingShift.id,
            conflicting_start: existingShift.start_time,
            conflicting_end: existingShift.end_time,
          },
        });
      }

      const gap1 = getGapBetweenShifts(
        existingShift.end_time,
        shift.start_time,
      );
      const gap2 = getGapBetweenShifts(
        shift.end_time,
        existingShift.start_time,
      );
      const minGap = Math.min(gap1, gap2);

      if (
        minGap < MINIMUM_GAP_HOURS &&
        !doShiftsOverlap(
          shift.start_time,
          shift.end_time,
          existingShift.start_time,
          existingShift.end_time,
        )
      ) {
        violations.push({
          type: 'minimum_gap',
          severity: 'error',
          message: `Only ${minGap.toFixed(1)} hours between this shift and another (minimum ${MINIMUM_GAP_HOURS}h required).`,
          details: {
            gap_hours: minGap,
            required_gap: MINIMUM_GAP_HOURS,
            conflicting_shift_id: existingShift.id,
          },
        });
      }
    }

    // 4e. Weekly overtime
    let weeklyHours = 0;
    const daysWorked = new Set<string>();
    for (const a of staffAssignments) {
      const s = a.shift as unknown as {
        id: string;
        start_time: string;
        end_time: string;
      } | null;
      if (!s) continue;
      const aStart = parseISO(s.start_time);
      daysWorked.add(format(aStart, 'yyyy-MM-dd'));
      if (aStart >= weekStartDate && aStart <= weekEndDate) {
        weeklyHours += getShiftDurationHours(s.start_time, s.end_time);
      }
    }

    const projectedWeeklyHours = weeklyHours + thisShiftHours;

    if (projectedWeeklyHours > OVERTIME_LIMIT_HOURS) {
      violations.push({
        type: 'overtime_weekly',
        severity: 'warning',
        message: `This assignment would bring the staff member to ${projectedWeeklyHours.toFixed(1)}h this week (overtime threshold: ${OVERTIME_LIMIT_HOURS}h).`,
        details: {
          current_hours: weeklyHours,
          shift_hours: thisShiftHours,
          projected_hours: projectedWeeklyHours,
        },
      });
    } else if (projectedWeeklyHours >= OVERTIME_WARNING_HOURS) {
      violations.push({
        type: 'overtime_weekly',
        severity: 'warning',
        message: `This assignment would bring the staff member to ${projectedWeeklyHours.toFixed(1)}h this week (approaching overtime at ${OVERTIME_LIMIT_HOURS}h).`,
        details: {
          current_hours: weeklyHours,
          shift_hours: thisShiftHours,
          projected_hours: projectedWeeklyHours,
        },
      });
    }

    // Daily hours check
    if (thisShiftHours > DAILY_HARD_BLOCK_HOURS) {
      violations.push({
        type: 'overtime_daily',
        severity: 'error',
        message: `This shift is ${thisShiftHours.toFixed(1)}h long, exceeding the ${DAILY_HARD_BLOCK_HOURS}h daily hard limit.`,
        details: { shift_hours: thisShiftHours, limit: DAILY_HARD_BLOCK_HOURS },
      });
    } else if (thisShiftHours > DAILY_WARNING_HOURS) {
      violations.push({
        type: 'overtime_daily',
        severity: 'warning',
        message: `This shift is ${thisShiftHours.toFixed(1)}h long, exceeding the ${DAILY_WARNING_HOURS}h daily recommended maximum.`,
        details: { shift_hours: thisShiftHours, limit: DAILY_WARNING_HOURS },
      });
    }

    // 4f. Consecutive days check
    daysWorked.add(shiftDate);
    let consecutiveDays = 1;
    const checkDate = parseISO(shiftDate);
    for (let i = 1; i <= 7; i++) {
      const prevDate = new Date(checkDate);
      prevDate.setDate(prevDate.getDate() - i);
      if (daysWorked.has(format(prevDate, 'yyyy-MM-dd'))) {
        consecutiveDays++;
      } else {
        break;
      }
    }
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(checkDate);
      nextDate.setDate(nextDate.getDate() + i);
      if (daysWorked.has(format(nextDate, 'yyyy-MM-dd'))) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    if (consecutiveDays >= CONSECUTIVE_DAY_BLOCK) {
      violations.push({
        type: 'consecutive_days',
        severity: 'error',
        message: `This would be ${consecutiveDays} consecutive days worked. 7+ consecutive days requires manager override with documented reason.`,
        details: { consecutive_days: consecutiveDays },
      });
    } else if (consecutiveDays >= CONSECUTIVE_DAY_WARNING) {
      violations.push({
        type: 'consecutive_days',
        severity: 'warning',
        message: `This would be day ${consecutiveDays} in a row for this staff member.`,
        details: { consecutive_days: consecutiveDays },
      });
    }

    candidates.push({
      profile: staff,
      violations,
      weekly_hours: weeklyHours,
      is_available: !violations.some((v) => v.type === 'not_available'),
      has_skill: !!hasSkill,
      is_certified: !!isCertified,
    });
  }

  // Sort: fewest errors first, then by weekly hours (fewest first)
  candidates.sort((a, b) => {
    const aErrors = a.violations.filter((v) => v.severity === 'error').length;
    const bErrors = b.violations.filter((v) => v.severity === 'error').length;
    if (aErrors !== bErrors) return aErrors - bErrors;
    return a.weekly_hours - b.weekly_hours;
  });

  return candidates;
}

// Get staff's shifts
export async function getMyShifts(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('shift_assignments')
    .select(
      `
      *,
      shift:shifts(*, required_skill:skills(*), location:locations(*), schedule:schedules(*))
    `,
    )
    .eq('staff_id', user.id)
    .eq('status', 'assigned')
    .order('assigned_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // Filter by date if provided
  if (startDate && endDate && data) {
    return data.filter((a) => {
      const shift = a.shift as any;
      if (!shift) return false;
      return shift.start_time >= startDate && shift.start_time <= endDate;
    });
  }

  return data;
}

// Get all shifts for a location (for manager view)
export async function getAllShiftsForLocation(locationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shifts')
    .select(
      `
      *,
      required_skill:skills(*),
      location:locations(*),
      schedule:schedules(*),
      shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
    `,
    )
    .eq('location_id', locationId)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data;
}

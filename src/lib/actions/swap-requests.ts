'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/lib/supabase/database.types';
import {
  MAX_PENDING_SWAP_REQUESTS,
  DROP_REQUEST_EXPIRE_HOURS_BEFORE_SHIFT,
} from '@/lib/utils/constants';
import { parseISO, subHours } from 'date-fns';
import { checkConstraints } from '@/lib/actions/shifts';

export async function getSwapRequests(filter?: 'pending' | 'all') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  await supabase.from('profiles').select('role').eq('id', user.id).single();

  let query = supabase
    .from('swap_requests')
    .select(
      `
      *,
      requesting_assignment:shift_assignments!swap_requests_requesting_assignment_id_fkey(
        *,
        shift:shifts(*, required_skill:skills(*), location:locations(*)),
        profile:profiles!shift_assignments_staff_id_fkey(*)
      ),
      target_staff:profiles!swap_requests_target_staff_id_fkey(*),
      target_assignment:shift_assignments!swap_requests_target_assignment_id_fkey(
        *,
        shift:shifts(*, location:locations(*)),
        profile:profiles!shift_assignments_staff_id_fkey(*)
      ),
      manager:profiles!swap_requests_manager_id_fkey(*)
    `,
    )
    .order('created_at', { ascending: false });

  if (filter === 'pending') {
    query = query.in('status', ['pending_peer', 'pending_manager']);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Auto-expire any drop requests past their expiry
  const now = new Date();
  const expired = (data || []).filter(
    (r) =>
      r.type === 'drop' &&
      r.expires_at &&
      parseISO(r.expires_at) <= now &&
      ['pending_peer', 'pending_manager'].includes(r.status),
  );
  if (expired.length > 0) {
    await supabase
      .from('swap_requests')
      .update({ status: 'cancelled', resolved_at: now.toISOString() })
      .in(
        'id',
        expired.map((e) => e.id),
      );
    // Remove expired from returned data
    const expiredIds = new Set(expired.map((e) => e.id));
    return (data || []).filter((r) => !expiredIds.has(r.id));
  }

  return data || [];
}

export async function createSwapRequest(data: {
  type: 'swap' | 'drop';
  requesting_assignment_id: string;
  target_staff_id?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check pending request limit
  await supabase
    .from('swap_requests')
    .select('*', { count: 'exact', head: true })
    .eq('requesting_assignment_id', data.requesting_assignment_id)
    .in('status', ['pending_peer', 'pending_manager']);

  // Check total pending for the staff member
  const { data: myAssignments } = await supabase
    .from('shift_assignments')
    .select('id')
    .eq('staff_id', user.id);

  if (myAssignments) {
    const myAssignmentIds = myAssignments.map((a) => a.id);
    const { count: totalPending } = await supabase
      .from('swap_requests')
      .select('*', { count: 'exact', head: true })
      .in('requesting_assignment_id', myAssignmentIds)
      .in('status', ['pending_peer', 'pending_manager']);

    if (totalPending && totalPending >= MAX_PENDING_SWAP_REQUESTS) {
      return {
        success: false,
        message: `You can only have ${MAX_PENDING_SWAP_REQUESTS} pending swap/drop requests at a time.`,
      };
    }
  }

  // Get the shift to calculate expiry for drop requests
  const { data: assignment } = await supabase
    .from('shift_assignments')
    .select('shift:shifts(start_time)')
    .eq('id', data.requesting_assignment_id)
    .single();

  let expiresAt: string | null = null;
  if (data.type === 'drop' && assignment?.shift) {
    const shiftStart = parseISO(
      (assignment.shift as unknown as { start_time: string }).start_time,
    );
    expiresAt = subHours(
      shiftStart,
      DROP_REQUEST_EXPIRE_HOURS_BEFORE_SHIFT,
    ).toISOString();
  }

  const { data: swapRequest, error } = await supabase
    .from('swap_requests')
    .insert({
      type: data.type,
      requesting_assignment_id: data.requesting_assignment_id,
      target_staff_id: data.target_staff_id || null,
      status: data.type === 'swap' ? 'pending_peer' : 'pending_manager',
      expires_at: expiresAt,
      resolved_at: null,
      manager_id: null,
      reason: null,
      target_assignment_id: null,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Notify target staff (for swaps) or managers (for drops)
  if (data.type === 'swap' && data.target_staff_id) {
    await supabase.from('notifications').insert({
      user_id: data.target_staff_id,
      type: 'swap_requested',
      title: 'Swap Request',
      message: 'Someone wants to swap a shift with you.',
      link: '/dashboard/swap-requests',
      is_read: false,
      delivery_method: 'in_app',
    });
  }

  // Audit log
  await supabase.from('audit_log').insert({
    entity_type: 'swap_request',
    entity_id: swapRequest.id,
    action: 'create',
    changed_by: user.id,
    after_state: swapRequest as unknown as Json,
  });

  revalidatePath('/dashboard/swap-requests');
  revalidatePath('/dashboard/my-shifts');
  return { success: true, data: swapRequest };
}

export async function acceptSwapRequest(swapRequestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: request } = await supabase
    .from('swap_requests')
    .select(
      '*, requesting_assignment:shift_assignments!requesting_assignment_id(staff_id)',
    )
    .eq('id', swapRequestId)
    .single();

  if (!request) throw new Error('Swap request not found');
  if (request.status !== 'pending_peer') {
    return {
      success: false,
      message: 'This swap request is no longer pending peer acceptance.',
    };
  }

  const { error } = await supabase
    .from('swap_requests')
    .update({ status: 'pending_manager' })
    .eq('id', swapRequestId);

  if (error) throw error;

  // Notify the requester
  const requesterId = (
    request.requesting_assignment as { staff_id: string } | null
  )?.staff_id;
  if (requesterId) {
    await supabase.from('notifications').insert({
      user_id: requesterId,
      type: 'swap_peer_accepted',
      title: 'Swap Accepted by Peer',
      message:
        'Your swap request has been accepted and is now awaiting manager approval.',
      link: '/dashboard/swap-requests',
      is_read: false,
      delivery_method: 'in_app',
    });
  }

  revalidatePath('/dashboard/swap-requests');
  return { success: true };
}

export async function approveSwapRequest(swapRequestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: request } = await supabase
    .from('swap_requests')
    .select(
      `
      *,
      requesting_assignment:shift_assignments!swap_requests_requesting_assignment_id_fkey(*, shift:shifts(*), profile:profiles!shift_assignments_staff_id_fkey(*)),
      target_staff:profiles!swap_requests_target_staff_id_fkey(*)
    `,
    )
    .eq('id', swapRequestId)
    .single();

  if (!request) throw new Error('Swap request not found');
  if (request.status !== 'pending_manager') {
    return {
      success: false,
      message: 'This request is not pending manager approval.',
    };
  }

  const reqAssignment = request.requesting_assignment as unknown as {
    staff_id: string;
    shift_id: string;
  } | null;
  if (!reqAssignment) throw new Error('Requesting assignment not found');

  if (request.type === 'swap' && request.target_staff_id) {
    // Run constraint checks on the target staff for the shift being swapped
    const violations = await checkConstraints(
      request.target_staff_id,
      reqAssignment.shift_id,
    );
    const hardErrors = violations.filter(
      (v) => v.severity === 'error' && v.type !== 'consecutive_days',
    );
    if (hardErrors.length > 0) {
      return {
        success: false,
        message: `Cannot approve swap: ${hardErrors.map((v) => v.message).join('; ')}`,
        violations: hardErrors,
      };
    }

    // Swap: reassign the shift from requester to target
    await supabase
      .from('shift_assignments')
      .update({ status: 'swapped' })
      .eq('id', request.requesting_assignment_id);

    // Create new assignment for target
    await supabase.from('shift_assignments').insert({
      shift_id: reqAssignment.shift_id,
      staff_id: request.target_staff_id,
      status: 'assigned',
      assigned_by: user.id,
    });

    // Notify both parties
    await supabase.from('notifications').insert([
      {
        user_id: reqAssignment.staff_id,
        type: 'swap_approved',
        title: 'Swap Approved',
        message: 'Your swap request has been approved by the manager.',
        link: '/dashboard/my-shifts',
        is_read: false,
        delivery_method: 'in_app',
      },
      {
        user_id: request.target_staff_id,
        type: 'swap_approved',
        title: 'Swap Approved',
        message: 'A shift swap has been approved. You have a new shift.',
        link: '/dashboard/my-shifts',
        is_read: false,
        delivery_method: 'in_app',
      },
    ]);
  } else if (request.type === 'drop') {
    // Drop: mark assignment as dropped
    await supabase
      .from('shift_assignments')
      .update({ status: 'dropped' })
      .eq('id', request.requesting_assignment_id);

    await supabase.from('notifications').insert({
      user_id: reqAssignment.staff_id,
      type: 'drop_approved',
      title: 'Drop Request Approved',
      message: 'Your shift drop has been approved.',
      link: '/dashboard/my-shifts',
      is_read: false,
      delivery_method: 'in_app',
    });
  }

  // Update request status
  await supabase
    .from('swap_requests')
    .update({
      status: 'approved',
      manager_id: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', swapRequestId);

  // Audit log
  await supabase.from('audit_log').insert({
    entity_type: 'swap_request',
    entity_id: swapRequestId,
    action: 'update',
    changed_by: user.id,
    before_state: { status: request.status },
    after_state: { status: 'approved' },
  });

  revalidatePath('/dashboard/swap-requests');
  revalidatePath('/dashboard/schedule');
  revalidatePath('/dashboard/my-shifts');
  return { success: true };
}

export async function rejectSwapRequest(
  swapRequestId: string,
  reason?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: request } = await supabase
    .from('swap_requests')
    .select(
      '*, requesting_assignment:shift_assignments!requesting_assignment_id(staff_id)',
    )
    .eq('id', swapRequestId)
    .single();

  if (!request) throw new Error('Swap request not found');

  await supabase
    .from('swap_requests')
    .update({
      status: 'rejected',
      manager_id: user.id,
      reason: reason || null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', swapRequestId);

  const requesterId = (
    request.requesting_assignment as { staff_id: string } | null
  )?.staff_id;
  if (requesterId) {
    await supabase.from('notifications').insert({
      user_id: requesterId,
      type: 'swap_rejected',
      title: 'Request Rejected',
      message: reason
        ? `Your request was rejected: ${reason}`
        : 'Your swap/drop request was rejected.',
      link: '/dashboard/swap-requests',
      is_read: false,
      delivery_method: 'in_app',
    });
  }

  revalidatePath('/dashboard/swap-requests');
  return { success: true };
}

export async function cancelSwapRequest(swapRequestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: request } = await supabase
    .from('swap_requests')
    .select('*')
    .eq('id', swapRequestId)
    .single();

  if (!request) throw new Error('Swap request not found');
  if (!['pending_peer', 'pending_manager'].includes(request.status)) {
    return {
      success: false,
      message: 'This request can no longer be cancelled.',
    };
  }

  await supabase
    .from('swap_requests')
    .update({
      status: 'cancelled',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', swapRequestId);

  // Notify target staff if it was a swap
  if (request.target_staff_id) {
    await supabase.from('notifications').insert({
      user_id: request.target_staff_id,
      type: 'swap_cancelled',
      title: 'Swap Cancelled',
      message: 'A swap request has been cancelled by the requester.',
      link: '/dashboard/swap-requests',
      is_read: false,
      delivery_method: 'in_app',
    });
  }

  revalidatePath('/dashboard/swap-requests');
  return { success: true };
}

export async function claimDroppedShift(swapRequestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: request } = await supabase
    .from('swap_requests')
    .select(
      `
      *,
      requesting_assignment:shift_assignments!requesting_assignment_id(*, shift:shifts(*))
    `,
    )
    .eq('id', swapRequestId)
    .single();

  if (!request) throw new Error('Request not found');

  // Check expiry
  if (request.expires_at && parseISO(request.expires_at) <= new Date()) {
    // Auto-expire
    await supabase
      .from('swap_requests')
      .update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('id', swapRequestId);
    return {
      success: false,
      message: 'This drop request has expired and is no longer available.',
    };
  }

  if (
    request.type !== 'drop' ||
    !['pending_manager', 'approved'].includes(request.status)
  ) {
    return {
      success: false,
      message: 'This shift is not available for pickup.',
    };
  }

  const shiftData = request.requesting_assignment as unknown as {
    staff_id: string;
    shift_id: string;
    shift?: { id: string; location_id?: string; start_time?: string };
  } | null;

  // If the drop is already approved by a manager, directly assign the shift
  if (request.status === 'approved') {
    const shiftId = shiftData?.shift?.id;
    if (!shiftId) return { success: false, message: 'Shift data not found.' };

    // Assign the claiming staff to the shift
    const { error } = await supabase.from('shift_assignments').insert({
      shift_id: shiftId,
      staff_id: user.id,
      status: 'assigned',
      assigned_by: user.id,
    });
    if (error) return { success: false, message: 'Failed to assign shift.' };

    // Mark the swap request as approved (claimed)
    await supabase
      .from('swap_requests')
      .update({
        target_staff_id: user.id,
        status: 'approved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', swapRequestId);

    // Notify the original staff member
    await supabase.from('notifications').insert({
      user_id: shiftData.staff_id,
      type: 'drop_approved',
      title: 'Your Dropped Shift Was Claimed',
      message: 'Another staff member has picked up your dropped shift.',
      link: '/dashboard/my-shifts',
      is_read: false,
      delivery_method: 'in_app',
    });

    revalidatePath('/dashboard/swap-requests');
    revalidatePath('/dashboard/open-shifts');
    revalidatePath('/dashboard/my-shifts');
    return {
      success: true,
      message: 'Shift assigned to you directly. Check My Shifts!',
    };
  }

  // Pending drop: set target_staff_id and notify managers for approval
  await supabase
    .from('swap_requests')
    .update({
      target_staff_id: user.id,
    })
    .eq('id', swapRequestId);

  // Notify managers
  if (shiftData?.shift?.location_id) {
    const { data: managers } = await supabase
      .from('manager_locations')
      .select('manager_id')
      .eq('location_id', shiftData.shift.location_id);

    if (managers) {
      const notifications = managers.map((m) => ({
        user_id: m.manager_id,
        type: 'drop_claimed' as const,
        title: 'Dropped Shift Claimed',
        message:
          'A staff member has volunteered to pick up a dropped shift. Approval needed.',
        link: '/dashboard/swap-requests',
        is_read: false,
        delivery_method: 'in_app' as const,
      }));
      await supabase.from('notifications').insert(notifications);
    }
  }

  revalidatePath('/dashboard/swap-requests');
  revalidatePath('/dashboard/open-shifts');
  return { success: true, message: 'Shift claimed! Pending manager approval.' };
}

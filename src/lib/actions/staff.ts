'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getSkills() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function getStaffMembers(locationId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('profiles')
    .select(
      `
      *,
      staff_skills(*, skill:skills(*)),
      staff_locations(*, location:locations(*))
    `,
    )
    .eq('role', 'staff')
    .order('full_name');

  if (locationId) {
    // Filter to staff certified at this location
    const { data: certifiedStaff } = await supabase
      .from('staff_locations')
      .select('staff_id')
      .eq('location_id', locationId)
      .is('decertified_at', null);

    if (certifiedStaff) {
      const staffIds = certifiedStaff.map((s) => s.staff_id);
      if (staffIds.length > 0) {
        query = query.in('id', staffIds);
      }
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getStaffMember(staffId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      *,
      staff_skills(*, skill:skills(*)),
      staff_locations(*, location:locations(*))
    `,
    )
    .eq('id', staffId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateStaffSkills(staffId: string, skillIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Remove existing skills
  await supabase.from('staff_skills').delete().eq('staff_id', staffId);

  // Add new skills
  if (skillIds.length > 0) {
    const { error } = await supabase
      .from('staff_skills')
      .insert(skillIds.map((skill_id) => ({ staff_id: staffId, skill_id })));
    if (error) throw error;
  }

  // Audit log
  await supabase.from('audit_log').insert({
    entity_type: 'staff_skills',
    entity_id: staffId,
    action: 'update',
    changed_by: user.id,
    after_state: { skill_ids: skillIds },
    metadata: { staff_id: staffId },
  });

  revalidatePath('/dashboard/staff');
}

export async function updateStaffLocations(
  staffId: string,
  locationIds: string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get current locations
  const { data: current } = await supabase
    .from('staff_locations')
    .select('*')
    .eq('staff_id', staffId)
    .is('decertified_at', null);

  const currentIds = (current || []).map((l) => l.location_id);

  // Decertify removed locations (soft delete)
  const toRemove = currentIds.filter((id) => !locationIds.includes(id));
  for (const locId of toRemove) {
    await supabase
      .from('staff_locations')
      .update({ decertified_at: new Date().toISOString() })
      .eq('staff_id', staffId)
      .eq('location_id', locId);
  }

  // Add new locations
  const toAdd = locationIds.filter((id) => !currentIds.includes(id));
  if (toAdd.length > 0) {
    // Check if there's a decertified record to re-certify
    for (const locId of toAdd) {
      const { data: existing } = await supabase
        .from('staff_locations')
        .select('*')
        .eq('staff_id', staffId)
        .eq('location_id', locId)
        .single();

      if (existing) {
        await supabase
          .from('staff_locations')
          .update({
            decertified_at: null,
            certified_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('staff_locations').insert({
          staff_id: staffId,
          location_id: locId,
        });
      }
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    entity_type: 'staff_locations',
    entity_id: staffId,
    action: 'update',
    changed_by: user.id,
    before_state: { location_ids: currentIds },
    after_state: { location_ids: locationIds },
  });

  revalidatePath('/dashboard/staff');
}

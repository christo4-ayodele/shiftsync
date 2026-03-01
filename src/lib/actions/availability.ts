'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/lib/supabase/database.types'

export async function getAvailability(staffId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const targetId = staffId || user.id

  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('staff_id', targetId)
    .order('day_of_week')
    .order('start_time')

  if (error) throw error
  return data
}

export async function setRecurringAvailability(entries: {
  day_of_week: number
  start_time: string
  end_time: string
  timezone: string
}[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Delete existing recurring availability
  await supabase
    .from('availability')
    .delete()
    .eq('staff_id', user.id)
    .eq('type', 'recurring')

  // Insert new entries
  if (entries.length > 0) {
    const { error } = await supabase.from('availability').insert(
      entries.map(e => ({
        staff_id: user.id,
        type: 'recurring' as const,
        day_of_week: e.day_of_week,
        specific_date: null,
        start_time: e.start_time,
        end_time: e.end_time,
        is_available: true,
        timezone: e.timezone,
      }))
    )
    if (error) throw error
  }

  // Audit
  await supabase.from('audit_log').insert({
    entity_type: 'availability',
    entity_id: user.id,
    action: 'update',
    changed_by: user.id,
    after_state: { recurring: entries } as unknown as Json,
  })

  revalidatePath('/dashboard/availability')
  return { success: true }
}

export async function addAvailabilityException(data: {
  specific_date: string
  start_time: string
  end_time: string
  is_available: boolean
  timezone: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('availability').insert({
    staff_id: user.id,
    type: 'exception',
    day_of_week: null,
    specific_date: data.specific_date,
    start_time: data.start_time,
    end_time: data.end_time,
    is_available: data.is_available,
    timezone: data.timezone,
  })

  if (error) throw error

  revalidatePath('/dashboard/availability')
  return { success: true }
}

export async function deleteAvailabilityException(exceptionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('availability')
    .delete()
    .eq('id', exceptionId)
    .eq('staff_id', user.id)

  if (error) throw error

  revalidatePath('/dashboard/availability')
  return { success: true }
}

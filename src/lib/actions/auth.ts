'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function getUserLocations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return []

  if (profile.role === 'admin') {
    const { data } = await supabase.from('locations').select('*').order('name')
    return data || []
  }

  if (profile.role === 'manager') {
    const { data } = await supabase
      .from('manager_locations')
      .select('location:locations(*)')
      .eq('manager_id', user.id)
    return data?.map(d => d.location).filter(Boolean) || []
  }

  // Staff - return certified locations
  const { data } = await supabase
    .from('staff_locations')
    .select('location:locations(*)')
    .eq('staff_id', user.id)
    .is('decertified_at', null)
  return data?.map(d => d.location).filter(Boolean) || []
}

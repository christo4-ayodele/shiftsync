'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { Json } from '@/lib/supabase/database.types';

export async function getNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
  revalidatePath('/dashboard/notifications');
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw error;
  revalidatePath('/dashboard/notifications');
}

export async function updateNotificationPreferences(
  preferences: Record<string, unknown>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ notification_preferences: preferences as unknown as Json })
    .eq('id', user.id);

  if (error) throw error;
  revalidatePath('/dashboard/settings');
}

export async function createNotification(data: {
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  delivery_method?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('notifications').insert({
    ...data,
    is_read: false,
    delivery_method: data.delivery_method || 'in_app',
  });
  if (error) throw error;
}

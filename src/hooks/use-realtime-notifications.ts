'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotificationStore } from '@/stores/notification-store'
import { toast } from 'sonner'

export function useRealtimeNotifications(userId: string | undefined) {
  const { setUnreadCount, increment } = useNotificationStore()

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Fetch initial unread count
    async function fetchUnreadCount() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false)

      setUnreadCount(count || 0)
    }

    fetchUnreadCount()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as { title: string; message: string }
          increment()
          toast(notification.title, {
            description: notification.message,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, setUnreadCount, increment])
}

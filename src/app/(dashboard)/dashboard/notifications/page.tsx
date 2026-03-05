'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/actions/notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  ArrowRightLeft,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { parseISO, formatDistanceToNow } from 'date-fns';
import { useNotificationStore } from '@/stores/notification-store';
import type { Notification } from '@/lib/types/database';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  schedule_published: Calendar,
  shift_assigned: Calendar,
  shift_unassigned: Calendar,
  swap_requested: ArrowRightLeft,
  swap_accepted: ArrowRightLeft,
  swap_approved: ArrowRightLeft,
  swap_rejected: ArrowRightLeft,
  drop_request: ArrowRightLeft,
  overtime_warning: AlertTriangle,
};

export default function NotificationsPage() {
  const { user } = useCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { setUnreadCount } = useNotificationStore();

  useEffect(() => {
    async function load() {
      if (!user) return;
      const data = await getNotifications();
      setNotifications(data);
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((n) =>
      n.map((notif) => (notif.id === id ? { ...notif, is_read: true } : notif)),
    );
    setUnreadCount(
      Math.max(0, notifications.filter((n) => !n.is_read).length - 1),
    );
  }

  async function handleMarkAllRead() {
    if (!user) return;
    await markAllNotificationsRead();
    setNotifications((n) => n.map((notif) => ({ ...notif, is_read: true })));
    setUnreadCount(0);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const Icon = ICON_MAP[notif.type] || Info;
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors
                  ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' : 'border-transparent hover:bg-muted/50'}
                `}
              >
                <div
                  className={`mt-0.5 p-1.5 rounded-full ${!notif.is_read ? 'bg-blue-100 text-blue-600' : 'bg-muted text-muted-foreground'}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${!notif.is_read ? 'font-medium' : 'text-muted-foreground'}`}
                  >
                    {notif.title}
                  </p>
                  {notif.message && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {notif.message}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(parseISO(notif.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {!notif.is_read && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

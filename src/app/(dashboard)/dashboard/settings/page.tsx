'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { updateNotificationPreferences } from '@/lib/actions/notifications';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  Bell,
  Calendar,
  ArrowRightLeft,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    schedule_published: true,
    shift_assigned: true,
    shift_unassigned: true,
    swap_requested: true,
    swap_approved: true,
    swap_rejected: true,
    overtime_warning: true,
  });

  useEffect(() => {
    if (
      user?.notification_preferences &&
      typeof user.notification_preferences === 'object' &&
      !Array.isArray(user.notification_preferences)
    ) {
      setPreferences((prev) => ({
        ...prev,
        ...(user.notification_preferences as Record<string, boolean>),
      }));
    }
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await updateNotificationPreferences(preferences);
    setSaving(false);
    toast.success('Settings saved');
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and notification preferences
        </p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl">
                {user.full_name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge
                variant={
                  user.role === 'admin'
                    ? 'default'
                    : user.role === 'manager'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {user.role}
              </Badge>
            </div>
          </div>
          <Separator />
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Weekly Hours</span>
              <span className="font-medium">
                {user.desired_weekly_hours || 40}h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member Since</span>
              <span className="font-medium">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label>Schedule Published</Label>
              </div>
              <Switch
                checked={preferences.schedule_published}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, schedule_published: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label>Shift Assigned</Label>
              </div>
              <Switch
                checked={preferences.shift_assigned}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, shift_assigned: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label>Shift Unassigned</Label>
              </div>
              <Switch
                checked={preferences.shift_unassigned}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, shift_unassigned: v }))
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <Label>Swap Requested</Label>
              </div>
              <Switch
                checked={preferences.swap_requested}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, swap_requested: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <Label>Swap Approved</Label>
              </div>
              <Switch
                checked={preferences.swap_approved}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, swap_approved: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <Label>Swap Rejected</Label>
              </div>
              <Switch
                checked={preferences.swap_rejected}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, swap_rejected: v }))
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <Label>Overtime Warnings</Label>
              </div>
              <Switch
                checked={preferences.overtime_warning}
                onCheckedChange={(v) =>
                  setPreferences((p) => ({ ...p, overtime_warning: v }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{' '}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

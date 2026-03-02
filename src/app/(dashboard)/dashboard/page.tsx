import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  ArrowLeftRight,
  Radio,
} from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Fetch dashboard stats based on role
  const now = new Date().toISOString();

  // Counts
  const { count: staffCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'staff');

  const { count: locationCount } = await supabase
    .from('locations')
    .select('*', { count: 'exact', head: true });

  const { count: pendingSwaps } = await supabase
    .from('swap_requests')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending_peer', 'pending_manager']);

  // Active shifts (happening now)
  const { data: activeShifts } = await supabase
    .from('shifts')
    .select('id')
    .lte('start_time', now)
    .gte('end_time', now);

  const { count: unreadNotifications } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  const stats = [
    ...(profile.role !== 'staff'
      ? [
          {
            title: 'Total Staff',
            value: staffCount || 0,
            icon: Users,
            href: '/dashboard/staff',
            color: 'text-blue-600',
          },
          {
            title: 'Locations',
            value: locationCount || 0,
            icon: Calendar,
            href: '/dashboard/schedule',
            color: 'text-green-600',
          },
        ]
      : []),
    {
      title: 'Active Shifts Now',
      value: activeShifts?.length || 0,
      icon: Radio,
      href: '/dashboard/on-duty',
      color: 'text-emerald-600',
    },
    {
      title: 'Pending Swaps',
      value: pendingSwaps || 0,
      icon: ArrowLeftRight,
      href: '/dashboard/swap-requests',
      color: 'text-orange-600',
    },
    {
      title: 'Unread Notifications',
      value: unreadNotifications || 0,
      icon: AlertTriangle,
      href: '/dashboard/notifications',
      color: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back, {profile.full_name}
        </h1>
        <p className="text-muted-foreground">
          {profile.role === 'admin' &&
            'Corporate Admin Dashboard — All locations'}
          {profile.role === 'manager' &&
            'Manager Dashboard — Your assigned locations'}
          {profile.role === 'staff' && 'Your shifts and schedule overview'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3">
            {profile.role !== 'staff' && (
              <>
                <Link
                  href="/dashboard/schedule"
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">View Schedule</p>
                    <p className="text-xs text-muted-foreground">
                      Manage weekly schedules
                    </p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/overtime"
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-sm">Overtime Dashboard</p>
                    <p className="text-xs text-muted-foreground">
                      Monitor labor costs
                    </p>
                  </div>
                </Link>
              </>
            )}
            {profile.role === 'staff' && (
              <>
                <Link
                  href="/dashboard/my-shifts"
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">My Shifts</p>
                    <p className="text-xs text-muted-foreground">
                      View your assigned shifts
                    </p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/availability"
                  className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <Clock className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">Set Availability</p>
                    <p className="text-xs text-muted-foreground">
                      Update your schedule preferences
                    </p>
                  </div>
                </Link>
              </>
            )}
            <Link
              href="/dashboard/open-shifts"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <ArrowLeftRight className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium text-sm">Open Shifts</p>
                <p className="text-xs text-muted-foreground">
                  Available shifts to pick up
                </p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

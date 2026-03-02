'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, MapPin, Users, Wifi, Activity } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { formatTimeInTimezone } from '@/lib/utils/timezone';
import { SKILL_COLORS } from '@/lib/utils/constants';
import type { Location } from '@/lib/types/database';

export default function OnDutyPage() {
  const { user } = useCurrentUser();
  const supabase = createClient();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [onDutyShifts, setOnDutyShifts] = useState<any[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLocations() {
      if (!user) return;
      if (user.role === 'admin') {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .order('name');
        setLocations(data || []);
      } else if (user.role === 'manager') {
        const { data } = await supabase
          .from('manager_locations')
          .select('location:locations(*)')
          .eq('manager_id', user.id);
        setLocations(
          (data?.map((d) => d.location).filter(Boolean) as Location[]) || [],
        );
      }
    }
    fetchLocations();
  }, [user]);

  const fetchOnDuty = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    // Get today's shifts with assignments
    let query = supabase
      .from('shifts')
      .select(
        `
        *,
        location:locations(*),
        required_skill:skills(*),
        shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
      `,
      )
      .gte('start_time', `${todayStr}T00:00:00`)
      .lte('start_time', `${todayStr}T23:59:59`)
      .order('start_time');

    if (selectedLocation !== 'all') {
      query = query.eq('location_id', selectedLocation);
    }

    const { data } = await query;

    const shifts = data || [];
    const onDuty: any[] = [];
    const upcoming: any[] = [];

    for (const shift of shifts) {
      const start = parseISO(shift.start_time);
      const end = parseISO(shift.end_time);
      const isActive = isWithinInterval(now, { start, end });

      if (isActive) {
        onDuty.push(shift);
      } else if (start > now) {
        upcoming.push(shift);
      }
    }

    setOnDutyShifts(onDuty);
    setUpcomingShifts(upcoming.slice(0, 10));
    setLoading(false);
  }, [selectedLocation]);

  useEffect(() => {
    fetchOnDuty();
  }, [fetchOnDuty]);

  // Auto refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchOnDuty, 60000);
    return () => clearInterval(interval);
  }, [fetchOnDuty]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('on-duty-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_assignments' },
        () => {
          fetchOnDuty();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOnDuty]);

  const totalOnDuty = onDutyShifts.reduce(
    (sum, s) =>
      sum +
      (s.shift_assignments?.filter((a: any) => a.status === 'assigned')
        .length || 0),
    0,
  );

  if (user?.role === 'staff') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Access restricted to managers and admins.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-green-500 animate-pulse" />
            Live On-Duty Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time view of who&apos;s working right now
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Wifi className="h-3 w-3 text-green-500" /> Live
          </Badge>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currently On Duty</p>
              <p className="text-2xl font-bold">{totalOnDuty}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Shifts</p>
              <p className="text-2xl font-bold">{onDutyShifts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Coming Up Today</p>
              <p className="text-2xl font-bold">{upcomingShifts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* Currently On Duty */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Currently On Duty
              </CardTitle>
            </CardHeader>
            <CardContent>
              {onDutyShifts.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">
                  No one is currently on duty
                </p>
              ) : (
                <div className="space-y-3">
                  {onDutyShifts.map((shift) => {
                    const tz = shift.location?.timezone || 'America/New_York';
                    const skill = shift.required_skill?.name || 'General';
                    const skillColor = SKILL_COLORS[skill.toLowerCase()] || '';
                    const assigned =
                      shift.shift_assignments?.filter(
                        (a: any) => a.status === 'assigned',
                      ) || [];

                    return (
                      <div
                        key={shift.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-xs ${skillColor}`}>
                              {skill}
                            </Badge>
                            <span className="text-sm">
                              {formatTimeInTimezone(shift.start_time, tz)} -{' '}
                              {formatTimeInTimezone(shift.end_time, tz)}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {shift.location?.name}
                            </span>
                          </div>
                          <Badge variant="secondary">
                            {assigned.length}/{shift.headcount_needed}
                          </Badge>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {assigned.map((a: any) => (
                            <div
                              key={a.id}
                              className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded text-sm"
                            >
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[8px]">
                                  {a.profile?.full_name
                                    ?.split(' ')
                                    .map((n: string) => n[0])
                                    .join('')
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{a.profile?.full_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coming Up */}
          {upcomingShifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Coming Up Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingShifts.map((shift) => {
                    const tz = shift.location?.timezone || 'America/New_York';
                    const skill = shift.required_skill?.name || 'General';
                    const assigned =
                      shift.shift_assignments?.filter(
                        (a: any) => a.status === 'assigned',
                      ) || [];

                    return (
                      <div
                        key={shift.id}
                        className="flex items-center justify-between border rounded p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">
                            {formatTimeInTimezone(shift.start_time, tz)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {skill}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {shift.location?.name}
                          </span>
                        </div>
                        <span className="text-xs">
                          {assigned.length}/{shift.headcount_needed} staff
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

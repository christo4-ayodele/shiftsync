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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  parseISO,
  differenceInHours,
} from 'date-fns';
import { OVERTIME_THRESHOLDS } from '@/lib/utils/constants';
import type { Location } from '@/lib/types/database';

type StaffHours = {
  id: string;
  name: string;
  weekly_hours: number;
  max_hours: number;
  shifts_count: number;
  consecutive_days: number;
  has_warning: boolean;
  has_violation: boolean;
};

export default function OvertimePage() {
  const { user } = useCurrentUser();
  const supabase = createClient();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [staffHours, setStaffHours] = useState<StaffHours[]>([]);
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

  const fetchHours = useCallback(async () => {
    setLoading(true);
    const weekStart = format(currentWeek, 'yyyy-MM-dd');
    const weekEnd = format(
      endOfWeek(currentWeek, { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    );

    // Get all shift assignments for the week
    let query = supabase
      .from('shift_assignments')
      .select(
        `
        *,
        profile:profiles!shift_assignments_staff_id_fkey(*),
        shift:shifts(*, location:locations(*))
      `,
      )
      .eq('status', 'assigned')
      .gte('shift.start_time', `${weekStart}T00:00:00`)
      .lte('shift.start_time', `${weekEnd}T23:59:59`);

    const { data: assignments } = await query;

    // Group by staff
    const staffMap = new Map<string, StaffHours>();
    for (const a of assignments || []) {
      if (!a.shift || !a.profile) continue;
      if (
        selectedLocation !== 'all' &&
        a.shift.location_id !== selectedLocation
      )
        continue;

      const id = a.profile.id;
      if (!staffMap.has(id)) {
        staffMap.set(id, {
          id,
          name: a.profile.full_name || 'Unknown',
          weekly_hours: 0,
          max_hours: a.profile.desired_weekly_hours || 40,
          shifts_count: 0,
          consecutive_days: 0,
          has_warning: false,
          has_violation: false,
        });
      }
      const entry = staffMap.get(id)!;
      const hours = differenceInHours(
        parseISO(a.shift.end_time),
        parseISO(a.shift.start_time),
      );
      entry.weekly_hours += hours;
      entry.shifts_count += 1;
    }

    // Calculate warnings and violations
    const items = Array.from(staffMap.values()).map((s) => ({
      ...s,
      has_warning: s.weekly_hours >= OVERTIME_THRESHOLDS.WEEKLY_WARNING_HOURS,
      has_violation: s.weekly_hours >= OVERTIME_THRESHOLDS.WEEKLY_LIMIT_HOURS,
    }));

    items.sort((a, b) => b.weekly_hours - a.weekly_hours);
    setStaffHours(items);
    setLoading(false);
  }, [currentWeek, selectedLocation]);

  useEffect(() => {
    fetchHours();
  }, [fetchHours]);

  const totalHours = staffHours.reduce((sum, s) => sum + s.weekly_hours, 0);
  const warningCount = staffHours.filter(
    (s) => s.has_warning && !s.has_violation,
  ).length;
  const violationCount = staffHours.filter((s) => s.has_violation).length;

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
          <h1 className="text-2xl font-bold">Overtime Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor weekly hours and prevent overtime violations
          </p>
        </div>
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

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">
          {format(currentWeek, 'MMM d')} —{' '}
          {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Staff Scheduled</p>
                <p className="text-2xl font-bold">{staffHours.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approaching OT</p>
                <p className="text-2xl font-bold text-orange-600">
                  {warningCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Over Limit</p>
                <p className="text-2xl font-bold text-red-600">
                  {violationCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Hours Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : staffHours.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No staff scheduled this week.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Shifts</TableHead>
                  <TableHead>Weekly Hours</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffHours.map((s) => {
                  const pct = Math.min(
                    100,
                    (s.weekly_hours / OVERTIME_THRESHOLDS.WEEKLY_LIMIT_HOURS) *
                      100,
                  );
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.shifts_count}</TableCell>
                      <TableCell>
                        <span
                          className={
                            s.has_violation
                              ? 'text-red-600 font-bold'
                              : s.has_warning
                                ? 'text-orange-600 font-semibold'
                                : ''
                          }
                        >
                          {s.weekly_hours.toFixed(1)}h
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {' '}
                          / {OVERTIME_THRESHOLDS.WEEKLY_LIMIT_HOURS}h
                        </span>
                      </TableCell>
                      <TableCell className="w-[150px]">
                        <Progress
                          value={pct}
                          className={`h-2 ${s.has_violation ? '[&>div]:bg-red-500' : s.has_warning ? '[&>div]:bg-orange-500' : '[&>div]:bg-green-500'}`}
                        />
                      </TableCell>
                      <TableCell>
                        {s.has_violation ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Over Limit
                          </Badge>
                        ) : s.has_warning ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-orange-600 border-orange-300"
                          >
                            Warning
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-green-600 border-green-300"
                          >
                            OK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

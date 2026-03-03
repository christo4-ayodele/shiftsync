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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  format,
  startOfWeek,
  endOfWeek,
  subWeeks,
  parseISO,
  differenceInHours,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Star,
  Target,
  Scale,
} from 'lucide-react';
import { isPremiumShift } from '@/lib/utils/timezone';
import type { Location } from '@/lib/types/database';

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export default function AnalyticsPage() {
  const { user } = useCurrentUser();
  const supabase = createClient();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [weeksBack, setWeeksBack] = useState(4);
  const [loading, setLoading] = useState(true);
  const [hoursData, setHoursData] = useState<any[]>([]);
  const [skillData, setSkillData] = useState<any[]>([]);
  const [weeklyTrendData, setWeeklyTrendData] = useState<any[]>([]);
  const [premiumData, setPremiumData] = useState<any[]>([]);
  const [fairnessMetrics, setFairnessMetrics] = useState<{
    score: number;
    stddev: number;
    mean: number;
    cv: number;
  } | null>(null);
  const [desiredVsActualData, setDesiredVsActualData] = useState<any[]>([]);

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

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const start = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), weeksBack);
    const startStr = format(start, 'yyyy-MM-dd');

    let query = supabase
      .from('shift_assignments')
      .select(
        `
        *,
        profile:profiles!shift_assignments_staff_id_fkey(*),
        shift:shifts(*, location:locations(*), required_skill:skills(*))
      `,
      )
      .eq('status', 'assigned')
      .gte('shift.start_time', `${startStr}T00:00:00`);

    const { data: assignments } = await query;

    const filtered = (assignments || []).filter((a) => {
      if (!a.shift) return false;
      if (
        selectedLocation !== 'all' &&
        a.shift.location_id !== selectedLocation
      )
        return false;
      return true;
    });

    // Hours by staff (fairness)
    const staffHoursMap = new Map<string, number>();
    const skillMap = new Map<string, number>();
    const weekMap = new Map<string, number>();
    const premiumMap = new Map<string, { premium: number; regular: number }>();
    const desiredMap = new Map<string, { desired: number; actual: number }>();

    for (const a of filtered) {
      if (!a.shift || !a.profile) continue;
      const hours = differenceInHours(
        parseISO(a.shift.end_time),
        parseISO(a.shift.start_time),
      );
      const name = a.profile.full_name || 'Unknown';
      staffHoursMap.set(name, (staffHoursMap.get(name) || 0) + hours);

      const skill = a.shift.required_skill?.name || 'General';
      skillMap.set(skill, (skillMap.get(skill) || 0) + hours);

      const week = format(
        startOfWeek(parseISO(a.shift.start_time), { weekStartsOn: 1 }),
        'MMM d',
      );
      weekMap.set(week, (weekMap.get(week) || 0) + hours);

      // Premium shift tracking (Fri/Sat evening)
      const tz = a.shift.location?.timezone || 'America/New_York';
      const premium = isPremiumShift(a.shift.start_time, tz);
      if (!premiumMap.has(name))
        premiumMap.set(name, { premium: 0, regular: 0 });
      const pc = premiumMap.get(name)!;
      if (premium) pc.premium++;
      else pc.regular++;

      // Desired vs actual hours
      if (!desiredMap.has(name)) {
        desiredMap.set(name, {
          desired: a.profile.desired_weekly_hours || 40,
          actual: 0,
        });
      }
      desiredMap.get(name)!.actual += hours;
    }

    setHoursData(
      Array.from(staffHoursMap.entries())
        .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
        .sort((a, b) => b.hours - a.hours),
    );

    setSkillData(
      Array.from(skillMap.entries()).map(([name, value]) => ({
        name,
        value: Math.round(value * 10) / 10,
      })),
    );

    setWeeklyTrendData(
      Array.from(weekMap.entries()).map(([week, hours]) => ({
        week,
        hours: Math.round(hours * 10) / 10,
      })),
    );

    // Fairness metrics (coefficient of variation)
    const allHours = Array.from(staffHoursMap.values());
    if (allHours.length > 1) {
      const mean = allHours.reduce((s, h) => s + h, 0) / allHours.length;
      const variance =
        allHours.reduce((s, h) => s + (h - mean) ** 2, 0) / allHours.length;
      const stddev = Math.sqrt(variance);
      const cv = mean > 0 ? stddev / mean : 0;
      const score = Math.max(0, Math.round(100 * (1 - cv)));
      setFairnessMetrics({
        score,
        stddev: Math.round(stddev * 10) / 10,
        mean: Math.round(mean * 10) / 10,
        cv: Math.round(cv * 100) / 100,
      });
    } else {
      setFairnessMetrics(null);
    }

    // Premium shift data
    setPremiumData(
      Array.from(premiumMap.entries())
        .map(([name, { premium, regular }]) => ({ name, premium, regular }))
        .sort((a, b) => b.premium - a.premium),
    );

    // Desired vs actual (per-week average)
    setDesiredVsActualData(
      Array.from(desiredMap.entries())
        .map(([name, { desired, actual }]) => ({
          name,
          desired: Math.round(desired * 10) / 10,
          actual: Math.round((actual / weeksBack) * 10) / 10,
          diff: Math.round((actual / weeksBack - desired) * 10) / 10,
        }))
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
    );

    setLoading(false);
  }, [selectedLocation, weeksBack]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (user?.role === 'staff') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Access restricted to managers and admins.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scheduling Analytics</h1>
          <p className="text-muted-foreground">
            Fairness metrics and scheduling insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(weeksBack)}
            onValueChange={(v) => setWeeksBack(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">Last 2 weeks</SelectItem>
              <SelectItem value="4">Last 4 weeks</SelectItem>
              <SelectItem value="8">Last 8 weeks</SelectItem>
              <SelectItem value="12">Last 12 weeks</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px]">
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

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px]" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fairness Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Scale className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Fairness Score
                    </p>
                    {fairnessMetrics ? (
                      <>
                        <p className="text-2xl font-bold">
                          <span
                            className={
                              fairnessMetrics.score >= 80
                                ? 'text-green-600'
                                : fairnessMetrics.score >= 60
                                  ? 'text-orange-600'
                                  : 'text-red-600'
                            }
                          >
                            {fairnessMetrics.score}%
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          \u03c3 = {fairnessMetrics.stddev}h · \u03bc ={' '}
                          {fairnessMetrics.mean}h
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Need 2+ staff
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Premium Shifts
                    </p>
                    <p className="text-2xl font-bold">
                      {premiumData.reduce((s, d) => s + d.premium, 0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Fri/Sat evening shifts
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avg Hours Gap
                    </p>
                    <p className="text-2xl font-bold">
                      {desiredVsActualData.length > 0
                        ? (
                            desiredVsActualData.reduce(
                              (s, d) => s + Math.abs(d.diff),
                              0,
                            ) / desiredVsActualData.length
                          ).toFixed(1)
                        : '0'}
                      h
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Desired vs actual/wk
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hours Distribution (Fairness) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                <CardTitle className="text-lg">
                  Hours Distribution by Staff
                </CardTitle>
              </div>
              <CardDescription>
                Total hours worked per staff member — check for equitable
                scheduling
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hoursData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No data available
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={hoursData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis
                      label={{
                        value: 'Hours',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                    />
                    <Tooltip />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {hoursData.length > 1 && (
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  <span>
                    Min: {Math.min(...hoursData.map((d) => d.hours))}h
                  </span>
                  <span>
                    Max: {Math.max(...hoursData.map((d) => d.hours))}h
                  </span>
                  <span>
                    Avg:{' '}
                    {(
                      hoursData.reduce((s, d) => s + d.hours, 0) /
                      hoursData.length
                    ).toFixed(1)}
                    h
                  </span>
                  <span>
                    Spread:{' '}
                    {(
                      Math.max(...hoursData.map((d) => d.hours)) -
                      Math.min(...hoursData.map((d) => d.hours))
                    ).toFixed(1)}
                    h
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Skill Breakdown */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieIcon className="h-5 w-5" />
                  <CardTitle className="text-lg">Hours by Skill</CardTitle>
                </div>
                <CardDescription>
                  Distribution of hours across skill requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                {skillData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No data
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={skillData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}h`}
                      >
                        {skillData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Weekly Trend */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <CardTitle className="text-lg">Weekly Hours Trend</CardTitle>
                </div>
                <CardDescription>
                  Total scheduled hours per week
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weeklyTrendData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No data
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weeklyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="hours"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Desired vs Actual Hours */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <CardTitle className="text-lg">
                  Desired vs Actual Hours
                </CardTitle>
              </div>
              <CardDescription>
                Average weekly hours compared to each staff member{"'"}s desired
                hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {desiredVsActualData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No data available
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={desiredVsActualData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-30}
                        textAnchor="end"
                        height={80}
                        fontSize={12}
                      />
                      <YAxis
                        label={{
                          value: 'Hours/wk',
                          angle: -90,
                          position: 'insideLeft',
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="desired"
                        fill="#8b5cf6"
                        name="Desired"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="actual"
                        fill="#3b82f6"
                        name="Actual Avg"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {desiredVsActualData.map((d) => (
                      <Badge
                        key={d.name}
                        variant="outline"
                        className={`text-xs ${
                          d.diff > 5
                            ? 'text-red-600 border-red-300'
                            : d.diff < -5
                              ? 'text-orange-600 border-orange-300'
                              : 'text-green-600 border-green-300'
                        }`}
                      >
                        {d.name}: {d.diff > 0 ? '+' : ''}
                        {d.diff}h/wk
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Premium Shift Distribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">
                  Premium Shift Distribution
                </CardTitle>
              </div>
              <CardDescription>
                Fri/Sat evening shifts per staff — track fair distribution of
                premium hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              {premiumData.length === 0 ||
              premiumData.every((d) => d.premium === 0) ? (
                <p className="text-center text-muted-foreground py-8">
                  No premium shifts in this period
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={premiumData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis
                      label={{
                        value: 'Shifts',
                        angle: -90,
                        position: 'insideLeft',
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="premium"
                      fill="#f59e0b"
                      name="Premium"
                      stackId="a"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="regular"
                      fill="#94a3b8"
                      name="Regular"
                      stackId="a"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

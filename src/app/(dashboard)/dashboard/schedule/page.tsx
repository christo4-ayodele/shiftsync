'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
} from 'date-fns';
import { formatInTimezone, formatTimeInTimezone } from '@/lib/utils/timezone';
import { SKILL_COLORS } from '@/lib/utils/constants';
import type {
  Location,
  Skill,
  ScheduleWithJoins,
  ShiftWithJoins,
  ShiftAssignmentWithJoins,
} from '@/lib/types/database';
import { toast } from 'sonner';

export default function SchedulePage() {
  const { user } = useCurrentUser();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [skills, setSkills] = useState<Skill[]>([]);
  const [shifts, setShifts] = useState<ShiftWithJoins[]>([]);
  const [schedule, setSchedule] = useState<ScheduleWithJoins | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateShift, setShowCreateShift] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Create shift form state
  const [newShift, setNewShift] = useState({
    required_skill_id: '',
    start_time: '09:00',
    end_time: '17:00',
    headcount_needed: 1,
    notes: '',
  });

  const supabase = createClient();

  // Fetch locations
  useEffect(() => {
    async function fetchLocations() {
      if (!user) return;

      if (user.role === 'admin') {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .order('name');
        setLocations(data || []);
        if (data && data.length > 0 && !selectedLocation)
          setSelectedLocation(data[0].id);
      } else if (user.role === 'manager') {
        const { data } = await supabase
          .from('manager_locations')
          .select('location:locations(*)')
          .eq('manager_id', user.id);
        const locs =
          (data?.map((d) => d.location).filter(Boolean) as Location[]) || [];
        setLocations(locs);
        if (locs.length > 0 && !selectedLocation)
          setSelectedLocation(locs[0].id);
      }
    }

    async function fetchSkills() {
      const { data } = await supabase.from('skills').select('*').order('name');
      setSkills(data || []);
    }

    fetchLocations();
    fetchSkills();
  }, [user, supabase, selectedLocation]);

  // Fetch schedule and shifts for selected location + week
  const fetchScheduleData = useCallback(async () => {
    if (!selectedLocation) return;
    setLoading(true);

    const weekStart = format(currentWeek, 'yyyy-MM-dd');
    const weekEnd = format(
      endOfWeek(currentWeek, { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    );

    // Get or create schedule
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*, location:locations(*)')
      .eq('location_id', selectedLocation)
      .eq('week_start', weekStart)
      .single();

    if (scheduleData) {
      setSchedule(scheduleData);
    } else {
      setSchedule(null);
    }

    // Get shifts
    const { data: shiftsData } = await supabase
      .from('shifts')
      .select(
        `
        *,
        required_skill:skills(*),
        location:locations(*),
        shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
      `,
      )
      .eq('location_id', selectedLocation)
      .gte('start_time', `${weekStart}T00:00:00`)
      .lte('start_time', `${weekEnd}T23:59:59`)
      .order('start_time');

    setShifts(shiftsData || []);
    setLoading(false);
  }, [selectedLocation, currentWeek, supabase]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedLocation) return;

    const channel = supabase
      .channel('schedule-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          fetchScheduleData();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_assignments' },
        () => {
          fetchScheduleData();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          fetchScheduleData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedLocation, fetchScheduleData, supabase]);

  const location = locations.find((l) => l.id === selectedLocation);
  const timezone = location?.timezone || 'America/New_York';

  // Group shifts by day (in the location's timezone, not browser-local)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const shiftsByDay: Record<string, ShiftWithJoins[]> = {};
  weekDays.forEach((day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    shiftsByDay[dayStr] = shifts.filter((s) => {
      const shiftDate = formatInTimezone(s.start_time, timezone, 'yyyy-MM-dd');
      return shiftDate === dayStr;
    });
  });

  async function handleCreateSchedule() {
    const weekStart = format(currentWeek, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('schedules')
      .insert({
        location_id: selectedLocation,
        week_start: weekStart,
        status: 'draft',
        edit_cutoff_hours: 48,
      })
      .select('*, location:locations(*)')
      .single();

    if (error) {
      toast.error('Failed to create schedule');
      return;
    }

    setSchedule(data);
    toast.success('Schedule created');
  }

  async function handleCreateShift() {
    if (!schedule || !selectedDay) return;

    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const startDateTime = `${dateStr}T${newShift.start_time}:00`;
    const endDateTime = `${dateStr}T${newShift.end_time}:00`;

    // Convert from location timezone to UTC
    const { fromZonedTime } = await import('date-fns-tz');
    const startUTC = fromZonedTime(startDateTime, timezone).toISOString();
    const endUTC = fromZonedTime(endDateTime, timezone).toISOString();

    const { error } = await supabase
      .from('shifts')
      .insert({
        schedule_id: schedule.id,
        location_id: selectedLocation,
        required_skill_id: newShift.required_skill_id,
        start_time: startUTC,
        end_time: endUTC,
        headcount_needed: newShift.headcount_needed,
        notes: newShift.notes || null,
      })
      .select('*')
      .single();

    if (error) {
      toast.error('Failed to create shift: ' + error.message);
      return;
    }

    toast.success('Shift created');
    setShowCreateShift(false);
    setNewShift({
      required_skill_id: '',
      start_time: '09:00',
      end_time: '17:00',
      headcount_needed: 1,
      notes: '',
    });
    fetchScheduleData();
  }

  async function handlePublish() {
    if (!schedule) return;

    const { error } = await supabase
      .from('schedules')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: user?.id,
      })
      .eq('id', schedule.id);

    if (error) {
      toast.error('Failed to publish schedule');
      return;
    }

    // Notify assigned staff
    const staffIds = new Set<string>();
    shifts.forEach((s) => {
      s.shift_assignments?.forEach((a: ShiftAssignmentWithJoins) => {
        if (a.status === 'assigned') staffIds.add(a.staff_id);
      });
    });

    for (const staffId of staffIds) {
      await supabase.from('notifications').insert({
        user_id: staffId,
        type: 'schedule_published',
        title: 'Schedule Published',
        message: `The schedule for ${location?.name} (week of ${format(currentWeek, 'MMM d')}) has been published.`,
        link: '/dashboard/my-shifts',
        is_read: false,
        delivery_method: 'in_app',
      });
    }

    toast.success('Schedule published! Staff have been notified.');
    fetchScheduleData();
  }

  async function handleUnpublish() {
    if (!schedule) return;

    const { error } = await supabase
      .from('schedules')
      .update({ status: 'draft', published_at: null, published_by: null })
      .eq('id', schedule.id);

    if (error) {
      toast.error('Failed to unpublish');
      return;
    }

    toast.success('Schedule unpublished');
    fetchScheduleData();
  }

  async function handleDeleteShift(shiftId: string) {
    const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
    if (error) {
      toast.error('Failed to delete shift');
      return;
    }
    toast.success('Shift deleted');
    fetchScheduleData();
  }

  if (user?.role === 'staff') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>
          Staff members can view their shifts on the &quot;My Shifts&quot; page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">Manage weekly shift schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold">
            {format(currentWeek, 'MMM d')} —{' '}
            {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            {schedule ? (
              <Badge
                variant={
                  schedule.status === 'published' ? 'default' : 'secondary'
                }
              >
                {schedule.status}
              </Badge>
            ) : (
              <Badge variant="outline">No schedule</Badge>
            )}
            {location && (
              <span className="text-xs text-muted-foreground">
                {location.timezone}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Schedule actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!schedule && (
          <Button onClick={handleCreateSchedule}>
            <Plus className="h-4 w-4 mr-1" /> Create Schedule
          </Button>
        )}
        {schedule && schedule.status === 'draft' && (
          <>
            <Button
              onClick={handlePublish}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4 mr-1" /> Publish Schedule
            </Button>
          </>
        )}
        {schedule && schedule.status === 'published' && (
          <Button variant="outline" onClick={handleUnpublish}>
            Unpublish
          </Button>
        )}
      </div>

      {/* Week Grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayShifts = shiftsByDay[dayStr] || [];
            const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr;

            return (
              <Card
                key={dayStr}
                className={`min-h-[160px] ${isToday ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader className="p-2 pb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      {format(day, 'EEE')}
                    </span>
                    <span
                      className={`text-xs ${isToday ? 'bg-primary text-primary-foreground rounded-full px-1.5 py-0.5' : 'text-muted-foreground'}`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 space-y-1">
                  {dayShifts.map((shift: ShiftWithJoins) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      timezone={timezone}
                      onDelete={() => handleDeleteShift(shift.id)}
                      isDraft={schedule?.status === 'draft'}
                    />
                  ))}
                  {schedule && (
                    <button
                      onClick={() => {
                        setSelectedDay(day);
                        setShowCreateShift(true);
                      }}
                      className="w-full p-1 text-xs text-muted-foreground border border-dashed rounded hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Shift Dialog */}
      <Dialog open={showCreateShift} onOpenChange={setShowCreateShift}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create Shift —{' '}
              {selectedDay ? format(selectedDay, 'EEE, MMM d') : ''}
            </DialogTitle>
            <DialogDescription>
              Add a new shift to the schedule at {location?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Required Skill</Label>
              <Select
                value={newShift.required_skill_id}
                onValueChange={(v) =>
                  setNewShift((s) => ({ ...s, required_skill_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select skill" />
                </SelectTrigger>
                <SelectContent>
                  {skills.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={newShift.start_time}
                  onChange={(e) =>
                    setNewShift((s) => ({ ...s, start_time: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={newShift.end_time}
                  onChange={(e) =>
                    setNewShift((s) => ({ ...s, end_time: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Headcount Needed</Label>
              <Input
                type="number"
                min="1"
                value={newShift.headcount_needed}
                onChange={(e) =>
                  setNewShift((s) => ({
                    ...s,
                    headcount_needed: parseInt(e.target.value) || 1,
                  }))
                }
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={newShift.notes}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, notes: e.target.value }))
                }
                placeholder="Special instructions..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateShift(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateShift}
              disabled={!newShift.required_skill_id}
            >
              Create Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShiftCard({
  shift,
  timezone,
  onDelete,
  isDraft,
}: {
  shift: ShiftWithJoins;
  timezone: string;
  onDelete: () => void;
  isDraft: boolean;
}) {
  const skillName = shift.required_skill?.name || 'Unknown';
  const skillColor =
    SKILL_COLORS[skillName.toLowerCase()] || 'bg-gray-100 text-gray-800';
  const assignedCount =
    shift.shift_assignments?.filter(
      (a: ShiftAssignmentWithJoins) => a.status === 'assigned',
    ).length || 0;
  const isFull = assignedCount >= shift.headcount_needed;

  return (
    <div className="p-1.5 rounded border text-xs space-y-1 bg-card hover:bg-muted/30 transition-colors group">
      <div className="flex items-center justify-between">
        <Badge
          variant="secondary"
          className={`text-[10px] px-1 py-0 ${skillColor}`}
        >
          {skillName}
        </Badge>
        {isDraft && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </button>
        )}
      </div>
      <p className="text-muted-foreground">
        {formatTimeInTimezone(shift.start_time, timezone)} -{' '}
        {formatTimeInTimezone(shift.end_time, timezone)}
      </p>
      <div className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        <span className={isFull ? 'text-green-600' : 'text-orange-600'}>
          {assignedCount}/{shift.headcount_needed}
        </span>
      </div>
      {shift.shift_assignments
        ?.filter((a: ShiftAssignmentWithJoins) => a.status === 'assigned')
        .map((a: ShiftAssignmentWithJoins) => (
          <p
            key={a.id}
            className="text-[10px] text-muted-foreground truncate pl-1"
          >
            • {a.profile?.full_name}
          </p>
        ))}
    </div>
  );
}

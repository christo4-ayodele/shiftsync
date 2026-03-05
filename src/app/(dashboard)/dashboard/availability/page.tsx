'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  getAvailability,
  setRecurringAvailability,
  addAvailabilityException,
  deleteAvailabilityException,
} from '@/lib/actions/availability';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Plus, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Availability } from '@/lib/types/database';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

type DaySlot = { start: string; end: string; available: boolean };

export default function AvailabilityPage() {
  const { user } = useCurrentUser();
  const [, setAvailabilityData] = useState<Availability[]>([]);
  const [exceptions, setExceptions] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);

  // Weekly schedule state
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, DaySlot>>(
    () => {
      const schedule: Record<number, DaySlot> = {};
      for (let i = 0; i < 7; i++) {
        schedule[i] = { start: '09:00', end: '17:00', available: false };
      }
      return schedule;
    },
  );

  // Exception form state
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionAvailable, setExceptionAvailable] = useState(false);
  const [exceptionStart, setExceptionStart] = useState('09:00');
  const [exceptionEnd, setExceptionEnd] = useState('17:00');
  const [exceptionReason, setExceptionReason] = useState('');

  useEffect(() => {
    async function load() {
      if (!user) return;
      const data = await getAvailability(user.id);
      const recurring = data.filter(
        (a: Availability) => a.type === 'recurring',
      );
      const exc = data.filter((a: Availability) => a.type === 'exception');
      setAvailabilityData(recurring);
      setExceptions(exc);

      // Populate weekly schedule from data
      const schedule: Record<number, DaySlot> = {};
      for (let i = 0; i < 7; i++) {
        const dayRec = recurring.find((r: Availability) => r.day_of_week === i);
        if (dayRec) {
          schedule[i] = {
            start: dayRec.start_time?.slice(0, 5) || '09:00',
            end: dayRec.end_time?.slice(0, 5) || '17:00',
            available: true,
          };
        } else {
          schedule[i] = { start: '09:00', end: '17:00', available: false };
        }
      }
      setWeeklySchedule(schedule);
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleSaveWeekly() {
    if (!user) return;
    setSaving(true);

    const entries = Object.entries(weeklySchedule)
      .filter(([, slot]) => slot.available)
      .map(([day, slot]) => ({
        day_of_week: parseInt(day),
        start_time: slot.start,
        end_time: slot.end,
      }));

    await setRecurringAvailability(
      entries.map((e) => ({
        ...e,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })),
    );
    setSaving(false);
    toast.success('Weekly availability saved');
  }

  async function handleAddException() {
    if (!user || !exceptionDate) return;

    await addAvailabilityException({
      specific_date: exceptionDate,
      start_time: exceptionAvailable ? exceptionStart : '00:00',
      end_time: exceptionAvailable ? exceptionEnd : '23:59',
      is_available: exceptionAvailable,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    setShowExceptionDialog(false);
    toast.success('Exception added');
    // Refresh
    const data = await getAvailability(user.id);
    setExceptions(data.filter((a: Availability) => a.type === 'exception'));
  }

  async function handleDeleteException(id: string) {
    await deleteAvailabilityException(id);
    setExceptions((e) => e.filter((ex) => ex.id !== id));
    toast.success('Exception removed');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Availability</h1>
        <p className="text-muted-foreground">
          Set your recurring weekly availability and any exceptions
        </p>
      </div>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly Schedule</CardTitle>
          <CardDescription>
            Toggle each day and set your available hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DAYS.map((day, idx) => {
              const slot = weeklySchedule[idx];
              return (
                <div key={day} className="flex items-center gap-4 py-2">
                  <div className="w-28 flex items-center gap-2">
                    <Switch
                      checked={slot.available}
                      onCheckedChange={(checked) =>
                        setWeeklySchedule((s) => ({
                          ...s,
                          [idx]: { ...s[idx], available: checked },
                        }))
                      }
                    />
                    <span
                      className={`text-sm font-medium ${!slot.available ? 'text-muted-foreground' : ''}`}
                    >
                      {day}
                    </span>
                  </div>
                  {slot.available && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.start}
                        className="w-32"
                        onChange={(e) =>
                          setWeeklySchedule((s) => ({
                            ...s,
                            [idx]: { ...s[idx], start: e.target.value },
                          }))
                        }
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={slot.end}
                        className="w-32"
                        onChange={(e) =>
                          setWeeklySchedule((s) => ({
                            ...s,
                            [idx]: { ...s[idx], end: e.target.value },
                          }))
                        }
                      />
                    </div>
                  )}
                  {!slot.available && (
                    <span className="text-xs text-muted-foreground">
                      Unavailable
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveWeekly} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{' '}
              {saving ? 'Saving...' : 'Save Availability'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exceptions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Exceptions</CardTitle>
            <CardDescription>
              Override availability for specific dates
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowExceptionDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Exception
          </Button>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No exceptions set
            </p>
          ) : (
            <div className="space-y-2">
              {exceptions.map((exc) => (
                <div
                  key={exc.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">
                        {format(
                          new Date(exc.specific_date!),
                          'EEE, MMM d, yyyy',
                        )}
                      </span>
                      <Badge
                        variant={exc.is_available ? 'default' : 'destructive'}
                      >
                        {exc.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                    </div>
                    {exc.is_available && exc.start_time && (
                      <p className="text-sm text-muted-foreground mt-1 ml-6">
                        {exc.start_time.slice(0, 5)} -{' '}
                        {exc.end_time?.slice(0, 5)}
                      </p>
                    )}
                    {(exc as unknown as { reason?: string }).reason && (
                      <p className="text-xs text-muted-foreground mt-1 ml-6 italic">
                        {(exc as unknown as { reason?: string }).reason}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDeleteException(exc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Exception Dialog */}
      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Availability Exception</DialogTitle>
            <DialogDescription>
              Override your availability for a specific date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={exceptionDate}
                onChange={(e) => setExceptionDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={exceptionAvailable}
                onCheckedChange={setExceptionAvailable}
              />
              <Label>
                {exceptionAvailable
                  ? 'Available (with custom hours)'
                  : 'Unavailable (day off)'}
              </Label>
            </div>
            {exceptionAvailable && (
              <div className="flex items-center gap-2">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={exceptionStart}
                    onChange={(e) => setExceptionStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={exceptionEnd}
                    onChange={(e) => setExceptionEnd(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g. Doctor appointment"
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExceptionDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddException} disabled={!exceptionDate}>
              Add Exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

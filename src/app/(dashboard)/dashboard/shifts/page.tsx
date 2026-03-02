'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  assignStaffToShift,
  unassignStaffFromShift,
  findCoverageCandidates,
  checkConstraints,
} from '@/lib/actions/shifts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserPlus,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Shield,
  MapPin,
  Star,
  ChevronDown,
} from 'lucide-react';
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from 'date-fns';
import {
  formatTimeInTimezone,
  getShiftDurationHours,
} from '@/lib/utils/timezone';
import { SKILL_COLORS } from '@/lib/utils/constants';
import type {
  ConstraintViolation,
  CoverageCandidate,
  Location,
  Skill,
} from '@/lib/types/database';
import { toast } from 'sonner';

export default function ShiftsPage() {
  const { user } = useCurrentUser();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [candidates, setCandidates] = useState<CoverageCandidate[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [overrideReasons, setOverrideReasons] = useState<
    Record<string, string>
  >({});

  const supabase = createClient();

  // Close dialog on unmount so its Radix portal overlay is never orphaned
  // if the user navigates away while the dialog is open or animating closed.
  useEffect(() => {
    return () => {
      setShowAssignDialog(false);
    };
  }, []);

  useEffect(() => {
    async function fetchLocations() {
      if (!user) return;
      if (user.role === 'admin') {
        const { data } = await supabase
          .from('locations')
          .select('*')
          .order('name');
        setLocations(data || []);
        if (data?.[0] && !selectedLocation) setSelectedLocation(data[0].id);
      } else if (user.role === 'manager') {
        const { data } = await supabase
          .from('manager_locations')
          .select('location:locations(*)')
          .eq('manager_id', user.id);
        const locs =
          (data?.map((d) => d.location).filter(Boolean) as Location[]) || [];
        setLocations(locs);
        if (locs[0] && !selectedLocation) setSelectedLocation(locs[0].id);
      }
    }
    fetchLocations();
  }, [user]);

  const fetchShifts = useCallback(async () => {
    if (!selectedLocation) return;
    setLoading(true);
    const weekStart = format(currentWeek, 'yyyy-MM-dd');
    const weekEnd = format(
      endOfWeek(currentWeek, { weekStartsOn: 1 }),
      'yyyy-MM-dd',
    );

    const { data } = await supabase
      .from('shifts')
      .select(
        `
        *,
        required_skill:skills(*),
        location:locations(*),
        schedule:schedules(*),
        shift_assignments(*, profile:profiles!shift_assignments_staff_id_fkey(*))
      `,
      )
      .eq('location_id', selectedLocation)
      .gte('start_time', `${weekStart}T00:00:00`)
      .lte('start_time', `${weekEnd}T23:59:59`)
      .order('start_time');

    setShifts(data || []);
    setLoading(false);
  }, [selectedLocation, currentWeek]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const location = locations.find((l) => l.id === selectedLocation);
  const timezone = location?.timezone || 'America/New_York';

  // Helper to detect consecutive days violations
  const isConsecutiveDaysViolation = (v: ConstraintViolation) => {
    return (
      v.type === 'consecutive_days' ||
      v.message?.toLowerCase().includes('consecutive day')
    );
  };

  async function openAssignDialog(shift: any) {
    setSelectedShift(shift);
    setShowAssignDialog(true);
    setCandidates([]);
    setOverrideReasons({}); // Clear all override reasons

    // Fetch coverage candidates
    const result = await findCoverageCandidates(shift.id);
    setCandidates(result);
  }

  async function handleAssign(staffId: string, hasWarnings: boolean) {
    if (!selectedShift) return;
    setAssigning(true);

    const result = await assignStaffToShift(
      staffId,
      selectedShift.id,
      hasWarnings,
      overrideReasons[staffId] || undefined,
    );

    setAssigning(false);

    if (!result.success) {
      if (result.violations) {
        toast.error(result.violations.map((v) => v.message).join('\n'));
      } else {
        toast.error(result.message || 'Failed to assign staff');
      }
      return;
    }

    toast.success('Staff assigned successfully');
    setShowAssignDialog(false);
    setOverrideReasons({});
    fetchShifts();
  }

  async function handleUnassign(assignmentId: string) {
    await unassignStaffFromShift(assignmentId);
    toast.success('Staff unassigned');
    fetchShifts();
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shift Management</h1>
          <p className="text-muted-foreground">
            Assign and manage staff for each shift
          </p>
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
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}
        >
          Prev Week
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
          Next Week
        </Button>
      </div>

      {/* Shifts Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No shifts found for this week. Create shifts on the Schedule page
            first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {shifts.map((shift) => {
            const assignedCount =
              shift.shift_assignments?.filter(
                (a: any) => a.status === 'assigned',
              ).length || 0;
            const isFull = assignedCount >= shift.headcount_needed;
            const skillName = shift.required_skill?.name || 'Unknown';
            const skillColor = SKILL_COLORS[skillName.toLowerCase()] || '';
            const duration = getShiftDurationHours(
              shift.start_time,
              shift.end_time,
            );

            return (
              <Card key={shift.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Shift Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">
                          {format(parseISO(shift.start_time), 'EEE, MMM d')}
                        </span>
                        <span className="text-muted-foreground">
                          {formatTimeInTimezone(shift.start_time, timezone)} -{' '}
                          {formatTimeInTimezone(shift.end_time, timezone)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {duration}h
                        </Badge>
                        <Badge className={`text-xs ${skillColor}`}>
                          {skillName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span
                            className={
                              isFull
                                ? 'text-green-600 font-medium'
                                : 'text-orange-600 font-medium'
                            }
                          >
                            {assignedCount}/{shift.headcount_needed}
                          </span>
                        </span>
                        {shift.notes && (
                          <span className="text-xs italic truncate max-w-[200px]">
                            {shift.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assigned Staff */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {shift.shift_assignments
                        ?.filter((a: any) => a.status === 'assigned')
                        .map((a: any) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm"
                          >
                            <span>{a.profile?.full_name}</span>
                            <button
                              onClick={() => handleUnassign(a.id)}
                              className="ml-1 text-destructive hover:text-destructive/80"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      {!isFull && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAssignDialog(shift)}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Staff Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Staff to Shift</DialogTitle>
            <DialogDescription>
              {selectedShift && (
                <span>
                  {format(parseISO(selectedShift.start_time), 'EEE, MMM d')} •{' '}
                  {formatTimeInTimezone(selectedShift.start_time, timezone)} -{' '}
                  {formatTimeInTimezone(selectedShift.end_time, timezone)} •{' '}
                  {selectedShift.required_skill?.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {candidates.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading candidates...
              </div>
            ) : (
              <div className="space-y-2">
                {candidates.map((candidate) => {
                  const errors = candidate.violations.filter(
                    (v) => v.severity === 'error',
                  );
                  const warnings = candidate.violations.filter(
                    (v) => v.severity === 'warning',
                  );

                  // Check if there are consecutive day violations (can be error or warning)
                  const hasConsecutiveViolation = [...errors, ...warnings].some(
                    isConsecutiveDaysViolation,
                  );

                  // Hard blockers are errors that are NOT consecutive day violations
                  const hardErrors = errors.filter(
                    (v) => !isConsecutiveDaysViolation(v),
                  );

                  // Get this candidate's override reason
                  const candidateOverrideReason =
                    overrideReasons[candidate.profile.id] || '';

                  // Can assign if: no hard errors AND (no consecutive violation OR has override reason)
                  const hasValidOverride =
                    candidateOverrideReason.trim().length >= 5;
                  const isEligible = hardErrors.length === 0;
                  const canAssign =
                    isEligible &&
                    (!hasConsecutiveViolation || hasValidOverride);

                  return (
                    <div
                      key={candidate.profile.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {candidate.profile.full_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />{' '}
                              {candidate.weekly_hours.toFixed(1)}h/wk
                            </span>
                            {candidate.has_skill && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-green-600"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{' '}
                                Skilled
                              </Badge>
                            )}
                            {candidate.is_certified && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-blue-600"
                              >
                                <MapPin className="h-2.5 w-2.5 mr-0.5" />{' '}
                                Certified
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={!canAssign || assigning}
                          variant={
                            hasConsecutiveViolation || warnings.length > 0
                              ? 'outline'
                              : 'default'
                          }
                          onClick={() =>
                            handleAssign(
                              candidate.profile.id,
                              warnings.length > 0 || hasConsecutiveViolation,
                            )
                          }
                        >
                          {hasConsecutiveViolation
                            ? 'Assign (Manager Override)'
                            : warnings.length > 0
                              ? 'Assign (Override)'
                              : 'Assign'}
                        </Button>
                      </div>

                      {/* Violations */}
                      {hardErrors.length > 0 && (
                        <div className="space-y-1">
                          {hardErrors.map((v, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-1.5 text-xs text-destructive"
                            >
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{v.message}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Consecutive day violations (show as warnings even if error severity) */}
                      {hasConsecutiveViolation && (
                        <div className="space-y-1">
                          {[...errors, ...warnings]
                            .filter(isConsecutiveDaysViolation)
                            .map((v, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-1.5 text-xs text-orange-600"
                              >
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{v.message}</span>
                              </div>
                            ))}
                          <div className="mt-1">
                            <Label className="text-xs">
                              Override Reason (required):
                            </Label>
                            <Input
                              className="text-xs h-7 mt-1"
                              placeholder="Reason for consecutive day override..."
                              value={candidateOverrideReason}
                              onChange={(e) =>
                                setOverrideReasons((prev) => ({
                                  ...prev,
                                  [candidate.profile.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Other warnings (non-consecutive) */}
                      {warnings.filter((v) => !isConsecutiveDaysViolation(v))
                        .length > 0 && (
                        <div className="space-y-1">
                          {warnings
                            .filter((v) => !isConsecutiveDaysViolation(v))
                            .map((v, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-1.5 text-xs text-orange-600"
                              >
                                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{v.message}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

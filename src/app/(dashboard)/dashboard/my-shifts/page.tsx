'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { getMyShifts } from '@/lib/actions/shifts';
import { createSwapRequest } from '@/lib/actions/swap-requests';
import { getStaffMembers } from '@/lib/actions/staff';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, ArrowRightLeft, LogOut } from 'lucide-react';
import { parseISO, isBefore, isAfter } from 'date-fns';
import {
  formatTimeInTimezone,
  formatInTimezone,
  getShiftDurationHours,
} from '@/lib/utils/timezone';
import { SKILL_COLORS } from '@/lib/utils/constants';
import { toast } from 'sonner';
import type { ShiftAssignmentWithJoins, Profile } from '@/lib/types/database';

export default function MyShiftsPage() {
  const { user } = useCurrentUser();
  const [shifts, setShifts] = useState<ShiftAssignmentWithJoins[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [showDropDialog, setShowDropDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<ShiftAssignmentWithJoins | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [dropReason, setDropReason] = useState('');
  const [peers, setPeers] = useState<Profile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const data = await getMyShifts(user.id);
      setShifts(data);
      setLoading(false);
    }
    load();
  }, [user]);

  const now = new Date();
  const upcoming = shifts.filter(
    (s) => s.shift && isAfter(parseISO(s.shift.start_time), now),
  );
  const past = shifts.filter(
    (s) => s.shift && isBefore(parseISO(s.shift.start_time), now),
  );

  async function openSwapDialog(assignment: ShiftAssignmentWithJoins) {
    setSelectedAssignment(assignment);
    setShowSwapDialog(true);
    // Fetch peers for swap target
    const staff = await getStaffMembers(assignment.shift?.location_id);
    setPeers(
      staff.filter((s: Profile) => s.id !== user?.id && s.role === 'staff'),
    );
  }

  function openDropDialog(assignment: ShiftAssignmentWithJoins) {
    setSelectedAssignment(assignment);
    setShowDropDialog(true);
  }

  async function handleSwap() {
    if (!selectedAssignment || !swapTargetId) return;
    setSubmitting(true);
    const result = await createSwapRequest({
      type: 'swap',
      requesting_assignment_id: selectedAssignment.id,
      target_staff_id: swapTargetId,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.message || 'Failed to submit swap request');
      return;
    }
    toast.success('Swap request submitted');
    setShowSwapDialog(false);
    setSwapTargetId('');
    setSwapReason('');
  }

  async function handleDrop() {
    if (!selectedAssignment) return;
    setSubmitting(true);
    const result = await createSwapRequest({
      type: 'drop',
      requesting_assignment_id: selectedAssignment.id,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.message || 'Failed to submit drop request');
      return;
    }
    toast.success(
      'Drop request submitted — shift will be available for pickup for 24h',
    );
    setShowDropDialog(false);
    setDropReason('');
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Shifts</h1>
        <p className="text-muted-foreground">
          {upcoming.length} upcoming shifts
        </p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-2 mt-4">
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No upcoming shifts
              </CardContent>
            </Card>
          ) : (
            upcoming.map((assignment) => {
              const shift = assignment.shift;
              if (!shift) return null;
              const location = shift.location;
              const tz = location?.timezone || 'America/New_York';
              const skill = shift?.required_skill?.name || 'General';
              const duration = shift
                ? getShiftDurationHours(shift.start_time, shift.end_time)
                : 0;
              const skillColor = SKILL_COLORS[skill.toLowerCase()] || '';

              return (
                <Card key={assignment.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Calendar className="h-4 w-4" />
                          <span className="font-semibold">
                            {formatInTimezone(
                              shift.start_time,
                              tz,
                              'EEEE, MMM d',
                            )}
                          </span>
                          <Badge className={`text-xs ${skillColor}`}>
                            {skill}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTimeInTimezone(shift.start_time, tz)} -{' '}
                            {formatTimeInTimezone(shift.end_time, tz)}
                            <span className="ml-1">({duration}h)</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {location?.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSwapDialog(assignment)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Swap
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => openDropDialog(assignment)}
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1" /> Drop
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-2 mt-4">
          {past.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No past shifts
              </CardContent>
            </Card>
          ) : (
            past.slice(0, 20).map((assignment) => {
              const shift = assignment.shift;
              if (!shift) return null;
              const location = shift.location;
              const tz = location?.timezone || 'America/New_York';
              return (
                <Card key={assignment.id} className="opacity-60">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span>
                        {formatInTimezone(shift.start_time, tz, 'MMM d')}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTimeInTimezone(shift.start_time, tz)} -{' '}
                        {formatTimeInTimezone(shift.end_time, tz)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {location?.name}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Swap Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Swap</DialogTitle>
            <DialogDescription>
              Request to swap this shift with a coworker
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Swap With</Label>
              <Select value={swapTargetId} onValueChange={setSwapTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a coworker" />
                </SelectTrigger>
                <SelectContent>
                  {peers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Why do you want to swap?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSwap} disabled={!swapTargetId || submitting}>
              {submitting ? 'Submitting...' : 'Submit Swap Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drop Dialog */}
      <Dialog open={showDropDialog} onOpenChange={setShowDropDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Drop</DialogTitle>
            <DialogDescription>
              The shift will be posted as open for 24 hours before manager
              review
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={dropReason}
                onChange={(e) => setDropReason(e.target.value)}
                placeholder="Why do you want to drop this shift?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDropDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDrop}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Drop Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

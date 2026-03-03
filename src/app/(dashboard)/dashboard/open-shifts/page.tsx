'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { createClient } from '@/lib/supabase/client';
import { claimDroppedShift } from '@/lib/actions/swap-requests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HandMetal,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import {
  formatTimeInTimezone,
  formatInTimezone,
  getShiftDurationHours,
} from '@/lib/utils/timezone';
import { SKILL_COLORS } from '@/lib/utils/constants';
import { toast } from 'sonner';

export default function OpenShiftsPage() {
  const { user } = useCurrentUser();
  const supabase = createClient();
  const [openShifts, setOpenShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Fetch drop requests open for claiming:
      // - pending_manager: claim will be sent to manager for approval
      // - approved: manager already approved the drop but no one has claimed it yet (direct claim)
      const { data } = await supabase
        .from('swap_requests')
        .select(
          `
          *,
          requesting_assignment:shift_assignments!requesting_assignment_id(
            *,
            shift:shifts(*, location:locations(*), required_skill:skills(*)),
            profile:profiles!shift_assignments_staff_id_fkey(*)
          )
        `,
        )
        .eq('type', 'drop')
        .in('status', ['pending_manager', 'approved'])
        .is('target_staff_id', null)
        .order('created_at', { ascending: false });

      // Filter to only those where expires_at is in the future (or no expiry set)
      const now = new Date();
      const open = (data || []).filter((r) => {
        if (!r.expires_at) return true;
        return parseISO(r.expires_at) > now;
      });

      setOpenShifts(open);
      setLoading(false);
    }
    load();
  }, []);

  async function handleClaim(requestId: string) {
    if (!user) return;
    setClaiming(requestId);
    const result = await claimDroppedShift(requestId);
    setClaiming(null);
    if (!result?.success) {
      toast.error(result?.message || 'Failed to claim shift');
      return;
    }
    toast.success(result.message || 'Shift claimed! Pending manager approval.');
    setOpenShifts((o) => o.filter((s) => s.id !== requestId));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Open Shifts</h1>
        <p className="text-muted-foreground">
          Shifts available to pick up from dropped requests
        </p>
      </div>

      {openShifts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No open shifts at the moment. Check back later!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {openShifts.map((req) => {
            const shift = req.requesting_assignment?.shift;
            const location = shift?.location;
            const tz = location?.timezone || 'America/New_York';
            const skill = shift?.required_skill?.name || 'General';
            const skillColor = SKILL_COLORS[skill.toLowerCase()] || '';
            const duration = shift
              ? getShiftDurationHours(shift.start_time, shift.end_time)
              : 0;
            const hoursLeft = req.expires_at
              ? differenceInHours(parseISO(req.expires_at), new Date())
              : null;
            const isOwnShift =
              req.requesting_assignment?.profile?.id === user?.id;

            return (
              <Card key={req.id}>
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
                        <Badge variant="secondary" className="text-xs">
                          {duration}h
                        </Badge>
                        {req.status === 'approved' && (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600 border-green-600"
                          >
                            Pre-approved
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTimeInTimezone(shift.start_time, tz)} -{' '}
                          {formatTimeInTimezone(shift.end_time, tz)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {location?.name}
                        </span>
                      </div>
                      {req.reason && (
                        <p className="text-xs text-muted-foreground italic">
                          Reason: {req.reason}
                        </p>
                      )}
                      {hoursLeft !== null && (
                        <div className="flex items-center gap-1 text-xs text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          {hoursLeft > 0
                            ? `${hoursLeft}h left to claim`
                            : 'Expiring soon'}
                        </div>
                      )}
                    </div>
                    <Button
                      disabled={isOwnShift || claiming === req.id}
                      onClick={() => handleClaim(req.id)}
                    >
                      <HandMetal className="h-4 w-4 mr-1" />
                      {claiming === req.id ? 'Claiming...' : 'Pick Up Shift'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

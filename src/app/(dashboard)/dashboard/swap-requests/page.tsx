'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  getSwapRequests,
  approveSwapRequest,
  rejectSwapRequest,
  acceptSwapRequest,
  cancelSwapRequest,
} from '@/lib/actions/swap-requests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRightLeft,
  LogOut,
  Check,
  X,
  Clock,
  AlertTriangle,
  User2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatTimeInTimezone, formatInTimezone } from '@/lib/utils/timezone';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, string> = {
  pending_peer: 'bg-orange-100 text-orange-800',
  pending_manager: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  expired: 'bg-gray-100 text-gray-600',
};

export default function SwapRequestsPage() {
  const { user } = useCurrentUser();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const data = await getSwapRequests();
      setRequests(data);
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleAction(
    action: 'approve' | 'reject' | 'accept' | 'cancel',
    requestId: string,
  ) {
    setActing(requestId);
    let result: any;
    switch (action) {
      case 'approve':
        result = await approveSwapRequest(requestId);
        break;
      case 'reject':
        result = await rejectSwapRequest(requestId, 'Rejected by manager');
        break;
      case 'accept':
        result = await acceptSwapRequest(requestId);
        break;
      case 'cancel':
        result = await cancelSwapRequest(requestId);
        break;
    }
    setActing(null);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Request ${action}${action === 'cancel' ? 'led' : 'd'} successfully`,
    );
    // Refresh
    const data = await getSwapRequests();
    setRequests(data);
  }

  const pending = requests.filter(
    (r) => r.status === 'pending_peer' || r.status === 'pending_manager',
  );
  const resolved = requests.filter(
    (r) => r.status !== 'pending_peer' && r.status !== 'pending_manager',
  );

  const isManager = user?.role === 'manager' || user?.role === 'admin';

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  function renderRequest(req: any) {
    const shift = req.requesting_assignment?.shift;
    const location = shift?.location;
    const tz = location?.timezone || 'America/New_York';
    const requester = req.requesting_assignment?.profile;
    const target = req.target_staff;
    const isMyRequest = requester?.id === user?.id;
    const amTarget = target?.id === user?.id;

    return (
      <Card key={req.id}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {req.type === 'swap' ? (
                    <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                  ) : (
                    <LogOut className="h-4 w-4 text-orange-600" />
                  )}
                  <span className="font-semibold capitalize">
                    {req.type} Request
                  </span>
                  <Badge
                    className={`text-[10px] ${STATUS_BADGE[req.status] || ''}`}
                  >
                    {req.status.replace('_', ' ')}
                  </Badge>
                </div>
                {shift && (
                  <p className="text-sm text-muted-foreground">
                    {formatInTimezone(shift.start_time, tz, 'EEE, MMM d')} •{' '}
                    {formatTimeInTimezone(shift.start_time, tz)} -{' '}
                    {formatTimeInTimezone(shift.end_time, tz)} •{' '}
                    {location?.name}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User2 className="h-3 w-3" />
                  <span>
                    From: <strong>{requester?.full_name || 'Unknown'}</strong>
                  </span>
                  {target && (
                    <>
                      <span>→</span>
                      <span>
                        To: <strong>{target.full_name}</strong>
                      </span>
                    </>
                  )}
                </div>
                {req.reason && (
                  <p className="text-xs text-muted-foreground italic">
                    {req.reason}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {/* Staff: peer accept */}
                {req.status === 'pending_peer' && amTarget && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleAction('accept', req.id)}
                      disabled={acting === req.id}
                    >
                      <Check className="h-3 w-3 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('reject', req.id)}
                      disabled={acting === req.id}
                    >
                      <X className="h-3 w-3 mr-1" /> Decline
                    </Button>
                  </>
                )}

                {/* Manager approve */}
                {req.status === 'pending_manager' && isManager && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleAction('approve', req.id)}
                      disabled={acting === req.id}
                    >
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction('reject', req.id)}
                      disabled={acting === req.id}
                    >
                      <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                  </>
                )}

                {/* Requester cancel */}
                {(req.status === 'pending_peer' ||
                  req.status === 'pending_manager') &&
                  isMyRequest && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleAction('cancel', req.id)}
                      disabled={acting === req.id}
                    >
                      Cancel
                    </Button>
                  )}
              </div>
            </div>

            {req.expires_at && req.status.startsWith('pending') && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Expires {format(parseISO(req.expires_at), 'MMM d, h:mm a')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Swap & Drop Requests</h1>
        <p className="text-muted-foreground">
          {pending.length} pending requests
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolved.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-2 mt-4">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No pending requests
              </CardContent>
            </Card>
          ) : (
            pending.map(renderRequest)
          )}
        </TabsContent>
        <TabsContent value="resolved" className="space-y-2 mt-4">
          {resolved.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No resolved requests yet
              </CardContent>
            </Card>
          ) : (
            resolved.map(renderRequest)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

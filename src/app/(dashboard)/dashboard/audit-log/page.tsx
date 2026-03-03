'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { getAuditLogs, exportAuditLogs } from '@/lib/actions/audit';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, FileText, Search } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { toast } from 'sonner';

const ACTION_COLORS: Record<string, string> = {
  shift_created: 'bg-green-100 text-green-800',
  shift_updated: 'bg-blue-100 text-blue-800',
  shift_deleted: 'bg-red-100 text-red-800',
  staff_assigned: 'bg-purple-100 text-purple-800',
  staff_unassigned: 'bg-orange-100 text-orange-800',
  schedule_published: 'bg-teal-100 text-teal-800',
  schedule_unpublished: 'bg-gray-100 text-gray-800',
  swap_requested: 'bg-yellow-100 text-yellow-800',
  swap_approved: 'bg-green-100 text-green-800',
  swap_rejected: 'bg-red-100 text-red-800',
  overtime_override: 'bg-orange-100 text-orange-800',
};

export default function AuditLogPage() {
  const { user } = useCurrentUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const startDate = format(
      subDays(new Date(), parseInt(dateRange)),
      'yyyy-MM-dd',
    );
    const data = await getAuditLogs({
      action: actionFilter !== 'all' ? actionFilter : undefined,
      startDate,
    });
    setLogs(data);
    setLoading(false);
  }, [actionFilter, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handleExport() {
    setExporting(true);
    const startDate = format(
      subDays(new Date(), parseInt(dateRange)),
      'yyyy-MM-dd',
    );
    const csv = await exportAuditLogs({
      action: actionFilter !== 'all' ? actionFilter : undefined,
      startDate,
    });
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success('Audit log exported');
  }

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.changed_by_profile?.full_name?.toLowerCase().includes(searchLower) ||
      log.action?.toLowerCase().includes(searchLower) ||
      JSON.stringify(log.metadata || {})
        .toLowerCase()
        .includes(searchLower)
    );
  });

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
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            Complete history of scheduling changes
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />{' '}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-[200px]"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="shift_created">Shift Created</SelectItem>
            <SelectItem value="shift_updated">Shift Updated</SelectItem>
            <SelectItem value="shift_deleted">Shift Deleted</SelectItem>
            <SelectItem value="staff_assigned">Staff Assigned</SelectItem>
            <SelectItem value="staff_unassigned">Staff Unassigned</SelectItem>
            <SelectItem value="schedule_published">
              Schedule Published
            </SelectItem>
            <SelectItem value="swap_requested">Swap Requested</SelectItem>
            <SelectItem value="swap_approved">Swap Approved</SelectItem>
            <SelectItem value="swap_rejected">Swap Rejected</SelectItem>
            <SelectItem value="overtime_override">OT Override</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No audit entries found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed By</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(log.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${ACTION_COLORS[log.action] || ''}`}
                      >
                        {log.action?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.changed_by_profile?.full_name || 'System'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {(() => {
                        const meta = log.metadata as Record<
                          string,
                          unknown
                        > | null;
                        // Prefer human-readable summary when staff_name is present
                        if (meta?.staff_name) {
                          const parts: string[] = [];
                          if (meta.staff_name)
                            parts.push(String(meta.staff_name));
                          if (meta.shift) parts.push(String(meta.shift));
                          if (meta.override_reason)
                            parts.push(`override: ${meta.override_reason}`);
                          const tooltip = JSON.stringify(meta, null, 2);
                          return (
                            <span title={tooltip}>{parts.join(' · ')}</span>
                          );
                        }

                        // Fallback: show generic key-value pairs from any state
                        const details: Record<string, unknown> =
                          meta ||
                          (log.after_state as Record<string, unknown>) ||
                          (log.before_state as Record<string, unknown>) ||
                          {};
                        const entries = Object.entries(details).filter(
                          ([k]) =>
                            ![
                              'id',
                              'created_at',
                              'updated_at',
                              'assigned_at',
                            ].includes(k),
                        );
                        if (entries.length === 0) return '—';
                        const tooltip = JSON.stringify(details, null, 2);
                        return (
                          <span title={tooltip}>
                            {entries
                              .slice(0, 3)
                              .map(([k, v]) => {
                                if (
                                  v === null ||
                                  v === undefined ||
                                  typeof v === 'object'
                                )
                                  return null;
                                return `${k.replace(/_/g, ' ')}: ${v}`;
                              })
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Showing {filtered.length} of {logs.length} entries
      </p>
    </div>
  );
}

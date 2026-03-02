'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { getStaffMembers } from '@/lib/actions/staff';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Users, MapPin, Star, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { SKILL_COLORS } from '@/lib/utils/constants';
import type { Location } from '@/lib/types/database';

export default function StaffPage() {
  const { user } = useCurrentUser();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const supabase = createClient();

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

  useEffect(() => {
    async function fetchStaff() {
      setLoading(true);
      const locationId =
        selectedLocation === 'all' ? undefined : selectedLocation;
      const data = await getStaffMembers(locationId);
      setStaff(data);
      setLoading(false);
    }
    fetchStaff();
  }, [selectedLocation]);

  const filtered = staff.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()),
  );

  if (user?.role === 'staff') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>You do not have permission to view the staff directory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff Directory</h1>
          <p className="text-muted-foreground">
            {filtered.length} staff members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-[200px]"
            />
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
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No staff found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {member.full_name
                              ?.split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.role === 'admin'
                            ? 'default'
                            : member.role === 'manager'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {member.staff_skills?.map((ss: any) => (
                          <Badge
                            key={ss.skill?.id}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {ss.skill?.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {member.staff_locations
                          ?.filter((sl: any) => !sl.decertified_at)
                          .map((sl: any) => (
                            <Badge
                              key={sl.location?.id}
                              variant="outline"
                              className="text-[10px]"
                            >
                              <MapPin className="h-2.5 w-2.5 mr-0.5" />
                              {sl.location?.name}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/staff/${member.id}`}>
                        <Button size="icon" variant="ghost">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-current-user';
import {
  getStaffMember,
  updateStaffSkills,
  updateStaffLocations,
  getSkills,
  getLocations,
} from '@/lib/actions/staff';
import { getAvailability } from '@/lib/actions/availability';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Star, Clock, Save } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Skill, Location } from '@/lib/types/database';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function StaffDetailPage() {
  const params = useParams<{ staffId: string }>();
  const { user } = useCurrentUser();
  const [member, setMember] = useState<any>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [memberData, skills, locations, avail] = await Promise.all([
        getStaffMember(params.staffId),
        getSkills(),
        getLocations(),
        getAvailability(params.staffId),
      ]);
      setMember(memberData);
      setAllSkills(skills);
      setAllLocations(locations);
      setSelectedSkills(
        memberData?.staff_skills?.map((ss: any) => ss.skill_id) || [],
      );
      setSelectedLocations(
        memberData?.staff_locations
          ?.filter((sl: any) => !sl.decertified_at)
          .map((sl: any) => sl.location_id) || [],
      );
      setAvailability(avail.filter((a: any) => a.type === 'recurring'));
      setLoading(false);
    }
    load();
  }, [params.staffId]);

  async function handleSave() {
    setSaving(true);
    await updateStaffSkills(params.staffId, selectedSkills);
    await updateStaffLocations(params.staffId, selectedLocations);
    setSaving(false);
    toast.success('Staff profile updated');
  }

  const isEditable = user?.role === 'admin' || user?.role === 'manager';

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Staff member not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/staff">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{member.full_name}</h1>
          <p className="text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-xl">
                  {member.full_name
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">{member.full_name}</p>
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
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Max weekly hours
              </p>
              <p className="font-medium">
                {member.desired_weekly_hours || 40}h
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Availability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Availability</CardTitle>
            <CardDescription>Recurring availability patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {DAYS.map((day, idx) => {
                const dayAvail = availability.filter(
                  (a: any) => a.day_of_week === idx,
                );
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="w-24 font-medium">{day}</span>
                    {dayAvail.length > 0 ? (
                      <div className="flex gap-2">
                        {dayAvail.map((a: any) => (
                          <Badge key={a.id} variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {a.start_time?.slice(0, 5)} -{' '}
                            {a.end_time?.slice(0, 5)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Unavailable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skills</CardTitle>
            <CardDescription>
              Assign or remove skill certifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allSkills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`skill-${skill.id}`}
                    checked={selectedSkills.includes(skill.id)}
                    disabled={!isEditable}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedSkills((s) => [...s, skill.id]);
                      else
                        setSelectedSkills((s) =>
                          s.filter((id) => id !== skill.id),
                        );
                    }}
                  />
                  <Label
                    htmlFor={`skill-${skill.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                    {skill.name}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Location Certifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Location Certifications</CardTitle>
            <CardDescription>
              Which locations this staff member can work at
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allLocations.map((loc) => (
                <div key={loc.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`loc-${loc.id}`}
                    checked={selectedLocations.includes(loc.id)}
                    disabled={!isEditable}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedLocations((l) => [...l, loc.id]);
                      else
                        setSelectedLocations((l) =>
                          l.filter((id) => id !== loc.id),
                        );
                    }}
                  />
                  <Label
                    htmlFor={`loc-${loc.id}`}
                    className="flex items-center gap-1.5"
                  >
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                    {loc.name}
                    <span className="text-xs text-muted-foreground">
                      ({loc.timezone})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {isEditable && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}

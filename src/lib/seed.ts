/**
 * ShiftSync Database Seeder
 *
 * Run with: npx tsx src/lib/seed.ts
 *
 * Creates demo users in Supabase Auth, then populates all tables
 * with realistic scheduling data for the "Coastal Eats" restaurant group.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import {
  addDays,
  startOfWeek,
  format,
  setHours,
  setMinutes,
  differenceInHours,
} from 'date-fns';
import { config } from 'dotenv';

// Load .env.local when running standalone
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================
// Fixed IDs for reproducibility
// ============================================
const LOCATION_IDS = {
  downtown: 'a0000000-0000-0000-0000-000000000001',
  harbor: 'a0000000-0000-0000-0000-000000000002',
  folly: 'a0000000-0000-0000-0000-000000000003',
  airport: 'a0000000-0000-0000-0000-000000000004',
};

const SKILL_IDS = {
  grill: 'b0000000-0000-0000-0000-000000000001',
  saute: 'b0000000-0000-0000-0000-000000000002',
  prep: 'b0000000-0000-0000-0000-000000000003',
  foh: 'b0000000-0000-0000-0000-000000000004',
  bar: 'b0000000-0000-0000-0000-000000000005',
  expo: 'b0000000-0000-0000-0000-000000000006',
};

// Demo users
const USERS = [
  {
    email: 'admin@coastaleats.com',
    password: 'password123',
    name: 'Alex Rivera',
    role: 'admin',
  },
  {
    email: 'mgr.downtown@coastaleats.com',
    password: 'password123',
    name: 'Jordan Chen',
    role: 'manager',
  },
  {
    email: 'mgr.harbor@coastaleats.com',
    password: 'password123',
    name: 'Priya Sharma',
    role: 'manager',
  },
  {
    email: 'staff1@coastaleats.com',
    password: 'password123',
    name: 'Marcus Williams',
    role: 'staff',
  },
  {
    email: 'staff2@coastaleats.com',
    password: 'password123',
    name: 'Sofia Martinez',
    role: 'staff',
  },
  {
    email: 'staff3@coastaleats.com',
    password: 'password123',
    name: 'Tyler Johnson',
    role: 'staff',
  },
  {
    email: 'staff4@coastaleats.com',
    password: 'password123',
    name: 'Emma Davis',
    role: 'staff',
  },
  {
    email: 'staff5@coastaleats.com',
    password: 'password123',
    name: 'Liam Brown',
    role: 'staff',
  },
  {
    email: 'staff6@coastaleats.com',
    password: 'password123',
    name: 'Olivia Wilson',
    role: 'staff',
  },
  {
    email: 'staff7@coastaleats.com',
    password: 'password123',
    name: 'Noah Taylor',
    role: 'staff',
  },
  {
    email: 'staff8@coastaleats.com',
    password: 'password123',
    name: 'Ava Anderson',
    role: 'staff',
  },
  {
    email: 'staff9@coastaleats.com',
    password: 'password123',
    name: 'James Garcia',
    role: 'staff',
  },
  {
    email: 'staff10@coastaleats.com',
    password: 'password123',
    name: 'Isabella Lopez',
    role: 'staff',
  },
];

async function seed() {
  console.log('🌱 Starting ShiftSync seed...\n');

  // ============================================
  // 1. Create locations
  // ============================================
  console.log('📍 Creating locations...');
  await supabase.from('locations').upsert([
    {
      id: LOCATION_IDS.downtown,
      name: 'Downtown Bistro',
      address: '123 Main St, Charleston, SC 29401',
      timezone: 'America/New_York',
    },
    {
      id: LOCATION_IDS.harbor,
      name: 'Harbor View',
      address: '456 Harbor Dr, Charleston, SC 29401',
      timezone: 'America/New_York',
    },
    {
      id: LOCATION_IDS.folly,
      name: 'Folly Beach Grill',
      address: '789 Center St, Folly Beach, SC 29439',
      timezone: 'America/New_York',
    },
    {
      id: LOCATION_IDS.airport,
      name: 'Airport Express',
      address: '5500 International Blvd, N Charleston, SC 29418',
      timezone: 'America/New_York',
    },
  ]);

  // ============================================
  // 2. Create skills
  // ============================================
  console.log('🎯 Creating skills...');
  await supabase.from('skills').upsert([
    { id: SKILL_IDS.grill, name: 'Grill' },
    { id: SKILL_IDS.saute, name: 'Sauté' },
    { id: SKILL_IDS.prep, name: 'Prep' },
    { id: SKILL_IDS.foh, name: 'FOH' },
    { id: SKILL_IDS.bar, name: 'Bar' },
    { id: SKILL_IDS.expo, name: 'Expo' },
  ]);

  // ============================================
  // 3. Create auth users + profiles
  // ============================================
  console.log('👤 Creating users...');
  const userIds: Record<string, string> = {};

  for (const u of USERS) {
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((eu) => eu.email === u.email);

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`  ✓ ${u.email} (existing: ${userId.slice(0, 8)}...)`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.name },
      });
      if (error) {
        console.error(`  ✗ Failed to create ${u.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      console.log(`  + ${u.email} (${userId.slice(0, 8)}...)`);
    }

    userIds[u.email] = userId;

    // Upsert profile
    await supabase.from('profiles').upsert({
      id: userId,
      role: u.role as 'admin' | 'manager' | 'staff',
      full_name: u.name,
      email: u.email,
      desired_weekly_hours: u.role === 'staff' ? 35 : null,
      notification_preferences: {
        shift_assigned: 'in_app',
        shift_changed: 'in_app',
        schedule_published: 'in_app',
        swap_updates: 'in_app',
        overtime_warnings: 'in_app',
      },
    });
  }

  const adminId = userIds['admin@coastaleats.com'];
  const mgrDowntownId = userIds['mgr.downtown@coastaleats.com'];
  const mgrHarborId = userIds['mgr.harbor@coastaleats.com'];
  const staffIds = USERS.filter((u) => u.role === 'staff')
    .map((u) => userIds[u.email])
    .filter(Boolean);

  if (!adminId || !mgrDowntownId || !mgrHarborId || staffIds.length < 5) {
    console.error('\n❌ Not enough users created. Check Supabase auth setup.');
    process.exit(1);
  }

  // ============================================
  // 4. Manager-location assignments
  // ============================================
  console.log('🏢 Assigning managers to locations...');
  await supabase.from('manager_locations').upsert(
    [
      { manager_id: mgrDowntownId, location_id: LOCATION_IDS.downtown },
      { manager_id: mgrDowntownId, location_id: LOCATION_IDS.folly },
      { manager_id: mgrHarborId, location_id: LOCATION_IDS.harbor },
      { manager_id: mgrHarborId, location_id: LOCATION_IDS.airport },
    ],
    { onConflict: 'manager_id,location_id' },
  );

  // ============================================
  // 5. Staff skills
  // ============================================
  console.log('⭐ Assigning staff skills...');
  // Each staff gets 4-5 skills so they can cover most shift types
  const skillAssignments: { staff_id: string; skill_id: string }[] = [];
  const staffSkillSets: string[][] = [
    // staff 0 - Marcus:  grill, saute, prep, foh
    [SKILL_IDS.grill, SKILL_IDS.saute, SKILL_IDS.prep, SKILL_IDS.foh],
    // staff 1 - Sofia:   foh, bar, expo, prep
    [SKILL_IDS.foh, SKILL_IDS.bar, SKILL_IDS.expo, SKILL_IDS.prep],
    // staff 2 - Tyler:   grill, prep, saute, expo
    [SKILL_IDS.grill, SKILL_IDS.prep, SKILL_IDS.saute, SKILL_IDS.expo],
    // staff 3 - Emma:    foh, bar, grill, prep
    [SKILL_IDS.foh, SKILL_IDS.bar, SKILL_IDS.grill, SKILL_IDS.prep],
    // staff 4 - Liam:    saute, grill, expo, bar
    [SKILL_IDS.saute, SKILL_IDS.grill, SKILL_IDS.expo, SKILL_IDS.bar],
    // staff 5 - Olivia:  foh, prep, bar, saute, expo (5 skills — versatile)
    [
      SKILL_IDS.foh,
      SKILL_IDS.prep,
      SKILL_IDS.bar,
      SKILL_IDS.saute,
      SKILL_IDS.expo,
    ],
    // staff 6 - Noah:    bar, saute, grill, foh
    [SKILL_IDS.bar, SKILL_IDS.saute, SKILL_IDS.grill, SKILL_IDS.foh],
    // staff 7 - Ava:     grill, foh, prep, bar
    [SKILL_IDS.grill, SKILL_IDS.foh, SKILL_IDS.prep, SKILL_IDS.bar],
    // staff 8 - James:   prep, expo, foh, saute, grill (5 skills — versatile)
    [
      SKILL_IDS.prep,
      SKILL_IDS.expo,
      SKILL_IDS.foh,
      SKILL_IDS.saute,
      SKILL_IDS.grill,
    ],
    // staff 9 - Isabella: foh, bar, grill, expo
    [SKILL_IDS.foh, SKILL_IDS.bar, SKILL_IDS.grill, SKILL_IDS.expo],
  ];
  for (let i = 0; i < staffIds.length; i++) {
    for (const skillId of staffSkillSets[i]) {
      skillAssignments.push({ staff_id: staffIds[i], skill_id: skillId });
    }
  }
  await supabase
    .from('staff_skills')
    .upsert(skillAssignments, { onConflict: 'staff_id,skill_id' });

  // ============================================
  // 6. Staff location certifications
  // ============================================
  console.log('📋 Certifying staff for locations...');
  const locationCerts: { staff_id: string; location_id: string }[] = [];
  const staffLocationSets: string[][] = [
    // staff 0 - Marcus:    Downtown, Folly, Harbor (3 locations)
    [LOCATION_IDS.downtown, LOCATION_IDS.folly, LOCATION_IDS.harbor],
    // staff 1 - Sofia:     Downtown, Folly
    [LOCATION_IDS.downtown, LOCATION_IDS.folly],
    // staff 2 - Tyler:     Downtown, Folly, Airport (3 locations)
    [LOCATION_IDS.downtown, LOCATION_IDS.folly, LOCATION_IDS.airport],
    // staff 3 - Emma:      Harbor, Airport, Downtown (3 locations)
    [LOCATION_IDS.harbor, LOCATION_IDS.airport, LOCATION_IDS.downtown],
    // staff 4 - Liam:      Harbor, Airport
    [LOCATION_IDS.harbor, LOCATION_IDS.airport],
    // staff 5 - Olivia:    Harbor, Airport, Folly (3 locations)
    [LOCATION_IDS.harbor, LOCATION_IDS.airport, LOCATION_IDS.folly],
    // staff 6 - Noah:      Downtown, Harbor, Folly (3 locations)
    [LOCATION_IDS.downtown, LOCATION_IDS.harbor, LOCATION_IDS.folly],
    // staff 7 - Ava:       Downtown, Harbor, Airport (3 locations)
    [LOCATION_IDS.downtown, LOCATION_IDS.harbor, LOCATION_IDS.airport],
    // staff 8 - James:     All locations (float)
    [
      LOCATION_IDS.downtown,
      LOCATION_IDS.harbor,
      LOCATION_IDS.folly,
      LOCATION_IDS.airport,
    ],
    // staff 9 - Isabella:  All locations (float)
    [
      LOCATION_IDS.downtown,
      LOCATION_IDS.harbor,
      LOCATION_IDS.folly,
      LOCATION_IDS.airport,
    ],
  ];
  for (let i = 0; i < staffIds.length; i++) {
    for (const locId of staffLocationSets[i]) {
      locationCerts.push({ staff_id: staffIds[i], location_id: locId });
    }
  }
  await supabase
    .from('staff_locations')
    .upsert(locationCerts, { onConflict: 'staff_id,location_id' });

  // ============================================
  // 7. Recurring availability for all staff
  // ============================================
  console.log('📅 Setting staff availability...');
  // Clear existing
  for (const sid of staffIds) {
    await supabase.from('availability').delete().eq('staff_id', sid);
  }

  const availEntries: Array<{
    staff_id: string;
    type: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
    timezone: string;
  }> = [];
  for (let i = 0; i < staffIds.length; i++) {
    // Each staff available most days with varying hours
    const morningStart = i % 2 === 0 ? '07:00' : '08:00';
    const eveningEnd = i % 3 === 0 ? '22:00' : '21:00';
    const daysOff = i % 7; // Each staff has one different day off (0=Mon)

    for (let day = 0; day < 7; day++) {
      if (day === daysOff) continue; // day off
      availEntries.push({
        staff_id: staffIds[i],
        type: 'recurring',
        day_of_week: day,
        start_time: morningStart,
        end_time: eveningEnd,
        is_available: true,
        timezone: 'America/New_York',
      });
    }
  }
  await supabase.from('availability').insert(availEntries);

  // ============================================
  // 8. Create schedules + shifts
  //    • Last week  (Feb 23 – Mar 1): full week, published, assigned
  //    • This week  (Mar 2 – Mar 8):  published, but only today (Mar 2)
  //      has shifts so the rest of the week is a clean slate.
  // ============================================
  console.log('📋 Creating schedules and shifts...');

  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 }); // Mar 2
  const lastMonday = addDays(thisMonday, -7); // Feb 23
  const locationIds = Object.values(LOCATION_IDS);

  const scheduleIds: Record<string, string> = {};

  // Create schedules for both weeks
  for (const weekStart of [lastMonday, thisMonday]) {
    for (const locId of locationIds) {
      const weekStr = format(weekStart, 'yyyy-MM-dd');
      const { data: schedule, error } = await supabase
        .from('schedules')
        .upsert(
          {
            location_id: locId,
            week_start: weekStr,
            status: 'published',
            published_at: new Date().toISOString(),
            published_by: adminId,
          },
          { onConflict: 'location_id,week_start' },
        )
        .select()
        .single();

      if (error) {
        console.error(`  ✗ Schedule for ${locId} ${weekStr}:`, error.message);
        continue;
      }
      scheduleIds[`${locId}-${weekStr}`] = schedule.id;
    }
  }

  // Shift templates: 2 per day per location (Morning + Evening) with headcount 1
  // This keeps total slots manageable for 10 staff
  const shiftSkills = [
    SKILL_IDS.grill,
    SKILL_IDS.foh,
    SKILL_IDS.prep,
    SKILL_IDS.bar,
    SKILL_IDS.saute,
    SKILL_IDS.expo,
  ];

  const shiftTemplates = [
    { startHour: 7, endHour: 15, headcount: 1, label: 'Morning' }, // 8h
    { startHour: 15, endHour: 23, headcount: 1, label: 'Evening' }, // 8h
  ];

  const allShiftIds: string[] = [];

  // --- Helper: create shifts for a range of days within a week ---
  async function createShiftsForDays(
    weekStart: Date,
    dayOffsets: number[], // e.g. [0..6] for full week, [0] for Monday only
  ) {
    for (const locId of locationIds) {
      const weekStr = format(weekStart, 'yyyy-MM-dd');
      const scheduleId = scheduleIds[`${locId}-${weekStr}`];
      if (!scheduleId) continue;

      for (const dayOffset of dayOffsets) {
        const day = addDays(weekStart, dayOffset);

        for (let s = 0; s < shiftTemplates.length; s++) {
          const template = shiftTemplates[s];
          const skillId = shiftSkills[(dayOffset + s) % shiftSkills.length];

          const startTime = setMinutes(setHours(day, template.startHour), 0);
          const endTime = setMinutes(setHours(day, template.endHour), 0);

          const { data: shift, error } = await supabase
            .from('shifts')
            .insert({
              schedule_id: scheduleId,
              location_id: locId,
              required_skill_id: skillId,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              headcount_needed: template.headcount,
              notes:
                dayOffset === 5 || dayOffset === 6
                  ? 'Weekend rush expected'
                  : null,
            })
            .select()
            .single();

          if (error) {
            console.error(`  ✗ Shift:`, error.message);
          } else {
            allShiftIds.push(shift.id);
          }
        }
      }
    }
  }

  // Last week: full 7 days (Feb 23 – Mar 1)
  await createShiftsForDays(lastMonday, [0, 1, 2, 3, 4, 5, 6]);
  // This week: only today Monday Mar 2 (dayOffset 0)
  await createShiftsForDays(thisMonday, [0]);

  console.log(`  Created ${allShiftIds.length} shifts`);

  // ============================================
  // 9. Assign staff to current week shifts
  //    (constraint-based: skills, location certs,
  //     hours cap, 12h rest, 1 shift/day, days off)
  // ============================================
  console.log('👥 Assigning staff to shifts...');

  // --- Build eligibility maps from what we just inserted ---
  const staffSkillsMap = new Map<string, Set<string>>();
  const staffLocationsMap = new Map<string, Set<string>>();

  for (const sa of skillAssignments) {
    if (!staffSkillsMap.has(sa.staff_id))
      staffSkillsMap.set(sa.staff_id, new Set());
    staffSkillsMap.get(sa.staff_id)!.add(sa.skill_id);
  }
  for (const lc of locationCerts) {
    if (!staffLocationsMap.has(lc.staff_id))
      staffLocationsMap.set(lc.staff_id, new Set());
    staffLocationsMap.get(lc.staff_id)!.add(lc.location_id);
  }

  // --- Fetch ALL seeded shifts (last week + today) in chronological order ---
  const { data: currentShifts } = await supabase
    .from('shifts')
    .select('*, location:locations(*), schedule:schedules(*)')
    .gte('start_time', format(lastMonday, 'yyyy-MM-dd'))
    .lte('start_time', format(addDays(thisMonday, 1), 'yyyy-MM-dd'))
    .order('start_time');

  // --- Per-staff tracking ---
  const hoursThisWeek: Record<string, number> = {};
  const assignedDates: Record<string, Set<string>> = {};
  const lastShiftEnd: Record<string, Date> = {};
  const daysOff: Record<string, Set<number>> = {};

  // Deterministic but varied hours cap:
  // Allow 2 specific staff to go up to 45h (overtime testers),
  // everyone else is hard-capped at 40h.
  const overtimeTesters = new Set([staffIds[5], staffIds[6]]); // Olivia & Noah
  const hoursCap = (sid: string) => (overtimeTesters.has(sid) ? 45 : 40);

  // Assign 1-2 days off per staff, spread across the week
  for (let i = 0; i < staffIds.length; i++) {
    const sid = staffIds[i];
    hoursThisWeek[sid] = 0;
    assignedDates[sid] = new Set();
    daysOff[sid] = new Set();

    // Primary day off — rotate through the week
    const primaryOff = i % 7; // 0=Mon ... 6=Sun
    daysOff[sid].add(primaryOff);

    // ~half the staff get a second day off (adjacent day)
    if (i % 3 !== 0) {
      const secondOff = (primaryOff + (i % 2 === 0 ? 1 : 6)) % 7;
      daysOff[sid].add(secondOff);
    }
  }

  // --- Seeded PRNG for reproducible "random" tie-breaking ---
  let prngState = 42;
  function nextRandom(): number {
    prngState = (prngState * 1664525 + 1013904223) & 0x7fffffff;
    return prngState / 0x7fffffff;
  }

  // --- Assignment loop ---
  let assignmentCount = 0;
  let unfilledSlots = 0;

  for (const shift of currentShifts || []) {
    const shiftStart = new Date(shift.start_time);
    const shiftEnd = new Date(shift.end_time);
    const shiftHours = differenceInHours(shiftEnd, shiftStart);
    const shiftDateStr = format(shiftStart, 'yyyy-MM-dd');
    const shiftDayOfWeek = (shiftStart.getDay() + 6) % 7; // 0=Mon

    // Build eligible list
    const eligible = staffIds.filter((sid) => {
      // 1. Location certification
      if (!staffLocationsMap.get(sid)?.has(shift.location_id)) return false;
      // 2. Required skill
      if (
        shift.required_skill_id &&
        !staffSkillsMap.get(sid)?.has(shift.required_skill_id)
      )
        return false;
      // 3. Max 1 shift per day
      if (assignedDates[sid]?.has(shiftDateStr)) return false;
      // 4. Day off
      if (daysOff[sid]?.has(shiftDayOfWeek)) return false;
      // 5. Hours cap
      if ((hoursThisWeek[sid] || 0) + shiftHours > hoursCap(sid)) return false;
      // 6. 12-hour rest between shifts
      if (lastShiftEnd[sid]) {
        const restHours = differenceInHours(shiftStart, lastShiftEnd[sid]);
        if (restHours < 12) return false;
      }
      return true;
    });

    // Sort: fewest hours first, then random tie-break
    eligible.sort((a, b) => {
      const diff = (hoursThisWeek[a] || 0) - (hoursThisWeek[b] || 0);
      if (diff !== 0) return diff;
      return nextRandom() - 0.5;
    });

    const needed = shift.headcount_needed;
    let filled = 0;

    for (let h = 0; h < Math.min(needed, eligible.length); h++) {
      const sid = eligible[h];

      const { error } = await supabase.from('shift_assignments').insert({
        shift_id: shift.id,
        staff_id: sid,
        status: 'assigned',
        assigned_by: adminId,
      });

      if (!error) {
        hoursThisWeek[sid] = (hoursThisWeek[sid] || 0) + shiftHours;
        assignedDates[sid]!.add(shiftDateStr);
        lastShiftEnd[sid] = shiftEnd;
        assignmentCount++;
        filled++;
      }
    }

    if (filled < needed) {
      unfilledSlots += needed - filled;
    }
  }

  // --- Summary table ---
  console.log(
    `  Created ${assignmentCount} assignments (${unfilledSlots} slots unfilled)`,
  );
  console.log('\n  ┌─────────────────────────┬────────┬───────┐');
  console.log('  │ Staff                   │ Shifts │ Hours │');
  console.log('  ├─────────────────────────┼────────┼───────┤');
  for (let i = 0; i < staffIds.length; i++) {
    const sid = staffIds[i];
    const name = USERS[i + 3].name.padEnd(23); // offset by 3 (admin + 2 mgrs)
    const shifts = (assignedDates[sid]?.size || 0).toString().padStart(6);
    const hours = (hoursThisWeek[sid] || 0).toString().padStart(5);
    console.log(`  │ ${name} │ ${shifts} │ ${hours} │`);
  }
  console.log('  └─────────────────────────┴────────┴───────┘');

  // ============================================
  // 10. Create a sample swap request
  // ============================================
  console.log('🔄 Creating sample swap requests...');

  // Find a shift assigned to staff1 in downtown
  const { data: staff1Assignments } = await supabase
    .from('shift_assignments')
    .select('*, shift:shifts(*, location:locations(*))')
    .eq('staff_id', staffIds[0])
    .eq('status', 'assigned')
    .limit(1);

  if (staff1Assignments?.[0]) {
    await supabase.from('swap_requests').insert({
      type: 'swap',
      requesting_assignment_id: staff1Assignments[0].id,
      target_staff_id: staffIds[2],
      status: 'pending_peer',
      reason: 'Family event - need someone to cover my shift',
    });
    console.log('  + Swap request: Marcus → Tyler');
  }

  // ============================================
  // 11. Create some notifications
  // ============================================
  console.log('🔔 Creating notifications...');
  const notifData = [
    {
      user_id: staffIds[0],
      type: 'schedule_published',
      title: 'Schedule Published',
      message: "This week's schedule for Downtown Bistro has been published.",
      is_read: false,
    },
    {
      user_id: staffIds[0],
      type: 'shift_assigned',
      title: 'New Shift',
      message:
        "You've been assigned to Grill shift on Monday 7:00 AM - 3:00 PM.",
      is_read: true,
    },
    {
      user_id: staffIds[1],
      type: 'schedule_published',
      title: 'Schedule Published',
      message: "This week's schedule for Downtown Bistro has been published.",
      is_read: false,
    },
    {
      user_id: staffIds[2],
      type: 'swap_requested',
      title: 'Swap Request',
      message: 'Marcus Williams wants to swap shifts with you.',
      is_read: false,
    },
    {
      user_id: mgrDowntownId,
      type: 'overtime_warning',
      title: 'Overtime Warning',
      message: 'Marcus Williams is approaching 35 hours this week.',
      is_read: false,
    },
  ];
  await supabase.from('notifications').insert(notifData);

  // ============================================
  // 12. Audit log entries
  // ============================================
  console.log('📝 Creating audit log entries...');
  const auditEntries = [
    {
      entity_type: 'schedule',
      entity_id:
        Object.values(scheduleIds)[0] || '00000000-0000-0000-0000-000000000000',
      action: 'schedule_published',
      changed_by: adminId,
      metadata: {
        location: 'Downtown Bistro',
        week: format(thisMonday, 'yyyy-MM-dd'),
      },
    },
    {
      entity_type: 'shift',
      entity_id: allShiftIds[0] || '00000000-0000-0000-0000-000000000000',
      action: 'staff_assigned',
      changed_by: adminId,
      metadata: { staff: 'Marcus Williams', shift: 'Monday Morning Grill' },
    },
    {
      entity_type: 'swap_request',
      entity_id: '00000000-0000-0000-0000-000000000000',
      action: 'swap_requested',
      changed_by: staffIds[0],
      metadata: {
        from: 'Marcus Williams',
        to: 'Tyler Johnson',
        reason: 'Family event',
      },
    },
  ];
  await supabase.from('audit_log').insert(auditEntries);

  // ============================================
  // DONE
  // ============================================
  console.log('\n✅ Seed complete!');
  console.log('\n📋 Demo Credentials:');
  console.log('  Admin:   admin@coastaleats.com / password123');
  console.log('  Manager: mgr.downtown@coastaleats.com / password123');
  console.log('  Manager: mgr.harbor@coastaleats.com / password123');
  console.log('  Staff:   staff1@coastaleats.com / password123');
  console.log('  Staff:   staff2@coastaleats.com / password123');
  console.log('  (... through staff10@coastaleats.com)');
  console.log('\n📍 Locations:');
  console.log(
    '  Downtown Bistro, Harbor View, Folly Beach Grill, Airport Express',
  );
  console.log(`\n📊 Data created:`);
  console.log(`  ${allShiftIds.length} shifts (last week + today)`);
  console.log(`  ${assignmentCount} shift assignments`);
  console.log(`  ${staffIds.length} staff with skills & location certs`);
}

seed().catch(console.error);

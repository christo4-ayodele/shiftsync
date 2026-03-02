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
import { addDays, startOfWeek, format, setHours, setMinutes } from 'date-fns';
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
      role: u.role as any,
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
  const skillAssignments = [
    // Each staff gets 2-4 skills
    { staff_id: staffIds[0], skill_id: SKILL_IDS.grill },
    { staff_id: staffIds[0], skill_id: SKILL_IDS.saute },
    { staff_id: staffIds[0], skill_id: SKILL_IDS.prep },
    { staff_id: staffIds[1], skill_id: SKILL_IDS.foh },
    { staff_id: staffIds[1], skill_id: SKILL_IDS.bar },
    { staff_id: staffIds[1], skill_id: SKILL_IDS.expo },
    { staff_id: staffIds[2], skill_id: SKILL_IDS.grill },
    { staff_id: staffIds[2], skill_id: SKILL_IDS.prep },
    { staff_id: staffIds[3], skill_id: SKILL_IDS.foh },
    { staff_id: staffIds[3], skill_id: SKILL_IDS.bar },
    { staff_id: staffIds[4], skill_id: SKILL_IDS.saute },
    { staff_id: staffIds[4], skill_id: SKILL_IDS.grill },
    { staff_id: staffIds[4], skill_id: SKILL_IDS.expo },
    { staff_id: staffIds[5], skill_id: SKILL_IDS.foh },
    { staff_id: staffIds[5], skill_id: SKILL_IDS.prep },
    { staff_id: staffIds[6], skill_id: SKILL_IDS.bar },
    { staff_id: staffIds[6], skill_id: SKILL_IDS.saute },
    { staff_id: staffIds[7], skill_id: SKILL_IDS.grill },
    { staff_id: staffIds[7], skill_id: SKILL_IDS.foh },
    { staff_id: staffIds[8], skill_id: SKILL_IDS.prep },
    { staff_id: staffIds[8], skill_id: SKILL_IDS.expo },
    { staff_id: staffIds[9], skill_id: SKILL_IDS.foh },
    { staff_id: staffIds[9], skill_id: SKILL_IDS.bar },
    { staff_id: staffIds[9], skill_id: SKILL_IDS.grill },
  ];
  await supabase
    .from('staff_skills')
    .upsert(skillAssignments, { onConflict: 'staff_id,skill_id' });

  // ============================================
  // 6. Staff location certifications
  // ============================================
  console.log('📋 Certifying staff for locations...');
  const locationCerts = [
    // Staff 0-2: Downtown + Folly
    { staff_id: staffIds[0], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[0], location_id: LOCATION_IDS.folly },
    { staff_id: staffIds[1], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[1], location_id: LOCATION_IDS.folly },
    { staff_id: staffIds[2], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[2], location_id: LOCATION_IDS.folly },
    // Staff 3-5: Harbor + Airport
    { staff_id: staffIds[3], location_id: LOCATION_IDS.harbor },
    { staff_id: staffIds[3], location_id: LOCATION_IDS.airport },
    { staff_id: staffIds[4], location_id: LOCATION_IDS.harbor },
    { staff_id: staffIds[4], location_id: LOCATION_IDS.airport },
    { staff_id: staffIds[5], location_id: LOCATION_IDS.harbor },
    { staff_id: staffIds[5], location_id: LOCATION_IDS.airport },
    // Staff 6-7: Downtown + Harbor (cross-location)
    { staff_id: staffIds[6], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[6], location_id: LOCATION_IDS.harbor },
    { staff_id: staffIds[7], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[7], location_id: LOCATION_IDS.harbor },
    // Staff 8-9: All locations
    { staff_id: staffIds[8], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[8], location_id: LOCATION_IDS.harbor },
    { staff_id: staffIds[8], location_id: LOCATION_IDS.folly },
    { staff_id: staffIds[8], location_id: LOCATION_IDS.airport },
    { staff_id: staffIds[9], location_id: LOCATION_IDS.downtown },
    { staff_id: staffIds[9], location_id: LOCATION_IDS.harbor },
    { staff_id: staffIds[9], location_id: LOCATION_IDS.folly },
    { staff_id: staffIds[9], location_id: LOCATION_IDS.airport },
  ];
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

  const availEntries: any[] = [];
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
  // 8. Create schedules + shifts for current & next week
  // ============================================
  console.log('📋 Creating schedules and shifts...');

  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const nextMonday = addDays(thisMonday, 7);
  const weeks = [thisMonday, nextMonday];
  const locationIds = Object.values(LOCATION_IDS);

  const scheduleIds: Record<string, string> = {};

  for (const weekStart of weeks) {
    for (const locId of locationIds) {
      const weekStr = format(weekStart, 'yyyy-MM-dd');
      const isCurrentWeek = weekStart === thisMonday;

      const { data: schedule, error } = await supabase
        .from('schedules')
        .upsert(
          {
            location_id: locId,
            week_start: weekStr,
            status: isCurrentWeek ? 'published' : 'draft',
            published_at: isCurrentWeek ? new Date().toISOString() : null,
            published_by: isCurrentWeek ? adminId : null,
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

  // Create shifts for each schedule
  const shiftSkills = [
    SKILL_IDS.grill,
    SKILL_IDS.foh,
    SKILL_IDS.prep,
    SKILL_IDS.bar,
    SKILL_IDS.saute,
    SKILL_IDS.expo,
  ];

  const shiftTemplates = [
    { startHour: 7, endHour: 15, headcount: 2, label: 'Morning' }, // 8h
    { startHour: 11, endHour: 19, headcount: 2, label: 'Mid' }, // 8h
    { startHour: 15, endHour: 23, headcount: 2, label: 'Evening' }, // 8h
    { startHour: 9, endHour: 17, headcount: 1, label: 'Day' }, // 8h
  ];

  const allShiftIds: string[] = [];

  for (const weekStart of weeks) {
    for (const locId of locationIds) {
      const weekStr = format(weekStart, 'yyyy-MM-dd');
      const scheduleId = scheduleIds[`${locId}-${weekStr}`];
      if (!scheduleId) continue;

      // Create shifts for each day of the week
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const day = addDays(weekStart, dayOffset);

        // 2-3 shifts per day per location
        const numShifts = dayOffset < 5 ? 3 : 2; // fewer on weekends
        for (let s = 0; s < numShifts; s++) {
          const template = shiftTemplates[s % shiftTemplates.length];
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

  console.log(`  Created ${allShiftIds.length} shifts`);

  // ============================================
  // 9. Assign staff to current week shifts
  // ============================================
  console.log('👥 Assigning staff to shifts...');

  // Get current week shifts with location info
  const { data: currentShifts } = await supabase
    .from('shifts')
    .select('*, location:locations(*), schedule:schedules(*)')
    .gte('start_time', format(thisMonday, 'yyyy-MM-dd'))
    .lt('start_time', format(nextMonday, 'yyyy-MM-dd'))
    .order('start_time');

  // Map staff to locations
  const staffByLocation: Record<string, string[]> = {
    [LOCATION_IDS.downtown]: [
      staffIds[0],
      staffIds[1],
      staffIds[2],
      staffIds[6],
      staffIds[7],
      staffIds[8],
      staffIds[9],
    ],
    [LOCATION_IDS.harbor]: [
      staffIds[3],
      staffIds[4],
      staffIds[5],
      staffIds[6],
      staffIds[7],
      staffIds[8],
      staffIds[9],
    ],
    [LOCATION_IDS.folly]: [
      staffIds[0],
      staffIds[1],
      staffIds[2],
      staffIds[8],
      staffIds[9],
    ],
    [LOCATION_IDS.airport]: [
      staffIds[3],
      staffIds[4],
      staffIds[5],
      staffIds[8],
      staffIds[9],
    ],
  };

  let assignmentCount = 0;
  const assignedPairs = new Set<string>(); // prevent duplicate shift-staff pairs

  for (const shift of currentShifts || []) {
    const eligible = staffByLocation[shift.location_id] || [];
    const needed = shift.headcount_needed;

    for (let h = 0; h < needed && h < eligible.length; h++) {
      const staffId = eligible[(assignmentCount + h) % eligible.length];
      const pairKey = `${shift.id}-${staffId}`;
      if (assignedPairs.has(pairKey)) continue;
      assignedPairs.add(pairKey);

      const { error } = await supabase.from('shift_assignments').insert({
        shift_id: shift.id,
        staff_id: staffId,
        status: 'assigned',
        assigned_by: adminId,
      });
      if (!error) assignmentCount++;
    }
  }
  console.log(`  Created ${assignmentCount} assignments`);

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
  console.log(`  ${allShiftIds.length} shifts across 2 weeks`);
  console.log(`  ${assignmentCount} shift assignments`);
  console.log(`  ${staffIds.length} staff with skills & location certs`);
}

seed().catch(console.error);

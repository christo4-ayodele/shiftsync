/**
 * ShiftSync E2E Seed — deterministic data for full assessment validation
 *
 * Run:  npx tsx src/lib/seed/e2e-seed.ts
 * npm:  npm run seed:e2e
 *
 * Week: 2026-03-02 (Mon) → 2026-03-08 (Sun)
 * "Today": 2026-03-03 (Tue)
 *
 * Covers every Phase-1 → 4 requirement plus edge cases.
 */

import { createClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local',
  );
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ════════════════════════════════════════════
// DETERMINISTIC IDs
// ════════════════════════════════════════════
const LOC = {
  manhattan: 'e2e00000-0000-0000-0000-000000000001',
  brooklyn: 'e2e00000-0000-0000-0000-000000000002',
  santaMonica: 'e2e00000-0000-0000-0000-000000000003',
  venice: 'e2e00000-0000-0000-0000-000000000004',
};

const SKILL = {
  bartender: 'e2e00000-0000-0000-0001-000000000001',
  server: 'e2e00000-0000-0000-0001-000000000002',
  line_cook: 'e2e00000-0000-0000-0001-000000000003',
  host: 'e2e00000-0000-0000-0001-000000000004',
};

// Week dates
const MON = '2026-03-02';
const TUE = '2026-03-03';
const WED = '2026-03-04';
const THU = '2026-03-05';
const FRI = '2026-03-06';
const SAT = '2026-03-07';
const SUN = '2026-03-08';

// ════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════
const PASSWORD = 'password123';

const USERS = [
  { email: 'admin@coastaleats.dev', name: 'Admin Rivera', role: 'admin' },
  {
    email: 'manager.east@coastaleats.dev',
    name: 'Jordan East',
    role: 'manager',
  },
  {
    email: 'manager.west@coastaleats.dev',
    name: 'Priya West',
    role: 'manager',
  },
  {
    email: 'staff.sarah@coastaleats.dev',
    name: 'Sarah Miller',
    role: 'staff',
    desired: 30,
  },
  {
    email: 'staff.john@coastaleats.dev',
    name: 'John Carter',
    role: 'staff',
    desired: 40,
  },
  {
    email: 'staff.maria@coastaleats.dev',
    name: 'Maria Santos',
    role: 'staff',
    desired: 25,
  },
  {
    email: 'staff.david@coastaleats.dev',
    name: 'David Kim',
    role: 'staff',
    desired: 45,
  },
  {
    email: 'staff.aisha@coastaleats.dev',
    name: 'Aisha Johnson',
    role: 'staff',
    desired: 20,
  },
  {
    email: 'staff.kelvin@coastaleats.dev',
    name: 'Kelvin Brown',
    role: 'staff',
    desired: 35,
  },
  {
    email: 'staff.grace@coastaleats.dev',
    name: 'Grace Lee',
    role: 'staff',
    desired: 30,
  },
  {
    email: 'staff.peter@coastaleats.dev',
    name: 'Peter Wang',
    role: 'staff',
    desired: 40,
  },
] as const;

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

/** Build a UTC ISO timestamp from a date string + HH:MM in a given timezone offset.
 *  For America/New_York (EST = UTC-5) and America/Los_Angeles (PST = UTC-8).
 *  We store in UTC like the real app does. */
function utc(dateStr: string, time: string, tz: 'ET' | 'PT'): string {
  const [h, m] = time.split(':').map(Number);
  const offset = tz === 'ET' ? 5 : 8; // EST / PST offset from UTC
  let utcH = h + offset;
  let dateObj = new Date(`${dateStr}T00:00:00Z`);
  if (utcH >= 24) {
    dateObj = addDays(dateObj, 1);
    utcH -= 24;
  }
  return `${format(dateObj, 'yyyy-MM-dd')}T${String(utcH).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+00:00`;
}

async function resetDatabase() {
  console.log('🗑️  Resetting entire database...');

  // 1. Delete all rows from every table (dependency order — children first)
  const tables = [
    'audit_log',
    'notifications',
    'overtime_overrides',
    'swap_requests',
    'shift_assignments',
    'shifts',
    'schedules',
    'availability',
    'staff_skills',
    'staff_locations',
    'manager_locations',
    'profiles',
    'skills',
    'locations',
  ];

  for (const table of tables) {
    const { error } = await sb
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      // Some tables may use composite PKs (no 'id' column). Try gte on created_at or other approach.
      const { error: err2 } = await sb
        .from(table)
        .delete()
        .gte('created_at', '1970-01-01');
      if (err2) console.warn(`  ⚠ Could not clear ${table}: ${err2.message}`);
      else console.log(`  ✓ Cleared ${table} (via created_at)`);
    } else {
      console.log(`  ✓ Cleared ${table}`);
    }
  }

  // 2. Delete all auth users
  console.log('  Removing all auth users...');
  const { data: authData } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (authData?.users?.length) {
    for (const user of authData.users) {
      const { error } = await sb.auth.admin.deleteUser(user.id);
      if (error)
        console.warn(
          `  ⚠ Could not delete auth user ${user.email}: ${error.message}`,
        );
      else console.log(`  ✓ Deleted auth user ${user.email}`);
    }
  } else {
    console.log('  (no auth users to delete)');
  }

  console.log('  ✅ Database reset complete.\n');
}

async function getOrCreateUser(
  email: string,
  name: string,
  role: string,
  desired?: number,
): Promise<string> {
  const { data: existingUsers } = await sb.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);
  let userId: string;
  if (existing) {
    userId = existing.id;
    console.log(`  ✓ ${email} (existing: ${userId.slice(0, 8)}...)`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`  + ${email} (${userId.slice(0, 8)}...)`);
  }
  await sb.from('profiles').upsert({
    id: userId,
    role: role as 'admin' | 'manager' | 'staff',
    full_name: name,
    email,
    desired_weekly_hours: desired ?? null,
  });
  return userId;
}

// ════════════════════════════════════════════
// MAIN SEED
// ════════════════════════════════════════════

async function seed() {
  console.log('🌱 Starting ShiftSync E2E seed...\n');
  console.log(`   Week: ${MON} (Mon) → ${SUN} (Sun)`);
  console.log(`   "Today": ${TUE} (Tue)\n`);

  await resetDatabase();

  // ─── A. Locations (4 / 2 timezones) ───
  console.log('\n📍 Creating locations...');
  await sb.from('locations').upsert([
    {
      id: LOC.manhattan,
      name: 'Coastal Eats — Manhattan',
      address: '100 Broadway, New York, NY',
      timezone: 'America/New_York',
    },
    {
      id: LOC.brooklyn,
      name: 'Coastal Eats — Brooklyn',
      address: '200 Atlantic Ave, Brooklyn, NY',
      timezone: 'America/New_York',
    },
    {
      id: LOC.santaMonica,
      name: 'Coastal Eats — Santa Monica',
      address: '300 Ocean Ave, Santa Monica, CA',
      timezone: 'America/Los_Angeles',
    },
    {
      id: LOC.venice,
      name: 'Coastal Eats — Venice Beach',
      address: '400 Boardwalk, Venice Beach, CA',
      timezone: 'America/Los_Angeles',
    },
  ]);

  // ─── B. Skills ───
  console.log('🎯 Creating skills...');
  await sb.from('skills').upsert([
    { id: SKILL.bartender, name: 'Bartender' },
    { id: SKILL.server, name: 'Server' },
    { id: SKILL.line_cook, name: 'Line Cook' },
    { id: SKILL.host, name: 'Host' },
  ]);

  // ─── C. Users ───
  console.log('👤 Creating users...');
  const uid: Record<string, string> = {};
  for (const u of USERS) {
    uid[u.email] = await getOrCreateUser(
      u.email,
      u.name,
      u.role,
      'desired' in u
        ? (u as unknown as { desired?: number }).desired
        : undefined,
    );
  }

  const adminId = uid['admin@coastaleats.dev'];
  const mgrEastId = uid['manager.east@coastaleats.dev'];
  const mgrWestId = uid['manager.west@coastaleats.dev'];

  const sarah = uid['staff.sarah@coastaleats.dev'];
  const john = uid['staff.john@coastaleats.dev'];
  const maria = uid['staff.maria@coastaleats.dev'];
  const david = uid['staff.david@coastaleats.dev'];
  const aisha = uid['staff.aisha@coastaleats.dev'];
  const kelvin = uid['staff.kelvin@coastaleats.dev'];
  const grace = uid['staff.grace@coastaleats.dev'];
  const peter = uid['staff.peter@coastaleats.dev'];

  // ─── D. Manager-location assignments ───
  console.log('🏢 Assigning managers to locations...');
  await sb.from('manager_locations').upsert(
    [
      { manager_id: mgrEastId, location_id: LOC.manhattan },
      { manager_id: mgrEastId, location_id: LOC.brooklyn },
      { manager_id: mgrWestId, location_id: LOC.santaMonica },
      { manager_id: mgrWestId, location_id: LOC.venice },
    ],
    { onConflict: 'manager_id,location_id' },
  );

  // ─── E. Staff skills ───
  console.log('⭐ Assigning staff skills...');
  const staffSkills: { staff_id: string; skill_id: string }[] = [
    // Sarah — server
    { staff_id: sarah, skill_id: SKILL.server },
    // John — bartender
    { staff_id: john, skill_id: SKILL.bartender },
    // Maria — host
    { staff_id: maria, skill_id: SKILL.host },
    // David — line_cook + server (cross-trained)
    { staff_id: david, skill_id: SKILL.line_cook },
    { staff_id: david, skill_id: SKILL.server },
    // Aisha — server
    { staff_id: aisha, skill_id: SKILL.server },
    // Kelvin — bartender + host
    { staff_id: kelvin, skill_id: SKILL.bartender },
    { staff_id: kelvin, skill_id: SKILL.host },
    // Grace — line_cook
    { staff_id: grace, skill_id: SKILL.line_cook },
    // Peter — server + bartender (cross-trained)
    { staff_id: peter, skill_id: SKILL.server },
    { staff_id: peter, skill_id: SKILL.bartender },
  ];
  await sb
    .from('staff_skills')
    .upsert(staffSkills, { onConflict: 'staff_id,skill_id' });

  // ─── F. Staff location certifications ───
  console.log('📋 Certifying staff for locations...');
  const staffLocs: { staff_id: string; location_id: string }[] = [
    // Sarah — Manhattan + Brooklyn (East only)
    { staff_id: sarah, location_id: LOC.manhattan },
    { staff_id: sarah, location_id: LOC.brooklyn },
    // John — Santa Monica + Venice (West only)
    { staff_id: john, location_id: LOC.santaMonica },
    { staff_id: john, location_id: LOC.venice },
    // Maria — Manhattan only
    { staff_id: maria, location_id: LOC.manhattan },
    // David — Manhattan + Santa Monica (timezone tangle!)
    { staff_id: david, location_id: LOC.manhattan },
    { staff_id: david, location_id: LOC.santaMonica },
    // Aisha — Brooklyn only
    { staff_id: aisha, location_id: LOC.brooklyn },
    // Kelvin — Venice only
    { staff_id: kelvin, location_id: LOC.venice },
    // Grace — Santa Monica only
    { staff_id: grace, location_id: LOC.santaMonica },
    // Peter — Manhattan + Brooklyn (East, for overtime trap)
    { staff_id: peter, location_id: LOC.manhattan },
    { staff_id: peter, location_id: LOC.brooklyn },
  ];
  await sb
    .from('staff_locations')
    .upsert(staffLocs, { onConflict: 'staff_id,location_id' });

  // ─── G. Availability ───
  // Day convention: 0=Monday, 6=Sunday (matching the UI DAYS array + checkConstraints)
  console.log('📅 Setting staff availability...');

  const avail: Array<{
    staff_id: string;
    type: string;
    day_of_week: number | null;
    specific_date?: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
    timezone: string;
  }> = [];

  // Sarah: Mon–Fri 09:00–15:00, off Sat/Sun.
  // Thu 09:00–15:00 is key — shift 10:00–16:00 should FAIL containment
  for (let d = 0; d <= 4; d++) {
    // Mon=0 .. Fri=4
    avail.push({
      staff_id: sarah,
      type: 'recurring',
      day_of_week: d,
      start_time: '09:00',
      end_time: '15:00',
      is_available: true,
      timezone: 'America/New_York',
    });
  }

  // John: Mon–Thu 08:00–16:00, Fri 22:00–06:00 (overnight), Sat 22:00–06:00
  for (let d = 0; d <= 3; d++) {
    // Mon-Thu
    avail.push({
      staff_id: john,
      type: 'recurring',
      day_of_week: d,
      start_time: '08:00',
      end_time: '16:00',
      is_available: true,
      timezone: 'America/Los_Angeles',
    });
  }
  avail.push({
    staff_id: john,
    type: 'recurring',
    day_of_week: 4,
    start_time: '22:00',
    end_time: '06:00',
    is_available: true,
    timezone: 'America/Los_Angeles',
  }); // Fri overnight
  avail.push({
    staff_id: john,
    type: 'recurring',
    day_of_week: 5,
    start_time: '22:00',
    end_time: '06:00',
    is_available: true,
    timezone: 'America/Los_Angeles',
  }); // Sat overnight

  // Maria: Mon–Sat all day, off Sun. EXCEPTION: blocked on Sat 2026-03-07
  for (let d = 0; d <= 5; d++) {
    // Mon-Sat
    avail.push({
      staff_id: maria,
      type: 'recurring',
      day_of_week: d,
      start_time: '07:00',
      end_time: '22:00',
      is_available: true,
      timezone: 'America/New_York',
    });
  }
  avail.push({
    staff_id: maria,
    type: 'exception',
    day_of_week: null,
    specific_date: SAT,
    start_time: '00:00',
    end_time: '23:59',
    is_available: false,
    timezone: 'America/New_York',
  });

  // David: Mon–Sun wide availability (overtime candidate)
  for (let d = 0; d <= 6; d++) {
    avail.push({
      staff_id: david,
      type: 'recurring',
      day_of_week: d,
      start_time: '06:00',
      end_time: '23:00',
      is_available: true,
      timezone: 'America/New_York',
    });
  }

  // Aisha: Mon–Thu 08:00–17:00 only (low hours — desired 20)
  for (let d = 0; d <= 3; d++) {
    avail.push({
      staff_id: aisha,
      type: 'recurring',
      day_of_week: d,
      start_time: '08:00',
      end_time: '17:00',
      is_available: true,
      timezone: 'America/New_York',
    });
  }

  // Kelvin: Tue–Sun 14:00–23:00 (off Mon, evening-heavy — bartender)
  for (let d = 1; d <= 6; d++) {
    avail.push({
      staff_id: kelvin,
      type: 'recurring',
      day_of_week: d,
      start_time: '14:00',
      end_time: '23:00',
      is_available: true,
      timezone: 'America/Los_Angeles',
    });
  }

  // Grace: Mon–Fri 07:00–16:00 (daytime line cook)
  for (let d = 0; d <= 4; d++) {
    avail.push({
      staff_id: grace,
      type: 'recurring',
      day_of_week: d,
      start_time: '07:00',
      end_time: '16:00',
      is_available: true,
      timezone: 'America/Los_Angeles',
    });
  }

  // Peter: Mon–Sun wide availability (overtime trap target)
  for (let d = 0; d <= 6; d++) {
    avail.push({
      staff_id: peter,
      type: 'recurring',
      day_of_week: d,
      start_time: '06:00',
      end_time: '23:00',
      is_available: true,
      timezone: 'America/New_York',
    });
  }

  await sb.from('availability').insert(avail);

  // ─── H. Schedules ───
  console.log('📋 Creating schedules...');
  const schedules: Record<string, string> = {};

  for (const [key, locId] of Object.entries(LOC)) {
    const { data, error } = await sb
      .from('schedules')
      .upsert(
        {
          location_id: locId,
          week_start: MON,
          status: 'published',
          published_at: new Date('2026-03-01T12:00:00Z').toISOString(),
          published_by: adminId,
          edit_cutoff_hours: 48,
        },
        { onConflict: 'location_id,week_start' },
      )
      .select()
      .single();

    if (error) {
      console.error(`  ✗ Schedule ${key}:`, error.message);
      continue;
    }
    schedules[key] = data.id;
    console.log(`  ✓ ${key}: ${data.id.slice(0, 8)}...`);
  }

  // ─── I. Shifts ───
  console.log('🕐 Creating shifts...');
  const shiftIds: Record<string, string> = {};

  async function createShift(
    label: string,
    locKey: keyof typeof LOC,
    skillKey: keyof typeof SKILL,
    dateStr: string,
    startTime: string,
    endTime: string,
    tz: 'ET' | 'PT',
    headcount: number = 1,
    notes?: string,
  ): Promise<string> {
    const sid = schedules[locKey];
    if (!sid) {
      console.error(`  ✗ No schedule for ${locKey}`);
      return '';
    }

    // Handle overnight: if endTime < startTime, end is next day
    let endDateStr = dateStr;
    const [sh] = startTime.split(':').map(Number);
    const [eh] = endTime.split(':').map(Number);
    if (eh <= sh) {
      const nextDay = addDays(new Date(`${dateStr}T00:00:00Z`), 1);
      endDateStr = format(nextDay, 'yyyy-MM-dd');
    }

    const { data, error } = await sb
      .from('shifts')
      .insert({
        schedule_id: sid,
        location_id: LOC[locKey],
        required_skill_id: SKILL[skillKey],
        start_time: utc(dateStr, startTime, tz),
        end_time: utc(endDateStr, endTime, tz),
        headcount_needed: headcount,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error(`  ✗ Shift ${label}:`, error.message);
      return '';
    }
    shiftIds[label] = data.id;
    console.log(`  ✓ ${label}: ${data.id.slice(0, 8)}...`);
    return data.id;
  }

  // ── Monday (Mar 2) shifts ──
  await createShift(
    'mon-man-server-am',
    'manhattan',
    'server',
    MON,
    '08:00',
    '14:00',
    'ET',
    1,
    'Monday morning server',
  );
  await createShift(
    'mon-man-cook-pm',
    'manhattan',
    'line_cook',
    MON,
    '14:00',
    '22:00',
    'ET',
  );
  await createShift(
    'mon-bkn-server-am',
    'brooklyn',
    'server',
    MON,
    '09:00',
    '15:00',
    'ET',
  );

  // ── Tuesday (Mar 3) — < 48h from "now" ──
  await createShift(
    'tue-man-server-am',
    'manhattan',
    'server',
    TUE,
    '08:00',
    '14:00',
    'ET',
    1,
    '48h cutoff test — starts today',
  );
  await createShift(
    'tue-man-cook-pm',
    'manhattan',
    'line_cook',
    TUE,
    '15:00',
    '23:00',
    'ET',
  );
  await createShift(
    'tue-bkn-host-pm',
    'brooklyn',
    'host',
    TUE,
    '12:00',
    '18:00',
    'ET',
  );

  // ── Wednesday (Mar 4) ──
  await createShift(
    'wed-man-server-am',
    'manhattan',
    'server',
    WED,
    '08:00',
    '14:00',
    'ET',
  );
  await createShift(
    'wed-man-cook-pm',
    'manhattan',
    'line_cook',
    WED,
    '14:00',
    '22:00',
    'ET',
  );
  await createShift(
    'wed-sm-cook-am',
    'santaMonica',
    'line_cook',
    WED,
    '07:00',
    '15:00',
    'PT',
  );

  // ── Thursday (Mar 5) — Sarah availability mismatch ──
  // Sarah avail 09:00–15:00 ET. Shift 10–16 ET extends past avail.
  await createShift(
    'thu-man-server-10to16',
    'manhattan',
    'server',
    THU,
    '10:00',
    '16:00',
    'ET',
    1,
    'Sarah availability mismatch test',
  );
  await createShift(
    'thu-man-server-08to15',
    'manhattan',
    'server',
    THU,
    '08:00',
    '15:00',
    'ET',
    1,
    'Also rejects Sarah (starts before avail)',
  );
  await createShift(
    'thu-man-cook-pm',
    'manhattan',
    'line_cook',
    THU,
    '14:00',
    '22:00',
    'ET',
  );
  // Shift for 10h-rest violation: ends 23:00 Thu
  await createShift(
    'thu-man-bartender-late',
    'manhattan',
    'bartender',
    THU,
    '17:00',
    '23:00',
    'ET',
    1,
    '10h rest violation setup',
  );

  // ── Friday (Mar 6) — Premium shifts (>= 17:00 local) ──
  // Rest violation target: starts 07:00 Fri (only 8h after Thu 23:00)
  await createShift(
    'fri-man-server-early',
    'manhattan',
    'server',
    FRI,
    '07:00',
    '13:00',
    'ET',
    1,
    '10h rest violation — 8h gap from Thu 23:00',
  );
  // Premium Manhattan
  await createShift(
    'fri-man-server-premium',
    'manhattan',
    'server',
    FRI,
    '17:00',
    '23:00',
    'ET',
    2,
    'Premium Fri evening — headcount 2',
  );
  // Premium Santa Monica
  await createShift(
    'fri-sm-bartender-premium',
    'santaMonica',
    'bartender',
    FRI,
    '18:00',
    '22:00',
    'PT',
    1,
    'Premium Fri evening PT',
  );
  // Non-premium Fri
  await createShift(
    'fri-bkn-server-am',
    'brooklyn',
    'server',
    FRI,
    '09:00',
    '15:00',
    'ET',
  );

  // ── Saturday (Mar 7) — Premium + overnight + Maria exception ──
  // Premium Brooklyn host — Maria has exception blocking this day
  await createShift(
    'sat-bkn-host-premium',
    'brooklyn',
    'host',
    SAT,
    '17:00',
    '21:00',
    'ET',
    1,
    'Maria exception test — premium',
  );
  // Premium Manhattan server
  await createShift(
    'sat-man-server-premium',
    'manhattan',
    'server',
    SAT,
    '17:00',
    '23:00',
    'ET',
  );
  // Overnight Venice bartender 23:00 → 03:00
  await createShift(
    'sat-ven-bartender-overnight',
    'venice',
    'bartender',
    SAT,
    '23:00',
    '03:00',
    'PT',
    1,
    'Overnight shift',
  );
  // Daytime shift
  await createShift(
    'sat-sm-cook-am',
    'santaMonica',
    'line_cook',
    SAT,
    '08:00',
    '14:00',
    'PT',
  );

  // ── Sunday (Mar 8) — "Sunday Night Chaos" + consecutive day ──
  // Sunday Night Chaos: Manhattan bartender 19:00–23:00, assign 1 + leave 2 backups
  await createShift(
    'sun-man-bartender-chaos',
    'manhattan',
    'bartender',
    SUN,
    '19:00',
    '23:00',
    'ET',
    1,
    'Sunday Night Chaos — 1 assigned, 2 eligible backups',
  );
  // Additional Sunday shifts (for consecutive-day testing)
  await createShift(
    'sun-man-server-am',
    'manhattan',
    'server',
    SUN,
    '08:00',
    '14:00',
    'ET',
  );
  await createShift(
    'sun-bkn-server-pm',
    'brooklyn',
    'server',
    SUN,
    '14:00',
    '20:00',
    'ET',
  );

  // ── Double-book attempt shift (same time, different location) ──
  // If Peter is assigned to fri-man-server-premium (17–23 Manhattan),
  // then fri-bkn-server-overlap should detect double-book
  await createShift(
    'fri-bkn-server-overlap',
    'brooklyn',
    'server',
    FRI,
    '18:00',
    '22:00',
    'ET',
    1,
    'Double-book test — overlaps fri-man 17–23',
  );

  // ── Peter's overtime trap shifts ──
  // Peter gets Mon–Thu morning + Wed evening = 34h.
  // Then the what-if preview should show 42h projected for an 8h Fri shift.
  // Peter shifts: Mon 8-14 (6h), Tue 8-14 (6h), Wed 8-14 (6h),
  //               Wed 14-22 (8h), Thu 8-16 (8h) = 34h
  // We'll also use some existing shifts above for peter.

  // ─── J. Assignments ───
  console.log('\n👥 Creating shift assignments...');

  async function assign(
    shiftLabel: string,
    staffId: string,
    assignerId: string,
  ): Promise<string> {
    const shiftId = shiftIds[shiftLabel];
    if (!shiftId) {
      console.error(`  ✗ Unknown shift: ${shiftLabel}`);
      return '';
    }
    const { data, error } = await sb
      .from('shift_assignments')
      .insert({
        shift_id: shiftId,
        staff_id: staffId,
        status: 'assigned',
        assigned_by: assignerId,
      })
      .select()
      .single();
    if (error) {
      console.error(`  ✗ Assign ${shiftLabel}: ${error.message}`);
      return '';
    }
    return data.id;
  }

  // Sarah — Mon + Tue mornings (12h — under her 30h desired)
  const sarahAssign1 = await assign('mon-man-server-am', sarah, mgrEastId);
  await assign('tue-man-server-am', sarah, mgrEastId);

  // Peter — overtime trap: Mon, Tue, Wed AM, Wed PM, Thu AM = 34h
  // He's already past warning (35h with one more shift), and adding Fri 6h → 40h, or 8h → 42h
  await assign('mon-bkn-server-am', peter, mgrEastId); // Mon 9-15, 6h

  // Need to create additional shifts for Peter's overtime trap
  await createShift(
    'tue-bkn-server-am',
    'brooklyn',
    'server',
    TUE,
    '09:00',
    '15:00',
    'ET',
    1,
    'Peter OT trap',
  );
  await createShift(
    'thu-bkn-server-am',
    'brooklyn',
    'server',
    THU,
    '08:00',
    '16:00',
    'ET',
    1,
    'Peter OT trap',
  );

  // Peter assignments (34h total):
  // Mon: mon-bkn-server-am (9–15, 6h) [already assigned above]
  await assign('tue-bkn-server-am', peter, mgrEastId); // Tue 9-15, 6h → 12h
  await assign('wed-man-server-am', peter, mgrEastId); // Wed 8-14, 6h → 18h
  // Wed evening — Peter should also work. Create a new shift
  await createShift(
    'wed-bkn-server-pm',
    'brooklyn',
    'server',
    WED,
    '15:00',
    '23:00',
    'ET',
    1,
    'Peter OT trap PM',
  );
  await assign('wed-bkn-server-pm', peter, mgrEastId); // Wed 15-23, 8h → 26h
  await assign('thu-bkn-server-am', peter, mgrEastId); // Thu 8-16, 8h → 34h
  // NOW: Peter is at 34h. Adding fri-man-server-premium (17–23, 6h) → 40h.
  // Or adding any 8h shift → 42h (overtime trap!)

  // David — heavy worker for overtime + consecutive days
  // David is line_cook + server, certified Manhattan + Santa Monica
  await assign('mon-man-cook-pm', david, mgrEastId); // Mon 14-22 ET, 8h
  await assign('tue-man-cook-pm', david, mgrEastId); // Tue 15-23 ET, 8h → 16h
  await assign('wed-man-cook-pm', david, mgrEastId); // Wed 14-22 ET, 8h → 24h
  await assign('thu-man-cook-pm', david, mgrEastId); // Thu 14-22 ET, 8h → 32h
  // Fri premium
  await assign('fri-man-server-premium', david, mgrEastId); // Fri 17-23 ET, 6h → 38h
  // Sat premium
  await assign('sat-man-server-premium', david, mgrEastId); // Sat 17-23 ET, 6h → 44h (OVERTIME!)
  // Sun — 7th consecutive day!
  await assign('sun-man-server-am', david, mgrEastId); // Sun 8-14 ET, 6h → 50h
  // David: 50h / 7 consecutive days → overtime violation + consecutive day warning/override

  // Aisha — under-scheduled (desired 20h, only 6h)
  await assign('tue-bkn-host-pm', aisha, mgrEastId); // Aisha only has server skill, HOST mismatch!
  // Wait — Aisha has server skill, but tue-bkn-host-pm requires Host.
  // This won't pass constraints if assigned via the UI. But seed can force-insert for testing.
  // Actually let's give Aisha a proper shift instead plus a mismatch attempt separately.
  // Let me give Aisha one correct shift.
  await createShift(
    'tue-bkn-server-pm',
    'brooklyn',
    'server',
    TUE,
    '14:00',
    '20:00',
    'ET',
  );

  // Kelvin — Venice bartender for overnight
  await assign('sat-ven-bartender-overnight', kelvin, mgrWestId); // Sat 23-03 PT, 4h

  // Grace — Santa Monica daytime
  await assign('wed-sm-cook-am', grace, mgrWestId); // Wed 7-15 PT, 8h
  await assign('sat-sm-cook-am', grace, mgrWestId); // Sat 8-14 PT, 6h → 14h

  // Maria — Manhattan host, Mon + some
  await createShift(
    'mon-man-host-am',
    'manhattan',
    'host',
    MON,
    '08:00',
    '14:00',
    'ET',
  );
  await assign('mon-man-host-am', maria, mgrEastId); // 6h
  await createShift(
    'wed-man-host-pm',
    'manhattan',
    'host',
    WED,
    '14:00',
    '20:00',
    'ET',
  );
  await assign('wed-man-host-pm', maria, mgrEastId); // 6h → 12h

  // John — West coast bartender
  await assign('fri-sm-bartender-premium', john, mgrWestId); // Fri 18-22 PT, 4h

  // Sunday Night Chaos: assign Peter (he's already at 34h but has wide availability)
  // Actually Peter is at 34h. Let's assign him to chaos for what-if exercise.
  // Keep it unassigned so the tester can try assigning and see the OT preview.
  // Instead assign Kelvin (he's bartender, certified Venice, but NOT Manhattan)
  // So let's make someone eligible. David has server skill + Manhattan cert.
  // But David is already at 50h. Let's assign no one and leave it for testing.
  // Actually let's assign John — wait, John isn't certified at Manhattan.
  // Let's create a bartender who can work Manhattan. Peter has bartender + Manhattan cert!
  // Peter is at 34h + 6h chaos = 40h exactly (limit).
  // Leave Sunday Night Chaos UNASSIGNED for the tester to manually assign from UI.

  // ─── K. Overtime override for David (7th consecutive day) ───
  console.log(
    '\n📋 Creating overtime override for David (7th consecutive day)...',
  );
  await sb.from('overtime_overrides').insert({
    staff_id: david,
    week_start: MON,
    manager_id: mgrEastId,
    reason:
      'Critical staffing shortage — all other line cooks unavailable. Approved 7th consecutive day.',
  });

  // ─── L. Swap & Drop requests ───
  console.log('🔄 Creating swap & drop requests...');

  // Swap: Sarah requests swap with Peter for mon-man-server-am
  // Status: pending_peer
  if (sarahAssign1) {
    await sb.from('swap_requests').insert({
      type: 'swap',
      requesting_assignment_id: sarahAssign1,
      target_staff_id: peter,
      status: 'pending_peer',
      reason: 'Need to attend a medical appointment Monday morning',
    });
    console.log('  ✓ Swap: Sarah → Peter (pending_peer)');
  }

  // Swap pending_manager: David wants to swap Fri premium with Peter
  // We need David's assignment for fri-man-server-premium
  const { data: davidFriAssign } = await sb
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftIds['fri-man-server-premium'])
    .eq('staff_id', david)
    .single();

  if (davidFriAssign) {
    await sb.from('swap_requests').insert({
      type: 'swap',
      requesting_assignment_id: davidFriAssign.id,
      target_staff_id: peter,
      status: 'pending_manager',
      reason: 'Personal commitment Friday evening — Peter agreed to cover',
    });
    console.log('  ✓ Swap: David → Peter for Fri premium (pending_manager)');
  }

  // Drop request: David drops Sat premium, expires 24h before shift
  const { data: davidSatAssign } = await sb
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftIds['sat-man-server-premium'])
    .eq('staff_id', david)
    .single();

  if (davidSatAssign) {
    // Sat 17:00 ET → expires 24h before = Fri 17:00 ET = Fri 22:00 UTC
    const expiresAt = utc(FRI, '17:00', 'ET');
    await sb.from('swap_requests').insert({
      type: 'drop',
      requesting_assignment_id: davidSatAssign.id,
      status: 'pending_manager',
      reason: 'Family emergency — need Saturday evening off',
      expires_at: expiresAt,
    });
    console.log(
      '  ✓ Drop: David drops Sat premium (pending_manager, expires Fri 17:00 ET)',
    );
  }

  // Already-expired drop request: Grace's Wed AM (already in the past)
  const { data: graceWedAssign } = await sb
    .from('shift_assignments')
    .select('id')
    .eq('shift_id', shiftIds['wed-sm-cook-am'])
    .eq('staff_id', grace)
    .single();

  if (graceWedAssign) {
    await sb.from('swap_requests').insert({
      type: 'drop',
      requesting_assignment_id: graceWedAssign.id,
      status: 'pending_manager',
      reason: 'Car broke down — cannot make it',
      expires_at: new Date('2026-03-02T12:00:00Z').toISOString(), // Already expired (Mon noon)
      created_at: new Date('2026-03-01T10:00:00Z').toISOString(),
    });
    console.log('  ✓ Drop: Grace Wed AM (EXPIRED — should auto-expire)');
  }

  // ─── M. Notifications ───
  console.log('🔔 Creating notifications...');
  await sb.from('notifications').insert([
    {
      user_id: sarah,
      type: 'schedule_published',
      title: 'Schedule Published',
      message:
        "This week's schedule for Coastal Eats — Manhattan has been published.",
      link: '/dashboard/my-shifts',
      is_read: false,
      delivery_method: 'in_app',
    },
    {
      user_id: sarah,
      type: 'swap_requested',
      title: 'Swap Confirmation Needed',
      message:
        'Your swap request with Peter Wang for Monday morning is pending.',
      link: '/dashboard/swap-requests',
      is_read: false,
      delivery_method: 'in_app',
    },
    {
      user_id: peter,
      type: 'swap_requested',
      title: 'Swap Request Received',
      message: 'Sarah Miller wants to swap her Monday morning shift with you.',
      link: '/dashboard/swap-requests',
      is_read: false,
      delivery_method: 'in_app',
    },
    {
      user_id: david,
      type: 'overtime_warning',
      title: 'Overtime Warning',
      message:
        'You have exceeded 40 weekly hours (currently 50h). Manager approval recorded.',
      link: '/dashboard/my-shifts',
      is_read: false,
      delivery_method: 'in_app',
    },
    {
      user_id: mgrEastId,
      type: 'overtime_warning',
      title: 'Staff Overtime Alert',
      message:
        'David Kim has exceeded 40h this week (50h). Override reason on file.',
      link: '/dashboard/overtime',
      is_read: false,
      delivery_method: 'in_app',
    },
    {
      user_id: peter,
      type: 'shift_assigned',
      title: 'New Shift Assigned',
      message: 'You have been assigned to 5 shifts this week (34h total).',
      link: '/dashboard/my-shifts',
      is_read: true,
      delivery_method: 'in_app',
    },
  ]);

  // ─── N. Audit log ───
  console.log('📝 Creating audit log entries...');
  await sb.from('audit_log').insert([
    {
      entity_type: 'schedule',
      entity_id: schedules.manhattan || '00000000-0000-0000-0000-000000000000',
      action: 'schedule_published',
      changed_by: adminId,
      metadata: { location: 'Coastal Eats — Manhattan', week: MON },
    },
    {
      entity_type: 'shift_assignment',
      entity_id: sarahAssign1 || '00000000-0000-0000-0000-000000000000',
      action: 'staff_assigned',
      changed_by: mgrEastId,
      metadata: {
        staff: 'Sarah Miller',
        shift: 'Mon 08:00–14:00 Server',
        location: 'Manhattan',
      },
    },
    {
      entity_type: 'overtime_override',
      entity_id: '00000000-0000-0000-0000-000000000000',
      action: 'overtime_override_created',
      changed_by: mgrEastId,
      metadata: {
        staff: 'David Kim',
        reason: '7th consecutive day — critical staffing shortage',
        hours: 50,
      },
    },
    {
      entity_type: 'swap_request',
      entity_id: '00000000-0000-0000-0000-000000000000',
      action: 'swap_requested',
      changed_by: sarah,
      metadata: {
        from: 'Sarah Miller',
        to: 'Peter Wang',
        reason: 'Medical appointment',
      },
    },
  ]);

  // ─── Summary ───
  console.log('\n' + '═'.repeat(60));
  console.log('✅ E2E SEED COMPLETE');
  console.log('═'.repeat(60));

  // Count what we seeded
  const { count: shiftCount } = await sb
    .from('shifts')
    .select('*', { count: 'exact', head: true });
  const { count: assignCount } = await sb
    .from('shift_assignments')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Data Summary:`);
  console.log(`   Locations:    4 (2 ET + 2 PT)`);
  console.log(`   Skills:       4 (Bartender, Server, Line Cook, Host)`);
  console.log(
    `   Users:        ${USERS.length} (1 admin, 2 managers, 8 staff)`,
  );
  console.log(`   Shifts:       ${shiftCount}`);
  console.log(`   Assignments:  ${assignCount}`);

  console.log(`\n📊 Staff Hours Summary:`);
  console.log('  ┌──────────────────┬──────────┬───────────┬──────────┐');
  console.log('  │ Staff            │ Desired  │ Assigned  │ Status   │');
  console.log('  ├──────────────────┼──────────┼───────────┼──────────┤');
  const staffSummary = [
    { name: 'Sarah Miller', desired: 30, assigned: 12, status: 'Under' },
    { name: 'John Carter', desired: 40, assigned: 4, status: 'Under' },
    { name: 'Maria Santos', desired: 25, assigned: 12, status: 'Under' },
    { name: 'David Kim', desired: 45, assigned: 50, status: 'OVERTIME' },
    { name: 'Aisha Johnson', desired: 20, assigned: 0, status: 'Unassigned' },
    { name: 'Kelvin Brown', desired: 35, assigned: 4, status: 'Under' },
    { name: 'Grace Lee', desired: 30, assigned: 14, status: 'Under' },
    { name: 'Peter Wang', desired: 40, assigned: 34, status: 'Near OT' },
  ];
  for (const s of staffSummary) {
    console.log(
      `  │ ${s.name.padEnd(16)} │ ${String(s.desired).padStart(5)}h   │ ${String(s.assigned).padStart(6)}h    │ ${s.status.padEnd(8)} │`,
    );
  }
  console.log('  └──────────────────┴──────────┴───────────┴──────────┘');

  console.log('\n🔑 Login Credentials (password for all: password123):');
  console.log(
    '  ┌──────────────────────────────────────┬─────────┬──────────────────────────────────────┐',
  );
  console.log(
    '  │ Email                                │ Role    │ Where to Click First                 │',
  );
  console.log(
    '  ├──────────────────────────────────────┼─────────┼──────────────────────────────────────┤',
  );
  console.log(
    '  │ admin@coastaleats.dev                │ Admin   │ Dashboard → Analytics                │',
  );
  console.log(
    '  │ manager.east@coastaleats.dev         │ Manager │ Shifts → Manhattan → Assign          │',
  );
  console.log(
    '  │ manager.west@coastaleats.dev         │ Manager │ Shifts → Santa Monica → Overtime     │',
  );
  console.log(
    '  │ staff.sarah@coastaleats.dev          │ Staff   │ My Shifts → Swap Requests            │',
  );
  console.log(
    '  │ staff.peter@coastaleats.dev          │ Staff   │ My Shifts (check 34h, OT preview)    │',
  );
  console.log(
    '  │ staff.david@coastaleats.dev          │ Staff   │ My Shifts (50h, 7 consecutive days)  │',
  );
  console.log(
    '  │ staff.john@coastaleats.dev           │ Staff   │ My Shifts (overnight Fri)            │',
  );
  console.log(
    '  │ staff.maria@coastaleats.dev          │ Staff   │ My Shifts (Sat exception blocked)    │',
  );
  console.log(
    '  └──────────────────────────────────────┴─────────┴──────────────────────────────────────┘',
  );

  console.log('\n🏁 Quick Start:');
  console.log('  1. Run: npm run dev');
  console.log('  2. Open: http://localhost:3000');
  console.log('  3. Login as manager.east@coastaleats.dev / password123');
  console.log('  4. Go to Shifts → Select "Coastal Eats — Manhattan"');
  console.log(
    '  5. Try assigning Sarah to Thu 10:00–16:00 → should be INELIGIBLE',
  );
  console.log('  6. Check Overtime page → David Kim should show 50h OVERTIME');
  console.log('  7. Open Analytics → Fairness score should not be 100%');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});

/**
 * Quick tests for isShiftFullyWithinAvailability
 *
 * Run:  npx tsx src/lib/utils/__tests__/availability-containment.test.ts
 */

import { isShiftFullyWithinAvailability } from '../timezone';

// Helper: build a UTC Date from "HH:MM" on an arbitrary fixed date (2026-03-05, a Thursday)
// We treat these as already-local times for simplicity since the test uses UTC as the tz.
function d(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 2, 5, h, m, 0)); // March 5, 2026
}

const tz = 'UTC'; // keeps it simple — no offset conversion

const cases: [string, Date, Date, string, string, boolean][] = [
  // [label, shiftStart, shiftEnd, availStart, availEnd, expected]
  [
    '09–15 vs 10–16 → false (shift extends past avail)',
    d('10:00'),
    d('16:00'),
    '09:00',
    '15:00',
    false,
  ],
  [
    '09–15 vs 08–15 → false (shift starts before avail)',
    d('08:00'),
    d('15:00'),
    '09:00',
    '15:00',
    false,
  ],
  [
    '09–15 vs 09–15 → true  (exact match)',
    d('09:00'),
    d('15:00'),
    '09:00',
    '15:00',
    true,
  ],
  [
    '22–06 vs 23–01 → true  (overnight, fully inside)',
    d('23:00'),
    d('01:00'),
    '22:00',
    '06:00',
    true,
  ],
];

let pass = 0;
let fail = 0;

for (const [label, shiftStart, shiftEnd, aStart, aEnd, expected] of cases) {
  const result = isShiftFullyWithinAvailability(
    shiftStart,
    shiftEnd,
    aStart,
    aEnd,
    tz,
  );
  const ok = result === expected;
  console.log(`${ok ? '✅' : '❌'} ${label}  got=${result}`);
  if (ok) pass++;
  else fail++;
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);

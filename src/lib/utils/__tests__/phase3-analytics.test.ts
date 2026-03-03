/**
 * Phase 3 tests: Premium shifts, Fairness score, Desired vs Actual hours
 *
 * Run:  npx tsx src/lib/utils/__tests__/phase3-analytics.test.ts
 */

import { isPremiumShift } from '../timezone';

// ─────────────────────────────────────────────────
// Helpers – reproduce the pure-logic pieces from
// the analytics page so we can unit-test them
// without spinning up React.
// ─────────────────────────────────────────────────

/** Fairness score: 100 × (1 − CV) where CV = σ/μ */
function computeFairnessScore(hoursArray: number[]): {
  score: number;
  stddev: number;
  mean: number;
  cv: number;
} | null {
  if (hoursArray.length < 2) return null;
  const mean = hoursArray.reduce((s, h) => s + h, 0) / hoursArray.length;
  const variance =
    hoursArray.reduce((s, h) => s + (h - mean) ** 2, 0) / hoursArray.length;
  const stddev = Math.sqrt(variance);
  const cv = mean > 0 ? stddev / mean : 0;
  const score = Math.max(0, Math.round(100 * (1 - cv)));
  return {
    score,
    stddev: Math.round(stddev * 10) / 10,
    mean: Math.round(mean * 10) / 10,
    cv: Math.round(cv * 100) / 100,
  };
}

/** Desired vs actual gap (average weekly hours over N weeks) */
function computeDesiredVsActual(
  entries: { desired: number; totalHours: number }[],
  weeksBack: number,
): { desired: number; actual: number; diff: number }[] {
  return entries.map(({ desired, totalHours }) => {
    const actual = Math.round((totalHours / weeksBack) * 10) / 10;
    return {
      desired: Math.round(desired * 10) / 10,
      actual,
      diff: Math.round((actual - desired) * 10) / 10,
    };
  });
}

const tz = 'UTC';

let pass = 0;
let fail = 0;

function assert(label: string, result: boolean) {
  if (result) {
    console.log(`✅ ${label}`);
    pass++;
  } else {
    console.log(`❌ ${label}`);
    fail++;
  }
}

// ═══════════════════════════════════════════════════
// 1. Premium Shift Detection
// ═══════════════════════════════════════════════════
console.log('\n── Premium Shift Detection ──');

// 2026-03-06 is a Friday, 2026-03-07 is a Saturday
// 2026-03-05 is a Thursday, 2026-03-08 is a Sunday

assert(
  'Friday 18:00 → premium',
  isPremiumShift('2026-03-06T18:00:00Z', tz) === true,
);

assert(
  'Friday 17:00 → premium (boundary)',
  isPremiumShift('2026-03-06T17:00:00Z', tz) === true,
);

assert(
  'Friday 16:59 → NOT premium (before 5pm)',
  isPremiumShift('2026-03-06T16:59:00Z', tz) === false,
);

assert(
  'Friday 10:00 → NOT premium (morning)',
  isPremiumShift('2026-03-06T10:00:00Z', tz) === false,
);

assert(
  'Saturday 20:00 → premium',
  isPremiumShift('2026-03-07T20:00:00Z', tz) === true,
);

assert(
  'Saturday 17:00 → premium (boundary)',
  isPremiumShift('2026-03-07T17:00:00Z', tz) === true,
);

assert(
  'Saturday 12:00 → NOT premium (daytime)',
  isPremiumShift('2026-03-07T12:00:00Z', tz) === false,
);

assert(
  'Thursday 18:00 → NOT premium (wrong day)',
  isPremiumShift('2026-03-05T18:00:00Z', tz) === false,
);

assert(
  'Sunday 19:00 → NOT premium (wrong day)',
  isPremiumShift('2026-03-08T19:00:00Z', tz) === false,
);

assert(
  'Monday 21:00 → NOT premium (wrong day)',
  isPremiumShift('2026-03-09T21:00:00Z', tz) === false,
);

// Timezone-aware: Friday 22:00 UTC is Saturday 03:00 in Asia/Tokyo
// This should NOT be premium because local day is Saturday but hour is 3am (< 17)
// Actually let's check: getDayOfWeekInTimezone returns JS getDay() → Saturday=6 in JS
// hour in Tokyo = 3am → 3 < 17 → NOT premium
assert(
  'Friday 22:00 UTC (Sat 07:00 Tokyo) → NOT premium (hour < 17 in local tz)',
  isPremiumShift('2026-03-06T22:00:00Z', 'Asia/Tokyo') === false,
);

// Friday 10:00 UTC is Friday 19:00 in +09:00 (Tokyo) → Fri 19:00 → premium
assert(
  'Friday 10:00 UTC (Fri 19:00 Tokyo) → premium in Asia/Tokyo',
  isPremiumShift('2026-03-06T10:00:00Z', 'Asia/Tokyo') === true,
);

// ═══════════════════════════════════════════════════
// 2. Fairness Score
// ═══════════════════════════════════════════════════
console.log('\n── Fairness Score ──');

// Perfectly equal distribution → score = 100
const perfect = computeFairnessScore([40, 40, 40, 40]);
assert('Equal hours [40,40,40,40] → score=100', perfect?.score === 100);
assert('Equal hours → stddev=0', perfect?.stddev === 0);

// Slightly uneven
const slight = computeFairnessScore([38, 40, 42, 40]);
assert(
  'Slight variation [38,40,42,40] → score ≥ 95',
  slight !== null && slight.score >= 95,
);
assert('Slight variation → stddev > 0', slight !== null && slight.stddev > 0);

// Very uneven
const uneven = computeFairnessScore([10, 50, 10, 50]);
assert(
  'Uneven [10,50,10,50] → score < 70',
  uneven !== null && uneven.score < 70,
);

// Extremely uneven
const extreme = computeFairnessScore([0, 80, 0, 0]);
assert(
  'Extreme [0,80,0,0] → score ≤ 20',
  extreme !== null && extreme.score <= 20,
);

// Single staff → null (need 2+)
const single = computeFairnessScore([40]);
assert('Single staff [40] → null', single === null);

// Empty → null
const empty = computeFairnessScore([]);
assert('Empty [] → null', empty === null);

// Two staff, equal
const two = computeFairnessScore([35, 35]);
assert('Two equal [35,35] → score=100', two?.score === 100);

// Two staff, one has double
const twoUneven = computeFairnessScore([20, 40]);
assert(
  'Two uneven [20,40] → score between 60-70',
  twoUneven !== null && twoUneven.score >= 60 && twoUneven.score <= 70,
);

// ═══════════════════════════════════════════════════
// 3. Desired vs Actual Hours
// ═══════════════════════════════════════════════════
console.log('\n── Desired vs Actual Hours ──');

// Staff member wants 35h/wk, worked 140h over 4 weeks → 35h/wk avg → diff=0
const exact = computeDesiredVsActual([{ desired: 35, totalHours: 140 }], 4);
assert('35h desired, 140h/4wk → diff=0', exact[0].diff === 0);
assert('35h desired, 140h/4wk → actual=35', exact[0].actual === 35);

// Staff wants 35h/wk, worked 160h over 4 weeks → 40h/wk → diff=+5
const over = computeDesiredVsActual([{ desired: 35, totalHours: 160 }], 4);
assert('35h desired, 160h/4wk → diff=+5', over[0].diff === 5);
assert('35h desired, 160h/4wk → actual=40', over[0].actual === 40);

// Staff wants 40h/wk, worked 120h over 4 weeks → 30h/wk → diff=-10
const under = computeDesiredVsActual([{ desired: 40, totalHours: 120 }], 4);
assert('40h desired, 120h/4wk → diff=-10', under[0].diff === -10);

// Multiple staff over 2 weeks
const multi = computeDesiredVsActual(
  [
    { desired: 35, totalHours: 70 }, // 70/2=35 → diff=0
    { desired: 40, totalHours: 60 }, // 60/2=30 → diff=-10
    { desired: 20, totalHours: 50 }, // 50/2=25 → diff=+5
  ],
  2,
);
assert('Multi[0] diff=0', multi[0].diff === 0);
assert('Multi[1] diff=-10', multi[1].diff === -10);
assert('Multi[2] diff=+5', multi[2].diff === 5);

// Edge case: 0 total hours
const zero = computeDesiredVsActual([{ desired: 35, totalHours: 0 }], 4);
assert(
  '0 hours worked → actual=0, diff=-35',
  zero[0].actual === 0 && zero[0].diff === -35,
);

// ═══════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════
console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);

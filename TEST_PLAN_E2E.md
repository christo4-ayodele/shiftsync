# ShiftSync — E2E Test Plan

> **Seed script:** `npm run seed:e2e`
> **Week under test:** 2026-03-02 (Mon) → 2026-03-08 (Sun)
> **Default password:** `password123`

---

## Quick Reference — Logins

| Email                          | Role    | Key Testing Focus                       |
| ------------------------------ | ------- | --------------------------------------- |
| `admin@coastaleats.dev`        | Admin   | Analytics, Audit Log                    |
| `manager.east@coastaleats.dev` | Manager | Manhattan + Brooklyn shifts, Assign, OT |
| `manager.west@coastaleats.dev` | Manager | Santa Monica + Venice shifts            |
| `staff.sarah@coastaleats.dev`  | Staff   | Swap requests, availability mismatch    |
| `staff.peter@coastaleats.dev`  | Staff   | 34h / OT preview, swap target           |
| `staff.david@coastaleats.dev`  | Staff   | 50h overtime, 7 consecutive days        |
| `staff.john@coastaleats.dev`   | Staff   | Overnight shift                         |
| `staff.maria@coastaleats.dev`  | Staff   | Sat exception block                     |

---

## Phase 1 — Spec-Alignment Correctness

### P1.1 — Availability Time-Range Enforcement

| #   | Step                                                                 | Expected                                                                                                                                                   |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login as `manager.east@coastaleats.dev`                              | Dashboard loads                                                                                                                                            |
| 2   | Go to **Shifts** → select **Coastal Eats — Manhattan**               | Shift list shows                                                                                                                                           |
| 3   | Find **Thu 10:00–16:00 Server** ("Sarah availability mismatch test") | Shift card visible                                                                                                                                         |
| 4   | Click **Assign** → look at candidate list                            | Sarah Miller appears under **Ineligible** section                                                                                                          |
| 5   | Hover/read ineligibility reason                                      | "Outside availability window" or similar                                                                                                                   |
| 6   | Find **Thu 08:00–15:00 Server** ("Also rejects Sarah")               | Shift card visible                                                                                                                                         |
| 7   | Click **Assign**                                                     | Sarah also **Ineligible** (starts before her 09:00 avail)                                                                                                  |
| 8   | Find **Mon 08:00–14:00 Server**                                      | Shift card visible                                                                                                                                         |
| 9   | Verify Sarah is **Eligible** for Mon 08:00–14:00                     | Sarah's avail is Mon 09:00–15:00; shift 08:00 starts before → actually Ineligible. Sarah IS assigned though (seed). Confirm she shows as already assigned. |

**Overnight availability test:**

| #   | Step                                           | Expected                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Login as `manager.west@coastaleats.dev`        | Dashboard loads                                                                 |
| 2   | **Shifts** → **Coastal Eats — Venice Beach**   | Shift list                                                                      |
| 3   | Find **Sat 23:00–03:00 Bartender** (overnight) | Shift card visible                                                              |
| 4   | Click **Assign**                               | Kelvin Brown appears **Eligible** (Sat avail 14:00–23:00 + his overnight avail) |

### P1.2 — 48-Hour Edit Cutoff

| #   | Step                                                                      | Expected                                                       |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Login as `manager.east@coastaleats.dev`                                   | Dashboard loads                                                |
| 2   | **Shifts** → **Manhattan** → find **Tue 08:00–14:00** ("48h cutoff test") | Card visible                                                   |
| 3   | Try to **Edit** this shift                                                | Error/toast: "Cannot edit shift within 48 hours of start time" |
| 4   | Find any **Thu or later** shift                                           | Card visible                                                   |
| 5   | Try to edit it                                                            | Edit succeeds (> 48h away)                                     |

### P1.3 — Swap Approval Constraints

| #   | Step                                                                  | Expected                                                                                                                           |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login as `manager.east@coastaleats.dev`                               | Dashboard                                                                                                                          |
| 2   | Go to **Swap Requests**                                               | Two swap requests visible                                                                                                          |
| 3   | Find **David→Peter** swap for Fri premium (status: `pending_manager`) | Card visible                                                                                                                       |
| 4   | Click **Approve**                                                     | System runs `checkConstraints()` for Peter at Fri 17:00–23:00. Peter is at 34h + 6h = 40h. Should succeed (40h = limit, not over). |
| 5   | Verify Peter now appears assigned to Fri premium shift                | Assignment updates                                                                                                                 |

**Peer-pending swap:**

| #   | Step                                   | Expected                                                            |
| --- | -------------------------------------- | ------------------------------------------------------------------- |
| 1   | Login as `staff.peter@coastaleats.dev` | Dashboard                                                           |
| 2   | **Swap Requests**                      | See Sarah's swap request (pending_peer → awaiting Peter's response) |
| 3   | Accept the swap                        | Status changes to `pending_manager`                                 |
| 4   | Login as manager, approve swap         | Constraints checked: Peter takes Sarah's Mon 08:00–14:00            |

### P1.4 — Drop Request Expiry

| #   | Step                                    | Expected                                                |
| --- | --------------------------------------- | ------------------------------------------------------- |
| 1   | Login as `manager.east@coastaleats.dev` | Dashboard                                               |
| 2   | **Swap Requests**                       | See David's drop for Sat premium + Grace's expired drop |
| 3   | Grace's drop request                    | Shows as **expired** (past `expires_at` of Mon noon)    |
| 4   | David's drop for Sat premium            | Still **pending_manager**, expires Fri 17:00 ET         |
| 5   | Approve David's drop                    | Shift becomes open; claimable by eligible staff         |

---

## Phase 1 (Addendum) — Additional Constraint Tests

### Skill Mismatch

| #   | Step                                                 | Expected                                                                           |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Shifts** → **Manhattan** → any **Line Cook** shift | Assign dialog                                                                      |
| 2   | Check candidate list                                 | Sarah, Aisha, Peter (server-only) appear **Ineligible** ("Missing required skill") |
| 3   | David (line_cook + server)                           | **Eligible**                                                                       |

### Certification Mismatch

| #   | Step                                              | Expected                                                                                |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **Shifts** → **Manhattan** → any **Server** shift | Assign dialog                                                                           |
| 2   | Check candidate list                              | Aisha (Brooklyn-only cert) should be **Ineligible** ("Not certified for this location") |
| 3   | Sarah, Peter (Manhattan-certified)                | **Eligible** (if not blocked by another constraint)                                     |

### 10-Hour Rest Violation

| #   | Step                                                                     | Expected                                     |
| --- | ------------------------------------------------------------------------ | -------------------------------------------- |
| 1   | Assign a staff member to **Thu 17:00–23:00 Bartender** (Manhattan)       | Assignment succeeds                          |
| 2   | Then try to assign same person to **Fri 07:00–13:00 Server** (Manhattan) | **Ineligible** — only 8h gap (< 10h minimum) |

### Double-Booking

| #   | Step                                                                        | Expected                                                 |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Assign Peter to **Fri 17:00–23:00 Server premium** (Manhattan, headcount 2) | Succeeds                                                 |
| 2   | Try to assign Peter to **Fri 18:00–22:00 Server** (Brooklyn, overlap shift) | **Ineligible** ("Already assigned to overlapping shift") |

---

## Phase 2 — What-If Overtime Preview

### What-If Preview Bar

| #   | Step                                                            | Expected                                                          |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Login as `manager.east@coastaleats.dev`                         | Dashboard                                                         |
| 2   | **Shifts** → **Manhattan** → **Fri 17:00–23:00 Server premium** | Assign dialog (headcount 2)                                       |
| 3   | Look at **Peter Wang** in candidate list                        | What-if bar shows: Current 34h → Projected 40h (exactly at limit) |
| 4   | Bar color                                                       | Yellow/warning (at or near 40h threshold)                         |
| 5   | Try a different shift that would push Peter over 40h            | Bar should show red/danger with "OVERTIME" label                  |

### OT Dollar Costs (Overtime Page)

| #   | Step                              | Expected                                                     |
| --- | --------------------------------- | ------------------------------------------------------------ |
| 1   | Go to **Overtime** page           | Page loads                                                   |
| 2   | Find **David Kim**                | Shows 50h total, 10h overtime                                |
| 3   | OT cost                           | 10 × $18 × 1.5 = $270 OT cost displayed                      |
| 4   | Click expand arrow on David's row | Per-shift breakdown shows each shift with hours + OT portion |
| 5   | OT Cost Summary card              | Shows total OT cost across all staff                         |

---

## Phase 3 — Analytics

### Premium Shift Tracking

| #   | Step                                                  | Expected                                         |
| --- | ----------------------------------------------------- | ------------------------------------------------ |
| 1   | Login as `admin@coastaleats.dev`                      | Dashboard → Analytics                            |
| 2   | Find **Premium Shifts** chart section                 | Stacked bar chart with premium vs regular shifts |
| 3   | David has multiple premium shifts (Fri + Sat evening) | David's bar shows stacked premium portion        |
| 4   | Other staff have no/fewer premiums                    | Visible imbalance in chart                       |

### Fairness Score

| #   | Step               | Expected                                                                                      |
| --- | ------------------ | --------------------------------------------------------------------------------------------- |
| 1   | **Analytics** page | Fairness Score summary card visible                                                           |
| 2   | Score value        | Should be **well below 100** (large coefficient of variation: David 50h, Aisha 0h, Kelvin 4h) |
| 3   | Color coding       | Red or orange (high inequality)                                                               |

### Desired vs Actual Hours

| #   | Step               | Expected                                                    |
| --- | ------------------ | ----------------------------------------------------------- |
| 1   | **Analytics** page | Desired vs Actual grouped bar chart visible                 |
| 2   | David Kim          | Desired: 45h, Actual: 50h → positive deviation badge (+5h)  |
| 3   | Aisha Johnson      | Desired: 20h, Actual: 0h → negative deviation badge (−20h)  |
| 4   | Peter Wang         | Desired: 40h, Actual: 34h → negative deviation badge (−6h)  |
| 5   | Sarah Miller       | Desired: 30h, Actual: 12h → negative deviation badge (−18h) |

---

## Phase 4 — Simultaneous Assignment

### Atomic Headcount Guard

| #   | Step                                                          | Expected                                                         |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Find any shift with **headcount = 1** that's already assigned | E.g., Mon Manhattan Server (Sarah assigned)                      |
| 2   | Open SECOND browser/incognito as different manager            | Both see same shift                                              |
| 3   | Both try to assign a second person simultaneously             | One succeeds, other gets "Shift is full" error — atomic rollback |

**Headcount 2 test:**

| #   | Step                                                        | Expected                                   |
| --- | ----------------------------------------------------------- | ------------------------------------------ |
| 1   | **Fri 17:00–23:00 Server premium** (Manhattan, headcount 2) | Currently has 1 assignment (David)         |
| 2   | Assign a second eligible person (Peter or Sarah)            | Succeeds — 2/2 filled                      |
| 3   | Try to assign a third person                                | "Shift is full" error — headcount exceeded |

### Realtime Subscription & Stale Warning

| #   | Step                                                                | Expected                                                                                         |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Open **Shifts** page as `manager.east@coastaleats.dev` in Browser A | Shift list loads                                                                                 |
| 2   | Open same page as same manager in Browser B (incognito)             | Same shift list                                                                                  |
| 3   | In Browser A: assign a staff member to an unassigned shift          | Assignment succeeds, toast shows                                                                 |
| 4   | In Browser B (without refreshing)                                   | **Stale data warning banner** appears: "Shift assignments have changed. Refresh to see updates." |
| 5   | Click **Refresh** on the banner                                     | Candidate list updates, assignment reflected                                                     |

---

## Edge Cases & Boundary Tests

### Maria's Saturday Exception

| #   | Step                                                                  | Expected                                          |
| --- | --------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | **Shifts** → **Brooklyn** → **Sat 17:00–21:00 Host premium**          | Assign dialog                                     |
| 2   | Maria Santos in candidate list                                        | **Ineligible** (exception blocks entire Saturday) |
| 3   | Note: Maria has recurring Sat availability but exception overrides it | Exception takes priority                          |
| 4   | Wait — Maria is only certified at Manhattan, not Brooklyn             | Also **Ineligible** for cert reason               |

### Timezone Tangle (David)

| #   | Step                                                                          | Expected                                               |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | David is certified at Manhattan (ET) + Santa Monica (PT)                      | Verify                                                 |
| 2   | Assign David to a Manhattan evening shift, then try Santa Monica next-morning | 10h rest check must account for 3h timezone difference |

### Consecutive Day Warning

| #   | Step                                           | Expected                                               |
| --- | ---------------------------------------------- | ------------------------------------------------------ |
| 1   | David is assigned Mon→Sun (7 consecutive days) | Warning on assignment page                             |
| 2   | Check **Overtime** page                        | David shows 7-day consecutive flag                     |
| 3   | Overtime override exists                       | Manager reason displayed: "Critical staffing shortage" |

### Sunday Night Chaos

| #   | Step                                                       | Expected                                                                                                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Shifts** → **Manhattan** → **Sun 19:00–23:00 Bartender** | Unassigned                                                                                                                                                   |
| 2   | Click Assign                                               | Check eligible candidates: Peter (bartender + Manhattan cert, but at 34h already → 38h projected → no OT), David (already at 50h → INELIGIBLE if OT blocked) |
| 3   | Assign Peter                                               | What-if shows 34→38h (under 40h limit), assign succeeds                                                                                                      |

---

## Dashboard Pages Verification

| Page Route                 | What to Check                                 |
| -------------------------- | --------------------------------------------- |
| `/dashboard`               | Overview loads, stats cards show              |
| `/dashboard/shifts`        | Location selector, shift cards, assign dialog |
| `/dashboard/schedule`      | Calendar view, published schedules            |
| `/dashboard/staff`         | Staff list with skills, locations             |
| `/dashboard/staff/[id]`    | Individual staff detail                       |
| `/dashboard/availability`  | Day grid, time pickers, save                  |
| `/dashboard/my-shifts`     | Staff view of assigned shifts                 |
| `/dashboard/swap-requests` | Pending/approved/expired swaps & drops        |
| `/dashboard/open-shifts`   | Dropped/unclaimed shifts                      |
| `/dashboard/overtime`      | OT hours, costs, per-shift breakdown          |
| `/dashboard/analytics`     | Premium shifts, fairness, desired vs actual   |
| `/dashboard/notifications` | Bell count, unread items                      |
| `/dashboard/audit-log`     | Action history                                |
| `/dashboard/on-duty`       | Currently working staff                       |
| `/dashboard/settings`      | Profile/preferences                           |

---

## Data Integrity Checks

| Check                          | SQL / Method                                                                             | Expected  |
| ------------------------------ | ---------------------------------------------------------------------------------------- | --------- |
| No orphaned assignments        | `shift_assignments` all reference valid `shifts.id`                                      | 0 orphans |
| Availability day_of_week range | All values 0–6                                                                           | ✓         |
| Availability timezone set      | No null timezone on recurring avail                                                      | ✓         |
| Schedule status                | All 4 schedules `published`                                                              | ✓         |
| Swap request statuses          | 1× pending_peer, 1× pending_manager (swap), 1× pending_manager (drop), 1× expired (drop) | ✓         |
| Overtime override exists       | David Kim, week 2026-03-02                                                               | ✓         |
| Premium shift detection        | Fri ≥17:00 + Sat ≥17:00 shifts flagged                                                   | ✓         |

---

## Test Execution Checklist

- [ ] Seed runs without errors: `npm run seed:e2e`
- [ ] App starts: `npm run dev`
- [ ] **P1.1** Availability containment — Sarah ineligible for Thu 10–16
- [ ] **P1.1** Overnight availability — Kelvin eligible for Sat 23–03
- [ ] **P1.2** 48h cutoff — Tue shift not editable
- [ ] **P1.3** Swap peer → manager flow
- [ ] **P1.4** Expired drop auto-detected
- [ ] **P1+** Skill mismatch shown as ineligible
- [ ] **P1+** Cert mismatch shown as ineligible
- [ ] **P1+** 10h rest violation detected
- [ ] **P1+** Double-book prevented
- [ ] **P2** What-if bar shows projected hours for Peter
- [ ] **P2** OT costs displayed for David ($270)
- [ ] **P2** Per-shift OT breakdown expandable
- [ ] **P3** Premium shift chart shows imbalance
- [ ] **P3** Fairness score below 100
- [ ] **P3** Desired vs actual gaps visible for all 8 staff
- [ ] **P4** Headcount guard prevents over-assignment
- [ ] **P4** Realtime stale warning appears in second browser
- [ ] **Edge** Maria Sat exception blocks assignment
- [ ] **Edge** David 7 consecutive days + override
- [ ] **Edge** Sunday Night Chaos — Peter assignable, OT preview correct

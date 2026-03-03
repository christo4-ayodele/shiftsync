# ShiftSync — Multi-Location Staff Scheduling Platform

A full-stack scheduling application built for **Coastal Eats**, a four-location restaurant group. Managers create weekly schedules, assign staff to shifts with constraint checking, and staff manage availability, swap/drop requests, and real-time notifications.

## Tech Stack

| Layer           | Technology                                                  |
| --------------- | ----------------------------------------------------------- |
| Framework       | Next.js 16 (App Router, React 19, TypeScript 5)             |
| Database / Auth | Supabase (Postgres, Auth, Realtime, Row-Level Security)     |
| UI              | Tailwind CSS v4 + shadcn/ui (25 components, New York theme) |
| Charts          | Recharts                                                    |
| Calendar        | FullCalendar 6                                              |
| Tables          | TanStack React Table                                        |
| State           | Zustand                                                     |
| Forms           | React Hook Form + Zod                                       |
| Date Utils      | date-fns + date-fns-tz                                      |

## Features

- **Role-based access** — Admin, Manager, Staff with RLS policies
- **Multi-location scheduling** — Drag-and-drop weekly calendar per location
- **Constraint engine** — Double-booking, minimum gap (10h), overtime (daily/weekly), skill/certification checks
- **Swap & drop requests** — Peer-to-peer swaps with manager approval workflow
- **Open shifts board** — Staff can claim dropped shifts
- **Overtime dashboard** — Weekly hour tracking with warning/violation thresholds
- **Analytics** — Hours fairness, skill distribution, weekly trends (Recharts)
- **Real-time notifications** — Supabase Realtime postgres_changes
- **Audit log** — Full trail of every create/update/delete with before/after state
- **On-duty view** — Live "who's working now" dashboard
- **Settings** — Notification preferences per user

## Live Demo

|                  | Link                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Deployed App** | [https://shiftsync-eight.vercel.app](https://shiftsync-eight.vercel.app/)                      |
| **Repository**   | [https://github.com/christo4-ayodele/shiftsync](https://github.com/christo4-ayodele/shiftsync) |

The application comes with **seeded demo data** — 4 locations, 13 staff members, 152+ shifts across 2 weeks, swap/drop requests, availability windows, and audit entries. Log in with any of the [demo credentials](#demo-credentials) to explore immediately.

---

## Quick Evaluator Walkthrough (5 Minutes)

> Login with **`mgr.downtown@coastaleats.com`** / `password123` to follow along.

| Step | Action                                                                                                                                                                                                              | Route                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1    | **Dashboard** — See stat cards: active staff, locations, pending swaps, live shifts                                                                                                                                 | `/dashboard`               |
| 2    | **Schedule** — Select a location and browse the weekly calendar. Click **+ New Shift** to create a shift with a required skill and headcount.                                                                       | `/dashboard/schedule`      |
| 3    | **Assign Staff** — On the schedule, click a shift card → **Assign Staff**. The candidate list shows an Eligible / Ineligible split. Try assigning someone who lacks the required skill to see the constraint error. | `/dashboard/schedule`      |
| 4    | **Swap Request** — Log out, sign in as **`staff1@coastaleats.com`**, open **My Shifts** (`/dashboard/my-shifts`), and submit a **Swap** or **Drop** request with a reason.                                          | `/dashboard/my-shifts`     |
| 5    | **Approve Swap** — Log back in as the manager. Open **Swap Requests** (`/dashboard/swap-requests`) and approve or reject the pending request.                                                                       | `/dashboard/swap-requests` |
| 6    | **Open Shifts** — Browse the **Open Shifts** board to see dropped shifts available for claiming.                                                                                                                    | `/dashboard/open-shifts`   |
| 7    | **Overtime** — Open the **Overtime** dashboard. Observe weekly hours per staff, OT cost estimates, and expandable per-shift breakdowns.                                                                             | `/dashboard/overtime`      |
| 8    | **Analytics** — Open the **Analytics** page. Explore the fairness score, desired vs actual hours chart, skill distribution pie, and premium shift breakdown.                                                        | `/dashboard/analytics`     |
| 9    | **Audit Log** — Open **Audit Log**, filter by action or date range, and export to CSV.                                                                                                                              | `/dashboard/audit-log`     |

---

## Constraint Engine

Every shift assignment runs through **7 sequential validation checks** before it is accepted. Hard errors block the assignment unconditionally; warnings can be overridden by a manager with a documented reason.

| #   | Rule                       | Severity          | Description                                                                                                                                                                                                        |
| --- | -------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Skill Requirement**      | `error`           | Staff must hold the shift's required skill (e.g., Bartender, Line Cook) in `staff_skills`.                                                                                                                         |
| 2   | **Location Certification** | `error`           | Staff must have an active (non-decertified) entry in `staff_locations` for the shift's location.                                                                                                                   |
| 3   | **Availability Window**    | `error`           | The shift must fall **fully within** the staff member's availability for that day. Date-specific exceptions take priority over recurring windows. Uses `isShiftFullyWithinAvailability()` with overnight handling. |
| 4   | **No Overlapping Shifts**  | `error`           | The shift must not time-overlap with any other assigned shift across all locations.                                                                                                                                |
| 5   | **Minimum 10-Hour Rest**   | `error`           | At least 10 hours must separate the end of one shift and the start of the next.                                                                                                                                    |
| 6   | **Overtime Thresholds**    | `warning`         | Weekly hours ≥ 35 h → warning. Weekly hours > 40 h → warning. Daily hours > 8 h → warning. Daily hours > 12 h → hard error.                                                                                        |
| 7   | **Consecutive Days**       | `warning`/`error` | 6 consecutive days → warning. 7+ consecutive days → hard error (requires a manager override with reason, recorded in `overtime_overrides`).                                                                        |

All violations return **descriptive error messages** shown inline in the assignment dialog. The candidate list splits staff into **Eligible** and **Ineligible** sections so managers see constraint status at a glance.

### Race-Condition Protection

Shift assignments use an **insert-then-verify** pattern: the assignment is inserted, then headcount is re-checked inside a transaction. If a concurrent assignment filled the last slot, the insert is rolled back and the user is notified.

---

## Real-Time Updates

ShiftSync uses **Supabase Realtime** (`postgres_changes`) to keep the UI in sync without polling.

| Feature                     | Channel / Table                                 | Behavior                                                                                                                                              |
| --------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notifications**           | `notifications` (INSERT, filtered by `user_id`) | New notifications increment the unread badge in real time and trigger a toast via Sonner. Managed by `useRealtimeNotifications` hook + Zustand store. |
| **Schedule Calendar**       | `shifts`, `shift_assignments`, `schedules`      | The weekly calendar auto-refreshes when any shift is created, assigned, or a schedule status changes.                                                 |
| **Swap Requests**           | `swap_requests`                                 | Status transitions (accept, approve, reject) are reflected immediately for all participants.                                                          |
| **Stale Candidate Warning** | `shift_assignments`                             | When another manager assigns a candidate while you have the assignment dialog open, a warning banner appears with an auto-refresh option.             |

---

## Analytics & Fairness Monitoring

> Accessible to **Managers** and **Admins** at `/dashboard/analytics`. Configurable look-back window (2, 4, 8, or 12 weeks) and location filter.

| Metric / Chart                 | Type              | What It Shows                                                                                                                                                   |
| ------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fairness Score**             | Summary card      | Measures hour distribution equity: $100 \times (1 - CV)$ where $CV = \sigma / \mu$ of staff weekly hours. Color-coded: ≥ 80 % green, ≥ 60 % orange, < 60 % red. |
| **Premium Shift Count**        | Summary card      | Number of Friday/Saturday evening shifts (starting ≥ 5 PM local time).                                                                                          |
| **Avg Hours Gap**              | Summary card      | Mean absolute difference between each staff member's desired and actual weekly hours.                                                                           |
| **Hours Distribution**         | Bar chart         | Total hours per staff member with min / max / average / spread stats.                                                                                           |
| **Skill Distribution**         | Pie chart         | Proportion of scheduled hours by required skill.                                                                                                                |
| **Weekly Hours Trend**         | Line chart        | Total scheduled hours per week over the look-back window.                                                                                                       |
| **Desired vs Actual Hours**    | Grouped bar chart | Side-by-side comparison per staff with over/under diff badges.                                                                                                  |
| **Premium Shift Distribution** | Stacked bar chart | Premium vs regular shift count per staff member, highlighting fairness in desirable shifts.                                                                     |

### Overtime Dashboard (`/dashboard/overtime`)

| Feature                 | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Summary Cards**       | Staff scheduled, approaching OT (≥ 35 h, warning), over limit (> 40 h, violation).                                |
| **OT Cost Estimate**    | Total overtime hours × $18 base rate × 1.5× multiplier.                                                           |
| **Staff Hours Table**   | Per-staff weekly hours with progress bar (green → orange → red), shift count, OT cost, and status badge.          |
| **Per-Shift Breakdown** | Expandable rows showing each shift's start/end (timezone-formatted), hours, location, and highlighted OT portion. |

---

## Assessment Scenario Testing

The E2E seed script (`npm run seed:e2e`) creates deterministic data designed to exercise key edge cases. Evaluators can reproduce each scenario immediately after seeding.

| Scenario                    | What to Test                                                                                                            | How to Verify                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overtime Trap**           | Peter has 34 h scheduled. Assigning a 7 h shift should trigger a weekly overtime warning at 35 h and exceed 40 h total. | Open Schedule → assign Peter to a 7 h shift → observe the overtime warning in the assignment dialog.                                                                            |
| **7-Consecutive-Day Block** | David is assigned shifts on 7 consecutive days, requiring a manager override.                                           | Try assigning David on his 7th day → hard error → enter an override reason → assignment succeeds with an `overtime_overrides` record.                                           |
| **Simultaneous Assignment** | Two managers try to assign the last slot on the same shift concurrently.                                                | Open the same shift in two browser tabs as different managers → assign in both → one succeeds, the other gets a "headcount full" rollback and a stale-candidate warning banner. |
| **Availability Mismatch**   | Sarah is available 7 AM – 3 PM but a shift runs 4 PM – 10 PM.                                                           | Attempt to assign Sarah → "Shift not within availability" error.                                                                                                                |
| **Timezone Handling**       | Verify that a 4 PM ET shift (stored as 9 PM UTC) renders on the correct calendar day, not the next day.                 | Check the schedule page for any ET afternoon shift → day grouping should match the local date.                                                                                  |
| **Swap & Cancellation**     | Staff submits a swap, peer accepts, then requester cancels before manager approval.                                     | As staff, create swap → as target, accept → as requester, cancel → status moves to `cancelled`.                                                                                 |
| **Drop Expiry**             | A drop request with `expires_at` set to 24 h before the shift auto-expires.                                             | Create a drop request for an imminent shift → wait or advance time → request expires automatically on next fetch.                                                               |
| **Fairness Complaint**      | Compare hours distribution across staff on the Analytics page.                                                          | Open Analytics → check the fairness score and desired vs actual hours chart → identify staff with significant over/under allocation.                                            |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js App Router                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  React 19    │  │  Server      │  │  Middleware    │  │
│  │  Client      │  │  Components  │  │  (Auth guard)  │  │
│  │  Components  │  │  + Actions   │  │               │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────┘  │
│         │                 │                              │
│    Zustand Store    8 Server Action files                │
│    (notifications)  (constraint engine,                  │
│                      swap workflow,                      │
│                      audit logging)                      │
└─────────┬─────────────────┬──────────────────────────────┘
          │                 │
          │   Supabase JS   │
          │   Client/Admin  │
          ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│                  Supabase (hosted Postgres)               │
│                                                          │
│  14 tables · 6 enums · Row-Level Security policies       │
│  Realtime enabled on 5 tables                            │
│  Auth (email/password, JWT)                              │
│  Triggers: updated_at auto-set, profile sync             │
└──────────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

- **Server Actions for business logic** — All constraint validation, swap workflow, and audit logging run server-side via Next.js Server Actions (`"use server"`). No business logic leaks to the client.
- **Row-Level Security** — Every table has RLS policies enforcing role-based access at the database layer. Even if a client bypasses the UI, Postgres rejects unauthorized operations.
- **Timezone-aware rendering** — All timestamps are stored as UTC (`TIMESTAMPTZ`). Display formatting uses `formatInTimezone()` with the location's IANA timezone to ensure shifts render on the correct calendar day regardless of the viewer's browser timezone.
- **Seeded demo data** — The main seed (`src/lib/seed.ts`) creates a realistic scheduling environment. The E2E seed (`src/lib/seed/e2e-seed.ts`) provides deterministic edge-case scenarios with a full database reset.
- **Realtime subscriptions** — Supabase Realtime `postgres_changes` keep the schedule calendar, notifications, and candidate lists in sync across concurrent users without polling.

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/dashboard/ # 13 dashboard pages
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── shared/                # Sidebar, Topbar, RoleGate
│   └── ui/                    # 25 shadcn/ui components
├── hooks/                     # useCurrentUser, useRealtimeNotifications
├── lib/
│   ├── actions/               # 8 server action files
│   ├── supabase/              # Client, Server, Admin, Middleware, generated types
│   ├── types/                 # Re-exported types + enriched join types
│   ├── utils/                 # Constants, timezone helpers
│   └── seed.ts                # Programmatic database seeder
├── stores/                    # Zustand notification store
supabase/
└── migrations/
    └── 001_schema.sql         # Full schema (8 enums, 14 tables, RLS, triggers)
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### 3. Run the migration

Open `supabase/migrations/001_schema.sql` in the Supabase SQL Editor and execute it. This creates all tables, enums, RLS policies, and triggers.

### 4. Generate types (optional — already committed)

```bash
supabase gen types typescript --project-id <project-id> --schema public > src/lib/supabase/database.types.ts
```

### 5. Seed demo data

```bash
node --import tsx src/lib/seed.ts
```

Creates 13 auth users, 4 locations, 6 skills, 152 shifts across 2 weeks, assignments, swap requests, notifications, and audit logs.

### 6. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Demo Credentials

| Role    | Email                        | Password    |
| ------- | ---------------------------- | ----------- |
| Admin   | admin@coastaleats.dev        | password123 |
| Manager | manager.east@coastaleats.dev | password123 |
| Manager | manager.east@coastaleats.dev | password123 |
| Staff   | staff.kelvin@coastaleats.dev | password123 |
| Staff   | staff.david@coastaleats.dev  | password123 |

## Database Schema

14 tables with full Row-Level Security:

- **profiles** — User profiles synced from Supabase Auth
- **locations** — Restaurant locations with timezone
- **skills** — Certifiable skills (Bartender, Line Cook, etc.)
- **staff_skills** / **staff_locations** — Many-to-many assignments
- **manager_locations** — Manager ↔ location access
- **availability** — Recurring weekly + date exceptions
- **schedules** — Weekly schedule containers per location
- **shifts** — Individual shifts with skill requirements
- **shift_assignments** — Staff ↔ shift assignments
- **swap_requests** — Swap/drop workflow with status machine
- **overtime_overrides** — Manager-approved overtime exceptions
- **notifications** — In-app notification system
- **audit_log** — Full change trail

## License

Private — Coastal Eats internal use.

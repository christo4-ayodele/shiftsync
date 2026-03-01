# ShiftSync — Multi-Location Staff Scheduling Platform

A full-stack scheduling application built for **Coastal Eats**, a four-location restaurant group. Managers create weekly schedules, assign staff to shifts with constraint checking, and staff manage availability, swap/drop requests, and real-time notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19, TypeScript 5) |
| Database / Auth | Supabase (Postgres, Auth, Realtime, Row-Level Security) |
| UI | Tailwind CSS v4 + shadcn/ui (25 components, New York theme) |
| Charts | Recharts |
| Calendar | FullCalendar 6 |
| Tables | TanStack React Table |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Date Utils | date-fns + date-fns-tz |

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

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@coastaleats.com | password123 |
| Manager | mgr.downtown@coastaleats.com | password123 |
| Manager | mgr.harbor@coastaleats.com | password123 |
| Staff | staff1@coastaleats.com | password123 |
| Staff | staff2–10@coastaleats.com | password123 |

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

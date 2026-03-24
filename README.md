# Ruteplanlægger

**Internal route-planning and inspection-scheduling tool** for a Danish property-inspection company. The app helps planners assign inspectors to inspections, optimise driving routes, manage availability, and sync shifts with external workforce systems.

> Production: [ruteplanlægger.dk](https://ruteplanlægger.dk)

---

## What it does

| Capability | Description |
|---|---|
| **Alle Syn** | Browse and edit all inspections imported from Monday.com — filter by department, type, date, and status |
| **Planlæg Syn** | Drag-and-drop route planner — assign inspections to inspectors, reorder stops, and preview routes on a map |
| **Rådighed** | View inspector availability, send SMS reminders, and manually toggle availability per date |
| **Inspektører** | Manage inspector profiles, addresses, skills, and department assignments |
| **ProfSyn AI** | AI chat assistant for answering planning questions using inspection and availability data |
| **Admin** | User management, role assignment, and configurable inspection-duration variables |

---

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Maps:** Mapbox GL JS via react-map-gl
- **Route optimisation:** Custom VRP solver running on Railway, called via Supabase Edge Functions
- **Workforce sync:** WorkFeed API integration for shifts, availability, and inspector data
- **Monday.com:** Inspection data sourced from Monday.com boards
- **State management:** TanStack Query for server state
- **Routing:** React Router v6

---

## Core files

### Pages (`src/pages/`)

| File | Route | Purpose |
|---|---|---|
| `AlleSyn.tsx` | `/alle-syn` | Main inspection list — filtering, editing, duration display |
| `PlanlaegSyn.tsx` | `/planlaeg-syn` | Route planning UI — inspector panels, map, drag-and-drop |
| `Availability.tsx` | `/availability` | Inspector availability overview and SMS reminders |
| `Inspectors.tsx` | `/inspectors` | Inspector directory and profile management |
| `ProfSynAI.tsx` | `/profsyn-ai` | AI-powered planning assistant |
| `Scheduled.tsx` | `/scheduled` | View scheduled/approved inspection routes |
| `Auth.tsx` | `/` | Login page |

### Key libraries (`src/lib/`)

| File | Purpose |
|---|---|
| `inspection-duration.ts` | Calculates inspection duration from type, rooms, and modifiers (DYMO, Cylinderskift) |
| `workfeed.ts` | WorkFeed API helpers for shift creation and sync |
| `vrp.ts` | Client-side helpers for the Vehicle Routing Problem solver |
| `scheduled.ts` | Utilities for the scheduled-routes view |
| `profsyn-ai.ts` | AI prompt construction and response parsing |
| `supabase.ts` | Supabase client wrapper and query helpers |

### Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `compute-vrp-routes` | Sends inspections to the Railway VRP solver and stores results |
| `approve-vrp-assignments` | Converts proposed routes into confirmed shifts |
| `sync-workfeed-inspectors` | Imports inspectors from WorkFeed into Supabase |
| `sync-workfeed-shifts` | Pushes approved shifts to WorkFeed |
| `fetch-available-inspectors` | Returns inspectors available on given dates |
| `geocode-addresses` | Geocodes inspection addresses via Mapbox |
| `send-sms-reminder` | Sends availability-reminder SMS to inspectors |
| `profsyn-ai-query` | Proxies AI queries with inspection context |

### Components (`src/components/`)

Organised by feature area: `alle-syn/`, `planlaeg-syn/`, `availability/`, `inspections/`, `scheduled/`, `shifts/`, `admin/`, `filters/`, and shared `ui/` (shadcn primitives).

---

## Database

Postgres on Supabase. Key tables:

- **`monday_items_selected`** — inspections imported from Monday.com
- **`inspectors`** — inspector profiles with geocoded home addresses
- **`inspection_queue`** — inspections queued for route planning
- **`proposed_assignments`** — VRP solver output awaiting approval
- **`supabase_shifts`** — confirmed shifts synced to WorkFeed
- **`supabase_availability`** — inspector availability per date
- **`inspection_durations`** — configurable duration matrix (type × rooms)
- **`inspection_duration_modifiers`** — add-on minutes for DYMO, Cylinderskift, etc.

Migrations live in `supabase/migrations/` (read-only, managed via Supabase CLI).

---

## Documentation

- [Product Requirements Document](./docs/PRD.md)
- [Data Model](./docs/data-model.md)
- [UX Guidelines](./docs/ux-guidelines.md)
- [ProfSyn AI](./docs/PROFSYN_AI.md)
- [WorkFeed Sync](./docs/workfeed-sync-implementation.md)

## Local development

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # production build → dist/
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`.

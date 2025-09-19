# Syn Planner

Internal SaaS for scheduling property inspections across Denmark, assigning them to part-time inspectors.

## Documentation

- [Product Requirements Document (PRD)](./docs/PRD.md)
- [Data Model](./docs/data-model.md)
- [UX Guidelines](./docs/ux-guidelines.md)

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase project with database access

### Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### Database Setup

The database tables and seed data are automatically created via Supabase migrations. The following tables are included:

- `supabase_inspections` - Main inspections table
- `supabase_availability` - Inspector availability tracking  
- `supabase_shifts` - Assigned shifts/assignments
- `inspections_vrp` - VRP optimization suggestions

### Available Scripts

In the project directory, you can run:

#### `npm run dev`

Runs the app in development mode.\
Open [http://localhost:8080](http://localhost:8080) to view it in the browser.

#### `npm run build`

Builds the app for production to the `dist` folder.

#### `npm run preview`

Serves the production build from the `dist` folder.

## Features

### Current (MVP)

- ✅ **Page 1: Inspections to be Scheduled**
  - Server-side paginated table of unscheduled inspections
  - Department multi-select filtering
  - Date range filtering with quick presets
  - Multi-select with persistence across pagination
  - Responsive design with semantic UI tokens

### Planned

- **Page 2: VRP Optimization Results**
- **WorkFeed API Integration**
- **Advanced Reporting**

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Row-Level Security)
- **State Management**: TanStack Query for server state
- **Routing**: React Router v6

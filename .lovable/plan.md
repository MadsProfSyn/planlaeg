## Goal

Rewrite `docs/data-model.md` to be the authoritative, detailed reference for:

1. Every Supabase table (purpose, key columns, relationships, RLS posture).
2. Helper objects: enums, key database functions, triggers, views.
3. Three data flows: **Monday.com → Platform**, **WorkFeed → Platform**, **Platform → WorkFeed**.

The current file is stale (only describes 4 placeholder tables that don't reflect reality). It will be fully replaced.

## Document structure

```text
1. Overview
2. Conventions (UUIDs, timezone rules, soft delete, sync_status pattern)
3. Auth & Access Control
   - profiles, user_roles, app_role enum, has_role()
4. Reference / Configuration tables
   - departments, afdeling_to_department, afdeling_zip
   - inspection_type_mappings, role_mappings
   - inspection_durations, inspection_duration_modifiers
5. Inspector domain
   - inspectors (+ skills, availability_time_ranges)
   - inspector_skills
   - supabase_availability (+ time ranges)
6. Inspection / Job domain
   - monday_items_selected  ← Monday source of truth
   - inspection_queue       ← VRP input
   - supabase_inspections   ← legacy mirror
   - proposed_assignments
   - vrp_runs
   - inspections_vrp
   - supabase_shifts        ← WorkFeed mirror + sync state
   - daily_route_totals
7. Caching & infra
   - mapbox_coords_cache, mapbox_travel_cache
   - job_queue, worker_keepalive_log
8. Communication
   - sms_reminder_logs
9. Database functions & triggers (catalog)
10. Data Flows
    10.1 Monday.com → Platform
    10.2 WorkFeed → Platform (inspectors, availability, shifts)
    10.3 Platform → WorkFeed (approve, manual send, update Monday after)
    10.4 VRP optimisation flow (Railway round-trip)
11. ER diagram (Mermaid)
```

## Content highlights

For each table I'll document:
- **Purpose** (1–2 lines, plain Danish/English context).
- **Key columns** with type + meaning (skip generic `id`/timestamps unless meaningful).
- **Foreign keys / relationships**.
- **RLS posture** ("authenticated read", "admin-only write", "RLS off – internal/service", etc., based on actual policies).
- **Written by / read by** (which edge functions or pages mutate it).

Examples of the level of detail:

- **monday_items_selected** — Row per inspection ingested from Monday (`item_id` unique). Holds raw payload (`raw jsonb`), parsed fields (`Kunde`, `synstype`, `adresse`, `dato_tid`, `lejemalsnr`, `antal_vaerelser`), scheduling state (`schedule_status`, `scheduled_inspector_id`, `scheduled_start_time/end_time`, `scheduled_date`, `route_km`, `route_sequence`), trigger-derived flags (`has_dymo`, `has_cylinderskift` set by `extract_inspection_flags`), and geocode cache (`lat`, `lng`, `geocode_status`). Geocoding kicked off via DB webhook → `geocode-monday-items` edge function. Memory rule: `duration_minutes` overrides duration tables.
- **supabase_shifts** — Mirror of WorkFeed shifts (`wf_shift_id` unique). Holds both UTC (`start_utc`/`end_utc`) and Copenhagen local (`start_time_local`/`end_time_local`) per the timezone rule. `sync_status` ∈ {`pending`,`synced`,`sync_failed`} with `sync_error`, `sync_attempts`, `last_sync_attempt`. Written by `sync-workfeed-shifts` (clean-slate per window), `post-to-workfeed`, and `approve-vrp-assignments`.
- **supabase_availability** + `availability_time_ranges` — One row per (inspector, date); multiple time ranges per row. Written by `workfeed-ingest-availability`, `sync-availability-cron`, RPC `set_consultant_availability_with_ranges`. NULL start/end → fallback 08:00–16:00 in `get_vrp_input` (memory rule).
- **inspection_queue** — VRP-facing inspection rows; `get_vrp_input(p_inspection_ids, p_target_dates)` joins this with availability + inspector capacity to build the Railway payload. Status lifecycle: `PENDING → IN_VRP → SCHEDULED`.
- **vrp_runs / proposed_assignments / inspections_vrp** — Stored solution + per-assignment rows; `assignment_source` distinguishes auto vs manual; `inspector_route_km` is full round-trip (memory rule). Approved via `approve-vrp-assignments` which writes `supabase_shifts` and triggers WorkFeed post.

### Section 10 — Data Flows (detailed prose + diagrams)

**10.1 Monday.com → Platform**
```text
Monday board webhook
  └─► (external) writes row into monday_items_selected (raw + parsed columns)
        ├─► trigger extract_inspection_flags  → has_dymo / has_cylinderskift
        └─► DB webhook on INSERT → net.http_post → geocode-monday-items
              └─► Mapbox (cached via mapbox_coords_cache) → lat/lng/geocode_status
UI /alle-syn reads monday_items_selected directly.
Promotion to VRP: rows are projected into inspection_queue when planning.
```

**10.2 WorkFeed → Platform**
- `sync-workfeed-inspectors` (cron `sync-inspectors-cron`) → `inspectors` (upsert by `wf_employee_id`).
- `workfeed-ingest-availability` + `sync-availability-cron` → `supabase_availability` (+ ranges). 60-day window (memory rule).
- `sync-workfeed-shifts` (cron `sync-shifts-cron`) → clean-slate delete + reinsert `supabase_shifts` for 90-day window; geocodes shift address via Mapbox cache; converts UTC → Copenhagen local.

**10.3 Platform → WorkFeed**
```text
User clicks "Godkend syn"
  └─► approve-vrp-assignments
        ├─► insert proposed_assignments + vrp_runs rows
        ├─► insert supabase_shifts (sync_status='pending')
        └─► for each shift → post-to-workfeed
              ├─► get_wf_role_id_for_inspection() resolves WF role
              ├─► converts Copenhagen → UTC with DST offset
              ├─► POST companies/{id}/shifts
              └─► writes wf_shift_id + sync_status='synced'|'sync_failed'
Then update-monday-after-workfeed pushes scheduled date/time/inspector back to Monday item.
Manual flow: send-manual-shifts-to-workfeed mirrors the above for non-VRP shifts.
```

**10.4 VRP loop** — `compute-vrp-routes` calls `get_vrp_input` RPC, posts payload to Railway (`profsyn-vrp-api`), polls `job_queue` style status, writes `vrp_runs` + `proposed_assignments`. Travel times pre-cached via `cache-travel-times` (memory rule).

### Section 11 — ER diagram
Mermaid `erDiagram` covering the main scheduling edges:
`inspectors → supabase_availability → availability_time_ranges`;
`monday_items_selected ↔ inspection_queue → proposed_assignments ← vrp_runs`;
`proposed_assignments → supabase_shifts → (WorkFeed)`;
`inspectors → supabase_shifts`;
`profiles ↔ user_roles`.

## Out of scope

- No code or schema changes — docs only.
- Will not modify `docs/PRD.md` or other docs.
- Will not duplicate column-level RLS SQL; describe policies in plain English with a pointer to migrations for the source of truth.

## Deliverable

A single replacement of `docs/data-model.md`, ~600–900 lines of Markdown, with the structure above. No emojis.
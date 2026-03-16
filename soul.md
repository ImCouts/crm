
# CRM — Claude Code Brief

## Goal
Build a CRM web app with a dark developer UI aesthetic inspired by Supabase.

dark developer UI aesthetic with high-contrast surfaces, monospace accents, and electric green highlights

## Styling
- Color scheme: deep dark backgrounds (#1a1a1a range, not pure black, with layered surface contrast)
- Typography — clean sans-serif (Inter) + monospace for code/data elements
- Accent color — signature electric green (#3ECF8E) used sparingly for CTAs and highlights
- Density — information-dense but well-spaced; a "pro tool" feel
- Component style — sharp-cornered or subtly rounded cards, muted borders, low-noise UI
- **Overall vibe — dark developer aesthetic / hacker-tool UI**

**dark-mode developer UI**

## Stack [**USE LATEST VERSION**]
- Next.js
- Supabase
- TypeScript
- Tailwind CSS
- No additional UI libraries — build components from scratch

---

## Database Schema (Supabase — already exists, do not recreate)

### leads
| column         | type        |
|----------------|-------------|
| business_phone | text (PK)   |
| company_name   | text        |
| website        | text        |
| rbq            | text        |
| owner_name     | text        |
| owner_phone    | text        |
| approx_rev     | numeric     |
| employee_count | int4        |
| created_at     | timestamptz |

### call_log
| column         | type        |
|----------------|-------------|
| id             | uuid (PK)   |
| business_phone | text (FK → leads) |
| called_at      | timestamptz |
| note           | text        |
| created_at     | timestamptz |

### lead_status
| column         | type        |
|----------------|-------------|
| business_phone | text (PK, FK → leads) |
| status         | text | Values: 'lead', 'discovery_call', 'interested', 'booked', 'pending', 'lost' -- Null = 'lead' |
| call_count     | int4        |
| offer_amount   | numeric     | nullable — active offer amount in dollars (e.g. 5000) |
| last_called_at | timestamptz |
| last_emailed_at| timestamptz |
| status_changed_at | timestamptz | default now() — set on insert and on every status change |

> All table joins are on business_phone, not id. Never assume an id foreign key

### tasks
| column         | type        | notes |
|----------------|-------------|-------|
| id             | uuid        | Primary Key, default gen_random_uuid() |
| business_phone | text        | FK → leads.business_phone, nullable |
| title          | text        | |
| description    | text        | nullable |
| due_at         | timestamptz | |
| completed      | boolean     | default false |
| created_at     | timestamptz | default now() |

### notes
| column         | type        | notes                                        |
|----------------|-------------|----------------------------------------------|
| id             | uuid        | Primary Key, default gen_random_uuid()       |
| business_phone | text        | FK → leads.business_phone, on delete cascade |
| content        | text        | not null                                     |
| created_at     | timestamptz | default now()                                |

---

## Auth
- None — solo project, no authentication required
- App loads directly into /dashboard

## Pages & Features

### /dashboard
- "Pending Pipeline" capsule: sum of offer_amount for all leads where status = 'pending' — displayed as formatted currency (e.g. $25,000) — styled as a highlighted stat capsule using the electric green accent (#3ECF8E)
- Summary stat cards: total leads, leads by status breakdown, total calls logged
- Recent call log table: last 10 entries (company_name, called_at, note)
- All data pulled from Supabase


### /leads (main table view)
- Full table of all leads from Supabase
- Columns: company_name, owner_name, business_phone, approx_rev, 
  employee_count, status (from lead_status), last_called_at, call_count
- Click a row → opens a slide-in drawer (no page navigation)
- Search bar: filter by company_name or business_phone
- Filter dropdown: filter by status

### /tasks
- Full list of all tasks across all leads
- Columns: title, linked company_name (via business_phone), due_at, completed
- Overdue tasks (due_at < now() and completed = false) highlighted in red
- Mark task as complete with a checkbox
- Create new task from this page (not tied to a lead)
- Filter: all / overdue / completed

### Lead Detail Drawer
- Shows all fields from leads + lead_status
- Call log history for that lead (call_log ordered by called_at desc)
- "Log a Call" form: note textarea + submit button
- On submit: INSERT into call_log, INCREMENT call_count, UPDATE last_called_at in lead_status
- Inline editing of lead fields with save button
- Tasks tab: shows tasks linked to this lead (ordered by due_at asc)
- "Add Task" form: title, description, due_at
- Overdue tasks highlighted in red
- Mark task as complete inline
- Notes tab: shows all notes for this lead (notes ordered by created_at desc)
- "Add Note" form: content textarea + submit button
- On submit: INSERT into notes (business_phone, content)
- Each note displays content + formatted created_at timestamp
- Offer amount field: numeric input (dollar amount) — editable inline, saved to lead_status.offer_amount — displayed as formatted currency (e.g. $5,000)

### /pipeline (Kanban)
- 6 columns: Lead → Discovery Call → Interested → Booked → Pending → Lost
- Cards in the Pending column display the offer_amount if set (e.g. $5,000) as a monospace badge on the card
- on load: fetch all leads joined with lead_status, place each card in column matching status
- place each card in column matching status (null = 'lead')
- Cards show: company_name, owner_name, owner_phone (if owner_phone == null: show business_phone)
- Drag and drop using native HTML drag and drop API — no library
- On card drop: UPSERT into lead_status (INSERT if no row exists, UPDATE if it does)
    using business_phone as the key, setting status to the new column value
 - Lead column drop sets status to 'lead'
 - Optimistic UI — move card instantly, sync in background
 - On every status change (drag & drop or inline): UPSERT must also SET status_changed_at = now()
 - Cards within each column are ordered by status_changed_at DESC
 - Each card displays a small muted badge in the bottom-right corner — format: "10d" — calculated as floor(now() - status_changed_at) in days — monospace font, color #666 — hidden if status_changed_at is null

---

## Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://rclttazujjfwdzmnuzgr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_hfieou-uSd1obrj0ZvJryw_QFSpiXt7

> Fill these in before running. Never hardcode keys in source files

---

## Deployment
- Vercel


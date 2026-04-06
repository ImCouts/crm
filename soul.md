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
| industry       | text        |
| employee_count | int4        |
| email          | text        |
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
| status         | text | Values: 'lead', 'no_answer', 'discovery_call', 'interested', 'booked', 'pending', 'lost' -- Null = 'lead' |
| call_count     | int4        |
| offer_amount   | numeric     | nullable — active offer amount in dollars (e.g. 5000) |
| last_called_at | timestamptz |
| last_emailed_at| timestamptz |
| status_changed_at | timestamptz | default now() — set on insert and on every status change |

> All table joins are on business_phone, not id. Never assume an id foreign key
> **Cascading PK updates:** All foreign keys referencing leads.business_phone (in call_log, lead_status, notes, tasks) use ON UPDATE CASCADE. This allows creating a lead with a placeholder phone (e.g. "unknown-companyname" or "TBD-1712345678") and replacing it with the real number later via inline edit in the Lead Detail Drawer. On save of a business_phone edit: UPDATE leads SET business_phone = new_value WHERE business_phone = old_value — cascading FKs handle the rest.

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

### contacts
| column         | type        | notes                                        |
|----------------|-------------|----------------------------------------------|
| id             | uuid        | Primary Key, default gen_random_uuid()       |
| business_phone | text        | FK → leads.business_phone, on update cascade on delete cascade |
| name           | text        | nullable                                     |
| phone          | text        | nullable                                     |
| email          | text        | nullable                                     |
| role           | text        | nullable                                     |
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
  industry, employee_count, status (from lead_status), last_called_at, call_count
- Click a row → opens a slide-in drawer (no page navigation)
- Search bar: filter by company_name, business_phone, or industry
- Filter dropdown: filter by status
- "Create Lead" modal fields: business_phone, company_name, owner_name, owner_phone, email, website, rbq, approx_rev, employee_count, industry

### /tasks
- Full list of all tasks across all leads
- Columns: title, linked company_name (via business_phone), due_at, completed
- Overdue tasks (due_at < now() and completed = false) highlighted in red
- Mark task as complete with a checkbox
- Create new task from this page (not tied to a lead)
- Filter: all / overdue / completed

### Phone number formatting
- owner_phone (create lead modal + drawer overview edit) and contacts.phone (add/edit) auto-format to (xxx) xxx-xxxx as the user types
- Strips non-digits, handles leading country code 1, caps at 10 digits
- Stored in DB already formatted as (xxx) xxx-xxxx

### Lead Detail Drawer
- Shows all fields from leads + lead_status
- Email field: text input — editable inline, saved to leads.email (also collected at lead creation time)
- Call log history for that lead (call_log ordered by called_at desc)
- "Log a Call" form: note textarea + submit button
- On submit: INSERT into call_log, INCREMENT call_count, UPDATE last_called_at in lead_status
- Inline editing of lead fields with save button
- Contacts tab (positioned between Overview and Calls):
  - Lists all contacts for this lead (from contacts table, ordered by created_at asc)
  - Each contact displays: name, phone, email, role — all fields optional
  - "Add Contact" button: opens inline form with fields for name, phone, email, role — submit inserts into contacts table with this lead's business_phone
  - Each contact row has a small edit button (pencil icon) to inline-edit fields and a small delete button (x icon) to DELETE from contacts by id
  - Use case: sub-owners, persons of interest, secondary contacts — stored structured data instead of burying it in notes
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
- 7 columns: Lead → No Answer → Discovery Call → Interested → Booked → Pending → Lost
- Cards in the Pending column display the offer_amount if set (e.g. $5,000) as a monospace badge on the card
- on load: fetch all leads joined with lead_status, place each card in column matching status
- place each card in column matching status (null = 'lead')
- Cards show: company_name, owner_name, owner_phone (if owner_phone == null: show business_phone)
- Drag and drop using native HTML drag and drop API — no library
- On card drop: first compare the destination column to the card's current status — if they are the same, cancel the drop (no API call, no status_changed_at reset, no re-render). Only if the destination column is different: UPSERT into lead_status (INSERT if no row exists, UPDATE if it does)
    using business_phone as the key, setting status to the new column value
 - Lead column drop sets status to 'lead'
 - Optimistic UI — move card instantly, sync in background
 - On every status change (drag & drop or inline): UPSERT must also SET status_changed_at = now()
 - Cards within each column are ordered by status_changed_at ASC
 - Each card displays a small muted badge in the bottom-right corner — format: "10d" — calculated as floor(now() - status_changed_at) in days — monospace font, color #666 — hidden if status_changed_at is null
 - Each column's visible card container should only be as tall as its cards (no giant empty box stretching down — remove any min-height or fixed height on the cards container)
 - BUT each column must still be droppable even when scrolled out of view or empty. Do this by making the entire column element (full height of the page) the dragover/drop event target — not just the cards container. The invisible hit zone should be the full column div spanning 100% height, while the cards just stack naturally inside it at their natural height
 - The drag behavior should work anywhere vertically within the column's lane.
 - "Log a Call" button — positioned top-right of the pipeline page, next to the page title
   - On click: opens a modal/popup form with:
     - A searchable dropdown to select a lead (displays company_name, searches by company_name or business_phone)
     - A note textarea
     - A submit button
   - On submit: INSERT into call_log (business_phone, called_at = now(), note), INCREMENT call_count and UPDATE last_called_at in lead_status for the selected lead
   - Close modal on successful submit
   - Same logic as the "Log a Call" form in the Lead Detail Drawer, but with an added lead selector

---

## Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://rclttazujjfwdzmnuzgr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_hfieou-uSd1obrj0ZvJryw_QFSpiXt7

> Fill these in before running. Never hardcode keys in source files

---

## Deployment
- Vercel
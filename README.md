# Covenant Lodge No. 4344 – Website & Application

Next.js 14+ (App Router) website for Covenant Lodge No. 4344: public site, recruitment CRM (7-stage pipeline), event management with RSVP, and Stripe payments (dining, charity, raffle). **No database required** – all features run against an in-memory mock store so you can iterate on the experience. Plug in Supabase (or another DB) later when ready.

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn-style UI (Radix), React Hook Form + Zod, Framer Motion, @dnd-kit (Kanban)
- **Data:** In-memory mock DB (`lib/mock-db.ts`) – no Supabase/DB needed for development
- **Auth:** Dummy admin login (env credentials)
- **Payments:** Stripe Checkout (optional; set env to enable)
- **Email:** Resend (optional)
- **Hosting:** Vercel

## Setup

### 1. Install dependencies

```bash
npm install
# or pnpm install / yarn
```

### 2. Environment variables (optional for basic run)

Copy `.env.example` to `.env.local` if you want to override defaults:

- **Admin (dummy):** `ADMIN_EMAIL`, `ADMIN_PASSWORD` (default: admin@covenantlodge.org.uk / admin). `SESSION_SECRET` for cookie signing (default works for local dev).
- **Stripe (optional):** Only needed for real payments. Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` for webhook.
- **Resend (optional):** For welcome/contact emails. No env = forms still work; data is stored in mock DB.
- **AI draft generation (optional):** Set `OPENAI_API_KEY` to enable LLM-generated lodge one-pager drafts in admin settings. Without it, the app uses a structured fallback draft generator.

**You do not need Supabase or any database to run the app.** All data (leads, events, RSVPs, payments, blog) is kept in memory and resets on server restart.

### 3. Run locally

```bash
npm run dev
```

- Public site: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin) (log in with default admin@covenantlodge.org.uk / admin)

## Front-end iteration (no DB)

- **Leads:** Expression of Interest form on Join Us creates a lead in the mock store. Admin CRM (list + Kanban + detail + activities) reads/writes the same store.
- **Events:** Admin creates/edits events in mock store. Public events list and event detail/RSVP read from it.
- **RSVPs:** Stored in mock store. With Stripe configured, checkout creates RSVP + session; webhook records payment and updates RSVP.
- **Blog:** Admin creates/edits posts in mock store. Public news list and post pages read from it.
- **Payments:** Listed in admin from mock store (and from Stripe webhook when enabled).

Data resets when you restart the dev server. Use this mode to iterate on UX and flows; when ready, swap `lib/mock-db` usage for Supabase (schemas in `supabase/migrations/001_initial_schema.sql` and `supabase/migrations/002_multi_tenant_saas_and_gift_aid.sql`).

## Multi-lodge tenant scoping (new)

API routes now support lodge scoping with a fallback to `covenant-4344`.

- Preferred for local/testing: query string, e.g. `/api/events?lodge=my-lodge`
- Alternative: `x-lodge-slug` request header
- Future-ready: subdomain inference via request host

The following route families are now lodge-aware:

- `app/api/events/*`
- `app/api/rsvps/route.ts`
- `app/api/payments/*`
- `app/api/leads/*`
- `app/api/lead-activities/route.ts`
- `app/api/blog/*`

New lodge management endpoints:

- `GET /api/lodges` list lodges
- `POST /api/lodges` create or update lodge settings
- `GET /api/lodges/:slug/site` get a lodge one-pager configuration
- `PATCH /api/lodges/:slug/site` update one-pager title, description, and sections
- `POST /api/lodges/:slug/ai-draft` generate an unsaved one-pager draft (AI when configured, fallback otherwise)
  - Supports full-page draft generation and section-only regeneration via `section_type`
  - Applies content guardrails (safe claims, clean CTA routes, length limits)

## Project structure

- `app/(public)/` – Public pages (Home, About, Venue, Join, Charity, Events, News, Contact, FAQ)
- `app/admin/` – Admin dashboard (dummy auth), leads CRM, events, blog, payments, settings
- `app/api/` – API routes (leads, lead-activities, events, rsvps, payments, blog, contact, auth)
- `components/` – UI components, layout, forms, CRM Kanban
- `lib/` – **mock-db** (in-memory store), auth (dummy), utils; Supabase client kept for future DB plug-in
- `supabase/migrations/` – SQL schema for when you connect a real DB

## Admin (dummy auth)

- Login: `/admin/login`. Credentials from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (default admin@covenantlodge.org.uk / admin).
- Session is cookie-based. Replace with Supabase Auth later if needed.

## Deploy (Vercel)

1. Push to GitHub and connect the repo in Vercel.
2. Set env vars: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`. Add Stripe/Resend if you use them.
3. Deploy. Note: with mock DB only, data still resets on each serverless cold start; add Supabase (or another DB) for persistent data.

## Design

- Colours: Navy (#1e3a5f), cream (#f8f6f3), gold (#d4af37)
- Typography: Playfair Display (headings), Inter (body)
- UGLE-compliant: no ritual/sensitive content; inclusive language; links to UGLE and women’s Freemasonry (OWF, HFAF)

## License

Private – Covenant Lodge No. 4344.

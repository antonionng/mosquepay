# MosquePay

All-in-one platform for UK mosques and Islamic centres: membership, donations (Zakat & Sadaqah), Jumu'ah and events, Gift Aid, newcomer CRM, community welfare, treasurer reporting, and mosque websites.

**Production site:** [https://www.mosque-pay.com](https://www.mosque-pay.com)

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Radix UI, React Hook Form + Zod
- **Data:** Supabase Postgres (project `scinykybyelaqzlxcjjo`) with in-memory mock fallback for local dev
- **Payments:** Mooov Connect (primary); Stripe legacy paths remain for older flows
- **Email:** Resend (`mosque-pay.com` domain)
- **Hosting:** Vercel

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and set at minimum:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (MosquePay project)
- `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard → Project Settings → API keys)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`

Without the service role key, the app falls back to the in-memory demo store (`ALLOW_IN_MEMORY_MOCK=true`).

Mooov merchant keys (`MOOOV_PLATFORM_*`, `MOOOV_DEMO_MOSQUE_ID`) can be added when the MosquePay merchant account is ready.

### 3. Run locally

```bash
npm run dev
```

- Marketing site: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
- Member portal: [http://localhost:3000/member/login](http://localhost:3000/member/login)

Default demo mosque: **Central Jamia Masjid** (`central-jamia-demo`).

### 4. Seed Supabase demo data (optional)

With `SUPABASE_SERVICE_ROLE_KEY` set:

```bash
npm run seed:platform-demo
# or wipe and re-seed:
npm run seed:platform-demo -- --reset
```

Seeds 10 UK demo mosques from `lib/platform-demo-mosques.ts` plus a platform owner via `scripts/bootstrap-platform-owner.mjs`.

## Project structure

- `app/(public)/` – Marketing site (features, pricing, FAQ, book demo)
- `app/admin/` – Mosque admin dashboard
- `app/(member)/member/` – Member portal
- `app/(operator)/operator/` – Platform operator console
- `app/[mosqueSlug]/` – Per-mosque public routes (events, newcomers, guest links)
- `app/api/` – API routes
- `components/` – UI, layout, marketing, site builder
- `lib/` – DB access, auth, payments (Mooov), giving, Gift Aid, SEO
- `supabase/migrations/` – Baseline schema (`001_mosquepay_baseline.sql`)
- `public/brand/` – MosquePay logos and favicon assets

## Multi-mosque scoping

API routes resolve the active mosque via:

- Query string: `/api/events?mosque=central-jamia-demo`
- Header: `x-mosque-slug`
- Admin cookie / subdomain (production)

## Deploy (Vercel)

1. Connect this repo to a new Vercel project for MosquePay.
2. Set env vars from `.env.example` (Supabase, Mooov, Resend, `NEXT_PUBLIC_SITE_URL=https://www.mosque-pay.com`).
3. Point `mosque-pay.com` DNS to Vercel.
4. Verify `mosque-pay.com` in Resend for transactional email.

## License

Private – MosquePay.

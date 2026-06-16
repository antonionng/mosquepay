# MosquePay Stripe Subscription create fixture — 2026-05-28

Locked body shape LP will POST when migrating an active monthly giving
schedule from the Mooov saved-charge interim onto Stripe Subscriptions
on the connected account, post-2026-06-05 cutover. Mooov pins their
Slice 3 stripeingest test fixture against this exact shape.

## Context

- Trigger: scheduled migration script run by LP after Mooov ships
  subscription pass-through (prod cutover Fri 5 Jun).
- One POST per `giving_schedules` row with `cycles_completed < cycles_total`
  and `status='active'` (or `past_due`).
- No card re-collection: `customer_ref` minted the Stripe Customer at
  enrolment time (Mooov L1.1) and the saved PM is reusable on the
  connected account.
- After this POST succeeds Mooov fans out `subscription.activated` →
  LP flips `giving_schedules.status='active_stripe'` and stores
  `mooov_subscription_id` from `data.subscription_id`.

## HTTP request

```http
POST https://api.stripe.com/v1/subscriptions HTTP/1.1
Host: api.stripe.com
Authorization: Bearer {STRIPE_PLATFORM_KEY}
Stripe-Account: {connected_account_id_of_covenant}
Stripe-Version: 2025-02-24.acacia
Idempotency-Key: lp:giving:migrate:{schedule_id}
Content-Type: application/x-www-form-urlencoded

customer={stripe_customer_id}
items[0][price_data][currency]=gbp
items[0][price_data][unit_amount]=1250
items[0][price_data][recurring][interval]=month
items[0][price_data][recurring][interval_count]=1
items[0][price_data][product_data][name]=Central Jamia Masjid — Annual Donations (Monthly)
items[0][price_data][product_data][metadata][lp_mosque_id]={mosque_uuid}
default_payment_method={stripe_payment_method_id}
billing_cycle_anchor={next_charge_at_unix}
proration_behavior=none
cancel_at={final_cycle_unix}
collection_method=charge_automatically
expand[0]=latest_invoice
metadata[lp_schedule_id]={schedule_uuid}
metadata[lp_mosque_id]={mosque_uuid}
metadata[lp_member_id]={member_uuid}
metadata[lp_member_giving_id]={member_giving_uuid}
metadata[lp_migrated_from]=saved_charge_cron
metadata[lp_cycles_completed_at_migration]={n}
metadata[lp_cycles_total]=12
```

## Decisions baked into the fixture

| Field | Value | Why |
| --- | --- | --- |
| `items[0][price_data]` (inline) | per-subscription Price | LP carries variable giving amounts per mosque (£80–£250 observed). No point in a Product/Price catalog on each connected account. |
| `billing_cycle_anchor` | `giving_schedules.next_charge_at` as Unix epoch | First Stripe-driven invoice fires on the same calendar day the LP cron would have fired. Zero gap, zero double-charge. |
| `proration_behavior` | `none` | We're migrating mid-stream after `cycles_completed` cycles already paid. Never want a transition invoice. Combined with the future `billing_cycle_anchor`, Stripe issues no $0 transition invoice. |
| `cancel_at` | anchor + remaining cycles in seconds | Fixed-term schedule. Stripe auto-cancels after the last invoice posts; `customer.subscription.deleted` fans out as `subscription.canceled`. No "stop after N cycles" handler needed. |
| `collection_method` | `charge_automatically` | Off-session by construction; no hosted invoice page. |
| `default_payment_method` | persisted `mooov_payment_method_id` | The PM Mooov saved at enrolment time. Already on the connected account. |
| `off_session=true` | **omitted** | Per Mooov's 2026-05-28 nit 2: redundant when `billing_cycle_anchor` is in the future + `proration_behavior=none`. Stripe ignores it when no initial invoice runs. Dropped to keep the fixture minimal-and-true. |
| `expand[0]=latest_invoice` | included | Migration script asserts the migrated subscription has no immediate invoice (validates the no-double-charge contract). |
| `Idempotency-Key` | `lp:giving:migrate:{schedule_id}` | Per-schedule key. Re-running the migration script for a partial batch is safe. |
| `metadata[lp_*]` | LP correlation IDs | Carried forward into Mooov's `subscription.*` events as `data.subscription_metadata` (NOT `data.metadata` — invoice metadata stays empty). LP webhook handler reads from `data.subscription_metadata`. |

## Webhook contract LP relies on

After this POST succeeds, LP expects this sequence from Mooov's
Connect ingest. Per Mooov's 2026-05-28 lock-in (Slices 1–5 landed,
3b dispatcher-routed-stub-projection), every cycle is **dual-emit**:
two distinct events with two distinct `event.id`s land on the same
endpoint, one on the subscription lane and one on the payment lane.

1. `subscription.activated` (immediate, subscription lane). Carries
   `data.subscription_id`, `data.subscription_metadata.lp_schedule_id`,
   `data.stripe_customer_id`, `data.customer_ref`. LP flips
   `giving_schedules.status = 'active_stripe'` and stores
   `data.subscription_id` on `giving_schedules.mooov_subscription_id`.
2. At each future billing cycle anchor, **two events**:
   - `subscription.invoice_paid` (subscription lane). Carries
     `data.subscription_id` + `data.subscription_metadata` (`lp_*`
     correlation IDs). Does NOT carry `payment_id`. LP uses this to
     advance `giving_schedules.cycles_completed`.
   - `payment.captured` (payment lane). Carries `data.payment_id` +
     `data.stripe_customer_id` + `data.customer_ref`. Does NOT carry
     `subscription_id`. LP's existing payment projector treats this
     identically to a saved-charge cycle and writes the
     `public.payments` row keyed on `payments.mooov_payment_id`.
   The two events MUST be correlated LP-side. Mooov has confirmed they
   share the same Stripe invoice but distinct Mooov `event.id`s;
   correlation key is `(subscription_id, period_start)` from the
   subscription lane against `(amount, period_start)` on the
   payment-attempts row, OR the cleaner long-term path:
   `subscription_metadata.cycle_number` once Slice 3b ships (until then,
   correlate on `period_start` from the subscription lane).
3. After the final invoice posts, Stripe auto-cancels at `cancel_at`,
   Mooov fans out `subscription.canceled` → LP marks the schedule
   `completed` (because `cycles_completed === cycles_total`).
   `subscription.canceled` is dual-sourced on the Stripe side
   (immediate `customer.subscription.deleted` vs scheduled update to
   `status=canceled`); both flow through one Mooov projection so LP
   only ever sees one `subscription.canceled` per schedule.
   `data.canceled_at` distinguishes the two cases if needed.

LP dedupes on `mooov_webhook_events.event_id` (existing
`(mosque_id, event_id)` PK). The dual-emit lands two distinct event_ids;
LP's `payments.mooov_payment_id` projection idempotently writes one
`payments` row regardless.

### Slice 3b heads-up (until Mooov ships)

Mooov's 2026-05-28 message: dispatcher route for `invoice.paid` /
`invoice.payment_failed` is wired and ACKs 200, but the projection is
a log+ack stub. Until 3b ships:

- LP **will** receive `subscription.activated` and `subscription.canceled`
  (Slice 3a — landed).
- LP **will** receive `payment.captured` per cycle (existing payment
  ingestor — unaffected by 3b).
- LP **will NOT** yet receive `subscription.invoice_paid` with
  `subscription_metadata`.

Concrete recommendation: do NOT migrate a live monthly-giving schedule
to Stripe Subscription mode until 3b lands. Until then, schedules stay
on the saved-charge interim (which has been live in Mooov prod the
whole time). After 3b lands, this fixture is the migration POST body.

## Local test fixture

Mooov's Slice 3 stripeingest tests should reproduce the body above
verbatim with these substitutions:

| Placeholder | Test value |
| --- | --- |
| `{schedule_id}` | `c0v_giving_sched_test_001` (UUID-shaped string) |
| `{stripe_customer_id}` | `cus_test_lp_001` |
| `{stripe_payment_method_id}` | `pm_test_lp_001` |
| `{next_charge_at_unix}` | `1798761600` (2027-01-04T00:00:00Z, future-anchored) |
| `{final_cycle_unix}` | `1827504000` (2027-12-04T00:00:00Z, anchor + 11 months) |
| `{mosque_uuid}` | `00000000-0000-0000-0000-000000000c0v` |
| `{member_uuid}` | `00000000-0000-0000-0000-0000c0vememb` |
| `{member_giving_uuid}` | `00000000-0000-0000-0000-c0vmembergiving` |
| `{n}` | `8` (representative: migrated after 8 of 12 cycles paid) |

If the live LP migration script ends up sending a different body shape
than this document, this doc is the contract — the script is wrong and
LP will fix it before merge.

## References

- Mooov reply 2026-05-28 (initial): locked Q-A→Q-E, fixture nits 1–2
  addressed inline above
- Mooov reply 2026-05-28 (post-lock): Slices 1–5 landed in prod
  (revision `gateway-prod-00040-n8g`, tag `290e6e4`); Slice 3b
  (`invoice.paid` / `invoice.payment_failed` projection) pending
- LP saved-charge interim spec: 2026-05-28 reply, tasks L1.1–L1.4
- Migration script: `app/api/admin/giving/migrate-to-stripe-subscriptions/route.ts`
  (lands after Mooov Slice 3b; this fixture is the input contract)
- Mooov by-ref customer fallback: `GET /v1/customers/by_ref?ref=<customer_ref>`
  (scope `customers:read`, platform-key only, 404/422/400 error shape).
  Not currently used by LP because the webhook stamps
  `data.stripe_customer_id` automatically (Q-A); reserved for future
  cron-side resolution if ever needed.

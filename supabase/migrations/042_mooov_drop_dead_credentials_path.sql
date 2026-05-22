-- 042_mooov_drop_dead_credentials_path
--
-- Remove leftovers from the original (May 15) per-lodge encrypted API
-- key plan that was superseded by Mooov's OAuth Connect / OBO model
-- shipped in 033800f. Today's smoke (5 webhook deliveries + 1 dues
-- round-trip against merch_lodgepay_demo) confirmed nothing reads any
-- of these objects in the live code path -- per-lodge auth flows
-- through grants persisted in mooov.lodges.metadata.{grant_id,...},
-- not through encrypted credentials in a dedicated table.
--
-- Drops, in dependency order:
--
--   * mooov.get_lodge_outbound_secret(text) -- callable only by
--     service_role; used to read the decrypted webhook signing
--     secret per-lodge. Connect uses one platform-wide signing
--     secret in MOOOV_WEBHOOK_SIGNING_SECRET instead.
--   * mooov.get_lodge_mooov_key(text) -- callable only by
--     service_role; used to read the decrypted per-lodge API key
--     secret + base url + merchant_id. Connect uses the platform
--     key (MOOOV_KEY_ID / MOOOV_KEY_SECRET) and resolves merchant_id
--     from mooov.lodges directly.
--   * mooov.mooov_master_key() -- vault resolver these two RPCs
--     depended on. The Vault secret MOOOV_CRED_MASTER_KEY was never
--     actually created, so the function has been returning NULL
--     since day one. Safe to drop.
--   * mooov.mooov_credentials -- per-lodge encrypted-credentials
--     table. 0 rows ever inserted. Cascade-drops the FK from any
--     stragglers (there are none).
--
-- Keeps everything per-lodge-auth actually uses:
--   * mooov.lodges (the grant/merchant directory)
--   * mooov.members, mooov.payment_attempts, mooov.dues_schedules,
--     mooov.mooov_webhook_events (all live)
--   * mooov.current_lodge_id() (RLS tenant resolver)

drop function if exists mooov.get_lodge_outbound_secret(text);
drop function if exists mooov.get_lodge_mooov_key(text);
drop function if exists mooov.mooov_master_key();
drop table    if exists mooov.mooov_credentials cascade;

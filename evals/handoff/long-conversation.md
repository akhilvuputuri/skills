# Synthetic long conversation: webhook migration

All names, repositories, tickets, and numbers are synthetic. `example/notify` is not a real repository.

User: We need to replace the 5-minute polling of Paylane payment events in example/notify with Paylane webhooks. Cut-over has to happen before the release freeze on 14 November. Hard rule for the whole migration: no event may be processed twice, and none may be dropped. Losing a refund event is worse than a duplicate, so if we ever have to choose, prefer the duplicate.

Agent: Understood. I see four pieces of work: (A) verify webhook signatures, (B) make processing idempotent across retries, (C) backfill events missed during cut-over, and (D) a metrics dashboard comparing polling and webhooks. Should I start with A?

User: Yes, start with A. Keep polling running in shadow mode until we have 7 days of parity between polling and webhooks. Don't turn polling off before that, even if webhooks look fine.

Agent: Paylane signs each delivery with HMAC-SHA256 over the raw body. The signature is in the `X-Paylane-Signature` header, and the timestamp is in `X-Paylane-Timestamp`.

User: Use the raw bytes, not re-serialized JSON. We got burned by that on another integration.

Agent: I added `verify_signature(raw_body, headers, secret)` in `notify/webhooks/signature.py`. It rejects deliveries whose timestamp is older than 5 minutes.

User: 5 minutes is fine. What about key rotation?

Agent: Paylane allows two active secrets during rotation. The verifier now tries both `PAYLANE_WEBHOOK_SECRET` and `PAYLANE_WEBHOOK_SECRET_PREVIOUS`.

User: Good. Tests?

Agent: `tests/webhooks/test_signature.py` has 11 cases, including tampered body, stale timestamp, rotated secret, and missing header. All 11 pass locally.

User: Open a PR.

Agent: Opened example/notify#212, "Verify Paylane webhook signatures". The description documents the header names, the 5-minute tolerance, the rotation behavior, and the test matrix.

User: Reviewer approved 212. Merge it.

Agent: Merged example/notify#212 into main as commit 4e1a9c2.

User: Great, A is done. Before B, quickly: can the dashboard (D) just reuse the existing Grafana board?

Agent: The existing board `payments-overview` has panels for polling latency. A webhook panel would need a new metric, `paylane_webhook_received_total`.

User: Let's park D until after cut-over. It's not needed for the freeze.

Agent: Parked D. Moving to B, idempotency. Paylane retries a failed delivery with exponential backoff. Their docs say retries continue for 24 hours.

User: Plan for B?

Agent: Proposal: store each delivery's `delivery_id` in Redis with `SETNX` and a TTL equal to the retry window, and skip processing when the key already exists.

User: Two problems. First, I checked with Paylane: retries continue for 3 days, not 24 hours. Their public doc is outdated. Second, a retry gets a new delivery_id on every attempt, so delivery_id can't be the dedup key. Use the event_id, which stays the same across retries.

Agent: Corrected: the retry window is 3 days, and the dedup key is `event_id`. With a 3-day window, a Redis TTL would have to be at least 3 days, and Redis in this deployment is configured without persistence.

User: Then Redis is out. If Redis restarts we lose the dedup state and could double-process. Reject the Redis SETNX approach.

Agent: Rejected Redis SETNX. Alternative: a Postgres table `processed_events` with a unique constraint on `event_id`. The insert happens in the same transaction as the business side effect, so either both commit or neither does.

User: That's the approach. Go with Postgres.

Agent: Created branch `webhooks-idempotency`. I wrote migration `0042_processed_events.py`, which creates `processed_events(event_id text primary key, received_at timestamptz not null)`.

User: Do we need an index on received_at?

Agent: Only if we prune old rows. Pruning older than 30 days would need it.

User: Add the index; we'll prune later. Not now.

Agent: Added the index in the same migration. Pruning is not implemented.

User: OK. Meanwhile, what's the plan for C, the backfill?

Agent: During cut-over, events could arrive while neither path processes them. Paylane has a replay API, `POST /v2/events/replay`, which can resend events for a time range.

User: How far back can it replay?

Agent: The replay API only covers the last 72 hours.

User: That's a problem if cut-over slips over a weekend. I opened a support ticket with Paylane asking for a longer replay window: PL-4471. C is blocked until they answer.

Agent: Noted: C is blocked on Paylane ticket PL-4471, because the replay API covers only 72 hours.

User: Back to B. Wire the handler.

Agent: `notify/webhooks/handler.py` now parses the event, opens a transaction, inserts into `processed_events`, and dispatches to the event-type handler. On a unique violation, it returns 200 without processing.

User: Why 200 on duplicate?

Agent: If we return an error, Paylane keeps retrying the duplicate for 3 days. 200 tells them it was handled.

User: Makes sense.

Agent: I ran the unit tests in `tests/webhooks/test_handler.py`: 14 passed.

User: Add a concurrency test. Two deliveries of the same event arriving at the same time.

Agent: Added `test_concurrent_duplicate_delivery`, which sends the same event twice in parallel threads and asserts exactly one side effect.

User: Run it a bunch of times.

Agent: I ran it 20 times. It failed 2 of the 20 runs. In the failures, the side effect happened twice.

User: That's exactly what we can't have. Why?

Agent: Hypothesis, not yet verified: the handler sends the HTTP 200 ack before the transaction commits. If the commit then fails or races, Paylane's retry and the original can both proceed. I have not confirmed this. It could also be the test harness sharing a connection between threads.

User: Don't treat that as the cause until it's checked.

Agent: Understood; it stays a hypothesis.

User: Side question: the staging Postgres is on version 14, right?

Agent: Staging runs Postgres 15.4, according to `infra/staging.tfvars`.

User: OK, irrelevant then. Is there anything else in the logs?

Agent: In the two failed runs, both threads logged `inserted processed_events` before either logged `commit`. That is consistent with the hypothesis but does not prove it.

User: Fine. I opened a draft PR for B so the reviewers can see the migration: example/notify#219. Put the migration rationale and the Redis rejection in its description so we don't have to repeat it elsewhere.

Agent: Updated the description of draft PR example/notify#219 with the migration schema, the reason for the `received_at` index, and why Redis SETNX was rejected.

User: Also check whether the refund handler uses the same code path. I don't want a separate dedup there.

Agent: I'll look at that.

User: Actually first, how is the shadow-mode comparison going for the parity requirement?

Agent: Shadow mode is not running yet, because the webhook endpoint is not deployed. The 7-day parity clock has not started.

User: Right. So the order is: finish B, deploy webhooks in shadow mode next to polling, run 7 days of parity, then cut over.

Agent: Recorded that order.

User: Back to the failing concurrency test. What would you do next?

Agent: Change the handler so that it returns 200 only after the transaction commits, then rerun `test_concurrent_duplicate_delivery` 50 times. If failures persist, look at the shared connection in the test harness.

User: That's the next step. I need to stop here. Write a handoff so I can continue in Codex tomorrow.

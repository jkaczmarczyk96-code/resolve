# Notifications (phase 11)

`/notifications` contains the latest 100 saved in-app notifications, an unread filter, explicit read acknowledgement, links to the corresponding problems, and saved per-account notification preferences. Settings links to these preferences. Refresh loads new updates; this release does not push browser, email or mobile messages.

Web-run transitions emit `analysis_completed`, `analysis_failed` and `input_required`. Monitoring emits `condition_met` and `monitor_failed`. The daily cron emits `task_due` once for each active task and saved deadline when it enters the next 24 hours; users can disable task reminders independently. Labels describe actual saved events; completed analysis is not labelled a solved problem. Existing historical runs are not backfilled.

The database event layer is separate from delivery: `notification_events` records a typed event with a unique event key; `notifications` is the current in-app delivery. Triggers publish atomically with the source transaction. Duplicate run transitions do not duplicate delivery. Preferences suppress future delivery in the selected category without deleting prior notifications or source events.

All tables enable RLS. Users can read their own notifications/preferences, but cannot forge events, change notification content or select internal event records. Owner-bound RPCs save preferences and acknowledge individual notifications. Event functions are internal; a later delivery channel can consume the abstraction without changing current notification identifiers.

Apply `20260913000000_notifications.sql` and `20260920020000_task_deadlines.sql` before deploying this release. The first migration also fixes checkpoint selection after an interrupted clarification continuation: the next claim recovers the latest workflow stage instead of replaying the original question snapshot.

Verification covers database event deduplication, preference filtering, two-user isolation, acknowledgement idempotency and monitoring events. A browser test with explicit HTTP fixtures covers inbox rendering, unread filtering, read acknowledgement, saved preferences and small-screen overflow; it does not claim a live end-to-end provider run.

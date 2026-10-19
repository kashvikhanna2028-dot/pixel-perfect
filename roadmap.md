# Subscriptions
- [x] Add private subscriptions, ratings, preferences, and atomic renewal handling.
- [x] Add subscriptions page, editor, presets, insights, reminders, and dashboard overview.
- [x] Extend settings/demo data and document future email reminders.
- [x] Verify calculations, privacy, and signed-in flows.

## Finish subscription gaps
- [x] Run baseline tests and inspect current build diagnostics.
- [x] Persist and migrate notification reads with optimistic updates and device synchronization.
- [x] Add opt-in email settings, protected daily dispatch, delivery deduplication, and a test reminder.
- [x] Document provider/secrets/scheduling setup and verify tests and signed-in flows.
- [ ] Activate and verify live email delivery — blocked by skipped provider connection, sender and cron secrets, and daily schedule configuration.

## Account recovery and passwordless sign-in
- [ ] Add forgot/reset password pages with neutral messaging and strength meter.
- [ ] Add email OTP and phone OTP sign-in tabs with OTP input, resend cooldown, expiry countdown.
- [ ] Add Settings Security card: change/set password, verified email/phone, sign out everywhere, add phone.
- [ ] Write SETUP-AUTH.md for manual steps (SMS provider, CAPTCHA, templates, OTP expiry).
- [ ] Add tests (OTP input, timers, phone normalization, generic messaging, route protection); run tests and build.
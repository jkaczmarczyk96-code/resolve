# Phase 17 — Hackathon release

Target event: **Nebius x NVIDIA Global AI Hackathon**.

Official submission deadline: **October 30, 2026 at 10:00 AM Pacific Time** (`2026-10-30T17:00:00Z`). Recommended track: **Best Apps and Agents**. Avenli also makes a functional Tavily API call and is eligible to be considered for **Best Use of Tavily**.

## Ready

- Production app: <https://avenli.vercel.app>
- Public no-account demo: <https://avenli.vercel.app/demo>
- GitHub source is synchronized with the production deployment.
- Hosted Supabase migrations and database lint are complete.
- README, setup instructions and `.env.example` describe a reproducible local environment.
- MIT is present as a detectable OSI-approved repository license.
- README explains the runtime role of NVIDIA Nemotron on Nebius Token Factory and Tavily.
- Architecture and trust boundaries are documented in [architecture.md](architecture.md).
- The demo flow and recording script are documented in [demo.md](demo.md).
- Three release screenshots are checked in under `docs/screenshots/`.
- Phase 16 verification passed 288 tests, zero-warning lint, strict TypeScript, production build, 16 Chromium scenarios and a zero-vulnerability runtime audit. Public-demo, saved-task and problem-lifecycle regressions now bring the offline suite to 298 tests across 47 files and the normal browser suite to 17 passing scenarios, with three live-provider scenarios skipped.
- Real Nebius/NVIDIA and Tavily workflows were verified during development; paid-provider checks stay opt-in.

## Before the Devpost write

- Devpost registration is complete. Acknowledge the current official rules only when ready to continue the submission workflow.
- Make the GitHub repository public after one final committed-secret scan.
- Capture the two remaining live screenshots listed in [demo.md](demo.md).
- Record and upload the short demo video.
- Keep the public YouTube video at three minutes or less, with audio explaining Nebius Token Factory and the NVIDIA model.
- Fetch the current official form fields and judging criteria, then finalize `devpost-submission.md`.
- Submit only after a final explicit review of the exact Devpost payload.

Nothing in this document indicates that a Devpost entry has been sent.

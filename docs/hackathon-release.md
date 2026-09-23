# Phase 17 — Hackathon release

Target event: **Nebius x NVIDIA Global AI Hackathon**.

Official submission deadline: **October 30, 2026 at 10:00 AM Pacific Time** (`2026-10-30T17:00:00Z`). Recommended track: **Best Apps and Agents**. Avenli also makes a functional Tavily API call and is eligible to be considered for **Best Use of Tavily**.

The latest organizer judging announcement checked on 2026-09-22 keeps four equally weighted criteria—Technological Implementation, Design, Potential Impact and Quality of the Idea—and specifically says that multi-step autonomous workflows stand out in Best Apps and Agents. The deadline remains unchanged and submissions are open.

## Ready

- Production app: <https://avenli.vercel.app>
- Public no-account demo: <https://avenli.vercel.app/demo>
- Public GitHub source is synchronized with the production deployment: <https://github.com/jkaczmarczyk96-code/resolve>.
- Hosted Supabase migrations and database lint are complete.
- README, setup instructions and `.env.example` describe a reproducible local environment.
- MIT is present as a detectable OSI-approved repository license.
- README explains the runtime role of NVIDIA Nemotron on Nebius Token Factory and Tavily.
- Architecture and trust boundaries are documented in [architecture.md](architecture.md).
- The demo flow and recording script are documented in [demo.md](demo.md).
- Seven release visuals are checked in under `docs/screenshots/`, including the Devpost cover, square thumbnail, production evidence-quality view and Calendar approval preview.
- A 2:34 demo can be regenerated from production with the checked-in recording scripts; it includes locally generated English narration describing Nebius Token Factory and NVIDIA Nemotron, plus synchronized burned-in captions. The owner approved public upload, and YouTube Studio confirmed publication at <https://youtu.be/B1Aqo6qaYtc> with no copyright issues.
- The owner confirmed residence in the Czech Republic, both mandatory eligibility statements and three 8/10 Nemotron/Nebius feedback ratings on 2026-09-23.
- `python scripts/scan-committed-secrets.py` found no high-confidence secret patterns in 627 text blobs across reachable Git history; only `.env.example` is tracked, and generated media and `.env.local` are ignored.
- Phase 16 verification passed 288 tests, zero-warning lint, strict TypeScript, production build, 16 Chromium scenarios and a zero-vulnerability runtime audit. Public-demo, saved-task, lifecycle, task-deadline, multi-query research, model-output repair, focused follow-up, evidence-abstention and unsupported-label regressions now bring the offline suite to 311 tests across 50 files and the normal browser suite to 17 passing scenarios, with three local-Supabase live scenarios skipped. A focused three-query Tavily live check and three complete quality-evaluation scenarios also pass; the transient Verifier contract failure found by the evaluation is covered by one strictly validated repair generation.
- Real Nebius/NVIDIA and Tavily workflows were verified during development; paid-provider checks stay opt-in.

## Before the Devpost write

- Devpost registration and rules acknowledgment are complete; no project or entry has been submitted.
- The owner approved publishing the repository; GitHub confirms it is public, with an MIT license and setup README. The committed-secret scan passed before publication.
- The public YouTube demo is available at <https://youtu.be/B1Aqo6qaYtc>; its upload settings and description are recorded in [youtube-demo.md](youtube-demo.md).
- Keep the public YouTube video at three minutes or less, with audio explaining Nebius Token Factory and the NVIDIA model.
- Fetch the current official form fields and judging criteria, then finalize `devpost-submission.md`.
- Submit only after a final explicit review of the exact Devpost payload.

Nothing in this document indicates that a Devpost entry has been sent.

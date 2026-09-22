# Avenli demo guide

This guide keeps a recorded demo under three minutes and uses only features that exist in production.

## Core story

People bring Avenli a real-world outcome with constraints and unknowns. Eight bounded AI agents turn it into a saved, evidence-aware recommendation and proposed tasks. The user can inspect the reasoning trail, answer a clarification, resume the same workflow and approve a separate external action only after reviewing its exact payload.

## Three-minute recording script

The exact ready-to-read voiceover is in [demo-narration.md](demo-narration.md).

### 0:00–0:20 — The problem

Open the landing page and say:

> Complex personal and work decisions usually scatter context, research and next steps across tabs. Avenli keeps the outcome, evidence, trade-offs and actions in one reviewable workspace.

Show **Give it a problem. Get it solved.**, then open the no-account public demo. Explain that it uses fictional in-memory data and makes no AI or external-service calls. Use the authenticated workspace later in the recording only for the real saved workflow and action review.

### 0:20–0:50 — Create an outcome

Open **New problem**. Use a concise prompt with a deadline, hard constraints and an unknown, for example:

> Prepare a launch checklist for a small web product by Friday. I have one developer, no paid project-management tools, and I need security, deployment and rollback checks. I do not yet know which checks must block release.

Explain that the browser saves the problem, while the server runs the finite workflow with NVIDIA Nemotron through Nebius Token Factory and Tavily research.

### 0:50–1:35 — Inspect the result

Open a completed problem. Show:

- the extracted goal, constraints and unknowns;
- the plan and agent progress;
- research excerpts, source links and evidence quality;
- compared options, risks and the recommendation;
- proposed tasks, which do not execute automatically.

Point out that confidence is capped when evidence is incomplete, stale, contradictory or covers only part of the plan.

### 1:35–2:00 — Human control and persistence

Explain that a clarification pauses as **Needs your input**, survives reload and resumes the same saved run once. Mention checkpoint recovery and daily monitoring without claiming that every result is continuously researched.

### 2:00–2:30 — Safe action

Show the Calendar proposal on a completed problem. Highlight the exact title, time and description, then the separate approval button. State that Avenli creates no attendees or invitations, uses an idempotent provider ID and records the full action audit trail.

Do not create another production test event during the recording unless the disposable event is intentionally part of the demo.

### 2:30–2:50 — Architecture

Show the diagram in [architecture.md](architecture.md). Summarize the trust boundaries: browser → authenticated server → durable Supabase workflow → Nebius/Tavily, with external actions isolated behind approval.

### 2:50–3:00 — Close

> Avenli gives open-model AI a durable, evidence-aware workflow and keeps the person in control of every real-world action.

End on the recommendation or dashboard screen and show `https://avenli.vercel.app`.

## Screenshot shot list

1. `screenshots/devpost-cover.png` — 1200×630 Devpost/social cover.
2. `screenshots/devpost-thumbnail.png` — square submission thumbnail.
3. `screenshots/landing.png` — product promise and visual identity.
4. `screenshots/workspace-desktop.png` — complete desktop problem workspace with goal, constraints, recommendation, plan and activity.
5. `screenshots/workspace-mobile.png` — responsive option comparison and mobile navigation.
6. Capture a live completed problem on the **Research** tab with source quality visible.
7. Capture the Calendar action proposal before approval, with no private email, token or sensitive event content visible.

The checked-in workspace screenshots use clearly labeled fictional demo data. The live screenshots in items 6–7 were visually checked in production and should be freshly exported immediately before the final Devpost upload so they match the current deployment.

## Recording checklist

- Record at 1440×900 or 1920×1080 with browser zoom at 100%.
- Hide bookmarks, unrelated tabs, email addresses and notification popups.
- Use one prepared problem to avoid waiting on provider latency in the final cut.
- Keep the narration factual: research is bounded, recommendations are reviewable, and tasks are proposed.
- Add captions and publish an unlisted or public YouTube/Vimeo link accepted by the event form.

## Reproducible draft

Windows can generate a private review copy from the production public demo without accounts or provider calls:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-demo-voice.ps1
node scripts/generate-demo-captions.mjs
node scripts/record-demo.mjs
```

The scripts create `artifacts/avenli-demo-draft.mp4`, a 1600×900 H.264/AAC video with an English system-voice reading of [demo-narration.md](demo-narration.md) and burned-in captions generated as [demo-captions.srt](demo-captions.srt). The generated media artifacts are ignored by Git. Treat this as a timing and visual draft; record or replace the narration and review every frame before publishing.

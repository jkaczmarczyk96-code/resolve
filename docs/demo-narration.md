# Avenli demo narration

Target length: about 2:45 at a measured pace. Record the production deployment at `https://avenli.vercel.app` and keep this narration factual.

## 0:00–0:20 — Promise

Complex decisions rarely fail because we need one more list of ideas. The real problem is that goals, constraints, research, trade-offs and next steps are scattered across tabs. Avenli turns that work into one saved, reviewable path from problem to action.

## 0:20–0:48 — Start a problem

I describe the outcome I need, the deadline, hard constraints and anything I still do not know. Avenli saves the problem, then runs a finite workflow instead of an open-ended chat. This public demo uses fictional data and makes no external calls, while signed-in workspaces persist real analyses.

## 0:48–1:18 — Nebius and NVIDIA

Eight specialized stages run on NVIDIA Nemotron 3 Super through Nebius Token Factory. Intake structures the request. Planning identifies dependencies and the most important research questions. Research, verification, option generation, critique, decision and task planning each return typed output that must pass strict validation before the next stage can begin.

## 1:18–1:48 — Evidence

For live analyses, Tavily supplies a bounded set of search results. Avenli assigns its own source IDs, keeps retrieved text outside system instructions and requires exact supporting excerpts for verified claims. Here I can inspect the sources, publication uncertainty and coverage. If the evidence is missing, stale or contradictory, confidence drops. If no decision-relevant claim has a traceable excerpt, Avenli abstains instead of selecting an option.

## 1:48–2:12 — Durable human control

The workflow can pause for a clarification, survive a reload and resume the same saved run. The Overview keeps the goal, constraints, unknowns and activity visible. Proposed tasks remain editable and do not execute automatically.

## 2:12–2:35 — Safe external action

Services are optional in Settings. For Google Calendar, Avenli first shows the exact title, time and description. Creating the event requires a separate approval. The write is idempotent, creates no attendees or invitations and leaves an audit record.

## 2:35–2:55 — Close

The architecture keeps the browser, authenticated server, durable Supabase state, model and research providers, and external writes behind clear boundaries. Avenli uses open-model reasoning to produce an evidence-aware plan while keeping the person in control of every real-world action. Give it a problem. Get it solved.

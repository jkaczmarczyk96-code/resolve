# RESOLVE

## Kompletní implementační plán

**Produktová věta:**
**Give it a problem. Get it solved.**

---

# 1. Vize produktu

Vytvoř webovou aplikaci **Resolve**, která funguje jako osobní AI agent pro řešení komplexních problémů.

Resolve není chatbot.

Uživatel nemá AI říkat jednotlivé kroky. Popíše problém, situaci nebo požadovaný výsledek přirozeným jazykem a Resolve samostatně:

1. pochopí požadovaný výsledek,
2. identifikuje cíl,
3. identifikuje omezení,
4. rozpozná známé informace,
5. identifikuje neznámé informace,
6. rozhodne, které informace musí získat od uživatele,
7. vytvoří plán,
8. provede potřebný research,
9. ověří důležité informace,
10. vytvoří varianty řešení,
11. kriticky zhodnotí vlastní návrhy,
12. vybere doporučené řešení,
13. identifikuje rizika,
14. vytvoří konkrétní úkoly,
15. uchová historii svého rozhodování,
16. může čekat na budoucí událost nebo podmínku,
17. později může po explicitním souhlasu provádět určité akce.

Primárním objektem aplikace je:

**Problem Workspace**

nikoliv chat.

---

# 2. Základní princip

Resolve musí být agent zaměřený na **výsledek**, nikoliv pouze na odpověď.

Příklad:

> My flight was cancelled. I need to be in Tokyo tomorrow before 14:00 and I can't spend more than €600.

Resolve nemá pouze odpovědět seznamem možností.

Má vytvořit živý problém:

```text
GOAL
Arrive in Tokyo before 14:00 tomorrow

CONSTRAINTS
• Budget ≤ €600
• Arrival before 14:00
• Starting location: Prague

UNKNOWNS
• Vienna connection availability
• Current train availability
• Baggage requirements

PLAN
✓ Understand constraints
✓ Research alternatives
→ Verify availability
○ Compare solutions
○ Critique solutions
○ Select recommendation
○ Create action plan

CURRENT PRIORITY
Verify Prague → Vienna connection

CONFIDENCE
Medium

RISKS
⚠ Short transfer time
⚠ Price may change

RECOMMENDATION
Pending verification
```

---

# 3. Hackathon

Projekt je připravován pro **Nebius x NVIDIA Global AI Hackathon**.

Nebius a NVIDIA model nesmí být pouze povinnou kosmetickou integrací.

AI infrastruktura musí být základní součástí produktu.

Použij:

* Nebius Token Factory / Nebius AI Cloud,
* minimálně jeden vhodný NVIDIA open-source model dostupný přes Nebius,
* případně různé modely podle náročnosti jednotlivých agentních úloh.

Modely nesmí být hardcoded napříč aplikací.

Vytvoř provider/model abstraction.

Model musí být možné změnit pomocí konfigurace/environment variables.

---

# 4. Technologický stack

Preferovaný stack:

* Next.js 16+
* App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide Icons
* Supabase
* PostgreSQL
* Supabase Auth
* Zod
* Nebius AI API
* web research provider, například Tavily
* Vercel

Používej aktuální stabilní verze kompatibilních knihoven.

API keys nikdy neposílej klientovi.

---

# 5. Architektonické principy

Od začátku odděluj:

* UI,
* autentizaci,
* database access,
* business logic,
* AI provider,
* AI agents,
* orchestration,
* research,
* integrations,
* actions,
* notifications.

Core Resolve nesmí být pevně navázaný na konkrétní UI.

Backend navrhuj tak, aby jej v budoucnu mohl používat další klient.

To ale **neznamená implementovat mobilní aplikaci nyní**.

---

# 6. Uživatelské účty

Resolve je multi-user aplikace.

Každý uživatel musí mít vlastní účet.

Použij **Supabase Auth**.

Povinné:

* registrace,
* e-mail + heslo,
* potvrzení e-mailu podle konfigurace,
* login,
* logout,
* forgot password,
* reset password,
* persistent session,
* server-side route protection,
* základní profil,
* bezpečné RLS.

---

# 7. Auth routes

Veřejné:

```text
/login
/register
/forgot-password
/reset-password
/auth/callback
```

Privátní:

```text
/dashboard
/problems
/problems/new
/problems/[id]
/notifications
/settings
```

Nepřihlášený uživatel nesmí získat přístup k osobním datům.

---

# 8. Registrace

Formulář:

* email
* password
* confirm password
* volitelně display name

Validuj:

* email,
* minimální sílu hesla,
* shodu hesel.

Pokud je aktivní email verification, zobraz správný mezistav.

---

# 9. Login

Obsah:

* email,
* password,
* show/hide password,
* Forgot password?,
* Create account.

Po úspěšném loginu:

```text
/dashboard
```

Pokud uživatel před loginem otevřel konkrétní protected URL, podporuj bezpečný návrat na tuto URL.

---

# 10. Password recovery

Implementuj kompletní flow:

```text
Forgot password
       ↓
Enter email
       ↓
Recovery email
       ↓
Secure recovery callback
       ↓
New password
       ↓
Password changed
```

Odpověď na zadání e-mailu nesmí prozrazovat existenci účtu.

Ošetři:

* expirovaný token,
* neplatný token,
* chybějící session,
* opakovaný link.

---

# 11. Profiles

Vytvoř tabulku:

## profiles

* id
* display_name
* avatar_url
* timezone
* preferred_language
* created_at
* updated_at

`id` odpovídá `auth.users.id`.

E-mail považuj primárně za součást Supabase Auth.

---

# 12. Datový model Resolve

Vytvoř Supabase migrace.

## problems

* id
* user_id
* title
* original_input
* status
* goal
* summary
* progress
* confidence
* current_priority
* created_at
* updated_at
* solved_at

Status například:

* analyzing
* planning
* researching
* verifying
* evaluating
* action_required
* waiting
* monitoring
* solved
* failed

---

## constraints

* id
* problem_id
* type
* description
* value
* is_hard_constraint
* source
* created_at

---

## unknowns

* id
* problem_id
* description
* importance
* status
* resolution
* confidence
* created_at
* resolved_at

Status:

* unresolved
* researching
* needs_user
* resolved

---

## plan_steps

* id
* problem_id
* title
* description
* status
* sequence
* assigned_agent
* depends_on
* created_at
* completed_at

---

## research_items

* id
* problem_id
* plan_step_id
* title
* claim
* summary
* source_url
* source_name
* source_date
* confidence
* verified
* created_at

---

## options

* id
* problem_id
* title
* description
* advantages
* disadvantages
* estimated_cost
* score
* rejected
* rejection_reason
* created_at

---

## decisions

* id
* problem_id
* title
* decision
* reasoning
* confidence
* assumptions
* created_at

---

## tasks

* id
* problem_id
* title
* description
* status
* priority
* due_at
* created_at
* completed_at

---

## risks

* id
* problem_id
* title
* description
* severity
* probability
* mitigation
* created_at

---

## agent_runs

* id
* problem_id
* agent_type
* status
* input
* output
* model
* tokens
* duration_ms
* error
* created_at

Citlivé interní reasoning informace neukládej.

---

# 13. RLS

RLS je povinné.

Uživatel A nesmí získat data uživatele B ani přímým API požadavkem.

Primární pravidlo:

```text
problems.user_id = auth.uid()
```

U child tabulek ověř vlastnictví přes příslušný problem.

Otestuj SELECT, INSERT, UPDATE a DELETE policies.

---

# 14. New Problem

Hlavní input:

**What do you need to solve?**

Pomocný text:

**Describe the outcome you need, not the steps.**

CTA:

**Resolve it**

Pod inputem mohou být demo scénáře.

Po vytvoření problému přesměruj uživatele na jeho workspace.

---

# 15. Problem Workspace

Workspace nesmí vypadat jako chat.

Obsah:

## Header

* title
* status
* progress
* confidence

## Goal

Požadovaný výsledek.

## Current Priority

Co Resolve aktuálně řeší.

## Constraints

Tvrdá a měkká omezení.

## Unknowns

Co ještě není známo.

## Plan

Jednotlivé kroky.

## Agent Activity

Co právě jednotlivé části systému provádějí.

## Research

Nalezené informace.

## Evidence

Zdroje podporující rozhodnutí.

## Options

Varianty řešení.

## Recommendation

Aktuálně doporučená varianta.

## Risks

Identifikovaná rizika.

## Tasks

Akce uživatele nebo Resolve.

## Decision Trail

Historie významných rozhodnutí.

---

# 16. AI provider abstraction

Vytvoř například:

```text
lib/
  ai/
    provider.ts
    nebius.ts
    models.ts
    schemas.ts
    agents/
      intake.ts
      planner.ts
      researcher.ts
      verifier.ts
      critic.ts
      decision.ts
```

Každý agent musí mít:

* typed input,
* typed output,
* Zod schema,
* timeout,
* error handling.

---

# 17. Intake Agent

Z původního textu vytvoří strukturovaný problém.

Výstup:

* title
* goal
* constraints
* known facts
* assumptions
* unknowns
* category
* initial assessment

Nevymýšlej chybějící fakta.

---

# 18. Planner Agent

Vytvoří plán.

Určí:

* kroky,
* priority,
* dependencies,
* které kroky vyžadují research,
* které informace vyžadují uživatele.

Planner nesmí předstírat internetový research.

---

# 19. Research Agent

Research Agent řeší konkrétní otázku.

SEARCH a REASONING musí být oddělené.

Research provider získá výsledky.

Model je následně analyzuje.

Výstup musí obsahovat zdroje.

Nikdy nevytvářej neexistující URL.

---

# 20. Verifier Agent

Kontroluje důležitá tvrzení.

Posuzuje:

* počet zdrojů,
* kvalitu zdrojů,
* rozpory,
* aktuálnost,
* podporu daného tvrzení.

Může vrátit:

```text
VERIFIED
PARTIALLY VERIFIED
UNVERIFIED
CONFLICTING
```

---

# 21. Critic Agent

Critic má být skutečný oponent.

Kontroluje:

* přehlédnuté constraints,
* neověřené assumptions,
* slabé evidence,
* rizika,
* lepší alternativy,
* situace, kdy plán selže.

Critic nesmí automaticky souhlasit s Plannerem.

---

# 22. Decision Agent

Dostane:

* goal,
* constraints,
* options,
* evidence,
* verification,
* critic output,
* risks.

Vytvoří:

* recommendation,
* confidence,
* reasoning summary,
* supporting evidence,
* assumptions,
* unresolved unknowns,
* rejected alternatives.

Nezobrazuj interní chain-of-thought.

---

# 23. Orchestrator

Vytvoř centrální state machine.

Nepoužívej nekonečnou autonomous agent loop.

Základ:

```text
INPUT
  ↓
INTAKE
  ↓
CHECK MISSING INFORMATION
  ↓
PLAN
  ↓
RESEARCH
  ↓
VERIFY
  ↓
GENERATE OPTIONS
  ↓
CRITIQUE
  ↓
DECIDE
  ↓
CREATE TASKS
  ↓
COMPLETE
```

Pokud chybí kritická informace:

```text
ACTION_REQUIRED
      ↓
     USER
      ↓
    RESUME
```

Každý stav musí být persistentní.

Workflow musí přežít refresh.

---

# 24. Human in the loop

Resolve musí vědět, kdy se zastavit.

Pokud například nezná výchozí lokaci:

**Resolve needs your input**

> Where are you currently located?

Po odpovědi workflow pokračuje.

Neptej se uživatele na informace, které lze rozumně získat research nástrojem.

---

# 25. Confidence

Nevěř slepě procentu vygenerovanému LLM.

Confidence počítej z kombinace:

* kvality evidence,
* počtu zdrojů,
* shody zdrojů,
* verification statusu,
* unresolved unknowns,
* critic výsledku,
* assumptions.

Primárně zobraz:

* High
* Medium
* Low

Procento může být sekundární.

---

# 26. Decision Trail

Každé důležité rozhodnutí musí být vysvětlitelné.

Například:

```text
Take Vienna → Tokyo flight

Confidence
HIGH

WHY
✓ Arrives before deadline
✓ Within budget
✓ Baggage included

EVIDENCE
4 verified sources

ASSUMPTION
You can reach Vienna before 13:00

UNKNOWN
Current train availability

[ Resolve unknown ]
```

`Resolve unknown` spustí nový cílený research krok.

---

# 27. Agent Activity

Nezobrazuj chain-of-thought.

Zobrazuj strukturované události:

* Understanding problem
* Identified 4 constraints
* Created 6-step plan
* Researching alternatives
* Found 8 relevant sources
* Verifying information
* Comparing 3 options
* Critic identified 2 risks
* Recommendation ready

---

# 28. Persistent Problems

Problem není jednorázový prompt.

Může existovat dny nebo týdny.

Stavy:

* active
* waiting
* action_required
* monitoring
* solved

Příklad:

```text
Waiting for:
Flight price ≤ €500
```

Jakmile je podmínka splněna, Resolve může workflow obnovit.

---

# 29. Notifications

Implementuj interní notifikační systém.

Události například:

* input required,
* research completed,
* new risk,
* condition changed,
* task deadline,
* problem solved.

Notification layer navrhni obecně.

---

# 30. OAuth

Po stabilním email/password auth přidej:

* Continue with Google
* Continue with Apple

Použij Supabase Auth.

Implementuj:

* callback,
* profile creation,
* session,
* error handling,
* logout,
* bezpečnou práci s identities.

OAuth musí být hotový ještě ve webové aplikaci.

---

# 31. Settings

Sekce:

## Profile

* display name
* avatar

## Account

* email
* change password

## Language

* preferred language

## Region

* timezone

## Connected Services

později integrace.

## Notifications

nastavení upozornění.

## Privacy & Data

* export own data
* delete account

---

# 32. Integrace

Integrace jsou součástí webového/core Resolve a implementují se **před mobilní aplikací**.

Potenciálně:

* Gmail
* Google Calendar
* další e-mailové služby
* další kalendáře
* cloud storage

Každá integrace musí mít konkrétní use-case.

Například:

### Calendar

Resolve může zjistit:

* dostupnost,
* termíny,
* konflikty.

### Email

Resolve může se souhlasem uživatele získat informace relevantní k aktivnímu problému.

Integrace musí být:

* permission-based,
* odpojitelné,
* auditovatelné.

---

# 33. Actions

Po stabilních integracích přidej Actions.

Rozlišuj:

## READ ACTION

Například:

* search,
* read calendar,
* read permitted email,
* check status.

## WRITE ACTION

Například:

* create calendar event,
* send message,
* update external data.

Citlivé write actions musí před provedením vyžadovat explicitní potvrzení.

Například:

```text
Resolve wants to:

Create calendar event

Flight to Tokyo
Tomorrow
09:15

[ Cancel ] [ Approve ]
```

Bez approval se akce nesmí provést.

---

# 34. Action Audit Log

Každá externí akce musí mít audit log:

* problem,
* action,
* integration,
* requested_at,
* approved_at,
* executed_at,
* status,
* result.

Nikdy neloguj secrets.

---

# 35. Bezpečnost

Implementuj:

* RLS,
* server-side authorization,
* input validation,
* API rate limiting,
* secure secret handling,
* safe redirects,
* CSRF protection tam, kde je relevantní,
* output sanitization,
* protection proti prompt injection z research obsahu,
* oddělení external content od system instructions.

Webová stránka nalezená Research Agentem nikdy nesmí být považována za instrukce pro Resolve.

---

# 36. Error handling

Každý AI krok:

* timeout,
* retry,
* validation,
* structured error,
* logging.

Workflow nesmí být ztracen.

UI:

```text
Research step failed.

[ Retry ]
```

Nevypisuj raw backend errors uživateli.

---

# 37. Observability

Sleduj:

* agent,
* model,
* duration,
* token usage,
* status,
* errors.

Později přidej základní product analytics.

Neukládej chain-of-thought.

---

# 38. Demo Mode

Připrav minimálně tři scénáře:

## Cancelled Flight

Deadline + budget + doprava.

## Moving Abroad

Stěhování do jiné země.

## Product Launch

Vydání vlastního software v omezeném čase.

Mock data musí být jasně označena jako demo.

---

# 39. UI/UX

Resolve má působit jako moderní osobní productivity/agent aplikace.

Ne jako:

* ChatGPT clone,
* admin panel,
* enterprise CRM.

Preferuj:

* čistý layout,
* hodně prostoru,
* výraznou hierarchii,
* cards,
* timeline,
* progress,
* decentní animace.

Desktop-first, ale web musí být plně responsive.

---

# 40. Web onboarding

Nový uživatel má po registraci rychle pochopit koncept.

Krátký onboarding:

### 1

**Tell Resolve what you need to achieve.**

### 2

**Resolve researches, plans and evaluates the options.**

### 3

**You stay in control.**

Poté:

**Create your first problem**

---

# 41. Web Polish

Před označením webu za dokončený implementuj:

* responsive design,
* accessibility,
* loading states,
* skeletons,
* empty states,
* errors,
* onboarding,
* retry flows,
* performance optimalizaci,
* rate limiting,
* monitoring,
* analytics,
* security review,
* privacy UX.

---

# 42. Testování

Implementuj:

## Unit tests

Pro:

* schemas,
* confidence,
* state transitions,
* permissions,
* helper functions.

## Integration tests

Pro:

* Supabase,
* AI provider,
* research,
* orchestrator.

## E2E

Minimálně:

```text
Register
→ Verify/Login
→ Create Problem
→ Agent workflow
→ User input
→ Resume
→ Recommendation
→ Solve
```

Dále:

```text
Forgot password
→ Recovery
→ New password
→ Login
```

A OAuth flow.

---

# 43. Hackathon příprava

Před dalším rozšiřováním musí být připraven:

* stabilní production deployment,
* public repository podle pravidel soutěže,
* README,
* architecture diagram,
* setup instructions,
* environment example,
* screenshots,
* demo data,
* demo scénář,
* krátké demo video,
* jasné vysvětlení použití Nebius,
* jasné vysvětlení použití NVIDIA modelu.

Demo musí ukazovat skutečnou agentní hodnotu, ne pouze UI.

---

# 44. Implementační roadmapa

## FÁZE 1 — Foundation

* Next.js
* TypeScript
* Tailwind
* shadcn/ui
* Supabase
* migrations
* RLS
* základní struktura projektu

---

## FÁZE 2 — Authentication

* profiles
* register
* email verification
* login
* logout
* forgot password
* reset password
* sessions
* protected routes

---

## FÁZE 3 — Web UI Skeleton

S mock daty:

* Dashboard
* Problems
* New Problem
* Workspace
* Plan
* Research
* Evidence
* Decisions
* Risks
* Tasks
* Decision Trail
* Settings

---

## FÁZE 4 — AI Foundation

* Nebius provider
* NVIDIA model
* schemas
* Intake
* Planner
* Researcher
* Verifier
* Critic
* Decision

Testuj agenty jednotlivě.

---

## FÁZE 5 — Basic Orchestrator

Nejdříve:

```text
INTAKE
→ PLAN
→ DECIDE
```

Ověř celý flow.

---

## FÁZE 6 — Full Orchestrator

Rozšiř:

```text
INTAKE
→ PLAN
→ RESEARCH
→ VERIFY
→ OPTIONS
→ CRITIQUE
→ DECIDE
→ TASKS
```

---

## FÁZE 7 — Live Workspace

Propoj workflow s UI.

Implementuj:

* live state,
* progress,
* activity,
* research,
* decisions,
* risks,
* tasks,
* retry.

---

## FÁZE 8 — Human in the Loop

* unknowns,
* action_required,
* user response,
* workflow resume.

---

## FÁZE 9 — Research Quality

* sources,
* verification,
* source quality,
* conflicting evidence,
* stale data,
* confidence.

---

## FÁZE 10 — Persistent Agent

* waiting,
* monitoring,
* resumable workflows,
* conditions.

---

## FÁZE 11 — Notifications

* in-app notifications,
* notification preferences,
* event abstraction.

---

## FÁZE 12 — Account Completion

* Google OAuth
* Apple OAuth
* profile management
* change password
* export data
* delete account.

---

## FÁZE 13 — Integrations

Implementuj vhodné externí služby.

Například:

* Gmail
* Google Calendar
* cloud services.

---

## FÁZE 14 — Actions

* read actions,
* write actions,
* approval system,
* audit log.

---

## FÁZE 15 — Web Completion

Dokonči:

* onboarding,
* responsive UI,
* accessibility,
* performance,
* security,
* error handling,
* analytics,
* monitoring,
* production polish.

---

## FÁZE 16 — Testing & Hardening

* unit tests,
* integration tests,
* E2E,
* auth tests,
* RLS tests,
* security tests,
* agent failure tests,
* prompt injection tests,
* production build.

---

## FÁZE 17 — Hackathon Release

* deployment,
* README,
* documentation,
* architecture,
* demo scenarios,
* screenshots,
* demo video,
* Devpost submission.

---

# 45. MOBILNÍ APLIKACE — AŽ PO DOKONČENÍ VŠEHO VÝŠE

**Vývoj mobilní aplikace je poslední část projektu.**

Do dokončení Fází 1–17:

**NEVYTVÁŘEJ:**

* React Native projekt,
* Expo projekt,
* iOS aplikaci,
* Android aplikaci,
* mobilní UI,
* mobilní autentizaci,
* mobile deep links,
* push notifications pro iOS/Android,
* Share Sheet,
* camera integration,
* location integration,
* mobile offline storage,
* mobile background tasks,
* App Store konfiguraci,
* Google Play konfiguraci.

Backend pouze navrhuj platformně nezávisle.

---

# FÁZE 18 — Mobile Architecture Review

Až po dokončení webové aplikace proveď audit Resolve Core.

Zkontroluj, že:

* business logic není závislá na React UI,
* AI orchestration je server-side,
* integrace jsou server-side,
* Problem API lze bezpečně použít z jiného klienta,
* authentication architecture podporuje mobilní klient,
* notifications mají společnou abstraction,
* actions používají společné API.

Teprve potom vytvoř mobilní projekt.

---

# FÁZE 19 — Mobile Foundation

Použij:

* React Native,
* Expo,
* TypeScript.

Jeden projekt pro:

* iOS,
* Android.

Mobilní aplikace používá existující Resolve Core.

Nevytvářej druhý backend.

---

# FÁZE 20 — Mobile Authentication

Implementuj:

* register,
* login,
* logout,
* forgot password,
* reset password,
* Google login,
* Apple login,
* secure session storage,
* deep-link auth callbacks.

Stejný účet musí fungovat na webu, iOS i Androidu.

---

# FÁZE 21 — Mobile Core

Implementuj mobile-first:

## Home

* Ask Resolve
* Needs your attention
* Active Problems
* Recent Problems

## Problems

Seznam problémů.

## Problem

* status
* progress
* current priority
* recommendation
* tasks
* unknowns
* risks
* activity

## Activity

Důležité události.

## Profile

Account/settings.

Mobilní UI nesmí být pouze zmenšený desktop.

---

# FÁZE 22 — Mobile Notifications

Teprve nyní implementuj:

* iOS push notifications,
* Android push notifications,
* device registration,
* notification deep links.

Příklady:

```text
Resolve needs your input.
```

```text
A condition affecting your plan has changed.
```

```text
Resolve found a solution.
```

---

# FÁZE 23 — Share to Resolve

Implementuj systémové sdílení.

Uživatel může do Resolve sdílet:

* URL,
* text,
* screenshot,
* obrázek,
* PDF,
* dokument.

Flow:

```text
SHARE
  ↓
RESOLVE
  ↓
Existing Problem / New Problem
  ↓
Analyze
  ↓
Evaluate impact
  ↓
Update Problem
```

---

# FÁZE 24 — Mobile Device Integrations

Teprve zde implementuj integrace specifické pro telefon:

* camera,
* photo library,
* files,
* location,
* contacts, pokud vznikne skutečný use-case,
* mobile calendar access, pokud je potřeba.

Vždy permission-based.

---

# FÁZE 25 — Voice

Přidej voice input.

Například:

> Resolve, my flight has just been cancelled and I need to be in London tomorrow morning.

Voice je input metoda.

Resolve se nesmí změnit na voice-chat aplikaci.

---

# FÁZE 26 — Mobile Offline

Implementuj bezpečnou offline cache pro:

* problems,
* tasks,
* recommendations,
* plan,
* důležité evidence.

Serverové AI funkce nesmí předstírat funkčnost offline.

---

# FÁZE 27 — Mobile Background Features

Až nyní řeš:

* background synchronization,
* background refresh,
* notification handling,
* deep linking,
* pending uploads.

Respektuj omezení iOS a Androidu.

---

# FÁZE 28 — Mobile Polish

Dokonči:

* animations,
* loading,
* errors,
* accessibility,
* platform-specific UX,
* performance,
* permissions UX,
* biometrics, pokud je vhodné.

---

# FÁZE 29 — Mobile Testing

Otestuj:

* iOS,
* Android,
* auth,
* OAuth,
* password recovery,
* deep links,
* notifications,
* uploads,
* Share to Resolve,
* offline/online transitions,
* integrations,
* actions.

---

# FÁZE 30 — Mobile Release

Až úplně nakonec řeš:

* production builds,
* signing,
* App Store,
* Google Play,
* store metadata,
* screenshots,
* privacy declarations,
* release testing.

---

# 46. Absolutní pravidlo pro mobilní vývoj

**Codex nesmí začít vytvářet ani implementovat žádnou část mobilní aplikace před dokončením webové aplikace, Resolve Core, AI systému, persistent agent systému, účtů, OAuth, integrací, actions, web polish, testování a hackathon release.**

Předchozí fáze mohou být architektonicky připravené na dalšího klienta.

To však není důvod začít implementovat mobilní aplikaci.

Pořadí je:

```text
RESOLVE CORE
     ↓
WEB APPLICATION
     ↓
AI AGENTS
     ↓
ORCHESTRATION
     ↓
PERSISTENCE
     ↓
ACCOUNTS + OAUTH
     ↓
INTEGRATIONS
     ↓
ACTIONS
     ↓
WEB POLISH
     ↓
TESTING
     ↓
HACKATHON RELEASE
     ↓
────────────────────
     ↓
MOBILE DEVELOPMENT
     ↓
iOS + ANDROID
     ↓
MOBILE INTEGRATIONS
     ↓
MOBILE POLISH
     ↓
APP STORE + GOOGLE PLAY
```

Mobilní aplikace je **rozšíření hotového Resolve**, nikoliv součást vývoje jeho základního MVP.

---

# 47. Pravidla pro Codex

Pracuj postupně.

Nikdy neimplementuj několik velkých fází současně.

Po každé fázi:

1. zkontroluj git diff,
2. spusť lint,
3. spusť TypeScript typecheck,
4. spusť relevantní testy,
5. spusť production build,
6. oprav nalezené chyby,
7. ověř funkčnost změny,
8. shrň provedené změny.

Teprve poté pokračuj další fází na explicitní pokyn uživatele.

Nevytvářej placeholder funkce a neoznačuj je jako hotové.

Nevyměňuj funkční architekturu bez důvodu.

Nepoužívej `any`, pokud existuje rozumná typed alternativa.

Veškeré AI structured outputs validuj.

Nikdy:

* nevystavuj secrets klientovi,
* nevypisuj chain-of-thought,
* nevymýšlej research zdroje,
* neobcházej RLS,
* neprováděj citlivou externí akci bez souhlasu uživatele.

---

# 48. AKTUÁLNÍ ÚKOL PRO CODEX

Celý tento dokument představuje architektonický a produktový plán projektu.

**Nyní implementuj pouze FÁZI 1 — Foundation.**

Nezačínej další fáze.

Postup:

1. Prozkoumej repository.
2. Zkontroluj existující soubory, dependencies a git status.
3. Pokud projekt již existuje, zachovej funkční části.
4. Připrav Next.js + TypeScript základ.
5. Nakonfiguruj Tailwind a shadcn/ui.
6. Připrav Supabase klienty pro browser/server.
7. Připrav strukturu databázových migrací.
8. Vytvoř základní databázové schéma Resolve.
9. Implementuj RLS policies.
10. Připrav základní application layout.
11. Připrav route strukturu potřebnou pro další fázi.
12. Připrav `.env.example` bez skutečných secrets.
13. Aktualizuj README o lokální spuštění.
14. Spusť lint.
15. Spusť typecheck.
16. Spusť production build.
17. Oprav všechny nalezené chyby.
18. Zkontroluj výsledný git diff.
19. Shrň:

    * co bylo vytvořeno,
    * které soubory byly změněny,
    * jaké databázové migrace vznikly,
    * výsledky lint/typecheck/build,
    * co bude následovat ve Fázi 2.

**Po dokončení se zastav.**

Neimplementuj Authentication, AI, research, orchestrator, integrace ani mobilní aplikaci, dokud k tomu nedostaneš další explicitní pokyn.

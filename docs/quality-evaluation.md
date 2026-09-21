# Live workflow quality evaluation

The release checks prove that Avenli is safe, typed and durable. This separate opt-in evaluation checks whether a real end-to-end recommendation is useful and adequately supported. It runs the complete eight-agent workflow in memory with the configured NVIDIA model on Nebius Token Factory and live Tavily retrieval, so Docker and Supabase are not required.

```powershell
npm run test:quality:live
```

The three scenarios cover official developer documentation, a current product comparison and a cautious cross-border research task. Each result receives a deterministic 100-point report covering:

- completion of every workflow state;
- coverage of multiple decision-critical research questions;
- canonical, independently published sources;
- claim-by-claim verification and at least one supported claim;
- primary-source use, alternatives and adversarial critique;
- source-safe decision evidence and conservative confidence;
- actionable tasks with valid plan and option references.

A scenario must score at least 75 and must always pass the completion, assessment-integrity, citation-integrity, confidence and task-reference gates. The command makes up to 24 model calls and nine Tavily searches, incurs provider usage and is intentionally excluded from the normal offline suite. The JSON report printed for each scenario is evidence for release review, not a claim that the underlying recommendation is objectively correct.

An agent may make one repair generation when a read-only model response fails its strict output contract. The same validated input and retrieved evidence are reused, and the replacement still has to pass schema and cross-reference integrity checks. Authentication, rate-limit, timeout, refusal, provider and cancellation errors are never retried by this mechanism.

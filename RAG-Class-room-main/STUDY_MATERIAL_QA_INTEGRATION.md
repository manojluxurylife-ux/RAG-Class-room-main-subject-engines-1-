# Integrated Study Material QA

## Workflow

1. A student uploads a textbook page and generation starts.
2. After progressive generation completes, the QA engine runs automatically.
3. The engine scores structure, teaching depth, quizzes, worked examples, language/generation hygiene, and visual readiness.
4. A score of 85% or more with no error-level finding is auto-published to the shared library.
5. Lower-scoring material remains private and appears under Admin → Material QA.
6. An administrator can re-run QA, approve manually, or reject with a reason.

## Main files

- `lib/study-material-qa.ts` — deterministic QA engine and report types.
- `lib/study-material-schema.ts` — QA report attached to each StudyMaterial.
- `lib/study-materials-store.ts` — report persistence and admin listing.
- `app/api/student/study-materials/[id]/continue-generation/route.ts` — automatic QA publication gate.
- `app/api/admin/material-qa/route.ts` — admin QA list.
- `app/api/admin/material-qa/[id]/route.ts` — re-run, approve, and reject actions.
- `app/admin/material-qa/page.tsx` — QA dashboard.
- `lib/roles.ts` — Material QA admin navigation link.

## Validation

- `npx tsc --noEmit` passes.
- `npm ci` completes.
- The Next.js production optimizer was started but did not finish within the execution environment's timeout.
- `npm audit` reported 8 dependency findings (7 moderate, 1 high) in the pre-existing dependency tree; review before production deployment.

## Important limitation

This first QA layer performs reliable structural and consistency checks. It does not independently prove every generated fact against every sentence of the textbook. A future semantic-grounding layer can compare claims against extracted textbook text using citations and an independent evaluator model.

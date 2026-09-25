Task Execution
- Tasks correspond to items in GitHub issues, executed one at a time.
- Read the full acceptance criteria and specification in `plan.md` before starting and before closing a task.
- Follow the Issue Lifecycle below from grooming through verification and closure.

Issue Lifecycle & Role Handoff
1. Grooming (PM): Formulates Goal, Acceptance Criteria (checkable), Out of Scope, and Constraints following `_docs/team/pm.md`.
2. Implementation (Engineer): Implements code and automated tests against acceptance criteria, commits regularly, and posts a comment on the open issue detailing changes following `_docs/team/software-engineer.md`.
3. Verification (QA): Evaluates code, executes test suite (`npm run test`) and type-check (`npm run build`), and posts structured `## QA: PASS` or `## QA: FAIL` comment following `_docs/team/qa-engineer.md`.
4. Resolution:
   - On QA PASS: The issue is closed (`gh issue close <number> --comment "Verified by QA"`).
   - On QA FAIL: The issue stays open and returns to the Engineer with the specific failure details to be addressed before re-submitting to QA.

Git Workflow & Branching
- Strategy: Trunk-based development on `main`. Each task commits directly to `main`.
- Commit Discipline: Commit regularly with concise, descriptive commit messages (e.g., `feat(task-1): ...`, `test(task-1): ...`).
- Remote Synchronization: Push passing commits to `origin/main` after task verification.

Architecture Guidelines
- Mock-First Strategy: Develop components and user flows using the in-memory mock service layer before connecting live Supabase/BCRA integrations.
- Contract Layer: Always ensure mock and live implementations conform to the centralized TypeScript interfaces (e.g., `PaymentGatewayInterface`).
- Concurrency & Security: Financial transactional logic (such as subasta investments) must handle overfunding protection and RLS policies.

Roles

- PM - grooms a task before anyone implements it, follows _docs/team/pm.md
- Engineer - implements one groomed task, follows _docs/team/software-engineer.md
- QA - checks the result against acceptance criteria and closes on PASS, follows _docs/team/qa-engineer.md

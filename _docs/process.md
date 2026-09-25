Task Execution
- Tasks correspond to items in GitHub issues, executed one at a time.
- Read the full acceptance criteria and specification in `plan.md` before starting and before closing a task.
- Commit regularly with concise, descriptive commit messages.

Architecture Guidelines
- Mock-First Strategy: Develop components and user flows using the in-memory mock service layer before connecting live Supabase/BCRA integrations.
- Contract Layer: Always ensure mock and live implementations conform to the centralized TypeScript interfaces (e.g., `PaymentGatewayInterface`).
- Concurrency & Security: Financial transactional logic (such as subasta investments) must handle overfunding protection and RLS policies.

Roles

- PM - grooms a task before anyone implements it, follows _docs/team/pm.md
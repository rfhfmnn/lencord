

Commands

- `npm install` - install dependencies
- `npm run dev` - start local development server
- `npm run test` - run the whole test suite (Vitest)
- `npx vitest run tests/components/HeroSimulator.test.tsx` - run a single test file
- `npm run build` - build for production and type-check

regularly commit code to git 

Rules

- Dependencies are managed in `package.json`. Do not add new packages without asking first.
- Strict TypeScript: ensure types and interfaces align with `@/types` and service layer contracts.
- Read document rules before implementing features or tests.

Documents

- `_docs/process.md` - How work is organized and task workflow guidelines.
- `_docs/testing-guidelines.md` - Before writing tests, read this guide.
- `_docs/design-system.md` - For anything touching the UI, read this guide.
- `_docs/team/pm.md` - Instructions for Product Manager role.
- `_docs/task-template.md` - Template for defining product tasks.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

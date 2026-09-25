

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
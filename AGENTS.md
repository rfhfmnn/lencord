# AGENTS.md — AI Agent Guidelines & Operating Manual

Welcome to the **Lencord** repository, a peer-to-peer (P2P) collective crowdlending platform tailored for Argentine SMEs (*PyMEs*). This document defines the architectural rules, Orchestrator workflow, specialized agent roles, available skills, engineering standards, and collaborative protocols expected of all AI agents operating on this codebase.

---

## 1. Project Mission & High-Level Architecture

The goal of **Lencord** is to connect growing Argentine small and medium-sized enterprises with investors seeking real-term yields, through an agile, transparent, and secure "all-or-nothing" crowdlending auction mechanism governed by digital loan agreements (*contratos de mutuo*) and electronic promissory notes (*pagarés digitales*).

### Core Workflows:
1. **SME Loan Application & Originacion (`/solicitar`):**
   - Multi-step wizard featuring strict Argentine tax ID (CUIT) validation using the official AFIP Módulo 11 checksum algorithm, fiscal verification, and credit file assembly.
   - Automated preliminary credit scoring integrated with the Central de Deudores (BCRA) dataset.
   - Standardized credit risk segmentation across three tiers (**Tier A**, **Tier B**, and **Tier C**).
2. **Collective Crowdlending Marketplace & Auction Engine:**
   - Real-time loan marketplace featuring dynamic funding progress bars, risk alert badges, and auction countdown timers.
   - Dual financing rate schemes: **Fixed Annual Nominal Rate (TNA)** for short-term loans (30, 60, and 90 days) and **UVA / CER + spread** for medium-term facilities (6 and 12 months).
   - Investment commitment engine with **strict overfunding prevention** (`amount_funded <= amount_requested`).
3. **Custody, Escrow, and Debt Servicing:**
   - Immutable audit trail of custodial account movements (`custody_transactions`).
   - Atomic generation of amortization schedules (`installments`) and proportional automated payouts to investors (`installment_payouts`).
4. **Legal Contracts & Regulatory Compliance:**
   - Digital issuance and electronic signing of Mutuo agreements and Promissory Notes with legal evidentiary weight under Argentine law.
   - Compliance logging with BCRA and UIF standards.
5. **Admin Operations Portal:**
   - Management and approval/rejection of KYC dossiers, credit score reviews, marketplace auction publication, and loan disbursement execution.

### Tech Stack:
- **Frontend / Framework:** Next.js 16+ (App Router), React 19+, Strict TypeScript, Tailwind CSS / Vanilla CSS tokens.
- **Backend & Database:** Supabase (PostgreSQL 15+, Row Level Security enforced on 100% of tables, atomic stored procedures / RPCs with `SECURITY DEFINER` and pessimistic locking `FOR UPDATE`, Storage buckets, Realtime channels).
- **Service Layer & Mock Architecture:** Mock-first architecture (`MockPaymentGateway`, interchangeable adapters toggled via `NEXT_PUBLIC_USE_MOCKS`).
- **Testing:** Vitest, React Testing Library (RTL), `@testing-library/user-event`, `happy-dom`.
- **Tooling & Orchestration:** Git (Trunk-based development on `main`), GitHub CLI (`gh`), ESLint 9.

---

## 2. Repository Layout

```text
lencord/
├── AGENTS.md                           # This operational manual
├── README.md                           # Human-facing project documentation
├── package.json                        # Dependencies and runtime scripts
├── tsconfig.json                       # Strict TypeScript configuration
├── vitest.config.mts                   # Vitest test runner configuration
├── _docs/                              # Project architecture, guidelines, and design tokens
│   ├── process.md                      # Issue lifecycle, role handoffs, and Orchestrator rules
│   ├── plan.md                         # Phase 1 functional and technical specification
│   ├── tasks.md                        # Phase 1 backlog and implementation checklist
│   ├── next_plan.md                    # Phase 2 expansion plan and architecture roadmap
│   ├── next_tasks.md                   # Phase 2 GitHub issues backlog
│   ├── design-system.md                # UI tokens, color palettes, and risk rating semaphores
│   ├── testing-guidelines.md           # Testing standards (UI, services, integration, and load)
│   ├── database.md                     # Data dictionary, ERD, RLS policies, RPCs, and triggers
│   └── task-template.md                # Standardized issue grooming template
├── .agent/                             # Agent definitions and specialized skills
│   ├── agents/                         # Persona definitions
│   │   ├── pm/agent.md                 # Product Manager (Task grooming & acceptance criteria)
│   │   ├── software-engineer/agent.md  # General software implementation & unit tests
│   │   ├── frontend-developer/agent.md # React 19, Next.js App Router & client state
│   │   ├── backend-developer/agent.md  # API routes, Supabase RPCs, and data security
│   │   ├── fullstack-developer/agent.md# End-to-end features spanning DB, API, and UI
│   │   ├── qa-engineer/agent.md        # Criteria verification, test execution, and PASS/FAIL verdicts
│   │   ├── debugger/agent.md           # Defect root cause analysis and targeted fixes
│   │   ├── ui-designer/agent.md        # Visual design consistency & design system compliance
│   │   ├── ai-engineer/agent.md        # AI/ML architectures and automated models
│   │   └── python-pro/agent.md         # Advanced Python tooling, analytics, and offline scripts
│   └── skills/                         # Modular capabilities
│       ├── anti-ui-slop/               # Prevents generic UI; enforces real-screen contracts and gates
│       ├── web-design-guidelines/      # Web accessibility, UX, and UI best practices audit
│       ├── design-dashboards/          # Dashboard design principles, metrics, and critiques
│       ├── grill-me/                   # Socratic pressure-testing interview for plans and specs
│       ├── svg-diagram/                # Technical SVG diagramming (no ASCII art)
│       └── caveman/                    # Ultra-terse, fluff-free communication mode
├── app/                                # Next.js App Router (pages, layouts, and API routes)
├── components/                         # Modular UI components (marketplace, wizard, simulators)
├── context/                            # Global React contexts (auth, application state)
├── services/                           # Business service layer (in-memory mocks and live Supabase clients)
├── types/                              # Centralized TypeScript domain interfaces and contracts
├── supabase/                           # SQL migrations, RLS policies, RPC functions, and seeds
├── scripts/                            # Operational CLI scripts (e.g. seed-admin.ts)
└── tests/                              # Vitest automated test suite
```

---

## 3. Agent Roles & Orchestrator Workflow

### The Orchestrator

The main session acts as the **Orchestrator**. Its exclusive responsibility is workflow coordination, state tracking, and subagent role assignment.

> [!IMPORTANT]
> **The Orchestrator NEVER writes code, creates tests, or implements features itself.** It coordinates specialized subagents (`pm`, `software-engineer`, `qa-engineer`, etc.) and enforces process discipline.

#### Issue Lifecycle:

```
          [Backlog: Open GitHub Issue]
                       │
                       ▼
               1. Grooming (PM)
          (Defines Acceptance Criteria in task-template.md)
                       │
                       ▼
            2. Engineer Assignment
       (frontend / backend / fullstack / software-engineer)
                       │
                       ▼
            3. Implementation & Tests
         (Writes code + unit tests + regular commits)
                       │
               (Leaves comment:
        "@qa-engineer ready for review")
                       │
                       ▼
              4. Verification (QA)
        (Runs Vitest + build + checks all criteria)
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
     [## QA: FAIL]           [## QA: PASS]
           │                       │
           ▼                       ▼
    Returns to Engineer        5. Closure
  (Detailed failure log)  (gh issue close)
    [Max 3 attempts]
           │
    [Circuit Breaker]
  (Escalate to Human / Debugger)
```

1. **Pick Issue:** Select the next open issue from the backlog (`gh issue list`).
2. **Grooming (PM):** The `pm` agent grooms the issue according to `_docs/task-template.md`, outlining Goal, checkable Acceptance Criteria, Out of Scope, and Constraints.
3. **Implementation (Engineer):** The Orchestrator assigns the issue to the appropriate developer (`frontend-developer`, `backend-developer`, `fullstack-developer`, or `software-engineer`). The engineer implements the solution and automated tests strictly adhering to the criteria.
4. **Handoff to QA:** When coding and local tests are finished, the engineer posts a comment on the issue: `@qa-engineer ready for review` and halts execution.
5. **Verification (QA Engineer):** The `qa-engineer` runs the test suite (`npm run test`) and type checks (`npm run build`), verifies every acceptance criterion against actual behavior, and posts a binary verdict: `## QA: PASS` or `## QA: FAIL`.
6. **Resolution:**
   - **On FAIL:** The issue stays open and returns to the engineer with the explicit failure trace to be resolved.
   - **On PASS:** The Orchestrator or QA closes the issue (`gh issue close <number> --comment "Verified by QA - all acceptance criteria passed"`).

#### Orchestrator Rules:
- **Single Tasking:** Each task corresponds to a single GitHub issue and must be completed, tested, and verified before moving to the next.
- **Mandatory Grooming:** Never skip Step 2. No code may be written without explicit acceptance criteria defined by the PM.
- **Strict Role Boundaries:**
  - The Engineer MUST NOT close the issue.
  - QA MUST NOT modify code to fix defects (only evaluates and outputs PASS/FAIL).
- **The Circuit Breaker:** If an issue receives **3 consecutive FAIL verdicts** from QA, the Orchestrator MUST pause execution, leave the issue open, and request human intervention or assign the `debugger` agent. Never loop infinitely.
- **Worktree Isolation:** For concurrent tracks or parallel execution, operate in isolated git worktrees with clean branch boundaries.

---

### Specialized Agent Personas

| Role | Persona File | Primary Mandate |
|---|---|---|
| **Orchestrator** | *Main Session / AGENTS.md* | Coordinates the task lifecycle, delegates work to specialized agents, and enforces process boundaries without writing code. |
| **Product Manager** | `.agent/agents/pm/agent.md` | Grooms issues using `_docs/task-template.md`, writes unambiguous checkable acceptance criteria, and defines out-of-scope boundaries. Never writes code. |
| **Software Engineer** | `.agent/agents/software-engineer/agent.md` | Implements groomed tasks and automated Vitest tests strictly against acceptance criteria. Commits regularly. |
| **Frontend Developer** | `.agent/agents/frontend-developer/agent.md` | Specializes in Next.js App Router, React 19, interactive widgets (e.g. HeroSimulator, loan wizard), accessibility, and UI state management. |
| **Backend Developer** | `.agent/agents/backend-developer/agent.md` | Focuses on `/app/api` endpoints, Supabase PostgreSQL schema, RLS policies, atomic RPCs, concurrency locks, and data integrity. |
| **Fullstack Developer** | `.agent/agents/fullstack-developer/agent.md` | Executes end-to-end features spanning database schema, backend services, and frontend UI components simultaneously. |
| **QA Engineer** | `.agent/agents/qa-engineer/agent.md` | Executes Vitest and build checks, tests every criterion, and posts formal `## QA: PASS` or `## QA: FAIL` verdicts. Never writes feature code. |
| **Debugger** | `.agent/agents/debugger/agent.md` | Investigates test failures, concurrency bugs, or runtime exceptions; identifies root causes and applies surgical, minimal fixes. |
| **UI Designer** | `.agent/agents/ui-designer/agent.md` | Audits visual polish, prevents design drift, ensures compliance with `_docs/design-system.md`, and refines crowdlending UX. |
| **AI Engineer** | `.agent/agents/ai-engineer/agent.md` | Architectures and optimizes AI/ML evaluations and scoring models when required in the product roadmap. |
| **Python Pro** | `.agent/agents/python-pro/agent.md` | Builds high-performance, type-safe Python scripts, data processing utilities, or offline analytics pipelines when needed. |

---

## 4. Skills Catalog & Usage Guidelines

Specialized skills reside in `.agent/skills/`. Agents must invoke them whenever relevant:

1. **`anti-ui-slop` (`.agent/skills/anti-ui-slop/SKILL.md`):**
   - *When to use:* Designing, implementing, or reviewing UI components (loan wizard, marketplace cards, investor/borrower dashboards).
   - *Purpose:* Prevents generic UI patterns, establishes design contracts grounded in real screens, and runs a mandatory pre-ship finish gate.
2. **`web-design-guidelines` (`.agent/skills/web-design-guidelines/SKILL.md`):**
   - *When to use:* Auditing frontend code for accessibility (a11y), responsive breakpoints, and modern web UI guidelines.
3. **`design-dashboards` (`.agent/skills/design-dashboards/SKILL.md`):**
   - *When to use:* Designing, critiquing, or specifying financial dashboards, operational monitors, or investment portfolio tracking views.
4. **`grill-me` (`.agent/skills/grill-me/SKILL.md`):**
   - *When to use:* Before embarking on complex or high-risk features. Launches an interactive, socratic interview to stress-test architectural decisions.
5. **`svg-diagram` (`.agent/skills/svg-diagram/SKILL.md`):**
   - *When to use:* Generating technical diagrams, architecture charts, or database ERDs in clean, valid SVG format (never use ASCII art).
6. **`caveman` (`.agent/skills/caveman/SKILL.md`):**
   - *When to use:* Triggered on demand (`/caveman`) when the user requests ultra-terse, zero-fluff, technically dense responses.

---

## 5. Architectural Rules & Engineering Principles

### 1. Mock-First Strategy & Contract Layer
- Lencord uses an abstracted service layer with an in-memory mock implementation (`MockPaymentGateway`, mock loan service, mock credit scoring) switchable via the `NEXT_PUBLIC_USE_MOCKS` environment variable.
- **Rule:** UI components must NEVER import or bind directly to Supabase client calls. All data operations must flow through typed service contracts defined in `@/types`. Both mock and live implementations must satisfy the exact same TypeScript interface.

### 2. Financial Integrity & Overfunding Prevention
- Transactional financial operations (auction bids, escrow allocations, disbursement triggers, and installment payouts) **must be atomic**.
- **Rule:** Database operations must use Supabase stored procedures (`SECURITY DEFINER`) with pessimistic locking (`FOR UPDATE`) to enforce that total committed funds never exceed the requested principal (`amount_funded <= amount_requested`).
- Client-side validations are purely for user experience; the database is the authoritative barrier against race conditions.

### 3. Database Security & RLS Discipline
- **Rule:** 100% of tables in the `public` schema and all Supabase Storage buckets **must have Row Level Security (RLS) enabled**.
- **Credential Safety:** The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is restricted to server-side admin CLI scripts. It must **NEVER** be leaked, imported, or referenced in client-side bundles (`'use client'`).

### 4. CUIT Validation Standard (AFIP Módulo 11)
- Every Argentine tax ID (CUIT/CUIL) submitted via the loan application wizard or user profile must be validated using the official **AFIP Módulo 11 checksum algorithm**.
- Validation must be performed client-side for immediate feedback and re-enforced in API route validations and stored procedures.

### 5. Design System & Anti-Drift Guardrails (`_docs/design-system.md`)
- **Typography:** `Plus Jakarta Sans` for titles and body text. Monospaced font (`font-mono` / `tabular-nums`) for CUITs, CBUs/CVUs, transaction IDs, monetary amounts, and percentages.
- **Color Tokens:** Deep Navy (`#0A2540` / `#1E40AF`) for primary CTAs and brand identity; light neutrals (`#F8FAFC`, `#FFFFFF`) for backgrounds and cards.
- **Risk Rating Semaphores (Official Badges):**
  - **Tier A:** Background `#D1FAE5`, Text `#065F46` (Soft Emerald).
  - **Tier B:** Background `#FEF3C7`, Text `#92400E` (Soft Amber).
  - **Tier C:** Background `#FFEDD5`, Text `#9A3412` (Soft Terracotta).

### 6. Dependency Discipline
- **Strict Rule:** Agents MUST NOT add new dependencies to `package.json` (`npm install <package>`) without prior explicit human approval.

### 7. Anti-Loop Protocol
- If a test or build fails more than **3 consecutive times** during an attempt to fix it, the agent MUST stop, commit their current working progress, and escalate to the `debugger` agent or request human intervention.

---

## 6. Definition of Done (DoD)

A task or GitHub issue is considered **Done** only when:
1. **Criteria Met:** Every acceptance criterion specified in the groomed issue is implemented.
2. **Automated Tests Passing:** Unit and integration tests are written in Vitest (`npm run test`) and pass completely.
3. **TypeScript & Build Clean:** Type checking passes without errors (`npm run build`).
4. **No Regressions:** All existing test suites continue to pass cleanly.
5. **Clean Git Commits:** Code is committed using conventional commit conventions (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`).
6. **QA Verification:** The QA engineer has executed the test suite, inspected the criteria, and posted a formal `## QA: PASS` verdict.

---

## 7. Command Cheat Sheet

```bash
# Install dependencies
npm install

# Start Next.js local development server (http://localhost:3000)
npm run dev

# Run full Vitest test suite
npm run test

# Run a single test file
npx vitest run tests/components/HeroSimulator.test.tsx

# Production build and TypeScript type-checking
npm run build

# Code linting
npm run lint

# Provision admin role in database (CLI)
npm run seed:admin -- admin@lencord.ar

# GitHub Issues & Workflow Management
gh issue list
gh issue view <issue-number>
gh issue comment <issue-number> --body "@qa-engineer ready for review"
gh issue close <issue-number> --comment "Verified by QA - all acceptance criteria passed"
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


Framework & Tools
- Runner: Vitest
- Testing Utilities: React Testing Library (RTL) & `@testing-library/user-event`
- DOM Environment: happy-dom / jsdom

Test Categories & Strategy

1. Component & UI Unit Tests (`/tests/components`)
- Test interactive widgets like the Hero Simulator (Loan vs. Investment calculations, TNA vs. CER).
- Validate multi-step SME application forms (`/solicitar`) including CUIT validation, character limits, and non-negative amounts.
- Test marketplace cards (funding progress bars, risk badges, countdown timers).

2. Service Layer & Mock Tests (`/tests/services`)
- Validate in-memory mock backend services (`MockPaymentGateway`, loan service, credit scoring).
- Verify pattern adapter switching (`NEXT_PUBLIC_USE_MOCKS`).

3. Business Logic & Edge Cases
- Overfunding Prevention: Verify that investments exceeding remaining auction capacity are rejected (`amount_funded <= amount_requested`).
- Deadline Routines: Test `/api/cron/check-deadlines` logic for cancelling expired loans or triggering disbursements.

4. Integration Journeys (`/tests/integration`)
- Test complete user journeys: SME loan application $\rightarrow$ Admin review/scoring $\rightarrow$ Marketplace publication $\rightarrow$ Investment commitments $\rightarrow$ Digital promissory note signature flow.

Testing Rules
- Mock external HTTP calls (BCRA API, BaaS Webhooks) using MSW or service layer abstractions.
- Never hardcode dynamic dates; mock system time when testing funding deadlines or installment payment schedules.
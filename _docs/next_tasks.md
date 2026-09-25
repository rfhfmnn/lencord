# Backlog de Tareas - Lencord (next_tasks.md)

## [1. Project Initialization and Smoke Test Suite](https://github.com/rfhfmnn/lencord/issues/24)
Goal: Establish and verify a clean Next.js project configuration with strict TypeScript and a passing automated test runner.
Description: Verify that the Next.js workspace compiles with strict TypeScript rules, valid linting, and working test infrastructure using Vitest. Configure an automated smoke test verifying that the test runner executes and passes without errors. Ensure the testing environment and mock configurations are ready for incremental feature development.

## [2. Supabase Environment Configuration and Database Schema Migration](https://github.com/rfhfmnn/lencord/issues/25)
Goal: Apply database migrations and verify connectivity to the Supabase PostgreSQL database.
Description: Configure environment variables for the Supabase project URL and API keys in `.env.local`. Apply all SQL migrations from `supabase/migrations/` creating tables for profiles, credit profiles, loans, investments, installments, contracts, and notifications with RLS policies and stored procedures. Verify successful connection and schema existence with an automated integration test.

## [3. Supabase Storage Bucket Setup and Document Security Policies](https://github.com/rfhfmnn/lencord/issues/26)
Goal: Create and configure the private storage bucket for loan documentation with RLS policies.
Description: Create the `loan-documents` private bucket in Supabase Storage with strict file type (PDF only) and size (10 MB maximum) restrictions. Implement storage security policies allowing only the authenticated borrower who uploaded a file to read and write in their directory, and users with role `'admin'` to download and inspect. Add an automated test or verification script validating that unauthenticated public requests are rejected with a 403 status.

## [4. Dedicated User Registration Page with Role Selection](https://github.com/rfhfmnn/lencord/issues/27)
Goal: Implement the `/registro` page allowing users to register as either an SME borrower or an investor.
Description: Build the `/registro` route with a dual-tab selector for SME (company name, Argentine CUIT with checksum validation, representative contact details) and Investor (full name, tax ID, email, password). Integrate the form submission with Supabase Auth (`signUp`) and create the corresponding record in the `profiles` table with the selected role. Display inline validation, error messages, and a confirmation state prompting the user to verify their email.

## [5. Dedicated Login Page with Role-Aware Redirection](https://github.com/rfhfmnn/lencord/issues/28)
Goal: Implement the `/login` page with secure session authentication and return URL support.
Description: Build the `/login` route allowing users to authenticate using email and password via Supabase Auth (`signInWithPassword`). Support a `redirect` query parameter to return users to their intended destination (such as `/solicitar`) after successful sign in. Display clear feedback for invalid credentials and provide a functional password recovery request link.

## [6. Sticky Navigation Header Session State and User Actions](https://github.com/rfhfmnn/lencord/issues/29)
Goal: Update the persistent Header component to reflect authentication status, user role, and session actions.
Description: Connect the Header to the Supabase authentication session state to render dynamic navigation items based on whether a user is logged in. When unauthenticated, display "Iniciar sesión" linking to `/login` and "Registrarse" linking to `/registro`. When authenticated, display the user's name, their role badge (PyME or Inversor), an illustrative balance placeholder, a link to their dashboard, and a logout button that terminates the session.

## [7. Next.js Session Middleware and Route Protection](https://github.com/rfhfmnn/lencord/issues/30)
Goal: Implement Next.js middleware to enforce authentication and role-based access control across private routes.
Description: Create `middleware.ts` using `@supabase/ssr` to refresh session cookies and inspect user authentication for protected paths. Enforce that `/solicitar` requires an authenticated user with role `'borrower'`, redirecting unauthenticated users to `/login?redirect=/solicitar`. Ensure `/admin` is strictly accessible only to users whose profile record contains role `'admin'`, and route unauthenticated users away from `/dashboard/*`.

## [8. Initial Administrator Provisioning Script](https://github.com/rfhfmnn/lencord/issues/31)
Goal: Create a secure administrative CLI script to assign the admin role to a designated user account.
Description: Implement an executable Node/TypeScript script (`npm run seed:admin`) that uses the Supabase service role key to elevate a target user's profile to role `'admin'`. Verify that the script operates directly on the database level and cannot be triggered from client-side public requests. Document the command and ensure it securely validates the existence of the user before updating their privileges.

## [9. Service Layer Supabase Activation and Client Provider Context](https://github.com/rfhfmnn/lencord/issues/32)
Goal: Connect live Supabase service implementations to the centralized service factory and global context.
Description: Update `services/factory.ts` to instantiate `SupabaseLoanService`, `SupabaseInvestmentService`, and `SupabaseLegalService` when live services are enabled. Wrap the root application layout in `ServiceProvider` so that all pages and client components share a unified service container. Add unit and integration tests confirming that service calls correctly target Supabase when `NEXT_PUBLIC_USE_MOCKS="false"`.

## [10. SME Loan Application Pre-population and Authenticated Submission](https://github.com/rfhfmnn/lencord/issues/33)
Goal: Connect the `/solicitar` wizard to the authenticated borrower's profile and save applications to the database.
Description: Update `LoanWizard.tsx` and step components to read the logged-in user's profile, automatically pre-populating company name, CUIT, and contact email. Ensure that the submission payload records the authenticated user's ID as `borrower_id` and persists the new loan with status `'in_review'` directly to the Supabase `loans` table. Verify that the created loan persists across browser reloads and redirects to the confirmation receipt.

## [11. Secure PDF Document Upload Integration in Loan Wizard](https://github.com/rfhfmnn/lencord/issues/34)
Goal: Connect Step 3 of the loan wizard to Supabase Storage for secure PDF uploads of balance sheets and F.931 forms.
Description: Implement file upload handlers in `StepDocumentUpload.tsx` that validate MIME type (`application/pdf`) and file size (under 10 MB). Upload selected files directly to the private `loan-documents` bucket under the borrower's directory using authenticated Supabase client calls. Store the resulting secure path references in the loan payload so authorized administrators can generate signed download URLs.

## [12. Admin Console Real-Time Application Queue](https://github.com/rfhfmnn/lencord/issues/35)
Goal: Wire the `/admin` console to query and display pending SME loan applications from the Supabase database.
Description: Update `AdminConsole.tsx` to fetch all loans with status `'in_review'` directly from `SupabaseLoanService` instead of mock in-memory seed data. Display comprehensive company information, requested amounts, chosen terms, and timestamps in the pending review list. Implement real-time subscription or polling so new submissions appear immediately on the administrator dashboard.

## [13. Admin Console Document Viewer with Signed URLs](https://github.com/rfhfmnn/lencord/issues/36)
Goal: Implement secure authenticated document preview and download links for administrators in `/admin`.
Description: Add a document review panel in `AdminConsole.tsx` that generates temporary signed URLs (15-minute expiration) from Supabase Storage for uploaded balance sheets and F.931 files. Render visual indicators showing whether optional financial statements were submitted and provide accessible preview/download buttons. Ensure that non-admin requests or expired tokens are unable to access the files.

## [14. Live BCRA Central de Deudores Credit Risk Scoring Integration](https://github.com/rfhfmnn/lencord/issues/37)
Goal: Connect the credit evaluation section in `/admin` to query the official BCRA API using the applicant's CUIT.
Description: Wire `BcraCreditScoringService` to the admin loan review view to query `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/{cuit}` in real time. Display the applicant's financial system debt history, reported banks, and BCRA classification situation (1 to 5). Provide graceful fallbacks and clear messaging when the applicant has no prior bank debt history.

## [15. Admin Loan Approval, Pricing, and Auction Publication](https://github.com/rfhfmnn/lencord/issues/38)
Goal: Enable administrators to set interest rates, platform spreads, auction deadlines, and publish loans to the marketplace.
Description: Connect the approval form in `AdminConsole.tsx` to validate and update the loan's `risk_tier` (Tier A, B, or C), `investor_rate`, `platform_spread`, and `funding_deadline`. Update the loan record status to `'funding'` in Supabase, triggering its immediate availability on the public marketplace. Provide error handling, confirmation dialogs, and a rejection flow that records an explanation note and marks the loan as `'rejected'`.

## [16. Marketplace Catalog Live Funding Display and Filters](https://github.com/rfhfmnn/lencord/issues/39)
Goal: Connect the `/marketplace` catalog to display live active auctions from Supabase with multi-criteria filtering.
Description: Update the marketplace page to fetch loans with status `'funding'` using `SupabaseLoanService`. Render interactive loan cards with real-time funding progress bars, interest rates, risk badges, and days remaining until deadline. Implement working client-side filters for risk tier, rate structure (fixed vs. CER), and loan duration ranges.

## [17. Banking-as-a-Service Sandbox Gateway and HMAC Webhook Handler](https://github.com/rfhfmnn/lencord/issues/40)
Goal: Implement the payment gateway sandbox adapter with HMAC signature verification and incoming webhook handling.
Description: Configure `BaaSPaymentGateway` to simulate fund holds, releases, and disbursements with cryptographic HMAC-SHA256 headers. Create the HTTP POST route handler `/api/webhooks/payments` that verifies incoming payload signatures against a shared secret before updating payment records. Test that valid webhooks correctly reflect status updates in the database while invalid signatures return 401 Unauthorized.

## [18. Atomic Marketplace Investment Ticket and Escrow Fund Hold](https://github.com/rfhfmnn/lencord/issues/41)
Goal: Connect the investment commitment modal to execute atomic bidding with payment gateway fund holds.
Description: Wire the investment ticket modal on `/marketplace/[id]` to `SupabaseInvestmentService.commitInvestment()`. Instruct the payment gateway to place a hold on the investor's balance and invoke the PostgreSQL stored procedure `commit_investment_atomic` with pessimistic row locking. If the investment completes 100% of the loan amount, automatically transition the loan status to `'funded'` and prevent further bids.

## [19. Electronic Promissory Note (Pagaré Digital) Generation and OTP Signing](https://github.com/rfhfmnn/lencord/issues/42)
Goal: Implement the legal contract review and simulated OTP signature interface for funded loans.
Description: Create the contract presentation view where the borrower reviews the loan agreement, installment schedule, and digital promissory note once 100% funding is achieved. Implement an OTP verification modal that validates a one-time passcode to record the digital signature in `legal_contracts`. Upon valid signature, trigger loan disbursement via the payment gateway, update loan status to `'active'`, and generate monthly records in `installments`.

## [20. Automated Auction Expiration Routine and Partial Funding Resolution](https://github.com/rfhfmnn/lencord/issues/43)
Goal: Implement a secure scheduled endpoint to process expired auctions according to the 75% funding threshold rule.
Description: Build the route handler `/api/cron/check-deadlines` protected by a bearer authorization secret to scan for loans whose funding deadline has passed. If an expired loan reached at least 75% funding, flag it for borrower partial acceptance and send an alert notification. If an expired loan failed to reach 75%, transition status to `'expired'`, trigger `releaseFunds` across all participating investments, and release the gateway holds.

## [21. SME Borrower Dashboard with Live Amortization Schedule](https://github.com/rfhfmnn/lencord/issues/44)
Goal: Build the `/dashboard/pyme` view tracking loan application review states, active auctions, and repayment schedules.
Description: Implement the borrower dashboard displaying active and past loan applications fetched from Supabase. Show live funding progress monitors for active auctions and notification alerts for required promissory note signatures. Render an amortization table for active loans displaying due dates, payment statuses, and a payment simulation button for upcoming installments.

## [22. Investor Dashboard with Portfolio Breakdown and Illustrative Custody Balance](https://github.com/rfhfmnn/lencord/issues/45)
Goal: Build the `/dashboard/inversor` view summarizing portfolio performance, cash flow calendars, and escrow balance.
Description: Create the investor dashboard displaying aggregated statistics on committed capital, interest earned, and portfolio distribution across risk tiers. Show the illustrative custody balance synchronized with the payment gateway along with mandatory regulatory disclaimers regarding third-party fund custody. Render a payment calendar showing scheduled monthly amortization installments with paid versus pending status indicators.

## [23. In-App User Notifications System](https://github.com/rfhfmnn/lencord/issues/46)
Goal: Implement in-app notification alerts for loan status changes, investment confirmations, and payment reminders.
Description: Create a notification bell component in the navigation bar backed by the `notifications` table in Supabase. Insert real-time notification records whenever an application is submitted, approved, funded, or signed, as well as when an investment is recorded. Allow users to mark notifications as read and link directly to relevant loan or dashboard views.

## [24. Transactional Email Notification Service](https://github.com/rfhfmnn/lencord/issues/47)
Goal: Integrate an automated transactional email provider for key platform milestones and regulatory notices.
Description: Configure a transactional email service (such as Resend or Supabase SMTP) with responsive branded HTML templates. Trigger automatic emails for account registration, loan submission receipt, credit approval/rejection notice, investment confirmation, and monthly installment payment alerts. Provide robust error logging so that failed email deliveries do not interrupt core database transactions.

## [25. End-to-End System Integration and Smoke Test Suite](https://github.com/rfhfmnn/lencord/issues/48)
Goal: Build comprehensive automated end-to-end integration tests validating the entire lifecycle from registration to active loan.
Description: Implement an automated integration test suite that simulates a complete user journey: borrower registration, loan application submission with document upload, admin credit review and approval, investor bidding to 100% capacity, promissory note digital signature, and installment schedule generation. Verify that all security policies, atomic constraints, and database relationships execute cleanly without race conditions or data loss.

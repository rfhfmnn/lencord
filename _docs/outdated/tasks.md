# Backlog de Tareas - Lencord

## 1. Project Initialization and Test Suite Setup
Goal: Set up an empty Next.js project with TypeScript, linting, and a working automated test runner.
Description: Initialize a clean Next.js repository configured with TypeScript, strict type checking, and ESLint. Configure Vitest or Jest with React Testing Library to support unit and component testing. Include a simple smoke test verifying that the test runner executes and passes successfully.

## 2. Global Styling, Theme Tokens, and Base UI Primitives
Goal: Establish the visual design system tokens, typography, and foundational UI components.
Description: Configure CSS styles and color tokens matching Lencord's identity, including the deep navy action palette, neutral surface tones, and Tier A/B/C risk badges. Import the Plus Jakarta Sans and monospace fonts as specified in the design guide. Create reusable base UI primitives such as buttons, badges, inputs, and card containers.

## 3. Backend Service Layer Contracts and Domain Types
Goal: Define unified TypeScript interfaces and data models for all application backend operations.
Description: Declare comprehensive TypeScript interfaces for authentication, loans, credit scoring, investments, payments, and legal documents. Ensure all operations that interact with backend data or external APIs are represented in this centralized contract layer. Document the required input parameters and return types so subsequent implementations can be developed independently.

## 4. In-Memory Mock Backend Services and Seed Data
Goal: Implement a fully functional in-memory mock service layer with realistic Argentine market seed data.
Description: Build mock classes that implement the backend service interfaces using in-memory state and configurable latency or error simulation. Populate the mock state with realistic PyME loan requests, credit profiles, and active marketplace investments. Verify that all read and write methods correctly update internal mock collections without needing an external database.

## 5. Service Provider Context and Environment Switching
Goal: Implement a dependency injection mechanism to toggle between mock and live backend implementations.
Description: Create a service factory and React context provider that exposes the backend service layer to the rest of the application. Wire the provider to inspect environment variables such as `NEXT_PUBLIC_USE_MOCKS` and instantiate either the mock services or real API clients. Ensure client components and server actions can resolve services without direct coupling to specific implementations.

## 6. Main Navigation Header and Regulatory Compliance Footer
Goal: Build the responsive sticky header navigation and compliance footer.
Description: Implement the persistent top navigation bar featuring investor and PyME action links, informational page links, and authentication buttons. Build the page footer containing regulatory disclaimers regarding Argentine financial laws, BCRA/UIF compliance notes, and institutional contact links. Ensure proper mobile responsive menus and accessible navigation landmarks.

## 7. Interactive Loan and Investment Simulator Hero Widget
Goal: Build the interactive double-sided financing and investment calculator on the landing page.
Description: Create the hero section simulator allowing users to toggle between borrower and investor modes with real-time calculation updates. Implement interactive sliders for loan amounts and terms, along with selectors for fixed TNA versus CER plus spread rate schemes. Calculate and display instant monthly installment amounts or estimated investment yields based on selected inputs.

## 8. Landing Page Trust Metrics and Informational Sections
Goal: Implement the social proof statistics, process walkthroughs, and SME financing category cards.
Description: Build the trust indicator bar displaying metrics such as funded PyMEs, historical volume, average terms, and investor yields. Create the dual-tab "Cómo funciona" guide outlining step-by-step journeys for both borrowers and investors. Add the visual grid showcasing the five core business financing categories, such as working capital and equipment acquisition.

## 9. Marketplace Loan Catalog and Multi-Criteria Filtering
Goal: Develop the marketplace loan catalog page with filtering and status indicators.
Description: Build the `/marketplace` catalog page that retrieves active loan listings from the loan service and renders them as informative cards. Include filters for risk rating tiers (Tier A, B, C), interest rate mechanisms (Fixed vs. CER), and loan duration ranges. Display key metrics on each card, including funding percentage progress bars, interest rates, and remaining days until deadline.

## 10. Loan Detail View and Investment Commitment Modal
Goal: Create the detailed loan opportunity page and investment ticket submission modal.
Description: Implement the `/marketplace/[id]` route to display comprehensive loan data, destination category, and anonymized borrower credit scores. Build an investment modal that allows users to enter an investment amount while validating against remaining auction capacity in real time. Connect the submission button to the investment service to record the commitment and update the funding progress.

## 11. SME Loan Application Wizard - Company and Project Information
Goal: Construct steps 1 and 2 of the multi-step SME loan application flow.
Description: Build the initial stages of `/solicitar` capturing legal entity information, tax ID (CUIT), business type, and representative contact details. Implement the second step allowing the borrower to configure the requested amount, desired term, preferred rate scheme, and project description. Include form validation to enforce character limits, non-negative amounts, and required contact information.

## 12. SME Loan Application Wizard - Document Upload and Banking Verification
Goal: Construct steps 3 and 4 of the loan application flow including file uploads and banking details.
Description: Build file upload interfaces for mandatory tax registration certificates (AFIP/ARCA) and optional financial statements or salary forms. Implement the final step collecting the disbursement CBU/CVU, sworn declarations of lawful funds, and acceptance of terms. Submit the finalized payload to the loan service and transition the loan application into the review state.

## 13. Investor Portfolio and Payment Schedule Dashboard
Goal: Build the investor dashboard summarizing active positions and upcoming cash flows.
Description: Create the `/dashboard/inversor` route to display aggregated statistics on committed capital, earned interest, and portfolio distribution across risk tiers. Render a payment calendar showing scheduled monthly amortization and interest installments with paid versus pending status indicators. Retrieve all portfolio metrics directly through the centralized investment and loan services.

## 14. SME Borrower Dashboard and Funding Status Monitor
Goal: Build the borrower dashboard for tracking application status and repayment obligations.
Description: Implement `/dashboard/pyme` to display the current state of submitted loan applications, including in-review, funding, and active statuses. Show a real-time progress monitor for active auctions indicating total funds pledged and time remaining before the funding deadline. Display an amortization table for active loans detailing upcoming monthly payment dates and amounts.

## 15. Admin Backoffice Console for Application Review and Scoring
Goal: Develop the administrator dashboard for evaluating SME applications and publishing auctions.
Description: Build the `/admin` view allowing authorized administrators to review submitted loan applications and inspect uploaded financial documents. Provide form controls to record BCRA credit situation scores, assign risk tiers (Tier A/B/C), define platform spread margins, and set auction deadlines. Connect the publish action to update the loan status to funding, making it visible on the public marketplace.

## 16. Electronic Promissory Note (Pagaré Digital) and Signing Flow
Goal: Implement the digital contract presentation and simulated OTP signature confirmation interface.
Description: Create the document review modal that displays the generated legal loan agreement and promissory note along with the calculated installment breakdown. Implement a two-factor OTP verification screen allowing the borrower to digitally sign and ratify the loan terms once an auction is fully funded. Update the loan contract record through the legal service and transition the loan to the funded status.

## 17. Relational Database Schema and Row Level Security Setup
Goal: Define the PostgreSQL database schema, tables, relationships, and security policies in Supabase.
Description: Create SQL migration scripts defining tables for profiles, SME credit profiles, loans, investments, installments, and legal contracts. Implement check constraints to prevent loan overfunding and foreign key relationships to guarantee data integrity. Write Supabase Row Level Security (RLS) policies ensuring strict data isolation between investors, borrowers, and administrators.

## 18. Atomic Auction Investment RPC Function
Goal: Write a database stored procedure to guarantee race-condition-free investment commitments.
Description: Create the PostgreSQL PL/pgSQL function `commit_investment_atomic` that applies pessimistic row locking (`FOR UPDATE`) on the loan record during bids. Validate that the loan is active and that the investment amount does not exceed the remaining auction capacity. Update the funded amount, transition status to funded if 100% capacity is reached, and insert the investment record within a single transaction.

## 19. Live Supabase Backend Service Implementations
Goal: Implement production service classes connecting the centralized service interfaces to Supabase.
Description: Create concrete service implementations that perform queries, inserts, and stored procedure calls against Supabase using `@supabase/ssr`. Replace simulated in-memory operations with authenticated database transactions and server actions. Ensure that these live service adapters implement the exact same TypeScript interfaces as the mock services.

## 20. BCRA Central de Deudores External API Integration
Goal: Implement an external integration to retrieve official credit risk scoring from the BCRA API.
Description: Build a server-side credit scoring adapter that queries the public BCRA Central de Deudores endpoint using a borrower's CUIT. Parse the returned debt history, situation classifications (1 to 5), and reporting financial entities into a normalized score object. Fall back gracefully to unrated status when no prior institutional debt is found, handling network timeouts and errors robustly.

## 21. Banking-as-a-Service Payment Adapter and Webhook Handlers
Goal: Implement payment gateway adapters and webhook handlers for financial fund transfers.
Description: Implement the `PaymentGatewayInterface` for real banking-as-a-service providers to handle investor fund holds, borrower disbursements, and installment collections. Create HTTP route handlers under `/api/webhooks/payments` to receive asynchronous transaction notifications from the banking provider. Update internal investment and installment records based on verified webhook signatures and payment statuses.

## 22. Automated Loan Deadline Check and Settlement Routine
Goal: Implement an automated routine to cancel expired auctions and trigger fund settlements.
Description: Create a secure route handler `/api/cron/check-deadlines` protected by authorization secret headers to scan for expired loans in funding status. For loans that fail to reach 100% before the deadline, trigger fund hold releases for all participating investors and mark investments as refunded. For fully funded loans, initiate the disbursement workflow and mark the loan status as active.

## 23. End-to-End User Journey Integration Tests
Goal: Implement automated end-to-end integration tests verifying core business flows using mock services.
Description: Write integration test suites that simulate complete user journeys across borrower application, administrative approval, and marketplace funding. Test that a borrower can submit an application, an admin can approve it, and multiple investors can commit funds until completion. Verify that the application functions seamlessly in a fully mock-driven environment without external dependencies.

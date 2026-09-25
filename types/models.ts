/**
 * Domain Models and Core Enums for Lencord P2P Platform
 * Conforms strictly to _docs/plan.md Section 6.
 */

// ---------------------------------------------------------------------------
// Enums and Unions
// ---------------------------------------------------------------------------

/**
 * Roles for platform users.
 * Matches profiles.role ENUM in plan.md Section 6.
 */
export type UserRole = 'investor' | 'sme' | 'admin';

/**
 * Platform risk categories for borrower creditworthiness.
 * Matches sme_credit_profiles.risk_tier ENUM in plan.md Section 6.
 */
export type RiskTier = 'Tier A' | 'Tier B' | 'Tier C';

/**
 * Lifecycle statuses for loan applications and active auctions.
 * Matches loans.status ENUM in plan.md Section 6.
 */
export type LoanStatus =
  | 'draft'
  | 'in_review'
  | 'funding'
  | 'funded'
  | 'active'
  | 'repaid'
  | 'cancelled';

/**
 * Financial rate schemes supported in the Argentine market.
 * Matches loans.rate_type ENUM in plan.md Section 6.
 */
export type RateType = 'TNA_FIXED' | 'CER_VARIABLE';

/**
 * Destination of loan funding for Argentine SMEs.
 * Matches loans.category ENUM in plan.md Section 6.
 */
export type LoanCategory =
  | 'working_capital'
  | 'machinery'
  | 'refinancing'
  | 'expansion'
  | 'new_sme';

/**
 * User identity verification status.
 * Matches profiles.kyc_status ENUM in plan.md Section 6.
 */
export type KycStatus = 'pending' | 'approved' | 'rejected';

/**
 * Status of individual investor commitment.
 * Matches investments.status ENUM in plan.md Section 6.
 */
export type InvestmentStatus = 'committed' | 'settled' | 'refunded';

/**
 * Status of monthly loan repayment installment.
 * Matches installments.status ENUM in plan.md Section 6.
 */
export type InstallmentStatus = 'pending' | 'paid' | 'overdue';

/**
 * Legal document classification.
 * Matches legal_contracts.document_type ENUM in plan.md Section 6.
 */
export type DocumentType = 'mutuo' | 'pagare';

/**
 * BCRA Central de Deudores credit situation scale (1 to 5, or null if no debt reported).
 * Matches sme_credit_profiles.bcra_situation in plan.md Section 6.
 */
export type BcraSituation = 1 | 2 | 3 | 4 | 5 | null;

// ---------------------------------------------------------------------------
// Domain Entities
// ---------------------------------------------------------------------------

/**
 * Platform user profile (investor, SME representative, or administrator).
 * Table: `profiles`
 */
export interface Profile {
  id: string; // UUID (references auth.users)
  role: UserRole;
  tax_id: string; // VARCHAR(11) - CUIT or CUIL, unique
  legal_name: string; // VARCHAR(255)
  phone: string; // VARCHAR(50)
  kyc_status: KycStatus;
  bank_cbu_cvu: string; // VARCHAR(22) - CBU or CVU
  created_at: string; // ISO 8601 Timestamp
}

/**
 * Credit evaluation and financial history for an SME borrower.
 * Table: `sme_credit_profiles`
 */
export interface SmeCreditProfile {
  id: string; // UUID
  profile_id: string; // Foreign Key to profiles.id
  bcra_situation: BcraSituation; // Values 1 to 5, or null if without reported debt
  risk_tier: RiskTier;
  balance_sheet_url: string | null; // Storage URL for financial statement
  f931_url: string | null; // Storage URL for payroll tax form
  scoring_notes: string | null; // Internal audit / assessment notes
  updated_at: string; // ISO 8601 Timestamp
}

/**
 * Loan application and crowdfunding auction entity.
 * Table: `loans`
 */
export interface Loan {
  id: string; // UUID
  borrower_id: string; // Foreign Key to profiles.id
  amount_requested: number; // NUMERIC(14, 2)
  amount_funded: number; // NUMERIC(14, 2), default 0.00
  term_months: number; // INT (e.g. 1, 2, 3, 6, 12)
  rate_type: RateType;
  investor_rate: number; // NUMERIC(5, 2) - Net annual rate for investors
  platform_spread: number; // NUMERIC(5, 2) - Spread retained by Lencord
  borrower_rate: number; // NUMERIC(5, 2) - Total rate paid by borrower (investor_rate + platform_spread)
  base_uva_value: number | null; // NUMERIC(10, 4) - Reference UVA value upon loan activation
  category: LoanCategory;
  status: LoanStatus;
  funding_deadline: string; // ISO 8601 Timestamp
  created_at: string; // ISO 8601 Timestamp
}

/**
 * Investment commitment made by an investor in a loan auction.
 * Table: `investments`
 */
export interface Investment {
  id: string; // UUID
  loan_id: string; // Foreign Key to loans.id
  investor_id: string; // Foreign Key to profiles.id
  amount: number; // NUMERIC(14, 2)
  status: InvestmentStatus;
  external_payment_id: string | null; // VARCHAR(100) - BaaS transaction ID
  created_at: string; // ISO 8601 Timestamp
}

/**
 * Scheduled installment repayment for an active loan.
 * Table: `installments`
 */
export interface Installment {
  id: string; // UUID
  loan_id: string; // Foreign Key to loans.id
  installment_number: number; // INT
  due_date: string; // DATE (YYYY-MM-DD or ISO 8601)
  principal_amount: number; // NUMERIC(14, 2)
  interest_borrower: number; // NUMERIC(14, 2)
  interest_investors: number; // NUMERIC(14, 2)
  interest_lencord: number; // NUMERIC(14, 2)
  uva_value_applied: number | null; // NUMERIC(10, 4) - Official UVA applied under CER
  status: InstallmentStatus;
  paid_at: string | null; // ISO 8601 Timestamp or null
}

/**
 * Executed or pending legal instruments (Mutual Agreement framework and Electronic Promissory Note).
 * Table: `legal_contracts`
 */
export interface LegalContract {
  id: string; // UUID
  loan_id: string; // Foreign Key to loans.id
  document_type: DocumentType;
  document_url: string; // Storage URL of generated PDF document
  signature_hash: string | null; // Cryptographic SHA-256 hash or OTP token
  signed_at: string | null; // ISO 8601 Timestamp or null
}

// ---------------------------------------------------------------------------
// Category Metadata and Labels
// ---------------------------------------------------------------------------

export const LOAN_CATEGORY_LABELS: Record<LoanCategory, string> = {
  working_capital: 'Capital de trabajo',
  machinery: 'Maquinaria y equipamiento',
  refinancing: 'Refinanciación de pasivos',
  expansion: 'Expansión comercial',
  new_sme: 'Emprender / nuevas PyMEs',
};

export const RISK_TIER_CONFIG = {
  'Tier A': {
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
    label: 'Tier A',
    description: 'Bajo riesgo - Máxima solvencia',
  },
  'Tier B': {
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
    label: 'Tier B',
    description: 'Riesgo moderado - Solvencia estándar',
  },
  'Tier C': {
    badgeBg: '#FFEDD5',
    badgeText: '#9A3412',
    label: 'Tier C',
    description: 'Mayor rendimiento - Requiere evaluación',
  },
} as const;

/**
 * Seed data for Lencord In-Memory Mock Service Layer.
 * Conforms to _docs/plan.md Sections 6 and 7.
 * Pre-populated with realistic Argentine PyME loans, profiles, and credit data.
 */

import type {
  Installment,
  Investment,
  LegalContract,
  Loan,
  Profile,
  SmeCreditProfile,
} from '@/types';

// ---------------------------------------------------------------------------
// Seed Profiles (Argentine PyMEs, Investors, and Admin)
// ---------------------------------------------------------------------------

export const SEED_PROFILES: Profile[] = [
  // SME Borrowers
  {
    id: 'prof-sme-001',
    role: 'sme',
    tax_id: '30712345679',
    legal_name: 'Metalúrgica Quilmes S.R.L.',
    phone: '+54 11 4253-8899',
    kyc_status: 'approved',
    bank_cbu_cvu: '0720123488000012345678',
    created_at: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'prof-sme-002',
    role: 'sme',
    tax_id: '30718901234',
    legal_name: 'Alimentos del Valle SAS',
    phone: '+54 261 498-1122',
    kyc_status: 'approved',
    bank_cbu_cvu: '0170054320000043210987',
    created_at: '2026-02-01T14:30:00.000Z',
  },
  {
    id: 'prof-sme-003',
    role: 'sme',
    tax_id: '30654321098',
    legal_name: 'Distribuidora San Telmo S.A.',
    phone: '+54 11 4361-9000',
    kyc_status: 'approved',
    bank_cbu_cvu: '0140998810000098765432',
    created_at: '2026-02-10T09:15:00.000Z',
  },
  {
    id: 'prof-sme-004',
    role: 'sme',
    tax_id: '30715566772',
    legal_name: 'TecnoAgro Rosario SAS',
    phone: '+54 341 480-5544',
    kyc_status: 'approved',
    bank_cbu_cvu: '2850321040000011223344',
    created_at: '2026-02-20T11:00:00.000Z',
  },
  {
    id: 'prof-sme-005',
    role: 'sme',
    tax_id: '30719988771',
    legal_name: 'Café de Especialidad Palermo SAS',
    phone: '+54 11 5199-3322',
    kyc_status: 'approved',
    bank_cbu_cvu: '0000003100012345678901',
    created_at: '2026-03-01T16:45:00.000Z',
  },

  // Retail & Qualified Investors
  {
    id: 'prof-inv-001',
    role: 'investor',
    tax_id: '20301234567',
    legal_name: 'Juan Ignacio Pérez',
    phone: '+54 11 6543-2100',
    kyc_status: 'approved',
    bank_cbu_cvu: '0070123430000055667788',
    created_at: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'prof-inv-002',
    role: 'investor',
    tax_id: '30709876543',
    legal_name: 'Inversora Austral S.A.',
    phone: '+54 11 4312-7700',
    kyc_status: 'approved',
    bank_cbu_cvu: '0110599520000099887766',
    created_at: '2026-01-12T12:00:00.000Z',
  },
  {
    id: 'prof-inv-003',
    role: 'investor',
    tax_id: '27356789014',
    legal_name: 'Mariana Gómez Valenzuela',
    phone: '+54 11 4789-1100',
    kyc_status: 'approved',
    bank_cbu_cvu: '0000003100098765432109',
    created_at: '2026-02-05T15:20:00.000Z',
  },

  // Platform Admin
  {
    id: 'prof-adm-001',
    role: 'admin',
    tax_id: '20287654321',
    legal_name: 'Administración Lencord',
    phone: '+54 11 5000-0000',
    kyc_status: 'approved',
    bank_cbu_cvu: '0170000000000000000000',
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Seed SME Credit Profiles
// ---------------------------------------------------------------------------

export const SEED_CREDIT_PROFILES: SmeCreditProfile[] = [
  {
    id: 'cred-001',
    profile_id: 'prof-sme-001',
    bcra_situation: 1,
    risk_tier: 'Tier A',
    balance_sheet_url: 'https://storage.lencord.ar/documents/sme-001/balance-2025.pdf',
    f931_url: 'https://storage.lencord.ar/documents/sme-001/f931-enero2026.pdf',
    scoring_notes: 'Empresa metalúrgica con más de 15 años en el mercado. Excelente historial financiero y sin atrasos.',
    updated_at: '2026-01-16T12:00:00.000Z',
  },
  {
    id: 'cred-002',
    profile_id: 'prof-sme-002',
    bcra_situation: 2,
    risk_tier: 'Tier B',
    balance_sheet_url: 'https://storage.lencord.ar/documents/sme-002/balance-2025.pdf',
    f931_url: 'https://storage.lencord.ar/documents/sme-002/f931-enero2026.pdf',
    scoring_notes: 'Productora de alimentos con crecimiento sostenido. Situación 2 en BCRA por atraso puntual menor a 60 días ya regularizado.',
    updated_at: '2026-02-02T15:00:00.000Z',
  },
  {
    id: 'cred-003',
    profile_id: 'prof-sme-003',
    bcra_situation: 2,
    risk_tier: 'Tier B',
    balance_sheet_url: 'https://storage.lencord.ar/documents/sme-003/balance-2025.pdf',
    f931_url: null,
    scoring_notes: 'Distribuidora mayorista sin nómina salarial directa (personal tercerizado). Flujo de caja verificado por extractos bancarios.',
    updated_at: '2026-02-11T10:30:00.000Z',
  },
  {
    id: 'cred-004',
    profile_id: 'prof-sme-004',
    bcra_situation: 1,
    risk_tier: 'Tier A',
    balance_sheet_url: 'https://storage.lencord.ar/documents/sme-004/balance-2025.pdf',
    f931_url: 'https://storage.lencord.ar/documents/sme-004/f931-enero2026.pdf',
    scoring_notes: 'Agtech en expansión en Santa Fe. Contratos de exportación vigentes y ratios de liquidez superiores a la media.',
    updated_at: '2026-02-21T11:45:00.000Z',
  },
  {
    id: 'cred-005',
    profile_id: 'prof-sme-005',
    bcra_situation: null,
    risk_tier: 'Tier C',
    balance_sheet_url: null,
    f931_url: null,
    scoring_notes: 'PyME gastronómica de reciente constitución (menos de 12 meses). Sin deuda registrada en BCRA. Evaluación basada en facturación POS.',
    updated_at: '2026-03-02T17:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Seed Loans (At least 5 realistic Argentine PyME loans across categories & tiers)
// ---------------------------------------------------------------------------

export const SEED_LOANS: Loan[] = [
  // 1. Working capital - Tier A (Fixed TNA, 3 months, 50% funded)
  {
    id: 'loan-seed-001',
    borrower_id: 'prof-sme-001',
    amount_requested: 12000000,
    amount_funded: 6000000,
    term_months: 3,
    rate_type: 'TNA_FIXED',
    investor_rate: 45.0,
    platform_spread: 2.5,
    borrower_rate: 47.5,
    base_uva_value: null,
    category: 'working_capital',
    status: 'funding',
    funding_deadline: '2026-10-15T23:59:59.000Z',
    created_at: '2026-09-01T10:00:00.000Z',
  },

  // 2. Machinery - Tier B (CER / UVA variable, 12 months, 60% funded)
  {
    id: 'loan-seed-002',
    borrower_id: 'prof-sme-002',
    amount_requested: 25000000,
    amount_funded: 15000000,
    term_months: 12,
    rate_type: 'CER_VARIABLE',
    investor_rate: 14.0,
    platform_spread: 2.5,
    borrower_rate: 16.5,
    base_uva_value: 1245.5,
    category: 'machinery',
    status: 'funding',
    funding_deadline: '2026-10-20T23:59:59.000Z',
    created_at: '2026-09-05T14:00:00.000Z',
  },

  // 3. Refinancing - Tier B (Fixed TNA, 6 months, ~28% funded)
  {
    id: 'loan-seed-003',
    borrower_id: 'prof-sme-003',
    amount_requested: 18000000,
    amount_funded: 5000000,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 52.0,
    platform_spread: 3.0,
    borrower_rate: 55.0,
    base_uva_value: null,
    category: 'refinancing',
    status: 'funding',
    funding_deadline: '2026-10-10T23:59:59.000Z',
    created_at: '2026-09-08T09:00:00.000Z',
  },

  // 4. Expansion - Tier A (CER variable, 12 months, 100% funded)
  {
    id: 'loan-seed-004',
    borrower_id: 'prof-sme-004',
    amount_requested: 30000000,
    amount_funded: 30000000,
    term_months: 12,
    rate_type: 'CER_VARIABLE',
    investor_rate: 12.5,
    platform_spread: 2.0,
    borrower_rate: 14.5,
    base_uva_value: 1240.0,
    category: 'expansion',
    status: 'funded',
    funding_deadline: '2026-09-30T23:59:59.000Z',
    created_at: '2026-08-25T11:30:00.000Z',
  },

  // 5. New SME - Tier C (Fixed TNA, 6 months, 20% funded)
  {
    id: 'loan-seed-005',
    borrower_id: 'prof-sme-005',
    amount_requested: 5000000,
    amount_funded: 1000000,
    term_months: 6,
    rate_type: 'TNA_FIXED',
    investor_rate: 60.0,
    platform_spread: 4.0,
    borrower_rate: 64.0,
    base_uva_value: null,
    category: 'new_sme',
    status: 'funding',
    funding_deadline: '2026-10-25T23:59:59.000Z',
    created_at: '2026-09-12T16:00:00.000Z',
  },

  // 6. In review loan (Submitted by PyME, awaiting admin scoring/publication)
  {
    id: 'loan-seed-006',
    borrower_id: 'prof-sme-001',
    amount_requested: 8000000,
    amount_funded: 0,
    term_months: 3,
    rate_type: 'TNA_FIXED',
    investor_rate: 0,
    platform_spread: 0,
    borrower_rate: 0,
    base_uva_value: null,
    category: 'working_capital',
    status: 'in_review',
    funding_deadline: '2026-11-01T23:59:59.000Z',
    created_at: '2026-09-24T18:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Seed Investments
// ---------------------------------------------------------------------------

export const SEED_INVESTMENTS: Investment[] = [
  // Investments for Loan 1 (total $6,000,000)
  {
    id: 'inv-seed-001',
    loan_id: 'loan-seed-001',
    investor_id: 'prof-inv-001',
    amount: 4000000,
    status: 'committed',
    external_payment_id: 'hold_seed_001',
    created_at: '2026-09-02T10:15:00.000Z',
  },
  {
    id: 'inv-seed-002',
    loan_id: 'loan-seed-001',
    investor_id: 'prof-inv-002',
    amount: 2000000,
    status: 'committed',
    external_payment_id: 'hold_seed_002',
    created_at: '2026-09-03T14:30:00.000Z',
  },

  // Investments for Loan 2 (total $15,000,000)
  {
    id: 'inv-seed-003',
    loan_id: 'loan-seed-002',
    investor_id: 'prof-inv-002',
    amount: 10000000,
    status: 'committed',
    external_payment_id: 'hold_seed_003',
    created_at: '2026-09-06T11:00:00.000Z',
  },
  {
    id: 'inv-seed-004',
    loan_id: 'loan-seed-002',
    investor_id: 'prof-inv-003',
    amount: 5000000,
    status: 'committed',
    external_payment_id: 'hold_seed_004',
    created_at: '2026-09-07T16:45:00.000Z',
  },

  // Investments for Loan 3 (total $5,000,000)
  {
    id: 'inv-seed-005',
    loan_id: 'loan-seed-003',
    investor_id: 'prof-inv-001',
    amount: 5000000,
    status: 'committed',
    external_payment_id: 'hold_seed_005',
    created_at: '2026-09-09T09:20:00.000Z',
  },

  // Investments for Loan 4 (100% funded - total $30,000,000)
  {
    id: 'inv-seed-006',
    loan_id: 'loan-seed-004',
    investor_id: 'prof-inv-002',
    amount: 20000000,
    status: 'committed',
    external_payment_id: 'hold_seed_006',
    created_at: '2026-08-26T15:00:00.000Z',
  },
  {
    id: 'inv-seed-007',
    loan_id: 'loan-seed-004',
    investor_id: 'prof-inv-003',
    amount: 10000000,
    status: 'committed',
    external_payment_id: 'hold_seed_007',
    created_at: '2026-08-27T18:10:00.000Z',
  },

  // Investments for Loan 5 (total $1,000,000)
  {
    id: 'inv-seed-008',
    loan_id: 'loan-seed-005',
    investor_id: 'prof-inv-001',
    amount: 1000000,
    status: 'committed',
    external_payment_id: 'hold_seed_008',
    created_at: '2026-09-13T10:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Seed Installments (Example schedule for funded loan-seed-004)
// ---------------------------------------------------------------------------

export const SEED_INSTALLMENTS: Installment[] = [
  {
    id: 'inst-seed-001',
    loan_id: 'loan-seed-004',
    installment_number: 1,
    due_date: '2026-10-30',
    principal_amount: 2500000,
    interest_borrower: 362500,
    interest_investors: 312500,
    interest_lencord: 50000,
    uva_value_applied: 1240.0,
    status: 'pending',
    paid_at: null,
  },
  {
    id: 'inst-seed-002',
    loan_id: 'loan-seed-004',
    installment_number: 2,
    due_date: '2026-11-30',
    principal_amount: 2500000,
    interest_borrower: 332291.67,
    interest_investors: 286458.33,
    interest_lencord: 45833.34,
    uva_value_applied: null,
    status: 'pending',
    paid_at: null,
  },
];

// ---------------------------------------------------------------------------
// Seed Legal Contracts
// ---------------------------------------------------------------------------

export const SEED_CONTRACTS: LegalContract[] = [
  {
    id: 'contract-seed-001',
    loan_id: 'loan-seed-004',
    document_type: 'pagare',
    document_url: 'https://storage.lencord.ar/contracts/loan-seed-004/pagare-firmado.pdf',
    signature_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    signed_at: '2026-08-28T10:00:00.000Z',
  },
  {
    id: 'contract-seed-002',
    loan_id: 'loan-seed-004',
    document_type: 'mutuo',
    document_url: 'https://storage.lencord.ar/contracts/loan-seed-004/contrato-mutuo.pdf',
    signature_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    signed_at: '2026-08-28T10:05:00.000Z',
  },
];

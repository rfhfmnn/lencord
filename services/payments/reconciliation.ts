/**
 * Daily Settlement Reconciliation Module for Lencord BaaS Platform.
 * Compares internal platform ledger entries against official bank custody statements.
 * Enforces Argentine BCRA / CNV non-custody regulatory compliance.
 */

export interface PlatformLedgerTransaction {
  id: string;
  type: 'hold' | 'release' | 'disbursement' | 'installment_collection';
  amount: number;
  referenceId: string;
  loanId?: string;
  investorId?: string;
  borrowerId?: string;
  timestamp: string;
}

export interface BankCustodyMovement {
  movementId: string;
  type: 'credit' | 'debit';
  amount: number;
  referenceId: string;
  status: 'settled' | 'pending';
  description: string;
  timestamp: string;
}

export interface BankCustodyStatement {
  accountNumber: string;
  cbu: string;
  bankName: string;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  movements: BankCustodyMovement[];
}

export interface ReconciliationDiscrepancy {
  code: 'MISSING_IN_BANK' | 'MISSING_IN_LEDGER' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH';
  referenceId: string;
  ledgerAmount?: number;
  bankAmount?: number;
  details: string;
}

export interface ReconciliationReport {
  reconciliationDate: string;
  status: 'matched' | 'discrepancy';
  totalLedgerDebits: number;
  totalLedgerCredits: number;
  calculatedLedgerBalance: number;
  bankClosingBalance: number;
  variance: number;
  matchedTransactionsCount: number;
  discrepancies: ReconciliationDiscrepancy[];
  regulatoryCompliance: {
    compliant: boolean;
    regulatoryNote: string;
  };
}

/**
 * Executes reconciliation comparing platform ledger transactions against bank custody statement.
 */
export function reconcileDailySettlements(params: {
  date?: string;
  ledgerTransactions: PlatformLedgerTransaction[];
  bankStatement: BankCustodyStatement;
}): ReconciliationReport {
  const { date = new Date().toISOString().split('T')[0], ledgerTransactions, bankStatement } = params;

  const discrepancies: ReconciliationDiscrepancy[] = [];
  let matchedCount = 0;

  // Map bank movements by referenceId
  const bankMovementMap = new Map<string, BankCustodyMovement>();
  for (const mov of bankStatement.movements) {
    bankMovementMap.set(mov.referenceId, mov);
  }

  // Track ledger movements
  const ledgerProcessedReferences = new Set<string>();

  let totalLedgerDebits = 0;
  let totalLedgerCredits = 0;

  for (const ledgerItem of ledgerTransactions) {
    ledgerProcessedReferences.add(ledgerItem.referenceId);

    // Ledger amounts: disbursements and releases represent outflows (debits from custody),
    // while holds and collections represent inflows (credits to custody)
    if (ledgerItem.type === 'disbursement' || ledgerItem.type === 'release') {
      totalLedgerDebits += ledgerItem.amount;
    } else {
      totalLedgerCredits += ledgerItem.amount;
    }

    const bankMov = bankMovementMap.get(ledgerItem.referenceId);
    if (!bankMov) {
      discrepancies.push({
        code: 'MISSING_IN_BANK',
        referenceId: ledgerItem.referenceId,
        ledgerAmount: ledgerItem.amount,
        details: `Ledger transaction ${ledgerItem.id} (${ledgerItem.type}) not found in bank custody statement`,
      });
      continue;
    }

    if (Math.abs(bankMov.amount - ledgerItem.amount) > 0.01) {
      discrepancies.push({
        code: 'AMOUNT_MISMATCH',
        referenceId: ledgerItem.referenceId,
        ledgerAmount: ledgerItem.amount,
        bankAmount: bankMov.amount,
        details: `Amount mismatch for reference ${ledgerItem.referenceId}: ledger=$${ledgerItem.amount}, bank=$${bankMov.amount}`,
      });
      continue;
    }

    if (bankMov.status !== 'settled') {
      discrepancies.push({
        code: 'STATUS_MISMATCH',
        referenceId: ledgerItem.referenceId,
        details: `Bank movement for reference ${ledgerItem.referenceId} has pending status instead of settled`,
      });
      continue;
    }

    matchedCount++;
  }

  // Check for bank movements missing in ledger
  for (const mov of bankStatement.movements) {
    if (!ledgerProcessedReferences.has(mov.referenceId)) {
      discrepancies.push({
        code: 'MISSING_IN_LEDGER',
        referenceId: mov.referenceId,
        bankAmount: mov.amount,
        details: `Bank movement ${mov.movementId} not found in platform internal ledger`,
      });
    }
  }

  const calculatedLedgerBalance = Number(
    (bankStatement.openingBalance + totalLedgerCredits - totalLedgerDebits).toFixed(2)
  );
  const variance = Number(
    (calculatedLedgerBalance - bankStatement.closingBalance).toFixed(2)
  );

  const isMatched = discrepancies.length === 0 && Math.abs(variance) < 0.01;

  return {
    reconciliationDate: date,
    status: isMatched ? 'matched' : 'discrepancy',
    totalLedgerDebits: Number(totalLedgerDebits.toFixed(2)),
    totalLedgerCredits: Number(totalLedgerCredits.toFixed(2)),
    calculatedLedgerBalance,
    bankClosingBalance: bankStatement.closingBalance,
    variance,
    matchedTransactionsCount: matchedCount,
    discrepancies,
    regulatoryCompliance: {
      compliant: isMatched,
      regulatoryNote:
        'Conforme a las normativas del BCRA y CNV sobre intermediación financiera no autorizada, los fondos son custodiados en cuentas bancarias a la vista de terceros autorizados. La plataforma no retiene fondos propios en la cuenta de liquidación.',
    },
  };
}

/**
 * In-memory Mock Credit Scoring Service.
 * Conforms to CreditScoringInterface in _docs/plan.md Section 7 and @/types.
 * Simulates BCRA Central de Deudores inquiries and automated SME risk tier evaluations.
 */

import type {
  BcraCreditReport,
  BcraEntityDebt,
  BcraSituation,
  CreditScoringInterface,
  EvaluateCreditRiskInput,
  RiskTier,
  SmeCreditProfile,
} from '@/types';
import { defaultMockStateStore, MockStateStore } from './mockState';

export class MockCreditScoringService implements CreditScoringInterface {
  private store: MockStateStore;
  private customReports: Map<string, BcraCreditReport> = new Map();

  constructor(store: MockStateStore = defaultMockStateStore) {
    this.store = store;
  }

  /**
   * Helper to set custom simulated BCRA reports for testing specific situations.
   */
  public setCustomBcraReport(cuit: string, report: BcraCreditReport): void {
    const cleanCuit = cuit.replace(/\D/g, '');
    this.customReports.set(cleanCuit, report);
  }

  public async getBcraReport(cuit: string): Promise<BcraCreditReport> {
    const cleanCuit = cuit.replace(/\D/g, '');

    // Return custom configured report if present
    if (this.customReports.has(cleanCuit)) {
      return JSON.parse(JSON.stringify(this.customReports.get(cleanCuit)!));
    }

    // Check if CUIT belongs to a seed profile
    const profile = this.store.profiles.find(
      (p) => p.tax_id.replace(/\D/g, '') === cleanCuit
    );

    let situation: BcraSituation = 1;
    if (profile) {
      const creditProfile = this.store.creditProfiles.find(
        (cp) => cp.profile_id === profile.id
      );
      if (creditProfile && creditProfile.bcra_situation !== undefined) {
        situation = creditProfile.bcra_situation;
      }
    }

    if (situation === 2) {
      const entities: BcraEntityDebt[] = [
        {
          entityName: 'BANCO SANTANDER ARGENTINA S.A.',
          situation: 2,
          amount: 3500000,
          daysPastDue: 45,
        },
      ];
      return {
        cuit: cleanCuit,
        worstSituation: 2,
        totalDebt: 3500000,
        entities,
        isClean: false,
        statusDescription: 'Situación 2 - Con seguimiento especial (atraso 31-90 días)',
      };
    }

    if (situation === 3) {
      const entities: BcraEntityDebt[] = [
        {
          entityName: 'BANCO DE GALICIA Y BUENOS AIRES S.A.',
          situation: 3,
          amount: 7200000,
          daysPastDue: 110,
        },
      ];
      return {
        cuit: cleanCuit,
        worstSituation: 3,
        totalDebt: 7200000,
        entities,
        isClean: false,
        statusDescription: 'Situación 3 - Con problemas (atraso 91-180 días)',
      };
    }

    if (situation === null) {
      return {
        cuit: cleanCuit,
        worstSituation: null,
        totalDebt: 0,
        entities: [],
        isClean: true,
        statusDescription: 'Sin deuda registrada en el sistema financiero',
      };
    }

    // Default: Clean situation 1
    return {
      cuit: cleanCuit,
      worstSituation: 1,
      totalDebt: 0,
      entities: [],
      isClean: true,
      statusDescription: 'Situación 1 - Normal / Sin atrasos',
    };
  }

  public async evaluateCreditRisk(
    input: EvaluateCreditRiskInput
  ): Promise<SmeCreditProfile> {
    const report = await this.getBcraReport(input.taxId);

    let riskTier: RiskTier = 'Tier A';

    if (report.worstSituation === 2) {
      riskTier = 'Tier B';
    } else if (report.worstSituation !== null && report.worstSituation >= 3) {
      riskTier = 'Tier C';
    } else if (report.worstSituation === null) {
      // New borrower without financial history
      riskTier = input.hasBalanceSheet ? 'Tier B' : 'Tier C';
    } else {
      // Situation 1
      if (input.hasBalanceSheet === false && input.hasF931 === false) {
        riskTier = 'Tier B';
      } else {
        riskTier = 'Tier A';
      }
    }

    let profile = this.store.creditProfiles.find(
      (cp) => cp.profile_id === input.profileId
    );

    const now = new Date().toISOString();

    if (!profile) {
      profile = {
        id: `cred-${Math.random().toString(36).substring(2, 9)}`,
        profile_id: input.profileId,
        bcra_situation: report.worstSituation,
        risk_tier: riskTier,
        balance_sheet_url: input.hasBalanceSheet
          ? `https://storage.lencord.ar/documents/${input.profileId}/balance.pdf`
          : null,
        f931_url: input.hasF931
          ? `https://storage.lencord.ar/documents/${input.profileId}/f931.pdf`
          : null,
        scoring_notes: `Evaluación crediticia automática. Situación BCRA: ${report.worstSituation ?? 'Sin deuda'}. Asignado: ${riskTier}.`,
        updated_at: now,
      };
      this.store.creditProfiles.push(profile);
    } else {
      profile.bcra_situation = report.worstSituation;
      profile.risk_tier = riskTier;
      if (input.hasBalanceSheet !== undefined) {
        profile.balance_sheet_url = input.hasBalanceSheet
          ? `https://storage.lencord.ar/documents/${input.profileId}/balance.pdf`
          : null;
      }
      if (input.hasF931 !== undefined) {
        profile.f931_url = input.hasF931
          ? `https://storage.lencord.ar/documents/${input.profileId}/f931.pdf`
          : null;
      }
      profile.updated_at = now;
    }

    return JSON.parse(JSON.stringify(profile));
  }

  public async getCreditProfileByProfileId(
    profileId: string
  ): Promise<SmeCreditProfile | null> {
    const profile = this.store.creditProfiles.find(
      (cp) => cp.profile_id === profileId
    );
    if (!profile) return null;
    return JSON.parse(JSON.stringify(profile));
  }
}

export const defaultMockCreditScoringService = new MockCreditScoringService();

/**
 * BCRA Central de Deudores External API Integration Adapter.
 * Conforms to CreditScoringInterface in _docs/plan.md Section 7 and @/types.
 * Queries official BCRA endpoint: https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/{cuit}
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
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BcraServiceOptions {
  baseUrl?: string;
  timeoutMs?: number;
  supabaseClient?: SupabaseClient;
  customFetch?: typeof fetch;
}

export class BcraCreditScoringService implements CreditScoringInterface {
  private baseUrl: string;
  private timeoutMs: number;
  private supabaseClient?: SupabaseClient;
  private fetchFn: typeof fetch;
  private localProfiles: Map<string, SmeCreditProfile> = new Map();

  constructor(options?: BcraServiceOptions) {
    this.baseUrl =
      options?.baseUrl || 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas';
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.supabaseClient = options?.supabaseClient;
    this.fetchFn = options?.customFetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Queries the official BCRA API Central de Deudores by CUIT.
   */
  public async getBcraReport(cuit: string): Promise<BcraCreditReport> {
    const cleanCuit = cuit.replace(/\D/g, '');
    if (!cleanCuit || cleanCuit.length !== 11) {
      return this.buildCleanReport(cleanCuit, 'CUIT inválido');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `${this.baseUrl}/${cleanCuit}`;
      const response = await this.fetchFn(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Lencord-P2P/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 404: No registered debts found for this CUIT
      if (response.status === 404) {
        return this.buildCleanReport(cleanCuit, 'Sin deuda bancaria registrada / Sin calificación previa');
      }

      if (!response.ok) {
        // Fallback for 5xx or other API errors
        return this.buildCleanReport(
          cleanCuit,
          'Sin deuda bancaria registrada / Sin calificación previa (BCRA temporalmente no disponible)'
        );
      }

      const payload = await response.json();
      return this.parseBcraPayload(cleanCuit, payload);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // Timeout or network error fallback so submission is not blocked
      const isTimeout =
        (err as Error)?.name === 'AbortError' ||
        String(err).includes('abort') ||
        String(err).includes('timeout');

      const message = isTimeout
        ? 'Sin deuda bancaria registrada / Sin calificación previa (Tiempo de espera agotado con BCRA)'
        : 'Sin deuda bancaria registrada / Sin calificación previa (Servicio BCRA no disponible)';

      return this.buildCleanReport(cleanCuit, message);
    }
  }

  private buildCleanReport(cuit: string, statusDescription: string): BcraCreditReport {
    return {
      cuit,
      worstSituation: null,
      totalDebt: 0,
      entities: [],
      isClean: true,
      statusDescription,
    };
  }

  /**
   * Parses official BCRA API JSON payload and normalizes debt items.
   */
  private parseBcraPayload(cuit: string, data: any): BcraCreditReport {
    if (!data || (!data.results && !data.deudas)) {
      return this.buildCleanReport(cuit, 'Sin deuda bancaria registrada / Sin calificación previa');
    }

    const rawEntities: any[] = [];
    const results = data.results || data;

    // Handle results.periodos[0].entidades or direct entidades/deudas array
    if (Array.isArray(results.periodos) && results.periodos.length > 0) {
      // Latest period is typically index 0
      const latestPeriod = results.periodos[0];
      if (Array.isArray(latestPeriod.entidades)) {
        rawEntities.push(...latestPeriod.entidades);
      }
    } else if (Array.isArray(results.entidades)) {
      rawEntities.push(...results.entidades);
    } else if (Array.isArray(results.deudas)) {
      rawEntities.push(...results.deudas);
    }

    if (rawEntities.length === 0) {
      return this.buildCleanReport(cuit, 'Sin deuda bancaria registrada / Sin calificación previa');
    }

    const entities: BcraEntityDebt[] = [];
    let worstSituation: BcraSituation = 1;
    let totalDebt = 0;

    for (const raw of rawEntities) {
      const situationRaw = Number(raw.situacion ?? raw.situation ?? 1);
      const situation = (
        situationRaw >= 1 && situationRaw <= 5 ? situationRaw : 1
      ) as BcraSituation;

      // Monto in BCRA is typically expressed in thousands of ARS ($000) or pesos
      const amount = Number(raw.monto ?? raw.amount ?? 0) * 1000;
      const entityName = String(
        raw.entidad ?? raw.denominacionEntidad ?? raw.entityName ?? 'Entidad Financiera'
      ).trim();
      const daysPastDue = raw.diasAtraso !== undefined ? Number(raw.diasAtraso) : undefined;

      entities.push({
        entityName,
        situation,
        amount,
        daysPastDue,
      });

      totalDebt += amount;
      if (situation !== null && (worstSituation === null || situation > worstSituation)) {
        worstSituation = situation;
      }
    }

    let statusDescription = 'Situación 1 - Normal / Sin atrasos';
    if (worstSituation === 2) {
      statusDescription = 'Situación 2 - Con seguimiento especial (atraso 31-90 días)';
    } else if (worstSituation === 3) {
      statusDescription = 'Situación 3 - Con problemas (atraso 91-180 días)';
    } else if (worstSituation === 4) {
      statusDescription = 'Situación 4 - Con alto riesgo de insolvencia (atraso 181-365 días)';
    } else if (worstSituation === 5) {
      statusDescription = 'Situación 5 - Irrecuperable (atraso > 365 días)';
    }

    return {
      cuit,
      worstSituation,
      totalDebt,
      entities,
      isClean: worstSituation === 1,
      statusDescription,
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
      riskTier = input.hasBalanceSheet ? 'Tier B' : 'Tier C';
    } else {
      if (input.hasBalanceSheet === false && input.hasF931 === false) {
        riskTier = 'Tier B';
      } else {
        riskTier = 'Tier A';
      }
    }

    const now = new Date().toISOString();
    const scoringNotes = `Evaluación crediticia automática BCRA. Situación: ${
      report.worstSituation ?? 'Sin deuda registrada'
    }. Total deuda: $${report.totalDebt.toLocaleString('es-AR')}. Asignado: ${riskTier}.`;

    if (this.supabaseClient) {
      const { data: existing } = await this.supabaseClient
        .from('sme_credit_profiles')
        .select('*')
        .eq('profile_id', input.profileId)
        .maybeSingle();

      if (existing) {
        const { data: updated } = await this.supabaseClient
          .from('sme_credit_profiles')
          .update({
            bcra_situation: report.worstSituation,
            risk_tier: riskTier,
            scoring_notes: scoringNotes,
            updated_at: now,
          })
          .eq('profile_id', input.profileId)
          .select()
          .single();

        return updated as SmeCreditProfile;
      } else {
        const { data: created } = await this.supabaseClient
          .from('sme_credit_profiles')
          .insert({
            profile_id: input.profileId,
            bcra_situation: report.worstSituation,
            risk_tier: riskTier,
            balance_sheet_url: input.hasBalanceSheet
              ? `https://storage.lencord.ar/documents/${input.profileId}/balance.pdf`
              : null,
            f931_url: input.hasF931
              ? `https://storage.lencord.ar/documents/${input.profileId}/f931.pdf`
              : null,
            scoring_notes: scoringNotes,
            updated_at: now,
          })
          .select()
          .single();

        return created as SmeCreditProfile;
      }
    }

    let profile = this.localProfiles.get(input.profileId);
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
        scoring_notes: scoringNotes,
        updated_at: now,
      };
      this.localProfiles.set(input.profileId, profile);
    } else {
      profile.bcra_situation = report.worstSituation;
      profile.risk_tier = riskTier;
      profile.scoring_notes = scoringNotes;
      profile.updated_at = now;
    }

    return JSON.parse(JSON.stringify(profile));
  }

  public async getCreditProfileByProfileId(
    profileId: string
  ): Promise<SmeCreditProfile | null> {
    if (this.supabaseClient) {
      const { data } = await this.supabaseClient
        .from('sme_credit_profiles')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle();

      return data as SmeCreditProfile | null;
    }

    const profile = this.localProfiles.get(profileId);
    return profile ? JSON.parse(JSON.stringify(profile)) : null;
  }
}

/**
 * Application Database and RPC Error Mapping.
 * Sanitizes raw SQL and PostgREST errors to prevent leaking raw SQL/table structures to clients.
 */

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = 'DATABASE_ERROR', statusCode: number = 400) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Maps Supabase / PostgreSQL / PostgREST errors to safe, user-friendly ApplicationErrors.
 */
export function mapSupabaseError(error: unknown, defaultMessage = 'Error en la base de datos'): ApplicationError {
  if (!error) {
    return new ApplicationError(defaultMessage, 'UNKNOWN_ERROR', 500);
  }

  if (error instanceof ApplicationError) {
    return error;
  }

  const errObj = error as { message?: string; details?: string; hint?: string; code?: string };
  const rawMessage = errObj.message || String(error);

  // Check for business rule exceptions raised in PostgreSQL RPC or constraints
  if (rawMessage.includes('El préstamo no se encuentra en estado de fondeo')) {
    return new ApplicationError('El préstamo no se encuentra en estado de fondeo', 'INVALID_LOAN_STATUS', 400);
  }

  if (rawMessage.includes('El monto excede el cupo disponible de la subasta') || rawMessage.includes('cupo disponible')) {
    return new ApplicationError('El monto excede el cupo disponible de la subasta', 'OVERFUNDING_REJECTED', 400);
  }

  if (rawMessage.includes('Préstamo no encontrado') || rawMessage.includes('PGRST116')) {
    return new ApplicationError('Recurso no encontrado', 'NOT_FOUND', 404);
  }

  if (rawMessage.includes('check_amount_requested_positive')) {
    return new ApplicationError('El monto solicitado debe ser mayor a cero', 'INVALID_AMOUNT', 400);
  }

  if (rawMessage.includes('check_amount_funded_limit')) {
    return new ApplicationError('El monto financiado no puede superar el solicitado', 'OVERFUNDING_REJECTED', 400);
  }

  if (rawMessage.includes('check_tax_id_format')) {
    return new ApplicationError('El formato de CUIT/CUIL es inválido', 'INVALID_TAX_ID', 400);
  }

  // RLS or permission denied
  if (rawMessage.includes('row-level security') || rawMessage.includes('permission denied')) {
    return new ApplicationError('Acceso denegado al recurso solicitado', 'PERMISSION_DENIED', 403);
  }

  // Generic sanitized fallback - do not leak raw SQL / schema
  return new ApplicationError(defaultMessage, errObj.code || 'DATABASE_ERROR', 500);
}

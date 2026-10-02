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
export function mapSupabaseError(error: unknown, defaultMessage = 'No se pudo completar la operación en el servidor'): ApplicationError {
  if (!error) {
    return new ApplicationError(defaultMessage, 'UNKNOWN_ERROR', 500);
  }

  if (error instanceof ApplicationError) {
    return error;
  }

  const errObj = error as { message?: string; details?: string; hint?: string; code?: string };
  const rawMessage = errObj.message || String(error);

  // Business rule exceptions raised in PostgreSQL RPC or constraints
  if (
    rawMessage.includes('Saldo en custodia insuficiente para realizar la inversión') ||
    rawMessage.includes('Saldo en custodia insuficiente') ||
    rawMessage.includes('custodia insuficiente') ||
    rawMessage.includes('INSUFFICIENT_FUNDS')
  ) {
    return new ApplicationError(
      'Tu saldo en custodia es insuficiente para realizar esta inversión.',
      'INSUFFICIENT_CUSTODY_BALANCE',
      400
    );
  }

  if (
    rawMessage.includes('No se permite autofinanciamiento') ||
    rawMessage.includes('autofinanciamiento') ||
    rawMessage.includes('propio préstamo') ||
    rawMessage.includes('propia solicitud')
  ) {
    return new ApplicationError(
      'No podés invertir en tu propia solicitud de crédito.',
      'SELF_FUNDING_NOT_ALLOWED',
      400
    );
  }

  if (
    rawMessage.includes('El monto excede el cupo disponible de la subasta') ||
    rawMessage.includes('El monto excede el cupo disponible')
  ) {
    return new ApplicationError(
      'El monto excede el cupo disponible de la subasta.',
      'OVERFUNDING_REJECTED',
      400
    );
  }

  if (
    rawMessage.includes('cupo disponible') ||
    rawMessage.includes('cupo remanente') ||
    rawMessage.includes('check_amount_funded_limit')
  ) {
    return new ApplicationError(
      'El monto ingresado excede el cupo remanente de la subasta.',
      'OVERFUNDING_REJECTED',
      400
    );
  }

  if (
    rawMessage.includes('El préstamo no se encuentra en estado de fondeo') ||
    rawMessage.includes('no se encuentra en estado de fondeo') ||
    rawMessage.includes('INVALID_LOAN_STATUS') ||
    rawMessage.includes('no se encuentra abierta')
  ) {
    return new ApplicationError(
      'La solicitud no se encuentra en etapa de fondeo abierta.',
      'INVALID_LOAN_STATUS',
      400
    );
  }

  if (rawMessage.includes('invalid input syntax for type uuid')) {
    return new ApplicationError(
      'Identificador de usuario inválido o sesión no iniciada.',
      'INVALID_UUID_SYNTAX',
      400
    );
  }

  if (rawMessage.includes('Préstamo no encontrado') || rawMessage.includes('PGRST116')) {
    return new ApplicationError('Recurso no encontrado', 'NOT_FOUND', 404);
  }

  if (rawMessage.includes('check_amount_requested_positive') || rawMessage.includes('monto a invertir debe ser mayor a cero')) {
    return new ApplicationError('El monto ingresado debe ser mayor a cero', 'INVALID_AMOUNT', 400);
  }

  if (rawMessage.includes('check_tax_id_format') || rawMessage.includes('MISSING_TAX_ID')) {
    return new ApplicationError(
      'Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil.',
      'INVALID_TAX_ID',
      400
    );
  }

  // RLS or permission denied
  if (rawMessage.includes('row-level security') || rawMessage.includes('permission denied')) {
    return new ApplicationError('Acceso denegado al recurso solicitado', 'PERMISSION_DENIED', 403);
  }

  // Sanitized fallback without leaking SQL internals or saying opaque "Error en la base de datos"
  const sanitizedMessage =
    defaultMessage === 'Error en la base de datos'
      ? 'No se pudo completar la operación en el servidor'
      : defaultMessage;

  return new ApplicationError(sanitizedMessage, errObj.code || 'OPERATION_FAILED', 500);
}

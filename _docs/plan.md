# plan.md: Especificación técnica y funcional para Lencord MVP

## 1. Resumen ejecutivo y modelo de negocio
* **Nombre de la plataforma:** Lencord.
* **Modelo:** Plataforma peer-to-peer (P2P) de préstamos colectivos orientada a PyMEs argentinas.
* **Mecánica de fondeo:** Subasta bajo modalidad "todo o nada" con fecha límite de cierre.
* **Estructura legal:** Sociedad por Acciones Simplificada (SAS). Lencord no realiza intermediación financiera directa ni custodia depósitos de terceros según la Ley 21.526. La plataforma actúa como facilitador tecnológico y mandatario.
* **Gestión de fondos:** Procesamiento de pagos, custodia temporal y transferencias directas delegadas en una entidad de pagos / banking-as-a-service regulada (ej. Bind Pagos, Pomelo o Coelsa).
* **Monetización:** Cobro mediante spread de tasa. La tasa que abona la PyME incluye el margen de Lencord de forma implícita sobre la tasa neta que percibe el inversor (ejemplo: si el inversor percibe una TNA del 50%, la PyME abona una TNA del 52%, reteniendo Lencord el 2% en cada liquidación).
* **Instrumentación legal de cobro:** Contrato marco de mutuo digital al registrarse y emisión automática de un pagaré electrónico con firma digital / OTP al completarse la subasta, otorgando vía ejecutiva en caso de impago.

---

## 2. Decisiones de producto y mercado argentino
* **Esquemas de tasa:**
  * Corto plazo (30, 60 y 90 días): tasa nominal fija (TNA).
  * Mediano plazo (6 a 12 meses): tasa indexada por inflación (CER / UVA) más un spread fijo.
* **Scoring y evaluación crediticia:**
  * Consulta automatizada vía API a la Central de Deudores del BCRA a partir del CUIT.
  * Análisis contable y documental con opción de no presentar balances (para PyMEs unipersonales, independientes o de reciente inicio) ni F931 (si no tienen nómina salarial activa).
  * Categorización en tres niveles de riesgo visibles en la plataforma: Tier A, Tier B y Tier C.

---

## 3. Identidad visual y lineamientos de diseño
* **Tipografía:** Plus Jakarta Sans para titulares, textos y lectura numérica. Tipografía monoespaciada para hashes, CUITs y CBUs.
* **Gramática visual:** Redacción de titulares y oraciones en español estándar (tipo oración, evitando mayúsculas en cada palabra).
* **Paleta de colores:**
  * Color primario (acción): azul marino profundo (`#0A2540` / `#1E40AF`) combinado con tonos cobalto para botones de llamada a la acción y estados activos.
  * Fondo: blanco puro (`#FFFFFF`) y gris neutro claro (`#F8FAFC`).
  * Superficies y tarjetas: `#FFFFFF` con bordes sutiles en `#E2E8F0`.
  * Textos: principal en `#0F172A` y secundario en `#64748B`.
* **Semáforo de riesgo:**
  * Tier A: fondo verde tenue (`#D1FAE5`) con texto esmeralda (`#065F46`).
  * Tier B: fondo ámbar tenue (`#FEF3C7`) con texto marrón cálido (`#92400E`).
  * Tier C: fondo naranja suave (`#FFEDD5`) con texto terracota (`#9A3412`).

---

## 4. Arquitectura de frontend y navegación web

### Estructura general de navegación
* **Sticky header:**
  * Enlace independiente: "Prestar" (para inversores).
  * Enlace independiente: "Pedir financiación" (para PyMEs).
  * Enlace: "Cómo funciona".
  * Enlace: "FAQ".
  * Acciones de acceso: botón secundario "Iniciar sesión" y botón primario "Registrarse".
* **Hero section:**
  * Título: *Financiamiento colectivo sin burocracia. Retornos reales sin intermediarios.*
  * Subtítulo: *Conectamos PyMEs argentinas en crecimiento, con inversores que buscan retornos reales, sin intermediarios bancarios.*
  * Widget simulador interactivo de doble vía (toggle "Quiero financiación" / "Quiero invertir", elección entre tasa fija y CER + margen, sliders de monto y plazo, y resultado en tiempo real de cuota o ganancia estimada).
* **Trust bar:**
  * Indicadores de actividad: total de PyMEs financiadas, volumen operado histórico, plazo promedio de financiamiento y tasa promedio histórica obtenida por los inversores (últimos 6 meses).
* **Sección "Cómo funciona":**
  * Vista para PyMEs con descripciones breves:
    1. Solicitud 100% online: completá los datos de tu empresa en pocos minutos.
    2. Evaluación en 24 horas: validamos tu situación fiscal y crediticia sin demoras.
    3. Publicación en subasta: los inversores fondean tu proyecto de manera colectiva.
    4. Desembolso directo: recibí los fondos en tu cuenta bancaria al alcanzar la meta.
  * Vista para inversores con descripciones breves:
    1. Creá tu cuenta: registro ágil con verificación de identidad.
    2. Elegí oportunidades: evaluá solicitudes clasificadas por plazo, tasa y nivel de riesgo.
    3. Invertí en cuotas colectivas: participá en subastas seguras con tickets accesibles.
    4. Cobrá mes a mes: recibí las cuotas de amortización e interés directo en tu cuenta.
* **Marketplace preview:**
  * Grilla de oportunidades de inversión activas.
  * Tarjetas de crédito con badge de riesgo (Tier A/B/C), tasa ofrecida, plazo restante, barra de progreso porcentual del fondeo y días para el cierre.
* **Casos de uso ("Financiá tu empresa"):**
  * Grilla visual con soporte fotográfico descriptivo para 5 categorías:
    1. Capital de trabajo.
    2. Maquinaria y equipamiento.
    3. Refinanciación de pasivos.
    4. Expansión comercial.
    5. Emprender / nuevas PyMEs.
* **Footer y compliance regulatorio:**
  * Disclaimer legal: aclaración explícita de que Lencord es una plataforma tecnológica y no una entidad financiera autorizada por la Ley 21.526, sin captación pública de depósitos.
  * Menciones de cumplimiento normativo ante el BCRA, la UIF y esquemas de garantías (SGRs).
  * Enlace reservado para canal de soporte y WhatsApp institucional.

---

## 5. Flujos de usuario y formularios clave

### Formulario multipaso para PyMEs (`/solicitar`)
1. **Paso 1: Datos de la empresa y contacto:**
   * Razón social o nombre de fantasía.
   * CUIT de la empresa o titular.
   * Tipo societario (SAS, SA, SRL, Monotributo, Responsable Inscripto).
   * Fecha de inicio de actividades.
   * Datos de contacto del apoderado (nombre, DNI y celular).
2. **Paso 2: Proyecto y condiciones:**
   * Categoría de destino de fondos.
   * Monto solicitado en pesos.
   * Plazo pretendido (30, 60, 90 días o 6, 12 meses).
   * Tipo de tasa de preferencia (fija o CER + spread).
   * Breve descripción explicativa del proyecto (hasta 500 caracteres).
3. **Paso 3: Documentación de respaldo (subida en PDF, máx. 10 MB):**
   * Constancia de inscripción AFIP / ARCA (obligatorio).
   * Extractos bancarios de los últimos 3 meses (recomendado).
   * Balance del último ejercicio contable (opcional).
   * Formulario 931 de nómina salarial (opcional).
4. **Paso 4: Datos bancarios y conformidad:**
   * CBU o CVU para la acreditación de fondos.
   * Declaración jurada sobre licitud de fondos y veracidad de datos.
   * Aceptación de términos y condiciones marco para habilitar la firma del pagaré digital.
   * Estado resultante: `En revisión` (plazo de respuesta 24 a 48 horas hábiles).

### Tablero de inversión para prestamistas (`/marketplace`)
* Onboarding y registro autogestionado con verificación de CUIT/CUIL y CBU/CVU de retiro.
* Filtros por nivel de riesgo (Tier A, B, C), modalidad de tasa (Fija o CER) y rango de plazos.
* Selección de monto a aportar con verificación de cupo disponible hasta completar el 100% de la publicación.

---

## 6. Modelo de datos relacional (PostgreSQL / Supabase)

### Tabla `profiles`
* `id`: UUID (Primary Key, referencia a `auth.users`).
* `role`: ENUM (`'investor'`, `'sme'`, `'admin'`).
* `tax_id`: VARCHAR(11) (CUIT o CUIL, único).
* `legal_name`: VARCHAR(255).
* `phone`: VARCHAR(50).
* `kyc_status`: ENUM (`'pending'`, `'approved'`, `'rejected'`).
* `bank_cbu_cvu`: VARCHAR(22).
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `now()`).

### Tabla `sme_credit_profiles`
* `id`: UUID (Primary Key, Default `gen_random_uuid()`).
* `profile_id`: UUID (Foreign Key a `profiles.id`).
* `bcra_situation`: SMALLINT (Nullable; valores 1 a 5 o NULL para solicitantes sin deuda reportada).
* `risk_tier`: ENUM (`'Tier A'`, `'Tier B'`, `'Tier C'`).
* `balance_sheet_url`: TEXT (Nullable; ruta en storage para balance contable).
* `f931_url`: TEXT (Nullable; ruta en storage para formulario 931).
* `scoring_notes`: TEXT (Notas internas de auditoría).
* `updated_at`: TIMESTAMP WITH TIME ZONE.

### Tabla `loans`
* `id`: UUID (Primary Key, Default `gen_random_uuid()`).
* `borrower_id`: UUID (Foreign Key a `profiles.id`).
* `amount_requested`: NUMERIC(14, 2).
* `amount_funded`: NUMERIC(14, 2) (Default 0.00).
* `term_months`: INT.
* `rate_type`: ENUM (`'TNA_FIXED'`, `'CER_VARIABLE'`).
* `investor_rate`: NUMERIC(5, 2) (Tasa anual neta para el inversor).
* `platform_spread`: NUMERIC(5, 2) (Spread retenido por Lencord).
* `borrower_rate`: NUMERIC(5, 2) (Tasa final que paga la PyME: `investor_rate + platform_spread`).
* `base_uva_value`: NUMERIC(10, 4) (Nullable; cotización de referencia UVA/CER al momento de activación del préstamo).
* `category`: ENUM (`'working_capital'`, `'machinery'`, `'refinancing'`, `'expansion'`, `'new_sme'`).
* `status`: ENUM (`'draft'`, `'in_review'`, `'funding'`, `'funded'`, `'active'`, `'repaid'`, `'cancelled'`).
* `funding_deadline`: TIMESTAMP WITH TIME ZONE.
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `now()`).
* **Constraints de integridad:**
  * `CHECK (amount_funded <= amount_requested)`: previene sobre-fondeo a nivel de motor de datos ante concurrencia.

### Tabla `investments`
* `id`: UUID (Primary Key, Default `gen_random_uuid()`).
* `loan_id`: UUID (Foreign Key a `loans.id`).
* `investor_id`: UUID (Foreign Key a `profiles.id`).
* `amount`: NUMERIC(14, 2).
* `status`: ENUM (`'committed'`, `'settled'`, `'refunded'`).
* `external_payment_id`: VARCHAR(100) (Identificador de transacción en la pasarela o BaaS).
* `created_at`: TIMESTAMP WITH TIME ZONE (Default `now()`).

### Tabla `installments`
* `id`: UUID (Primary Key, Default `gen_random_uuid()`).
* `loan_id`: UUID (Foreign Key a `loans.id`).
* `installment_number`: INT.
* `due_date`: DATE.
* `principal_amount`: NUMERIC(14, 2).
* `interest_borrower`: NUMERIC(14, 2).
* `interest_investors`: NUMERIC(14, 2).
* `interest_lencord`: NUMERIC(14, 2).
* `uva_value_applied`: NUMERIC(10, 4) (Nullable; cotización UVA oficial aplicada al liquidar cuotas bajo esquema CER).
* `status`: ENUM (`'pending'`, `'paid'`, `'overdue'`).
* `paid_at`: TIMESTAMP WITH TIME ZONE (Nullable).

### Tabla `legal_contracts`
* `id`: UUID (Primary Key, Default `gen_random_uuid()`).
* `loan_id`: UUID (Foreign Key a `loans.id`).
* `document_type`: ENUM (`'mutuo'`, `'pagare'`).
* `document_url`: TEXT.
* `signature_hash`: TEXT (Hash criptográfico SHA-256 o token de firma OTP).
* `signed_at`: TIMESTAMP WITH TIME ZONE.

---

## 7. Lógica transaccional y endpoints del sistema

* **`submitLoanApplication` (Server Action):**
  * Valida datos de la solicitud y sube documentación opcional a storage privado en Supabase.
  * Llama server-side a la API pública de la Central de Deudores del BCRA (`api.bcra.gob.ar`) usando el CUIT y almacena la situación reportada (o `NULL` si no registra deuda).
  * Deja el préstamo en estado `in_review`.
* **`approveAndPublishLoan` (Server Action - Admin):**
  * Setea el tier de riesgo, el spread de Lencord y la tasa final.
  * Asigna fecha de vencimiento a la subasta (`funding_deadline`) y cambia el estado a `funding`.
* **`commitInvestment` (Server Action con RPC atómico):**
  * Ejecuta la función almacenada en PostgreSQL `commit_investment_atomic` con bloqueo de fila (`SELECT ... FOR UPDATE` sobre la fila del préstamo) para evitar condiciones de carrera (*race conditions*).
  * Verifica disponibilidad de cupo remanente (`amount_requested - amount_funded`).
  * Invoca a la interfaz de pagos (`PaymentGatewayInterface`) para retener o comprometer fondos.
  * Inserta el registro en `investments` y actualiza atómicamente `amount_funded`. Si alcanza el 100%, transiciona el préstamo a `funded` e inicia el proceso de instrumentación legal.
* **`finalizeLoanFunding` (Servicio transaccional / Cron Job):**
  * **Si la subasta alcanza el 100%:** cambia estado a `funded`, genera el pagaré digital con la tabla de cuotas calculada, solicita firma electrónica/OTP a la PyME y, tras la confirmación de firma, instruye el desembolso bancario vía BaaS y pasa a `active`. En esquemas CER, fija `base_uva_value`.
  * **Si la subasta vence (`funding_deadline < now()`) sin alcanzar el 100%:** cambia estado a `cancelled`, libera las retenciones de fondos mediante la pasarela de pagos para todos los inversores participantes y marca las inversiones como `refunded`.
* **Endpoints de fondo y tareas programadas:**
  * `GET /api/cron/check-deadlines`: endpoint programado (protegido por header `Authorization: Bearer CRON_SECRET`) que evalúa préstamos en estado `funding` con fecha límite expirada para cancelarlos y liberar fondos de forma autónoma.
* **Webhooks (`/api/webhooks/*`):**
  * `/api/webhooks/payments`: recepción de confirmaciones asíncronas de transferencias, débitos y desembolsos del proveedor BaaS.
  * `/api/webhooks/signatures`: recepción de eventos de firma exitosa de los pagarés electrónicos.

---

## 8. Arquitectura de Backend y Servicios

### 8.1. Runtime y organización del código
* **Entorno:** Next.js (Node.js runtime) con TypeScript estricto.
* **Capa de acciones y mutaciones:** Server Actions tipadas para operaciones originadas por usuarios autenticados (PyMEs, Inversores y Administradores).
* **Capa de endpoints HTTP:** Route Handlers (`app/api/*`) para Webhooks entrantes de proveedores externos y Cron Jobs con autenticación por clave compartida.
* **Capa de base de datos:** Supabase Client Server (`@supabase/ssr`) con sesión en cookies seguras (HTTP-only) y acceso a cliente administrativo con `SERVICE_ROLE_KEY` exclusivamente en contextos restringidos de backend (crons y webhooks).

### 8.2. Abstracción del proveedor de Pagos (Patrón Adaptador / Mock)
Para permitir el desarrollo y prueba integral sin depender de los plazos de homologación bancaria (BIND Pagos, Pomelo, Coelsa), se implementa un patrón adaptador:

```typescript
// Contrato agnóstico de pagos
export interface PaymentGatewayInterface {
  holdFunds(investorId: string, amount: number, loanId: string): Promise<{ holdId: string; success: boolean }>;
  releaseFunds(holdId: string): Promise<{ success: boolean }>;
  disburseLoan(loanId: string, cbuTarget: string, amount: number): Promise<{ transferId: string; success: boolean }>;
  collectInstallment(installmentId: string, cbuSource: string, amount: number): Promise<{ paymentId: string; status: 'pending' | 'settled' }>;
}
```

* **`MockPaymentGateway` (Desarrollo y demos):**
  * Simula transacciones financieras al instante en base de datos.
  * Permite inyectar fallos de prueba (fondos insuficientes, CBU inválido) y ejecutar pruebas de flujo completo (subasta -> fondeo -> desembolso -> cobro de cuotas) sin costos ni burocracia.
* **`BindPaymentGateway` / `PomeloPaymentGateway` (Producción):**
  * Implementa las llamadas reales vía HTTPS/mTLS con firmas criptográficas hacia las APIs del proveedor BaaS seleccionado.
* **Selección dinámica:** Configurable vía variable de entorno `PAYMENT_PROVIDER="mock" | "bind" | "pomelo"`.

### 8.3. Concurrencia segura en subastas (PostgreSQL RPC)
Función PL/pgSQL `commit_investment_atomic`:
```sql
-- Ejecución atómica con bloqueo a nivel de fila
CREATE OR REPLACE FUNCTION commit_investment_atomic(
  p_loan_id UUID,
  p_investor_id UUID,
  p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_loan loans%ROWTYPE;
  v_new_funded NUMERIC;
BEGIN
  -- Bloqueo pesimista de la fila del préstamo durante la transacción
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id FOR UPDATE;
  
  IF v_loan.status != 'funding' THEN
    RAISE EXCEPTION 'El préstamo no se encuentra en estado de fondeo';
  END IF;
  
  IF (v_loan.amount_funded + p_amount) > v_loan.amount_requested THEN
    RAISE EXCEPTION 'El monto excede el cupo disponible de la subasta';
  END IF;
  
  v_new_funded := v_loan.amount_funded + p_amount;
  
  UPDATE loans SET 
    amount_funded = v_new_funded,
    status = CASE WHEN v_new_funded = amount_requested THEN 'funded'::loan_status ELSE 'funding'::loan_status END
  WHERE id = p_loan_id;
  
  INSERT INTO investments (loan_id, investor_id, amount, status)
  VALUES (p_loan_id, p_investor_id, p_amount, 'committed');
  
  RETURN jsonb_build_object('success', true, 'amount_funded', v_new_funded);
END;
$$ LANGUAGE plpgsql;
```

### 8.4. Políticas de seguridad y Row Level Security (RLS)
* **Aislamiento de PyMEs:** Solo pueden consultar y modificar sus propias solicitudes. Sus documentos confidenciales (balances, F931) no son accesibles públicamente ni por otros usuarios.
* **Aislamiento de Inversores:** Solo pueden visualizar sus propias inversiones, saldos y cuotas a cobrar.
* **Marketplace público:** Los inversores y visitantes acceden a datos resumidos del préstamo y perfil crediticio anonimizado (categoría, CUIT parcialmente enmascarado, situación BCRA, Tier de riesgo, monto y plazo), sin exponer cuentas bancarias ni documentación privada.
* **Rol Administrador:** Acceso completo a revisión de solicitudes, asignación de tiers de riesgo y auditoría.
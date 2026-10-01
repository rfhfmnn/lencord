# Backlog de Tareas - Circuito de Fondos BaaS Simulado, Auditoría y Producción (`_docs/proximas_tareas.md`)

Este documento especifica el backlog integral de tareas acordadas a partir de la lluvia de ideas para implementar la experiencia de usuario y arquitectura de datos completa basada en el **Modelo BaaS (Banking as a Service / Cuentas Virtuales Segregadas) en modo Simulado (Sandbox)**, formalización de contratos con firma electrónica auditable, cobro y distribución de cuotas y gestión de saldos en custodia.

Sigue rigurosamente el formato estándar de `_docs/task-template.md` y las directivas de `_docs/team/pm.md`.

---

## 1. Arquitectura de Datos en Supabase: Ledger Transaccional, Distribución de Cuotas, Firma y RPCs Atómicos

### Goal
Implementar la infraestructura de datos en Supabase necesaria para soportar un modelo financiero auditable: libro contable de saldo en custodia (`custody_transactions`), distribución de cuotas por inversor (`installment_payouts`), metadatos de auditoría de firma electrónica en `legal_contracts`, y procedimientos almacenados (RPC) transaccionales y atómicos en PostgreSQL para el checkout de inversiones y la liquidación de cuotas.

### Acceptance criteria
- [ ] **Tabla `custody_transactions` (Libro Contable / Ledger):**
  - Campos: `id UUID`, `profile_id UUID REFERENCES profiles(id)`, `type VARCHAR(50)` ('card_deposit', 'investment_hold', 'installment_payout', 'withdrawal', 'refund'), `amount NUMERIC(14,2)`, `balance_after NUMERIC(14,2)`, `status VARCHAR(20)` ('completed', 'pending', 'failed'), `reference_id UUID NULL`, `payment_metadata JSONB NULL`, `created_at TIMESTAMPTZ`.
  - Índices en `profile_id` y `created_at DESC`.
  - Restricción: `amount > 0`.
- [ ] **Tabla `installment_payouts` (Distribución de Cuotas):**
  - Campos: `id UUID`, `installment_id UUID REFERENCES installments(id)`, `investment_id UUID REFERENCES investments(id)`, `investor_id UUID REFERENCES profiles(id)`, `principal_share NUMERIC(14,2)`, `interest_share NUMERIC(14,2)`, `total_share NUMERIC(14,2)`, `status VARCHAR(20)` ('pending', 'credited'), `paid_at TIMESTAMPTZ NULL`.
  - Restricción de unicidad: `UNIQUE(installment_id, investment_id)`.
- [ ] **Actualización de `legal_contracts` para Firma Electrónica Auditable:**
  - Se agregan columnas: `signer_id UUID REFERENCES profiles(id) NULL`, `signer_role VARCHAR(20) NULL`, `signature_hash TEXT NULL`, `signer_ip VARCHAR(45) NULL`, `signer_user_agent TEXT NULL`, `signed_at TIMESTAMPTZ NULL`.
- [ ] **Procedimiento Almacenado Atómico `process_investment_checkout_rpc`:**
  - Parámetros: `p_loan_id UUID`, `p_investor_id UUID`, `p_amount NUMERIC`, `p_payment_method TEXT`, `p_card_last_four TEXT`, `p_card_brand TEXT`.
  - Verifica cupo disponible en el préstamo y que el inversor no sea el prestatario.
  - Inserta la inversión en `investments` con estado `committed`.
  - Inserta el registro en `custody_transactions` registrando el ingreso y la afectación al préstamo.
  - Actualiza `amount_funded` y transiciona el préstamo a `funded` si se cubrió el 100%, o `funding` si es parcial.
  - Retorna JSON con estado, nuevo monto fondeado y referencias de pago.
- [ ] **Procedimiento Almacenado Atómico `process_installment_repayment_rpc`:**
  - Parámetros: `p_installment_id UUID`, `p_payer_id UUID`.
  - Verifica que la cuota exista y esté en estado `pending`.
  - Marca la cuota como `paid` registrando `paid_at = now()`.
  - Consulta todas las inversiones comprometidas en ese préstamo y calcula la cuota parte proporcional para cada inversor según: `(inversion.amount / prestamo.amount_requested) * cuota.amount_principal` e intereses.
  - Inserta una fila en `installment_payouts` por cada inversor participante.
  - Inserta un movimiento de crédito en `custody_transactions` acreditando el total de la cuota parte a favor de cada inversor.
  - Inserta una notificación en `notifications` para cada inversor informando la acreditación.
  - Si no quedan cuotas pendientes para ese préstamo, actualiza el préstamo a `repaid`.
- [ ] **Políticas Row Level Security (RLS):**
  - `custody_transactions`: Los inversores solo pueden consultar sus propios movimientos (`profile_id = auth.uid()`).
  - `installment_payouts`: Los inversores solo pueden consultar sus propios cobros (`investor_id = auth.uid()`).
  - Admins tienen acceso completo de auditoría en todas las tablas mediante `is_admin()`.

### Out of scope
- Conexión con webhooks de APIs bancarias externas de producción (Stripe, BIND, Pomelo).

### Constraints
- Crear migración en `supabase/migrations/` e integrar definiciones en `supabase/setup_cloud_schema.sql`.
- PostgreSQL estricto con transacciones ACID (`SECURITY DEFINER`).

---

## 2. Experiencia de Checkout de Inversión con Pasarela de Pagos (Tarjeta Simulado BaaS)

### Goal
Proveer una experiencia de usuario de checkout financiero fluido en el modal de inversión del Marketplace, donde el inversor pueda pagar directamente con tarjeta de débito/crédito (simulando una pasarela BaaS) o debitar de su saldo en custodia disponible, con opciones de prueba rápida (tarjeta aprobada / fondos insuficientes).

### Acceptance criteria
- [ ] **Selector de Medio de Pago en Modal de Inversión:**
  - Si el inversor tiene saldo disponible en custodia: opción de seleccionar *"Pagar con saldo en custodia ($X disponible)"*.
  - Opción destacada *"Pagar con tarjeta de débito / crédito"*.
- [ ] **Formulario de Tarjeta (BaaS Sandbox Experience):**
  - Campos: Número de tarjeta (16 dígitos con formateo y detección de marca Visa/Mastercard), Fecha de vencimiento (MM/AA), Código de seguridad (CVV de 3 dígitos) y Nombre del titular.
  - Validaciones inline (algoritmo de Luhn o longitud válida, fecha no vencida).
- [ ] **Botones de Prueba Rápida (Sandbox Helpers):**
  - Botón *"Tarjeta válida de prueba"*: autocompleta con datos válidos simulados (`4500 1234 5678 9010`, titular, vencimiento futuro) para agilizar el testing sin tipeo manual.
  - Botón *"Simular tarjeta rechazada"*: autocompleta tarjeta para probar mensaje de error bancario sin romper la UI.
- [ ] **Procesamiento y Confirmación Inmediata:**
  - Al presionar *"Confirmar inversión"*, invoca `process_investment_checkout_rpc`.
  - Muestra estado de carga accesible con indicador visual (`aria-busy="true"`).
  - En caso de éxito, despliega pantalla de recibo de inversión con: ID de transacción, últimos 4 dígitos de tarjeta, monto invertido, cuotas estimadas a cobrar y botón para ver en el panel.
  - El porcentaje fondeado del préstamo en el Marketplace se actualiza al instante.
- [ ] **Pruebas automatizadas:**
  - Suite de tests en `tests/components/InvestmentModalCheckout.test.tsx` cubriendo validaciones, autocompletado de prueba, simulación de error y éxito de inversión.

### Out of scope
- Tokenización PCI-DSS real en servidores externos.

### Constraints
- Modificar y extender `components/marketplace/InvestmentModal.tsx` o crear `components/checkout/InvestmentCheckoutModal.tsx`.
- Usar el sistema de diseño (`design-system.md`) y componentes base de `@/components/ui`.

---

## 3. Flujo de Firma Electrónica Auditable para Contratos (Mutuo y Pagaré)

### Goal
Implementar una pantalla y modal interactivo de firma electrónica para que las PyMEs (al aprobarse su préstamo) y los Inversores (al invertir o formalizar la operación) puedan previsualizar el contrato de mutuo y el pagaré, manifestar su consentimiento y rubricar electrónicamente registrando metadatos legales de auditoría (timestamp UTC, hash criptográfico, IP y user-agent).

### Acceptance criteria
- [ ] **Componente de Vista Previa Legal:**
  - Muestra un visor con el resumen estructurado de las condiciones contractuales (monto, tasa TNA pactada, plazo, sistema de amortización, partes intervinientes) y enlace al PDF almacenado en `loan-documents`.
- [ ] **Paso de Conformidad y Firma:**
  - Checkbox obligatorio: *"Declaro bajo juramento que he leído y acepto los términos del Contrato de Mutuo y las obligaciones del Pagaré Electrónico"*.
  - Botón de acción: *"Firmar electrónicamente documento"*.
- [ ] **Captura de Metadatos de Auditoría:**
  - Al confirmar la firma, el sistema calcula el Hash SHA-256 del contenido del contrato.
  - Guarda en `legal_contracts`: `signer_id`, `signer_role`, `signature_hash`, fecha y hora exacta (`signed_at`), IP simulada/detectada y agente de usuario.
- [ ] **Estado Visual de Documento Firmado:**
  - Badge institucional verde *"Firmado electrónicamente"* con fecha y hash visible de verificación para auditoría.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/ElectronicSignatureModal.test.tsx` validando previsualización, bloqueo si no se marca el consentimiento, y registro correcto de los metadatos en la base de datos.

### Out of scope
- Integración con autoridades certificantes de firma digital con token criptográfico de hardware (ONTI).

### Constraints
- Código en `components/legal/ElectronicSignatureModal.tsx` y servicios en `services/supabase/SupabaseLegalService.ts`.

---

## 4. Fondeo Completo del Préstamo, Notificación de Desembolso y Activación de Cuotas

### Goal
Cuando una subasta alcanza el 100% del monto solicitado (`amount_funded = amount_requested`), el sistema debe transicionar automáticamente el estado del crédito a fondeado (`funded`/`active`), generar el cronograma mensual de cuotas y notificar a la PyME con una confirmación simulada de desembolso bancario a su CBU.

### Acceptance criteria
- [ ] **Transición Automática y Generación de Cuotas:**
  - Al registrarse la inversión que completa el 100%:
    - El estado del préstamo cambia a `funded` y luego a `active`.
    - Se insertan en la tabla `installments` las N cuotas mensuales correspondientes al plazo pactado (`term_months`), calculadas bajo el sistema de amortización francés con desglose de capital e interés.
- [ ] **Notificación y Banner de Desembolso en Panel PyME (`/dashboard/pyme`):**
  - Se muestra tarjeta destacada: *"¡Felicitaciones! Tu crédito fue fondeado al 100%. Los fondos por $X han sido transferidos a tu cuenta CBU registrada (Banco X, CBU termina en Y)"*.
  - Se despliega el cronograma de vencimientos de cuotas con fecha de vencimiento de la primera cuota (a 30 días).
- [ ] **Notificación a los Inversores:**
  - Cada inversor participante recibe una notificación: *"La subasta de [Nombre PyME] se completó exitosamente. Tu inversión ya está activa y generando rendimientos"*.
- [ ] **Pruebas automatizadas:**
  - Tests de integración validando que al completarse el fondeo se generan las cuotas en base de datos y se renderiza el banner de desembolso en el panel de la PyME.

### Out of scope
- Ejecución de transferencias bancarias reales vía API Coelsa.

### Constraints
- Lógica en el servicio de préstamos y componentes de `components/dashboard/BorrowerDashboard.tsx`.

---

## 5. Pago de Cuotas por la PyME y Distribución Proporcional Automática a Inversores

### Goal
Permitir que la PyME abone sus cuotas mensuales desde su panel mediante un checkout simulado (tarjeta/débito en cuenta), y que el sistema procese automáticamente el prorrateo de capital e intereses entre todos los inversores participantes, acreditando el dinero directamente en su saldo en custodia.

### Acceptance criteria
- [ ] **Botón de Pago en Calendario de Cuotas de la PyME:**
  - En la tabla de cuotas de `/dashboard/pyme`, cada cuota en estado `pending` cuenta con un botón interactivo *"Pagar cuota"*.
  - Las cuotas ya pagadas muestran badge verde *"Pagada"* con fecha de cancelación.
- [ ] **Modal de Pago de Cuota:**
  - Muestra desglose del importe de la cuota: Capital, Interés compensatorio y Total a debitar.
  - Formulario de tarjeta/medio de pago simulado con botón rápido *"Simular pago exitoso"*.
- [ ] **Distribución Atómica a Inversores:**
  - Al confirmarse el pago, se ejecuta `process_installment_repayment_rpc`:
    - La cuota pasa a estado `paid`.
    - Cada inversor del préstamo recibe el crédito de su cuota parte en `custody_transactions`.
    - Se registra el registro hijo en `installment_payouts`.
- [ ] **Notificación de Cobro al Inversor:**
  - Cada inversor recibe una notificación: *"Cobro recibido: Se han acreditado $X (Capital: $A + Intereses: $B) de la cuota N de [Empresa]"*.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/InstallmentRepaymentFlow.test.tsx` verificando el pago de cuotas, el cálculo matemático del prorrateo y la acreditación a los inversores.

### Out of scope
- Cobranza extrajudicial y débito automático recurrente no solicitado.

### Constraints
- Modificar `components/dashboard/BorrowerDashboard.tsx` y servicios financieros asociados.

---

## 6. Saldo en Custodia, Historial de Movimientos y Solicitud de Retiro a CBU en Panel del Inversor

### Goal
Dotar al Panel del Inversor de una billetera de custodia completa que refleje el saldo disponible acumulado de cobros, un historial auditable de movimientos (ingresos por cuotas, colocaciones en préstamos, retiros) y un flujo interactivo para solicitar el retiro de fondos hacia su CBU bancario.

### Acceptance criteria
- [ ] **Indicador de Saldo en Custodia en Tiempo Real:**
  - En `/dashboard/inversor`: tarjeta superior destacando *"Saldo disponible en custodia: $X.XX"*, calculado dinámicamente desde el ledger `custody_transactions`.
  - Acción visible junto al saldo: botón *"Retirar fondos a mi CBU"*.
- [ ] **Historial de Movimientos Auditables:**
  - Sección *"Movimientos de cuenta"*: tabla o listado cronológico de transacciones.
  - Columnas: Fecha/Hora, Tipo (Cobro de cuota, Inversión, Retiro), Préstamo/Referencia, Importe (+ o - en color verde/neutro) y Estado.
  - Estado vacío amigable cuando el usuario aún no tiene transacciones registradas.
- [ ] **Modal de Retiro de Fondos:**
  - El inversor ingresa el monto a retirar (con validación de que no supere el saldo disponible).
  - Visualiza su cuenta bancaria de destino (CBU/CVU y Alias configurados en su perfil).
  - Al confirmar, el sistema registra una transacción tipo `withdrawal` en `custody_transactions`, debita el saldo disponible y muestra confirmación: *"Transferencia bancaria en proceso: Los fondos se acreditarán en tu cuenta bancaria"*.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/CustodyBalanceAndWithdrawal.test.tsx` evaluando cálculo de saldo, listado de transacciones, validación de montos máximos y flujo de retiro.

### Out of scope
- Integración con redes de pago interbancarias en vivo para transferencias inmediatas.

### Constraints
- Modificar `components/dashboard/InvestorDashboard.tsx` y crear `components/dashboard/WithdrawalModal.tsx`.

---

## 7. Notificaciones en Tiempo Real (Supabase Realtime) y Alertas en el Header

### Goal
Configurar la sincronización en vivo mediante Supabase Realtime sobre la tabla `notifications` para que los usuarios reciban alertas visuales instantáneas (badge en la campana del Header y alertas flotantes tipo toast) ante cobros, confirmación de inversiones y cambios de estado de préstamos sin necesidad de recargar la página.

### Acceptance criteria
- [ ] **Suscripción Realtime a Notificaciones:**
  - En el layout o Header, se establece un canal de escucha `supabase.channel('user-notifications')` sobre eventos `INSERT` en la tabla `public.notifications` filtrados por el `user_id` autenticado.
- [ ] **Actualización Reactiva del Header:**
  - Al recibirse un evento en tiempo real, el contador de notificaciones no leídas en el icono de la campana se incrementa inmediatamente.
  - Al abrir el menú desplegable de notificaciones, la nueva notificación se muestra primera en la lista destacada como no leída.
- [ ] **Alerta Flotante (Toast Notification):**
  - Ante eventos de alta prioridad (inversión confirmada, cuota acreditada), se despliega un toast accesible en la esquina superior derecha con título, mensaje y opción de cierre.
- [ ] **Limpieza de Recursos (Clean-up):**
  - Al desmontar el componente o cerrar sesión, el canal de Realtime se desuscribe ordenadamente para evitar fugas de memoria.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/RealtimeNotifications.test.tsx` simulando eventos de inserción en el canal y validando la actualización del contador y la aparición del toast.

### Out of scope
- Notificaciones Push nativas en dispositivos móviles mediante Web Push API.

### Constraints
- Utilizar cliente Supabase Browser (`@supabase/supabase-js`) y componentes en `components/layout/`.

---

## 8. Términos y Condiciones Definitivos, Política de Privacidad y Consentimiento de Riesgos

### Goal
Completar las rutas legales `/terminos` y `/privacidad` con la redacción legal definitiva adaptada a la operatoria de financiamiento colectivo P2P en Argentina, e integrar checkboxes obligatorios de aceptación de términos y consentimiento expreso de riesgos crediticios en el registro y en el primer checkout de inversión.

### Acceptance criteria
- [ ] **Contenido Completo en `/terminos`:**
  - Cláusulas institucionales sobre el rol de Lencord como plataforma tecnológica de conexión entre partes y no entidad financiera de intermediación bajo Ley 21.526.
  - Derechos y obligaciones del Inversor y de la PyME Prestataria.
  - Reglas de subasta, comisiones por servicio de la plataforma y mandatos de cobranza.
- [ ] **Contenido Completo en `/privacidad` y Advertencia de Riesgos:**
  - Política de tratamiento de datos personales bajo la Ley 25.326 y derechos de acceso, rectificación y supresión (ARCO).
  - Apartado expreso y destacado de **Advertencia de Riesgos**: manifestación clara de que las inversiones no están garantizadas por el Estado ni cuentan con seguro de depósitos bancarios, y que existe riesgo de mora o incobrabilidad por parte de las PyMEs solicitantes.
- [ ] **Aceptación Obligatoria en Registro e Inversión:**
  - En el formulario de registro (`RegisterForm.tsx`): checkbox obligatorio aceptando Términos y Condiciones y Política de Privacidad.
  - En el primer checkout de inversión: consentimiento expreso de comprensión de riesgos financieros antes de formalizar la colocación de fondos.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/pages/LegalPages.test.tsx` y en formularios validando que el registro y checkout se bloquean si no se aceptan las condiciones legales.

### Out of scope
- Asesoramiento tributario personalizado para cada inversor (declaración de Ganancias o Bienes Personales).

### Constraints
- Modificar `app/terminos/page.tsx`, `app/privacidad/page.tsx`, `components/auth/RegisterForm.tsx` y componentes de checkout.

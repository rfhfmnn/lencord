# Backlog de Tareas - Circuito de Fondos BaaS Simulado, Auditoría y Producción (`_docs/proximas_tareas.md`)

Este documento especifica el backlog integral de tareas acordadas a partir de la lluvia de ideas para implementar la experiencia de usuario y arquitectura de datos completa basada en el **Modelo BaaS (Banking as a Service / Cuentas Virtuales Segregadas) en modo Simulado (Sandbox)**, formalización de contratos con firma electrónica auditable, cobro y distribución de cuotas y gestión de saldos en custodia.

Sigue rigurosamente el formato estándar de `_docs/task-template.md` y las directivas de `_docs/team/pm.md`.

---

## [1. Persistencia Automática de Perfiles (`public.profiles`) y Carga Robusta de Documentos PDF en Storage](https://github.com/rfhfmnn/lencord/issues/64)

## Goal

Garantizar que todo usuario registrado en Supabase Auth cree de forma transparente e inmediata su fila correspondiente en `public.profiles` mediante el trigger de base de datos con permisos `SECURITY DEFINER` (soportando tanto CUIT empresarial como DNI/inversor o nulo), y que el wizard de solicitud de crédito (`/solicitar`) permita subir los PDFs de constancia AFIP/ARCA, balances y extractos al bucket privado `loan-documents` de Supabase Storage asociándolos al `auth.uid()` de la sesión activa, habilitando el avance sin bloqueos al paso 4.

## Acceptance criteria

- [ ] **Trigger Automático `on_auth_user_created` en Supabase:**
  - El trigger se ejecuta ante cada inserción en `auth.users` sin depender de si el usuario confirmó el email o si el cliente tiene sesión activa.
  - Inserta en `public.profiles` con `id = auth.users.id`, rol extraído de metadatos (`borrower` o `investor`), y nombre legal o razón social.
  - El campo `tax_id` admite CUIT de 11 dígitos, DNI de 7 u 8 dígitos, o NULL si es un inversor que aún no lo completó (sin violar la restricción `check_tax_id_format`).
  - Si en los metadatos `tax_id` viene como string vacío `""`, el trigger lo convierte a `NULL`.
- [ ] **Políticas RLS en Supabase Storage (`storage.objects`):**
  - El bucket privado `loan-documents` cuenta con políticas RLS activas en `storage.objects` para prestatarios autenticados (`INSERT`, `SELECT`, `UPDATE`, `DELETE`) restringidas a la ruta `(storage.foldername(name))[1] = auth.uid()::text`.
  - Los administradores (`public.is_admin()`) tienen acceso total (`ALL`) a cualquier documento del bucket.
- [ ] **Resolución del Identificador de Usuario en `/solicitar`:**
  - En `LoanWizard.tsx` y `StepDocumentUpload.tsx`, el `borrowerId` se resuelve de forma estricta a partir de `session.user.id` (`auth.uid()`) activo, eliminando el fallback estático `prof-sme-001` que causaba el rechazo por RLS.
  - Si un usuario no autenticado intenta acceder a `/solicitar`, el middleware lo redirige a `/login?redirect=/solicitar`.
  - Si la sesión expira mientras el usuario completa el formulario, la interfaz muestra un mensaje claro indicando que la sesión ha expirado en lugar de un error críptico de RLS.
- [ ] **Validación y Avance al Paso 4 en `StepDocumentUpload`:**
  - Al seleccionar un archivo PDF válido (formato PDF, tamaño <= 10 MB) para la constancia obligatoria de AFIP/ARCA, el archivo se sube correctamente al bucket `loan-documents`.
  - El nombre del archivo se sanitiza (reemplazo de espacios y caracteres especiales por guiones bajos) antes de construir la ruta de almacenamiento.
  - Desaparecen los errores de carga ("Error al subir archivo / RLS policy violation").
  - Si el usuario elimina el archivo cargado y sube otro, el estado de error se resetea y la URL se actualiza correctamente.
  - El botón *"Continuar al paso 4"* valida que la constancia está cargada y avanza sin trabarse al formulario de datos bancarios.
- [ ] **Pruebas automatizadas:**
  - Suite de tests en `tests/components/StepDocumentUpload.test.tsx` y `tests/components/LoanWizardStep3And4.test.tsx` pasando al 100% validando subida exitosa, manejo de errores de Storage y avance al paso 4.

## Out of scope

- Carga de formatos distintos de PDF (imágenes JPG/PNG).

## Constraints

- Modificaciones en `supabase/setup_cloud_schema.sql`, `components/solicitar/StepDocumentUpload.tsx` y `components/solicitar/LoanWizard.tsx`.
- Tipado estricto con `@/types` sin errores de compilación (`npm run build`).

---

## [2. Arquitectura de Datos en Supabase: Ledger Transaccional, Distribución de Cuotas, Firma y RPCs Atómicos](https://github.com/rfhfmnn/lencord/issues/65)

## Goal

Implementar la infraestructura de datos en Supabase necesaria para soportar un modelo financiero auditable y robusto: libro contable inmutable de saldo en custodia (`custody_transactions`), distribución de cuotas por inversor (`installment_payouts`), metadatos de auditoría de firma electrónica en `legal_contracts`, y procedimientos almacenados atómicos en PostgreSQL (`process_investment_checkout_rpc` y `process_installment_repayment_rpc`) con bloqueo concurrente y prevención de sobre-fondeo.

## Acceptance criteria

- [ ] **Tabla `custody_transactions` (Libro Contable / Ledger):**
  - Campos: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id UUID NOT NULL REFERENCES profiles(id)`, `type VARCHAR(50) NOT NULL` ('card_deposit', 'investment_hold', 'installment_payout', 'withdrawal', 'refund'), `amount NUMERIC(14,2) NOT NULL`, `balance_after NUMERIC(14,2) NOT NULL`, `status VARCHAR(20) NOT NULL DEFAULT 'completed'`, `reference_id UUID NULL`, `payment_metadata JSONB NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
  - Índices en `profile_id` y `created_at DESC`.
  - Restricción: `CONSTRAINT check_transaction_amount_positive CHECK (amount > 0)`.
- [ ] **Tabla `installment_payouts` (Distribución de Cuotas):**
  - Campos: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE RESTRICT`, `investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE RESTRICT`, `investor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`, `principal_share NUMERIC(14,2) NOT NULL`, `interest_share NUMERIC(14,2) NOT NULL`, `total_share NUMERIC(14,2) NOT NULL`, `status VARCHAR(20) NOT NULL DEFAULT 'credited'`, `paid_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
  - Restricción de unicidad: `CONSTRAINT uq_installment_investment UNIQUE(installment_id, investment_id)`.
- [ ] **Campos de Auditoría en `legal_contracts`:**
  - Columnas agregadas: `signer_id UUID REFERENCES profiles(id) NULL`, `signer_role VARCHAR(20) NULL`, `signature_hash TEXT NULL`, `signer_ip VARCHAR(45) NULL`, `signer_user_agent TEXT NULL`, `signed_at TIMESTAMPTZ NULL`.
- [ ] **Procedimiento Almacenado Atómico `process_investment_checkout_rpc`:**
  - Parámetros: `p_loan_id UUID`, `p_investor_id UUID`, `p_amount NUMERIC`, `p_payment_method TEXT`, `p_card_last_four TEXT`, `p_card_brand TEXT`.
  - Bloqueo de fila: ejecuta `SELECT ... FROM loans WHERE id = p_loan_id FOR UPDATE` para evitar condiciones de carrera en subastas simultáneas.
  - Validación de autofinanciamiento: rechaza la inversión si `p_investor_id = loan.borrower_id`.
  - Validación de sobre-fondeo: rechaza si `(loan.amount_funded + p_amount) > loan.amount_requested`.
  - Inserta la inversión en `investments` con `status = 'committed'`.
  - Inserta registro en `custody_transactions` vinculando `reference_id = p_loan_id`.
  - Actualiza `amount_funded` y transiciona el préstamo a `funded` si `amount_funded = amount_requested`, o `funding` si es parcial.
  - Retorna JSON con `success: true`, `amount_funded`, `loan_status` e `investment_id`.
- [ ] **Procedimiento Almacenado Atómico `process_installment_repayment_rpc`:**
  - Parámetros: `p_installment_id UUID`, `p_payer_id UUID`.
  - Idempotencia: verifica que la cuota exista y esté en estado `pending`; si ya está `paid`, rechaza la ejecución.
  - Bloqueo de fila: ejecuta `SELECT ... FROM installments WHERE id = p_installment_id FOR UPDATE`.
  - Marca la cuota como `paid` y registra `paid_at = now()`.
  - Prorrateo exacto: distribuye el capital e intereses entre las inversiones activas; maneja redondeo de centavos asegurando que la suma de `total_share` sea idéntica al `amount_total` de la cuota.
  - Inserta una fila en `installment_payouts` y un crédito en `custody_transactions` para cada inversor.
  - Inserta una notificación en `notifications` por cada inversor informando la acreditación.
  - Si todas las cuotas del préstamo están en estado `paid`, actualiza `loans.status = 'repaid'`.
- [ ] **Políticas Row Level Security (RLS):**
  - RLS activado en `custody_transactions` y `installment_payouts`.
  - Inversores solo pueden consultar sus propios registros (`profile_id = auth.uid()` o `investor_id = auth.uid()`).
  - Administradores (`public.is_admin()`) poseen acceso de lectura y auditoría completo.

## Out of scope

- Webhooks de liquidación interbancaria en tiempo real (COELSA/BIND API).

## Constraints

- Migración en `supabase/migrations/` y actualización en `supabase/setup_cloud_schema.sql`.
- Funciones PL/pgSQL ejecutadas con `SECURITY DEFINER` y transacciones ACID.

---

## [3. Experiencia de Checkout de Inversión con Pasarela de Pagos (Tarjeta Simulado BaaS)](https://github.com/rfhfmnn/lencord/issues/66)

## Goal

Proveer una experiencia de usuario de checkout financiero completa en el modal de inversión del Marketplace, permitiendo al inversor pagar con tarjeta de débito/crédito (simulando una pasarela BaaS) o debitar de su saldo en custodia disponible, con opciones de prueba rápida (tarjeta aprobada / fondos insuficientes) y emisión de recibo de inversión.

## Acceptance criteria

- [ ] **Selector de Medio de Pago:**
  - Si el inversor dispone de saldo en custodia (`balance > 0`): muestra opción de seleccionar *"Pagar con saldo en custodia ($X.XX disponible)"*. Si el saldo cubre el total de la inversión, permite confirmación directa sin tarjeta.
  - Opción destacada *"Pagar con tarjeta de débito / crédito"*.
  - Las opciones son excluyentes (pago 100% saldo o 100% tarjeta).
- [ ] **Formulario de Tarjeta (BaaS Sandbox Experience):**
  - Campos: Número de tarjeta (16 dígitos con espaciado cada 4 dígitos y detección visual de logo Visa/Mastercard), Fecha de vencimiento (MM/AA con validación de no vencida), Código CVV (3 dígitos ocultos con opción de mostrar) y Nombre del titular.
  - Validaciones inline con mensajes de error accesibles (`role="alert"`).
- [ ] **Botones Sandbox para Testing Rápido:**
  - Botón visible *"Tarjeta válida de prueba"*: autocompleta con `4500 1234 5678 9010`, fecha futura `12/28`, CVV `123`, y nombre del usuario.
  - Botón visible *"Simular tarjeta rechazada"*: autocompleta con tarjeta que simula rechazo bancario por fondos insuficientes, mostrando el banner de error correspondiente.
- [ ] **Prevención de Doble Envío y Procesamiento Atómico:**
  - Al presionar *"Confirmar inversión"*, el botón se deshabilita inmediatamente (`disabled`, `aria-busy="true"`) mostrando un spinner para evitar múltiples clicks accidentales.
  - Invoca `process_investment_checkout_rpc`.
- [ ] **Pantalla de Confirmación / Recibo:**
  - Despliega confirmación exitosa con: ID de transacción, tarjeta utilizada (últimos 4 dígitos `•••• 9010`), monto retenido, fecha/hora y botón para volver al Marketplace o ir a *"Mis inversiones"*.
  - El porcentaje fondeado del préstamo en el Marketplace se actualiza de forma inmediata sin recargar la página.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/InvestmentModalCheckout.test.tsx` cubriendo selección de medio de pago, autocompletado de prueba, simulación de rechazo bancario y confirmación exitosa.

## Out of scope

- Pagos divididos (pagar 50% con saldo y 50% con tarjeta).

## Constraints

- Extender `components/marketplace/InvestmentModal.tsx` o crear `components/checkout/InvestmentCheckoutModal.tsx`.
- Usar tokens de diseño de `_docs/design-system.md` y componentes accesibles de `@/components/ui`.

---

## [4. Flujo de Firma Electrónica Auditable para Contratos (Mutuo y Pagaré)](https://github.com/rfhfmnn/lencord/issues/67)

## Goal

Implementar un modal interactivo de firma electrónica de contratos legales (Mutuo y Pagaré Electrónico) para que tanto las PyMEs como los Inversores puedan previsualizar el documento legal, manifestar su consentimiento bajo juramento y estampar su firma electrónica registrando metadatos probatorios (hash SHA-256, IP, timestamp UTC y user-agent).

## Acceptance criteria

- [ ] **Visor de Previsualización Legal:**
  - Muestra un resumen estructurado del contrato: partes intervinientes (razón social PyME, datos del inversor), monto principal, tasa pactada (TNA/spread), plazo de amortización y enlace para abrir/descargar el documento PDF.
- [ ] **Paso de Consentimiento Obligatorio:**
  - Checkbox interactivo: *"Declaro bajo juramento que he leído y acepto en su totalidad los términos del Contrato de Mutuo y las obligaciones cambiarias del Pagaré Electrónico"*.
  - El botón de firma permanece deshabilitado hasta que el checkbox esté marcado.
- [ ] **Generación Criptográfica y Registro de Firma:**
  - Al pulsar *"Firmar electrónicamente documento"*, el sistema genera el Hash SHA-256 del contenido del contrato utilizando la Web Crypto API (`window.crypto.subtle.digest`).
  - Actualiza la tabla `legal_contracts` registrando: `signer_id = auth.uid()`, `signer_role` (`borrower` o `investor`), `signature_hash`, `signer_ip`, `signer_user_agent` y `signed_at = now()`.
- [ ] **Estado Visual de Documento Firmado:**
  - Si el contrato ya fue firmado por el usuario, el modal muestra un badge institucional verde *"Firmado electrónicamente"* con la fecha de firma y los primeros 16 caracteres del hash SHA-256 para verificación.
  - El botón de firma se oculta o deshabilita impidiendo duplicidad de firmas.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/ElectronicSignatureModal.test.tsx` verificando bloqueo sin checkbox, generación de hash SHA-256, registro de firma en el servicio y visualización del badge firmado.

## Out of scope

- Firma digital con certificado de hardware PKI / token físico criptográfico (ONTI).

## Constraints

- Componente en `components/legal/ElectronicSignatureModal.tsx` y servicios en `services/supabase/SupabaseLegalService.ts`.
- Compatible con navegadores modernos y lectores de pantalla.

---

## [5. Fondeo Completo del Préstamo, Notificación de Desembolso y Activación de Cuotas](https://github.com/rfhfmnn/lencord/issues/68)

## Goal

Automatizar el ciclo de cierre de subasta cuando un préstamo alcanza el 100% de financiamiento (`amount_funded = amount_requested`): transicionar el estado del crédito a activo (`active`), generar las cuotas mensuales en `installments` calculadas bajo el sistema francés, y notificar a la PyME con la confirmación de desembolso bancario simulado a su cuenta CBU.

## Acceptance criteria

- [ ] **Transición de Estado del Préstamo:**
  - Al completarse la inversión que cubre el 100% del monto solicitado, el préstamo cambia su estado a `funded` y automáticamente a `active`.
  - La subasta se cierra para nuevas inversiones en el Marketplace (no permite inversiones adicionales).
- [ ] **Generación de Cuotas Mensuales (`installments`):**
  - Se generan las N cuotas (`term_months`) en la tabla `installments` calculadas con el sistema de amortización francés:
    - Cuota mensual total constante (capital + interés).
    - Desglose amortización de capital creciente e interés compensatorio decreciente.
    - Fechas de vencimiento secuenciales cada 30 días a partir de la fecha de activación (manejando correctamente fin de mes y años bisiestos).
    - Cada cuota se inicializa con `status = 'pending'`.
- [ ] **Banner de Desembolso en Panel de la PyME (`/dashboard/pyme`):**
  - Muestra una tarjeta destacada de celebración: *"¡Felicitaciones! Tu solicitud fue 100% financiada. Los fondos por $X.XX han sido transferidos a tu cuenta CBU registrada (terminada en Y)"*.
  - Se activa y visualiza el cronograma completo de cuotas a pagar con la fecha de la próxima cuota.
- [ ] **Notificación a los Inversores Participantes:**
  - Cada inversor que aportó fondos a la subasta recibe una notificación en `notifications`: *"La subasta de [Nombre PyME] se completó exitosamente. Tu inversión ya está activa y devengando rendimientos"*.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/LoanFundingCompletion.test.tsx` validando transición de estados, cálculo matemático de cuotas francesas y renderizado de la notificación de desembolso.

## Out of scope

- Transferencias electrónicas interbancarias reales vía COELSA.

## Constraints

- Integración en `components/dashboard/BorrowerDashboard.tsx` y servicios de préstamos en `services/supabase/SupabaseLoanService.ts`.

---

## [6. Pago de Cuotas por la PyME y Distribución Proporcional Automática a Inversores](https://github.com/rfhfmnn/lencord/issues/69)

## Goal

Permitir que la PyME efectúe el pago de sus cuotas mensuales desde su panel mediante un checkout simulado (tarjeta o débito en cuenta), y que el sistema liquide automáticamente el prorrateo de capital e intereses entre todos los inversores participantes, acreditando el dinero directamente en su saldo en custodia.

## Acceptance criteria

- [ ] **Calendario de Cuotas y Botón de Pago en `/dashboard/pyme`:**
  - En la tabla de cuotas, la próxima cuota en estado `pending` muestra el botón activo *"Pagar cuota"*.
  - Las cuotas deben pagarse en orden secuencial estricto (no se puede pagar la cuota 2 si la cuota 1 está pendiente).
  - Las cuotas con `status = 'paid'` muestran badge verde *"Pagada"* con fecha de pago y comprobante.
- [ ] **Modal de Pago de Cuota PyME:**
  - Desglosa el importe exacto: Capital a amortizar, Interés compensatorio y Total a pagar.
  - Formulario de tarjeta/débito simulado con botón rápido *"Simular pago exitoso"*.
- [ ] **Ejecución y Prorrateo Atómico:**
  - Al confirmar el pago, invoca `process_installment_repayment_rpc`.
  - La cuota cambia a estado `paid`.
  - Se calculan las cuotas partes de cada inversor en base a su porcentaje de participación original: `(monto_invertido / monto_total) * capital` e intereses.
  - Se genera un registro en `installment_payouts` y un crédito tipo `installment_payout` en `custody_transactions` para cada inversor.
  - Si era la última cuota pactada del préstamo, el estado del préstamo cambia automáticamente a `repaid`.
- [ ] **Notificación al Inversor:**
  - Se inserta una notificación para cada inversor participante: *"Cobro acreditado: Recibiste $X.XX de la cuota N de [Razón Social PyME]"*.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/InstallmentRepaymentFlow.test.tsx` evaluando el pago de cuotas, la validación secuencial, la distribución proporcional a múltiples inversores y la actualización del estado del préstamo a `repaid`.

## Out of scope

- Débito automático recurrente no autorizado y gestión de mora judicial.

## Constraints

- Modificar `components/dashboard/BorrowerDashboard.tsx` y servicios financieros en `services/supabase/`.

---

## [7. Saldo en Custodia, Historial de Movimientos y Solicitud de Retiro a CBU en Panel del Inversor](https://github.com/rfhfmnn/lencord/issues/70)

## Goal

Dotar al Panel del Inversor (`/dashboard/inversor`) de un módulo integral de gestión de saldo en custodia que muestre el saldo disponible acumulado de cobros, un historial auditable de movimientos (ingresos por cuotas, colocaciones en préstamos, retiros) y un flujo interactivo para solicitar el retiro de fondos hacia su CBU bancario.

## Acceptance criteria

- [ ] **Tarjeta de Saldo en Custodia Disponible:**
  - En la parte superior de `/dashboard/inversor`: muestra *"Saldo disponible en custodia: $X.XX"*, calculado a partir del balance actual en `custody_transactions`.
  - Botón visible junto al saldo: *"Retirar fondos a mi CBU"*.
- [ ] **Historial de Movimientos Auditables:**
  - Sección *"Movimientos de cuenta"*: listado cronológico de transacciones.
  - Columnas: Fecha y hora, Tipo de movimiento (Cobro de cuota, Inversión, Retiro), Referencia/Préstamo, Importe (+ verde para cobros, - neutro para inversiones o retiros) y Estado.
  - Si el usuario no registra movimientos, muestra un estado vacío amigable con enlace al Marketplace.
- [ ] **Modal de Retiro de Fondos a CBU:**
  - Muestra la cuenta bancaria de destino (CBU/CVU y Alias configurados en su perfil). Si no tiene cuenta configurada, muestra un aviso guiándolo a completarla en *"Mi perfil"*.
  - Input para ingresar el monto a retirar, con validación de que no supere el saldo disponible en custodia ni sea menor o igual a cero.
  - Botón *"Retirar el total disponible"* para autocompletar el saldo máximo.
  - Al confirmar, registra una transacción tipo `withdrawal` en `custody_transactions`, debita el saldo y muestra recibo: *"Solicitud de retiro registrada: La transferencia a tu CBU está en proceso"*.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/CustodyBalanceAndWithdrawal.test.tsx` evaluando cálculo de saldo, visualización de movimientos, validaciones del modal de retiro y actualización reactiva del balance.

## Out of scope

- Redes de transferencias bancarias inmediatas en vivo (Coelsa/API BIND).

## Constraints

- Modificar `components/dashboard/InvestorDashboard.tsx` y crear `components/dashboard/WithdrawalModal.tsx`.
- Cumplir con los estándares de diseño y accesibilidad de `_docs/design-system.md`.

---

## [8. Notificaciones en Tiempo Real (Supabase Realtime) y Alertas en el Header](https://github.com/rfhfmnn/lencord/issues/71)

## Goal

Configurar la sincronización en vivo mediante Supabase Realtime sobre la tabla `notifications` para que los usuarios reciban alertas visuales instantáneas (badge en la campana del Header y alertas flotantes tipo toast) ante cobros, confirmación de inversiones y cambios de estado de préstamos sin necesidad de recargar la página.

## Acceptance criteria

- [ ] **Suscripción Realtime a Notificaciones:**
  - En el layout principal o Header, se inicializa una suscripción de Supabase Realtime (`supabase.channel('user-notifications')`) escuchando eventos `INSERT` en `public.notifications` con filtro `user_id = eq.${user.id}`.
- [ ] **Actualización Reactiva del Header:**
  - Al recibirse una nueva notificación en tiempo real, el contador de notificaciones no leídas en el icono de la campana se incrementa inmediatamente.
  - Al abrir el desplegable de notificaciones, el nuevo elemento aparece al inicio de la lista destacado como no leído.
- [ ] **Alerta Flotante (Toast Notification):**
  - Ante eventos de alta prioridad (inversión confirmada, cobro de cuota acreditado, préstamo fondeado), se despliega un toast accesible en la esquina superior derecha con título, mensaje y botón de cierre.
  - El toast se oculta automáticamente tras 6 segundos o al hacer clic en cerrar.
- [ ] **Limpieza de Recursos (Clean-up):**
  - Al desmontar el componente o cerrar la sesión del usuario, el canal de Realtime se desuscribe y remueve (`supabase.removeChannel`) para evitar fugas de memoria.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/components/RealtimeNotifications.test.tsx` simulando eventos de inserción en el canal y verificando la actualización del contador en el Header y el renderizado del toast.

## Out of scope

- Notificaciones Push nativas en dispositivos móviles (Web Push API / Service Workers).

## Constraints

- Utilizar cliente Supabase Browser (`@supabase/supabase-js`) y componentes en `components/layout/`.

---

## [9. Términos y Condiciones Definitivos, Política de Privacidad y Consentimiento de Riesgos](https://github.com/rfhfmnn/lencord/issues/72)

## Goal

Completar las rutas legales `/terminos` y `/privacidad` con la redacción legal definitiva adaptada a la operatoria de financiamiento colectivo P2P en Argentina, e integrar checkboxes obligatorios de aceptación de términos y consentimiento expreso de riesgos crediticios en el formulario de registro y en el checkout de inversión.

## Acceptance criteria

- [ ] **Contenido Completo en `/terminos`:**
  - Redacción clara sobre el rol de Lencord como plataforma tecnológica de conexión y no entidad financiera bajo Ley 21.526.
  - Reglas de la subasta, derechos y obligaciones de Inversores y PyMEs Prestatarias.
  - Política de comisiones por servicio de la plataforma y mandatos de cobranza en caso de mora.
- [ ] **Contenido Completo en `/privacidad` y Advertencia de Riesgos:**
  - Tratamiento de datos personales conforme a la Ley 25.326 y mecanismos para ejercer derechos de acceso, rectificación y supresión (ARCO).
  - Sección destacada de **Advertencia Expresa de Riesgo**: manifestación de que los préstamos no cuentan con garantía estatal ni seguro de depósitos bancarios, y que el inversor asume el riesgo de mora o insolvencia de la PyME.
- [ ] **Aceptación Obligatoria en Registro e Inversión:**
  - En `components/auth/RegisterForm.tsx`: checkbox obligatorio con enlace a `/terminos` y `/privacidad`. El botón de registro permanece deshabilitado hasta que esté marcado.
  - En el checkout de inversión: confirmación explícita de aceptación de riesgo crediticio antes de ejecutar la colocación de fondos.
- [ ] **Pruebas automatizadas:**
  - Tests en `tests/pages/LegalPages.test.tsx` validando que las páginas contienen las cláusulas completas, y tests en formularios validando que el registro y la inversión se bloquean si no se aceptan los términos.

## Out of scope

- Asesoramiento tributario personalizado para cada inversor (declaración de Ganancias o Bienes Personales).

## Constraints

- Modificar `app/terminos/page.tsx`, `app/privacidad/page.tsx`, `components/auth/RegisterForm.tsx` y modal de checkout.

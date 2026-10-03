# Backlog de Nuevas Tareas - Notificaciones, Pagaré, Formato Contable y Registro PyME (`_docs/nuevas_tareas.md`)

Este documento especifica el nuevo paquete de tareas priorizadas a partir del feedback del producto y las definiciones acordadas, respetando el formato estricto de `_docs/task-template.md` y los lineamientos de `_docs/team/pm.md`.

---

## [Tarea 1: Notificaciones automáticas bidireccionales (In-App y Email) entre PyME e Inversores](https://github.com/rfhfmnn/lencord/issues/79)

**Labels:** `notifications`, `email`, `backend`, `ux`

### Goal
Implementar un sistema de notificaciones automáticas y reactivas tanto en la plataforma (centro de notificaciones in-app con campana) como por correo electrónico, manteniendo informados a la PyME y a los inversores sobre cada acción que impacte en su financiación (inversiones recibidas, subasta completada, activación con pagaré firmado, acreditación de pagos de cuotas y alertas de vencimiento).

### Acceptance criteria
- [ ] **Notificación de inversión a la PyME (In-App + Email):**
  - Cada vez que un inversor compromete fondos en una subasta activa (`process_investment_checkout_rpc`), se inserta una notificación in-app para el prestatario indicando: monto invertido, porcentaje alcanzado del fondeo y fecha.
  - Se despacha un correo electrónico a la PyME con plantilla transaccional notificando el nuevo aporte de capital recibido.
- [ ] **Notificación de subasta al 100% completada (In-App + Email):**
  - Al alcanzar el 100% del monto solicitado:
    - **A la PyME:** Notificación in-app y correo electrónico con llamado a la acción para ingresar al panel a firmar el pagaré digital y liberar los fondos.
    - **A los inversores participantes:** Notificación in-app y correo electrónico avisando que la subasta cerró con éxito y que se aguarda la firma de la PyME para el desembolso.
- [ ] **Notificación de pagaré firmado y activación (In-App + Email):**
  - Al completar la PyME la firma electrónica del pagaré (`signContract` + `activateLoan`):
    - Se envía notificación in-app y correo electrónico a todos los inversores que participaron de esa subasta, confirmando el desembolso e indicando que el crédito ya se encuentra activo, adjuntando el enlace para visualizar el pagaré firmado.
- [ ] **Notificación de cobro de cuota mensual (In-App + Email):**
  - Cuando la PyME abona una cuota (`repayInstallment` / `process_installment_repayment_rpc`):
    - Cada inversor participante recibe una notificación in-app y un correo detallando el importe exacto acreditado en su cuenta en custodia (desglose de capital amortizado e interés compensatorio).
- [ ] **Alerta de cuota próxima a vencer a la PyME (In-App + Email):**
  - El proceso de control o cron diario envía un aviso a la PyME 3 días antes de la fecha de vencimiento de la próxima cuota pendiente, indicando monto total y fecha límite.
- [ ] **Pruebas automatizadas:**
  - Tests unitarios y de integración en `tests/services/` y `tests/components/` validando la generación de notificaciones in-app y el disparo de los despachos de correo para los 5 eventos clave.

### Out of scope
- Notificaciones vía WhatsApp o SMS (quedan relegadas a integraciones futuras con proveedores externos de mensajería).
- Envío de notificaciones a inversores que no hayan invertido en el préstamo correspondiente.

### Constraints
- Utilizar el servicio centralizado de notificaciones [MultiChannelNotificationService.ts](file:///c:/Users/rafah/Documents/lencord/services/notifications/MultiChannelNotificationService.ts) y los templates de email de [services/email/templates.ts](file:///c:/Users/rafah/Documents/lencord/services/email/templates.ts).
- Persistir registros inmutables en la tabla `notifications` de Supabase respetando las políticas RLS existentes.

---

## [Tarea 2: Visualización de Pagaré para Inversores y Anexo de Acreedores con Privacidad](https://github.com/rfhfmnn/lencord/issues/80)

**Labels:** `legal`, `investor-dashboard`, `security`, `privacy`

### Goal
Permitir a los inversores consultar y descargar el pagaré digital firmado directamente desde su tabla de inversiones activas, incorporando en el documento legal un Anexo de Acreedores que liste de forma clara los montos y cuotas a percibir, preservando la privacidad de datos personales entre inversores.

### Acceptance criteria
- [ ] **Acceso en la tabla "Mis Inversiones" (`InvestorDashboard`):**
  - En la tabla de inversiones activas del panel del inversor, en la columna de acciones de cada préstamo en estado `active` o `repaid`, se incluye el botón/enlace *"Ver pagaré firmado"*.
  - Al pulsar el botón, se abre el visualizador/modal del pagaré electrónico ([PromissoryNoteModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/legal/PromissoryNoteModal.tsx) o visor de contrato) mostrando el documento firmado con su hash criptográfico SHA-256 y fecha/hora de suscripción.
  - Para préstamos en estado `funding`, el botón permanece deshabilitado o con la leyenda *"Pendiente de firma"*.
- [ ] **Anexo de Acreedores en el Pagaré:**
  - El documento del pagaré incorpora una sección o cláusula de *"Anexo I - Cronograma y Acreedores Participantes"*.
  - En el anexo se especifican las condiciones acordadas: Razón Social de la PyME tomadora, CUIT, monto de capital, plazo de amortización y tasa pactada.
- [ ] **Privacidad de datos por Inversor:**
  - Cuando un inversor autenticado visualiza el pagaré, el Anexo de Acreedores muestra **únicamente** los datos de la PyME deudora y los datos de acreencia del propio inversor (su Nombre/Razón Social, DNI/CUIT, capital aportado, porcentaje de participación y monto de cuota mensual a percibir).
  - Los datos personales, nombres, DNI/CUIT o montos individuales de los demás inversores participantes se mantienen ocultos o anonimizados para cumplir con normativas de protección de datos personales.
  - La PyME deudora y el Administrador en la consola admin pueden visualizar la nómina completa consolidada de acreedores.
- [ ] **Seguridad y RLS en Supabase:**
  - Se valida que la política RLS en `legal_contracts` permita a los inversores ejecutar `SELECT` sobre los contratos de los préstamos en los que posean una inversión activa registrada en `investments`.
- [ ] **Pruebas automatizadas:**
  - Pruebas en `tests/components/InvestorDashboard.test.tsx` y `tests/components/PromissoryNoteModal.test.tsx` asegurando el renderizado del botón, la apertura del pagaré firmado y la correcta filtración de datos de acreedores según el rol del usuario conectado.

### Out of scope
- Firma criptográfica del inversor (el pagaré es un título ejecutivo emitido y firmado exclusivamente por la PyME deudora a favor de los acreedores).

### Constraints
- Los componentes deben alinearse con [design-system.md](file:///c:/Users/rafah/Documents/lencord/_docs/design-system.md).
- Respetar los contratos de `LegalServiceInterface` definidos en `types/services.ts`.

---

## [Tarea 3: Formato monetario con decimales fijos en Saldo en Custodia y Operaciones de Fondos](https://github.com/rfhfmnn/lencord/issues/81)

**Labels:** `ui/ux`, `frontend`, `financial-accuracy`

### Goal
Estandarizar la visualización de todos los saldos en custodia, movimientos contables y modales de transacción en la plataforma para que presenten siempre dos decimales obligatorios con formato monetario argentino (`$ 150.000,00`), evitando discrepancias o redondeos que oculten centavos.

### Acceptance criteria
- [ ] **Header superior (`Header.tsx`):**
  - El indicador de saldo en custodia (`data-testid="header-custody-balance"`) formatea el importe con dos decimales fijos (ejemplo: `$ 250.000,00` o `$ 14.320,50`).
- [ ] **Tarjetas de métricas en Dashboards:**
  - En el Panel del Inversor (`InvestorDashboard`), la tarjeta de *"Saldo disponible en custodia"* y *"Capital invertido"* muestra valores con dos cifras decimales.
  - En el Panel de la PyME (`BorrowerDashboard`), el saldo en custodia o fondos transferidos se renderizan con dos decimales.
- [ ] **Modales de Retiro y Depósito:**
  - En [WithdrawalModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/WithdrawalModal.tsx): el saldo disponible, el desglose a transferir y la confirmación del retiro a CBU/Alias muestran siempre dos decimales.
  - En [DepositModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/DepositModal.tsx): el saldo en cuenta y el importe a fondear admiten y muestran centavos con precisión de dos dígitos.
- [ ] **Función de formateo centralizada:**
  - Se adapta `formatCurrency` en [HeroSimulator.tsx](file:///c:/Users/rafah/Documents/lencord/components/home/HeroSimulator.tsx) o se provee una variante `formatCurrencyPrecise` / opción `{ includeDecimals: true }` para garantizar que la presentación contable sea uniforme en todo el frontend.
- [ ] **Pruebas automatizadas:**
  - Actualización de los tests en `tests/components/Header.test.tsx`, `tests/components/CustodyBalanceAndWithdrawal.test.tsx` y tests de dashboards verificando la presencia de los dos decimales (`,00`).

### Out of scope
- Modificación del backend de PostgreSQL (las columnas `numeric(15,2)` ya almacenan dos decimales; el cambio es a nivel presentación de interfaz).

### Constraints
- Mantener la convención de moneda argentina: símbolo `$`, separador de miles con punto (`.`) y separador decimal con coma (`,`).

---

## [Tarea 4: Separación de Nombre/Apellido del Representante y Persistencia de Teléfono en Mesa de Crédito](https://github.com/rfhfmnn/lencord/issues/82)

**Labels:** `auth`, `forms`, `admin-console`, `bugfix`, `data-integrity`

### Goal
Dividir el ingreso de la identidad del representante legal en dos casillas separadas (Nombre y Apellido) tanto en el registro de empresas como en la solicitud de financiamiento, garantizando su correcta persistencia en las columnas `first_name` y `last_name` de `profiles`, y asegurar que el número de teléfono celular de contacto se almacene en el perfil de la PyME para que la Mesa de Crédito del Administrador lo visualice de inmediato en lugar de "No registrado".

### Acceptance criteria
- [ ] **Formulario de Registro (`RegisterForm.tsx`):**
  - Al seleccionar el rol PyME (`borrower`), el campo único *"Nombre del apoderado o representante"* se reemplaza por dos inputs independientes:
    - *"Nombre del representante"* (`first_name`)
    - *"Apellido del representante"* (`last_name`)
  - Ambos campos cuentan con validación obligatoria y mensajes de error específicos en caso de omisión.
  - Al crear la cuenta en Supabase Auth, se guardan `first_name`, `last_name` y `representative_name` en la metadata del usuario y en la tabla `profiles`.
- [ ] **Paso 1 de la Solicitud de Financiamiento (`StepCompanyInfo.tsx`):**
  - Se reemplaza el campo único *"Nombre y apellido del apoderado/titular"* por dos inputs separados: *"Nombre del apoderado/titular"* y *"Apellido del apoderado/titular"*.
  - Se precargan automáticamente a partir del `first_name` y `last_name` del perfil del usuario autenticado.
- [ ] **Persistencia del teléfono en el perfil de la PyME (`LoanWizard.tsx`):**
  - Al registrar la solicitud de financiamiento en [LoanWizard.tsx](file:///c:/Users/rafah/Documents/lencord/components/solicitar/LoanWizard.tsx), se actualiza el registro en `profiles` del prestatario:
    - Se guarda `phone` con el valor ingresado en `rep_phone`.
    - Se guardan `first_name` y `last_name` si fueron modificados en el paso 1.
- [ ] **Visualización en Mesa de Crédito (`AdminConsole.tsx`):**
  - Al abrir el detalle de una solicitud en la Mesa de Crédito y Aprobaciones del Admin, en la sección de contacto del solicitante se muestra el número de teléfono real del perfil (`profile.phone`) en lugar de la leyenda *"No registrado"*.
  - Se visualiza el nombre y apellido completos del representante legal (`${profile.first_name} ${profile.last_name}`).
- [ ] **Pruebas automatizadas:**
  - Actualizar y ejecutar tests en `tests/components/RegisterForm.test.tsx`, `tests/components/LoanWizardStep1And2.test.tsx` y `tests/components/AdminConsole.test.tsx` validando que los campos divididos se renderizan, se validan y que el teléfono deja de mostrar "No registrado" en la consola del admin.

### Out of scope
- Integración con APIs de validación de identidad biométrica (Renaper).

### Constraints
- Mantener compatibilidad con el trigger de PostgreSQL `handle_new_user` en Supabase.
- No alterar las firmas existentes de `SubmitLoanInput` en `@/types`.

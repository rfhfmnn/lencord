# Backlog de Nuevas Tareas - Notificaciones, Pagaré, Formato Contable y Registro PyME (`_docs/nuevas_tareas.md`)

Este documento especifica el nuevo paquete de tareas priorizadas a partir del feedback del producto y las definiciones acordadas, respetando el formato estricto de `_docs/task-template.md` y los lineamientos de Product Manager (`_docs/team/pm.md`). Todos los criterios de aceptación son verificables de manera binaria (SÍ / NO).

---

## [Tarea 1: Notificaciones automáticas bidireccionales (In-App y Email) entre PyME e Inversores](https://github.com/rfhfmnn/lencord/issues/82)

**Labels:** `notifications`, `enhancement`, `user-feedback`

### Goal
Implementar un sistema de notificaciones automáticas y reactivas tanto en la plataforma (campana in-app respaldada en la tabla `notifications`) como por correo electrónico transaccional, informando a la PyME y a los inversores sobre cada hito crítico de su financiamiento: nueva inversión recibida, subasta completada al 100%, activación con pagaré firmado, cobro/liquidación de cuota mensual y alertas preventivas de vencimiento.

### Acceptance criteria
- [x] **Evento 0 - Aprobación y Publicación de Préstamo por Administración (PyME):**
  - Al aprobarse y publicarse una solicitud de financiamiento por el administrador (`approveAndPublishLoan` o transición a `status = 'funding'`), se inserta en `notifications` una fila con `user_id = loan.borrower_id`, `type = 'success'`, `title = 'Préstamo aprobado'`, `action_url = '/dashboard/pyme'` y el mensaje *"Tu solicitud de crédito ha sido aprobada y publicada en la subasta del marketplace."*.
  - Se despacha el correo transaccional de aprobación crediticia (`sendCreditApprovalEmail`) con monto solicitado, tasa inversor, tasa PyME y fecha límite de fondeo.
- [ ] **Evento 1 - Nueva Inversión en Subasta (PyME):**
  - Al confirmarse una inversión en un préstamo (`process_investment_checkout_rpc`), se inserta en `notifications` una fila con `user_id = loan.borrower_id`, `type = 'info'`, `title = 'Nuevo aporte de inversión recibido'`, `action_url = '/dashboard/pyme'` y un mensaje indicando el monto invertido formateado en pesos y el nuevo porcentaje acumulado de la subasta.
  - Se invoca el servicio de email para enviar un correo a la dirección del prestatario informando el aporte recibido y el enlace directo a su panel.
- [ ] **Evento 2 - Subasta al 100% completada (PyME e Inversores):**
  - Cuando el acumulado de inversiones de un préstamo alcanza o supera el 100% del monto solicitado (`loan.amount_requested`):
    - **Para la PyME:** Se crea una notificación in-app (`type = 'success'`, `title = '¡Subasta 100% financiada! Pagaré listo para firma'`, `action_url = '/dashboard/pyme'`) y se envía un correo electrónico solicitándole ingresar a firmar el pagaré digital para la liberación de los fondos.
    - **Para los Inversores:** Se consulta la lista de inversores únicos que aportaron al préstamo (deduplicando por `investor_id`). Para cada inversor, se inserta una notificación in-app (`type = 'success'`, `title = 'Subasta finalizada con éxito'`, `action_url = '/dashboard/inversor'`) y se despacha un correo electrónico confirmando el cierre exitoso del fondeo.
- [ ] **Evento 3 - Pagaré firmado y crédito activado (Inversores):**
  - Al ejecutarse `signContract` y `activateLoan` por la PyME:
    - Para cada inversor participante deduplicado, se inserta una notificación in-app (`type = 'success'`, `title = 'Pagaré firmado: fondos desembolsados'`, `action_url = '/dashboard/inversor'`) informando que la PyME firmó el pagaré, los fondos fueron transferidos a su CBU y el cronograma de amortización comenzó a devengarse.
    - Se envía un correo electrónico a cada inversor adjuntando el enlace directo para consultar el pagaré firmado en su panel.
- [ ] **Evento 4 - Cobro y acreditación de cuota mensual (Inversores):**
  - Al registrarse el pago de una cuota por la PyME (`repayInstallment` / `process_installment_repayment_rpc`), una vez calculada la distribución por inversor (`installment_payouts`):
    - Para cada inversor beneficiario, se inserta una notificación in-app (`type = 'success'`, `title = 'Acreditación de cuota recibida'`, `action_url = '/dashboard/inversor'`) detallando la cuota número N y el importe exacto acreditado en su saldo en custodia.
    - Se envía un correo transaccional al inversor detallando el desglose de capital e interés compensatorio acreditado.
- [ ] **Evento 5 - Alerta de vencimiento próximo de cuota (PyME):**
  - El endpoint o job de verificación (`check-deadlines` o servicio de cuotas) identifica cuotas en estado `'pending'` cuya fecha de vencimiento (`due_date`) sea exactamente dentro de 3 días calendario.
  - Para cada cuota identificada, si no se envió previamente la alerta para esa cuota, se inserta una notificación in-app (`type = 'warning'`, `title = 'Próximo vencimiento de cuota'`, `action_url = '/dashboard/pyme'`) indicando número de cuota, importe total a abonar y fecha de vencimiento.
  - Se despacha un correo electrónico recordatorio a la PyME.
- [ ] **Tolerancia a fallos y no bloqueo:**
  - Si el envío de un correo electrónico falla por desconexión o configuración del servidor SMTP/resend, el error es capturado en `catch`, registrado en log, y **no interrumpe** la inserción de la notificación in-app ni la transacción principal de inversión/pago.
- [ ] **Pruebas automatizadas:**
  - La suite de pruebas incluye tests unitarios y de integración en `tests/services/MultiChannelNotificationService.test.ts` y en los tests de ciclo de vida (`tests/integration/loanLifecycle.test.ts`) validando la creación de notificaciones in-app y el llamado al despachador de emails para los 5 eventos descritos.

### Out of scope
- Notificaciones vía WhatsApp o SMS (quedan diferidas para integración con proveedores de mensajería móvil externa).
- Notificaciones push de navegador (Web Push API).

### Constraints
- Utilizar exclusivamente la tabla `public.notifications` respetando los tipos ENUM existentes (`'info'`, `'success'`, `'warning'`) y RLS (`Users can view own notifications`).
- Utilizar el servicio `MultiChannelNotificationService.ts` y los templates definidos en `services/email/templates.ts`.
- Las notificaciones a múltiples inversores deben ejecutarse de forma asíncrona mediante `Promise.allSettled` para evitar bloqueos por latencia de red.

---

## [Tarea 2: Visualización de Pagaré para Inversores y Anexo de Acreedores con Privacidad](https://github.com/rfhfmnn/lencord/issues/83)

**Labels:** `legal`, `enhancement`, `user-feedback`

### Goal
Permitir a los inversores consultar y revisar el pagaré digital firmado por la PyME directamente desde la tabla de *"Mis Inversiones"* en su panel, incorporando en el cuerpo del documento legal un Anexo de Acreedores donde cada inversor visualice con precisión matemática sus propios datos de acreencia y cuota mensual a percibir, preservando la confidencialidad de datos personales (DNI, nombres y montos) respecto a terceros inversores.

### Acceptance criteria
- [ ] **Acceso desde el Panel del Inversor (`InvestorDashboard.tsx`):**
  - En la tabla de inversiones activas (`data-testid="investments-table"`), en la columna de acciones para cada fila:
    - Si el préstamo está en estado `'active'` o `'repaid'` y cuenta con contrato de pagaré firmado, se renderiza un botón secundario visible *"Ver pagaré firmado"* (`data-testid="btn-view-promissory-note-{loanId}"`).
    - Si el préstamo está en estado `'funding'` o `'funded'` pendiente de firma, el botón muestra el texto *"Pendiente de firma"* y se encuentra deshabilitado.
- [ ] **Modo Lectura / Auditoría en `PromissoryNoteModal`:**
  - Al hacer clic en *"Ver pagaré firmado"*, se abre el modal del pagaré electrónico en modo solo lectura (`readOnly = true`):
    - No se solicita código OTP ni se muestra el botón *"Firmar pagaré digital"*.
    - Se muestra un badge verde destacado: `"✓ Contrato firmado electrónicamente por la PyME"`.
    - Se exhibe el hash criptográfico SHA-256 (`signature_hash`) y la fecha/hora exacta de la firma digital (`signed_at`).
    - Se ofrece un botón *"Descargar copia"* / *"Cerrar"*.
- [ ] **Anexo de Acreedores y Privacidad de Datos:**
  - El documento del pagaré incorpora al pie una sección rotulada `"Anexo I - Nómina de Acreedores e Individualización de Cuotas"`:
    - Si el usuario que visualiza el pagaré tiene rol de **Inversor**: el Anexo I lista **únicamente** los datos de la PyME libradora y la fila correspondiente a su propia inversión (Razón Social/Nombre del Inversor, CUIT/DNI, capital invertido, porcentaje de participación y cuota mensual a percibir). Los datos de otros co-inversores no se envían ni se renderizan en el cliente.
    - Si el usuario que visualiza es la **PyME deudora** o un **Administrador**: el Anexo I muestra la nómina completa consolidada de todos los inversores participantes de la subasta con el desglose de cuotas de cada uno.
- [ ] **Seguridad y Permisos RLS en Supabase:**
  - La tabla `public.legal_contracts` cuenta con una política `SELECT` activa para inversores autenticados que restringe la lectura exclusivamente a contratos de préstamos donde exista un registro en `public.investments` con `investor_id = auth.uid()`.
  - Intentar consultar un pagaré de un préstamo en el que no se haya invertido retorna 0 filas o un error 403 / Recurso no encontrado.
- [ ] **Pruebas automatizadas:**
  - Se implementan tests en `tests/components/InvestorDashboard.test.tsx` verificando:
    - La aparición del botón *"Ver pagaré firmado"* en préstamos activos.
    - La apertura del modal en modo solo lectura.
    - Que un inversor autenticado solo ve su propia información en el anexo de acreedores sin filtrar datos de otros usuarios.

## Out of scope
- Firma electrónica por parte del inversor (el pagaré es un título de crédito unilateral emitido por la PyME a favor de los acreedores).
- Generación de firma manuscrita digitalizada.

## Constraints
- El diseño debe adherir a los lineamientos visuales de `_docs/design-system.md` (badges, modales accesibles y tipografía uniforme).
- Los contratos deben satisfacer las interfaces de `LegalServiceInterface` en `@/types/services.ts`.

---

## [Tarea 3: Formato monetario con decimales fijos en Saldo en Custodia y Operaciones de Fondos](https://github.com/rfhfmnn/lencord/issues/84)

**Labels:** `financial-accuracy`, `enhancement`, `user-feedback`

### Goal
Estandarizar la presentación de los saldos en custodia, operaciones bancarias y modales de movimientos de fondos en toda la plataforma, asegurando que todos los importes contables y financieros se visualicen siempre con dos decimales obligatorios según la convención monetaria argentina (`$ 150.000,00` o `$ 0,00`), evitando redondeos que oculten centavos en billeteras y transacciones.

### Acceptance criteria
- [ ] **Función de formateo monetario centralizada (`formatCurrency`):**
  - La función `formatCurrency` en `components/home/HeroSimulator.tsx` (o un módulo de utilidades compartidas `@/utils/currency`) se extiende para soportar una opción de decimales explícita o por defecto para saldos contables:
    - Formatea usando `es-AR`, moneda `ARS`, con `minimumFractionDigits: 2` y `maximumFractionDigits: 2`.
    - Ejemplo: `formatCurrency(150000, { decimals: true })` o `formatCurrency(150000.5)` produce `"$ 150.000,50"`.
    - Un valor de `0` produce estrictamente `"$ 0,00"`.
    - Un valor con centavos fraccionarios (ej. `1234.567`) se redondea a dos decimales (`"$ 1.234,57"`).
- [ ] **Header Superior (`Header.tsx`):**
  - El indicador de saldo en custodia en la barra de navegación (`data-testid="header-custody-balance"`) muestra el importe con dos decimales (ejemplo: `$ 250.000,00` o `$ 0,00`).
  - Al actualizarse el saldo tras una inversión, cobro de cuota o retiro, el Header refleja inmediatamente el valor con dos decimales.
- [ ] **Tarjetas de Balance en Paneles (`InvestorDashboard` y `BorrowerDashboard`):**
  - En el Panel del Inversor (`InvestorDashboard.tsx`):
    - Tarjeta de *"Saldo disponible en custodia"* (`data-testid="custody-balance-card"`): muestra el saldo con dos decimales.
    - Tarjeta de *"Capital invertido"* y métricas de cobro: muestran dos decimales.
  - En el Panel de la PyME (`BorrowerDashboard.tsx`):
    - Banner de desembolso y saldo transferido: se renderizan con dos decimales.
- [ ] **Modal de Retiro de Fondos (`WithdrawalModal.tsx`):**
  - El cartel de *"Saldo disponible para transferir a tu cuenta bancaria"* muestra el importe exacto con centavos (`data-testid="available-balance"`).
  - Al hacer clic en *"Retirar el total disponible"*, el input se completa con el valor exacto incluyendo centavos (ej. `15420.50`).
  - La previsualización y el resumen de confirmación del retiro exhiben el monto con dos decimales.
- [ ] **Modal de Depósito / Fondeo (`DepositModal.tsx`):**
  - El saldo actual y el valor a ingresar contemplan dos decimales obligatorios en el resumen de acreditación.
- [ ] **Pruebas automatizadas:**
  - Se ejecutan y pasan los tests unitarios en:
    - `tests/components/Header.test.tsx` (validando que el saldo muestra `,00`).
    - `tests/components/CustodyBalanceAndWithdrawal.test.tsx` (validando formato en modal de retiro).
    - `tests/components/HeroSimulator.test.tsx` y tests de dashboards verificando el formateo monetario con dos decimales.

## Out of scope
- Modificación de la base de datos de PostgreSQL (los campos `numeric(15, 2)` en `profiles.custody_balance` y `custody_transactions.amount` ya almacenan centavos).
- Formato de monedas extranjeras (USD / EUR).

## Constraints
- Mantener la convención oficial argentina de numeración: punto (`.`) como separador de miles y coma (`,`) como separador de decimales precedido por el signo `$`.
- Preservar la compatibilidad hacia atrás en sliders del simulador público de préstamos donde los montos solicitados sean enteros redondos si no se especifica la opción de decimales.

---

## [Tarea 4: Separación de Nombre/Apellido del Representante y Persistencia de Teléfono en Mesa de Crédito](https://github.com/rfhfmnn/lencord/issues/85)

**Labels:** `auth`, `mesa-credito`, `bug`, `user-feedback`

### Goal
Dividir el ingreso de la identidad del representante legal en dos casillas independientes (Nombre y Apellido) en el formulario de registro de empresas y en la solicitud de financiamiento, garantizando su correcta persistencia en las columnas `first_name` y `last_name` de `profiles`, y asegurar que el número telefónico de contacto ingresado en la solicitud se guarde en el perfil de la PyME para que la Mesa de Crédito del Administrador lo visualice de inmediato en lugar de la leyenda "No registrado".

### Acceptance criteria
- [ ] **Formulario de Registro PyME (`RegisterForm.tsx`):**
  - Al seleccionar el rol PyME (`borrower`), el campo único anterior de representante se divide en dos casillas separadas obligatorias:
    - *"Nombre del representante"* (`name="repFirstName"`, `data-testid="input-rep-first-name"`).
    - *"Apellido del representante"* (`name="repLastName"`, `data-testid="input-rep-last-name"`).
  - Si alguno de los dos campos se envía vacío o solo con espacios, se muestra el mensaje de validación correspondiente:
    - *"El nombre del representante es obligatorio."*
    - *"El apellido del representante es obligatorio."*
  - Al completar el registro, se guardan en la metadata de Auth y en la tabla `profiles`:
    - `first_name`: valor ingresado en Nombre.
    - `last_name`: valor ingresado en Apellido.
    - `representative_name`: combinación de Nombre y Apellido (`${nombre} ${apellido}`).
- [ ] **Paso 1 de la Solicitud de Financiamiento (`StepCompanyInfo.tsx`):**
  - La interfaz del Paso 1 contiene dos campos de texto individuales para la persona apoderada:
    - *"Nombre del apoderado/titular"* (`id="rep_first_name"`, `data-testid="input-rep-first-name"`).
    - *"Apellido del apoderado/titular"* (`id="rep_last_name"`, `data-testid="input-rep-last-name"`).
  - Ambos campos se precargan automáticamente con el `first_name` y `last_name` del perfil del usuario conectado (o división limpia si proviene de un registro legado).
  - El campo de teléfono celular (`rep_phone`) se precarga con `profile.phone` si ya existía registrado.
- [ ] **Persistencia del Teléfono y Datos en Perfil (`LoanWizard.tsx`):**
  - Al pulsar *"Confirmar y solicitar financiación"* en el paso final del wizard:
    - Además de crear el registro del préstamo (`loans`), se ejecuta la actualización del perfil del prestatario en Supabase:
      - `phone`: número telefónico celular ingresado en `step1Data.rep_phone`.
      - `first_name`: nombre del representante ingresado en `step1Data.rep_first_name`.
      - `last_name`: apellido del representante ingresado en `step1Data.rep_last_name`.
    - La operación se ejecuta con manejo de errores defensivo para que un fallo en la actualización del perfil no interrumpa la creación de la solicitud.
- [ ] **Visualización en Mesa de Crédito Admin (`AdminConsole.tsx`):**
  - En la consola del Administrador (`/admin`), al abrir el modal de evaluación de una solicitud de crédito:
    - En el campo *"Teléfono de contacto"*: se visualiza el número de teléfono guardado en el perfil de la PyME solicitante, desapareciendo la leyenda *"No registrado"* cuando el teléfono fue provisto en la solicitud.
    - En el campo *"Representante legal / Titular"*: se visualiza la composición limpia de Nombre y Apellido (`${profile.first_name} ${profile.last_name}`).
- [ ] **Pruebas automatizadas:**
  - Se ejecutan y pasan los tests unitarios en:
    - `tests/components/RegisterForm.test.tsx` (validando campos separados y mensajes de error de nombre y apellido).
    - `tests/components/LoanWizardStep1And2.test.tsx` (validando inputs en paso 1 y precarga).
    - `tests/components/AdminConsole.test.tsx` (validando que el teléfono y nombre completo se renderizan en el panel de evaluación).

## Out of scope
- Validación de números de teléfono vía código SMS / WhatsApp OTP al momento de cargar el formulario.
- Consulta automática de poderes notariales o estatutos sociales en registros públicos de comercio.

## Constraints
- Mantener la integridad del trigger PostgreSQL `handle_new_user` en Supabase extrayendo `first_name` y `last_name` de los metadatos de registro.
- No modificar el tipo de datos de la columna `phone` (`varchar(50)`) en la tabla `public.profiles`.

---

## [Tarea 5: Visualización de la Razón Social de la PyME en Oportunidades del Marketplace](https://github.com/rfhfmnn/lencord/issues/86)

**Labels:** `marketplace`, `pyme`, `enhancement`, `user-feedback`

### Goal
Mostrar claramente la Razón Social de la empresa PyME en todas las oportunidades de inversión del marketplace (tanto en las tarjetas del catálogo general `/marketplace` como en la vista de detalle de cada subasta `/marketplace/[id]` y en el modal de inversión), permitiendo que los inversores identifiquen de inmediato a la entidad prestataria.

### Acceptance criteria
- [x] **Tarjetas del Catálogo de Oportunidades (`LoanCard.tsx`):**
  - Cada tarjeta de préstamo en `/marketplace` renderiza de forma visible la razón social de la empresa prestataria (`data-testid="loan-company-name"`).
  - La razón social se ubica de forma destacada sobre la descripción del proyecto, respetando la tipografía y jerarquía visual del design system.
  - Si la razón social es extensa, se trunca limpiamente con ellipsis en una sola línea manteniendo la alineación de la tarjeta.
  - Si una oportunidad no cuenta con razón social registrada, se muestra el fallback `"Empresa PyME"`.
- [x] **Vista Detallada de la Oportunidad (`LoanDetail.tsx`):**
  - En el encabezado principal de la subasta `/marketplace/[id]`, se exhibe un bloque informativo destacado con la razón social de la PyME (`data-testid="detail-company-name"`).
  - En la sección *"Evaluación crediticia y solvencia"*, se incluye una fila explícita indicando *"Razón Social"* y el nombre legal de la compañía (`data-testid="detail-credit-company-name"`).
- [x] **Modal de Inversión (`InvestmentModal.tsx`):**
  - El encabezado o subtítulo del modal de inversión (`data-testid="investment-modal"`) indica la razón social de la PyME en la que se está invirtiendo.
- [x] **Resolución de Datos en Capa de Servicios y Catálogo (`MarketplaceCatalog.tsx` y servicios):**
  - `MarketplaceCatalog.tsx` recupera los nombres legales de las empresas prestatarias mediante los perfiles asociados a cada `borrower_id` y los transfiere a cada `LoanCard`.
  - `MockLoanService` y `SupabaseLoanService` enriquecen las instancias de `Loan` con el campo `borrower_name` / `company_name` a partir de `profiles.legal_name`.
  - Los datos semilla de préstamos (`SEED_LOANS`) cuentan con la razón social asignada correspondiente a su prestatario.
- [x] **Pruebas automatizadas:**
  - Se ejecutan y pasan los tests unitarios en:
    - `tests/components/LoanCard.test.tsx` (validando que renderiza la razón social y fallback).
    - `tests/components/MarketplaceCatalog.test.tsx` (validando que las tarjetas en el catálogo muestran las razones sociales correspondientes).
    - `tests/components/LoanDetail.test.tsx` (validando que el detalle de la oportunidad exhibe la razón social en el encabezado y en solvencia).

### Out of scope
- Pantalla pública de perfil corporativo o balance general descargable para inversores anónimos.
- Modificación de la estructura relacional de la tabla `loans` en PostgreSQL.

### Constraints
- Obtener la razón social exclusivamente desde la columna `legal_name` de `public.profiles`.
- Respetar los estilos y tokens definidos en `_docs/design-system.md`.

---

## [Tarea 6: Incorporación de Tipo Societario y Fecha de Inicio en Registro PyME y Modo Confirmación en Paso 1](https://github.com/rfhfmnn/lencord/issues/87)

**Labels:** `auth`, `solicitar`, `ux`, `enhancement`, `user-feedback`

### Goal
Capturar el tipo societario y la fecha de inicio de actividades directamente en el formulario de registro de cuentas PyME para persistirlos en el perfil de la empresa, permitiendo que el Paso 1 de la solicitud de crédito se autocomplete íntegramente como una pantalla de confirmación de datos societarios ya validados.

### Acceptance criteria
- [x] **Formulario de Registro PyME (`RegisterForm.tsx`):**
  - Al seleccionar el rol PyME (`borrower`), se muestran dos campos obligatorios adicionales para la empresa:
    - Selector "Tipo societario" (`data-testid="select-company-type"` / `id="companyType"`) con opciones: `SRL`, `SA`, `SAS`, `Responsable Inscripto` y `Monotributo`.
    - Selector de fecha "Fecha de inicio de actividades" (`data-testid="input-start-date"` / `id="startDate"`).
  - Si se intenta enviar el registro con el tipo societario vacío o sin fecha de inicio, se muestran los mensajes de validación correspondientes ("Seleccioná el tipo societario de la empresa." / "La fecha de inicio de actividades es obligatoria.").
  - No se permite seleccionar una fecha de inicio de actividades posterior al día actual ("La fecha de inicio no puede ser una fecha futura.").
  - Al completar el registro, los valores `company_type` y `start_date` se persisten en `auth.users.user_metadata` y en las columnas `company_type` y `start_date` de `public.profiles`.
- [x] **Precarga y Resolución en Solicitud de Financiamiento (`LoanWizard.tsx`):**
  - Al resolver el perfil del usuario autenticado (vía `userProfile` prop o sesión Supabase Auth), `company_type` y `start_date` se extraen de `profiles` / `user_metadata` y se inyectan en `step1Data`.
  - Al completarse la solicitud de crédito, cualquier actualización de estos campos se replica en `profiles`.
- [x] **Modo Confirmación en Paso 1 (`StepCompanyInfo.tsx`):**
  - Cuando los datos societarios vienen precargados de la cuenta autenticada (`isPrepopulated` con `company_type` y `start_date`):
    - El selector de tipo societario y el input de fecha de inicio se muestran en modo solo lectura / bloqueados (`disabled` / `readOnly`), con helper text indicando que provienen del registro de la empresa.
    - Se visualiza el aviso destacado de confirmación: `"🔒 Datos fiscales verificados: La información de tu empresa corresponde a tu cuenta registrada y se encuentra precargada para confirmar la solicitud."`
  - Si una cuenta preexistente o legado no posee `company_type` o `start_date` cargados en el perfil, los campos permanecen editables para permitir su ingreso manual.
- [x] **Pruebas automatizadas:**
  - Se ejecutan y pasan los tests en:
    - `tests/components/RegisterForm.test.tsx` (validando campos, validaciones y persistencia de `company_type` y `start_date`).
    - `tests/components/LoanWizardStep1And2.test.tsx` y `tests/components/LoanWizardAuthenticated.test.tsx` (validando precarga, modo solo lectura de confirmación en paso 1 y compatibilidad).

### Out of scope
- Validación por API en tiempo real con ARCA/AFIP del certificado de inicio de actividades.

### Constraints
- Agregar columnas `company_type VARCHAR(50)` y `start_date DATE` en `public.profiles` mediante migración PostgreSQL idempotente.
- Respetar los tipos `CompanyType` definidos en `@/components/solicitar/StepCompanyInfo`.



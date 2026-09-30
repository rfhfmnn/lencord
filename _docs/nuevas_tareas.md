# Backlog de Nuevas Tareas - Mejoras de Usuario y Plataforma (nuevas_tareas.md)

Este documento contiene las tareas especificadas y refinadas según las respuestas y definiciones del usuario, siguiendo la plantilla `_docs/task-template.md` y las directrices de `_docs/team/pm.md`. Cada tarea cuenta con su correspondiente GitHub Issue bajo la etiqueta `user-feedback`.

---

## [1. Navegación dinámica y Header condicional por rol de usuario](https://github.com/rfhfmnn/lencord/issues/52)

### Goal
Ocultar enlaces irrelevantes en la barra de navegación superior persistente (`Header`) según el tipo de rol autenticado: cuando un usuario inicie sesión como PyME (`'sme'` o `'borrower'`) no debe figurar la opción de "Prestar", y cuando inicie sesión como Inversor (`'investor'`) no debe figurar la opción de "Pedir financiación". Mantener ambos enlaces visibles para usuarios sin sesión iniciada y para administradores.

### Acceptance criteria
- [ ] **Usuario sin sesión (público):** Tanto en la barra de escritorio (`desktopNav`) como en el menú lateral desplegable móvil (`mobileNav`), se renderizan simultáneamente los enlaces "Prestar" (hacia `/marketplace`) y "Pedir financiación" (hacia `/solicitar`).
- [ ] **Sesión PyME (`borrower` o `sme`):** 
  - El enlace "Prestar" NO se renderiza en la navegación de escritorio ni en el menú móvil.
  - El enlace "Pedir financiación" se renderiza visible en ambas vistas.
- [ ] **Sesión Inversor (`investor`):**
  - El enlace "Pedir financiación" NO se renderiza en la navegación de escritorio ni en el menú móvil.
  - El enlace "Prestar" se renderiza visible en ambas vistas.
- [ ] **Sesión Administrador (`admin`):** Se mantienen visibles ambos accesos operativos junto al enlace directo al panel de control `/admin`.
- [ ] **Cierre de sesión:** Al hacer clic en "Cerrar sesión", el estado se actualiza inmediatamente sin recarga completa de página y ambos enlaces vuelven a ser visibles.
- [ ] **Fase de carga (Hydration/Loading):** Mientras la sesión está resolviendo (`isLoading === true`), el Header no genera parpadeo (layout shift) abrupto en la botonera de navegación.
- [ ] **Pruebas automatizadas:** El archivo de pruebas `tests/components/Header.test.tsx` contiene casos para los 4 estados (no autenticado, PyME, Inversor, Admin) verificando la presencia o ausencia de cada enlace con aserciones checkables.

### Out of scope
- Restricción y redirección de rutas a nivel servidor/middleware (cubierto en issue #58 para subastas y en middleware para /solicitar).

### Constraints
- Modificar exclusivamente [Header.tsx](file:///c:/Users/rafah/Documents/lencord/components/layout/Header.tsx) y estilos en [header.module.css](file:///c:/Users/rafah/Documents/lencord/components/layout/header.module.css).
- Mantener compatibilidad estricta con la interfaz `UserSession` y los roles definidos en `@/types`.

---

## [2. Registro con DNI opcional para Inversores y obligatoriedad en perfil para invertir](https://github.com/rfhfmnn/lencord/issues/53)

### Goal
Permitir que los inversores se registren sin ingresar obligatoriamente su DNI/CUIT en el formulario inicial de `/registro`, habilitar la carga/edición del DNI en la sección de perfil del inversor en su panel, y bloquear la confirmación de inversiones en el marketplace si el usuario aún no cargó su DNI.

### Acceptance criteria
- [ ] **Formulario de Registro (`/registro`):**
  - Al seleccionar el rol "Inversor", el campo DNI/CUIT pasa a ser opcional y muestra el texto de ayuda: *"Opcional al registrarse. Requerido posteriormente para poder invertir."*
  - Si el inversor deja el campo vacío, el formulario se envía exitosamente y la cuenta se crea sin errores.
  - Si el inversor decide ingresar un DNI, se valida que posea formato numérico válido (7 u 8 dígitos para DNI, u 11 dígitos con validación de checksum oficial para CUIT).
  - Para el rol "PyME" (`borrower`), el CUIT se mantiene estrictamente obligatorio con validación de 11 dígitos y algoritmo ARCA/AFIP.
- [ ] **Base de Datos y Esquema:**
  - Migración SQL que relaja la restricción `NOT NULL` de `tax_id` en la tabla `profiles` para inversores nuevos (`NULL` permitido al crearse).
  - El check de formato permite valores nulos, cadenas de 7-8 dígitos (DNI) y cadenas de 11 dígitos (CUIT).
- [ ] **Panel del Inversor (`/dashboard/inversor`):**
  - Se añade la tarjeta o sección "Mi Perfil" con visualización del estado del DNI (badge semántico: *"DNI cargado"* o *"DNI pendiente"*).
  - Permite ingresar o editar el DNI y guardarlo contra el backend de Supabase/servicio mock con validación inmediata.
- [ ] **Modal de Inversión (`InvestmentModal.tsx`):**
  - Si el inversor autenticado no posee DNI/CUIT cargado en su perfil, el botón "Confirmar inversión" se deshabilita.
  - Se muestra una alerta destacada (`role="alert"`): *"Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil."*
  - La alerta incluye un botón directo de acción que redirige al usuario a la sección de perfil para completar su DNI.
  - En la capa de servicios (`services/investment.ts`), cualquier intento de confirmación sin DNI es rechazado con error `MISSING_TAX_ID`.
- [ ] **Pruebas automatizadas:** Pruebas unitarias en `RegisterForm.test.tsx` e `InvestmentModal.test.tsx` verifican el registro sin DNI, la validación de formato cuando se ingresa, y el bloqueo de inversión ante DNI faltante.

### Out of scope
- Validación biométrica KYC con Renaper en tiempo real (queda para fase posterior).

### Constraints
- Modificar [RegisterForm.tsx](file:///c:/Users/rafah/Documents/lencord/components/auth/RegisterForm.tsx), [InvestorDashboard.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/InvestorDashboard.tsx), [InvestmentModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/InvestmentModal.tsx), [types/index.ts](file:///c:/Users/rafah/Documents/lencord/types/index.ts).
- Crear migración SQL idempotente en `supabase/migrations/`.

---

## [3. Inicio de sesión con selección de rol (PyME vs Inversor) y cuenta unificada](https://github.com/rfhfmnn/lencord/issues/54)

### Goal
Implementar un selector de rol al iniciar sesión en `/login` ("Ingresar como PyME" o "Ingresar como Inversor") con arquitectura de cuenta unificada, permitiendo que un mismo usuario con un único correo electrónico pueda ingresar con cualquiera de los dos perfiles, redirigiéndolo al panel y contexto correspondiente.

### Acceptance criteria
- [ ] **Selector en `/login`:**
  - Se presenta un selector de dos pestañas destacado: *"Ingresar como PyME"* e *"Ingresar como Inversor"*.
  - El selector es accesible por teclado (`aria-selected`, soporte de flechas y tabs).
- [ ] **Redirección por rol seleccionado:**
  - Al ingresar credenciales correctas con "Ingresar como PyME", el contexto de sesión activa se establece como PyME y redirige a `/dashboard/pyme` (o al return URL de `redirect` si fue solicitado).
  - Al ingresar credenciales correctas con "Ingresar como Inversor", el contexto de sesión activa se establece como Inversor y redirige a `/dashboard/inversor` (o al return URL de `redirect` si fue solicitado).
- [ ] **Cuenta sin el rol seleccionado:**
  - Si un usuario registrado exclusivamente como Inversor selecciona "Ingresar como PyME", tras validar contraseña se le informa de manera clara: *"Tu cuenta no posee un perfil PyME activo."*, ofreciendo un botón directo: *"Activar perfil de empresa"* sin forzarlo a registrarse desde cero.
  - Caso recíproco para PyMEs ingresando como inversor.
- [ ] **Conmutador de rol en sesión (Role Switcher):**
  - Si la cuenta posee ambos perfiles habilitados, el menú de usuario del Header despliega una opción rápida: *"Cambiar a modo Inversor"* / *"Cambiar a modo PyME"*, alternando de contexto y redirigiendo sin desloguear.
- [ ] **Manejo de parámetro `redirect`:**
  - La redirección respeta la función de seguridad `sanitizeRedirectUrl` para prevenir vulnerabilidades de Open Redirect.
- [ ] **Pruebas automatizadas:** `LoginForm.test.tsx` prueba la alternancia del selector de rol, la autenticación exitosa para cada rol, el tratamiento del usuario con rol faltante y la prevención de Open Redirect.

### Out of scope
- Recuperación de contraseña por SMS (se preserva el flujo de recuperación existente vía email).

### Constraints
- Modificar [LoginForm.tsx](file:///c:/Users/rafah/Documents/lencord/components/auth/LoginForm.tsx), [Header.tsx](file:///c:/Users/rafah/Documents/lencord/components/layout/Header.tsx) y tipos en `@/types`.

---

## [4. Limpieza del Panel de Inversor y reemplazo de selector demo por perfil real](https://github.com/rfhfmnn/lencord/issues/55)

### Goal
Eliminar el selector de prueba temporal (`<select id="investor-select">` con "Juan Ignacio Pérez", "Inversora Austral S.A.", etc.) del Panel del Inversor (`InvestorDashboard.tsx`) y vincular todas las métricas, listas y datos exclusivamente a la sesión y perfil del usuario autenticado.

### Acceptance criteria
- [ ] **Eliminación del componente mockup:**
  - El bloque `div.investorSelector` y el elemento `<select id="investor-select">` son removidos por completo del árbol DOM.
  - No queda rastro de nombres ficticios hardcodeados en el código de producción del componente.
- [ ] **Datos reales del usuario autenticado:**
  - El encabezado del panel muestra el nombre legal real obtenido de la sesión (`user.name` o `profile.legal_name`).
  - La tarjeta de saldo y advertencia regulatoria consume el saldo real o de custodia asignado a la cuenta autenticada.
- [ ] **Pestaña / Sección de "Mi Perfil":**
  - Se agrega una sección accesible para ver correo electrónico registrado, CBU/CVU bancario asociado y estado del DNI/CUIT.
  - Permite actualizar el DNI/CUIT con feedback de éxito o error en línea.
- [ ] **Estado vacío (Empty State):**
  - Si el inversor autenticado no tiene inversiones registradas (`investments.length === 0`), se renderiza un estado vacío limpio con ilustración amigable, mensaje motivacional y botón primario *"Explorar oportunidades"* que enlaza a `/marketplace`.
- [ ] **Pruebas automatizadas:** `InvestorDashboard.test.tsx` valida la ausencia del selector demo, la carga de datos del perfil autenticado, y el renderizado correcto del empty state ante listas vacías.

### Out of scope
- Sincronización automática de movimientos con homebanking bancario externo.

### Constraints
- Modificar [InvestorDashboard.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/InvestorDashboard.tsx) y estilos asociados en [dashboard.module.css](file:///c:/Users/rafah/Documents/lencord/components/dashboard/dashboard.module.css).

---

## [5. Historial y tabla de solicitudes en Panel PyME con vencimiento opcional y descripción](https://github.com/rfhfmnn/lencord/issues/56)

### Goal
Incorporar en el panel de la PyME (`/dashboard/pyme`) una tabla detallada con el historial de todas sus solicitudes de crédito (descripción del proyecto, fecha de solicitud, monto, tasa, estado y vencimiento), y añadir en el wizard y panel la opción de que la subasta no tenga fecha límite fija o pueda ser configurada/modificada por la PyME cuando lo desee.

### Acceptance criteria
- [ ] **Tabla de historial de solicitudes (`/dashboard/pyme`):**
  - Se añade la sección "Historial de solicitudes de financiamiento" con una tabla accesible (`<table role="table">`).
  - Columnas obligatorias visibles:
    1. **Proyecto / Destino:** Categoría con badge y descripción resumida del proyecto.
    2. **Monto solicitado:** Formateado en pesos argentinos (`$ X.XXX.XXX`).
    3. **Plazo y Tasa:** Meses y esquema de tasa (Fija o CER).
    4. **Fecha de solicitud:** Formato legible local (`DD/MM/AAAA`).
    5. **Vencimiento de subasta:** Fecha estipulada o etiqueta *"Sin fecha límite"*.
    6. **Estado:** Badge semántico según estado (`in_review`, `funding`, `funded`, `active`, etc.).
    7. **Acciones:** Enlace a ver detalle, botón para firmar pagaré (si está fondeado), o botón *"Definir vencimiento"* (si está en subasta sin fecha límite).
- [ ] **Configuración en Solicitud (`/solicitar`, Paso 2):**
  - En `StepProjectConditions.tsx`, se incorpora un campo opcional para vencimiento de subasta con opciones:
    - *"Sin fecha límite (abierta hasta completar fondeo)"*
    - *"15 días"*
    - *"30 días"*
    - *"45 días"*
    - *"Fecha personalizada"* (selector de fecha calendario que no permita fechas pasadas).
- [ ] **Modificación posterior de vencimiento:**
  - Si una subasta se encuentra activa (`funding`) sin fecha límite, la PyME puede abrir un diálogo modal desde la tabla para fijar o extender una fecha límite cuando lo decida.
- [ ] **Empty State:** Si la PyME no tiene solicitudes previas, se mantiene la tarjeta invitando a solicitar financiamiento con botón hacia `/solicitar`.
- [ ] **Pruebas automatizadas:** Casos de prueba en `BorrowerDashboard.test.tsx` y `StepProjectConditions.test.tsx` validan la visualización de las columnas, la opción de sin fecha límite y la apertura del modal de edición de vencimiento.

### Out of scope
- Cancelación arbitraria de subastas que ya alcancen el 50% de fondeo sin intervención del oficial de riesgos.

### Constraints
- Modificar [BorrowerDashboard.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/BorrowerDashboard.tsx), [StepProjectConditions.tsx](file:///c:/Users/rafah/Documents/lencord/components/solicitar/StepProjectConditions.tsx) y estilos en [dashboard.module.css](file:///c:/Users/rafah/Documents/lencord/components/dashboard/dashboard.module.css).

---

## [6. Simulador de cuotas y disclaimer en Paso 2 de Solicitud de Financiamiento](https://github.com/rfhfmnn/lencord/issues/57)

### Goal
Integrar en el paso 2 del wizard de solicitud de crédito (`StepProjectConditions.tsx`) un simulador interactivo y reactivo que calcule la cuota mensual estimada bajo el sistema francés a una tasa promedio de referencia del mercado, acompañado de un disclaimer explicativo destacado sobre la evaluación de riesgo crediticio.

### Acceptance criteria
- [ ] **Cálculo reactivo de cuota estimada:**
  - Al modificar el monto solicitado o el plazo pretendido (1, 2, 3, 6, 12 meses), el simulador actualiza automáticamente el valor de la cuota mensual promedio estimada.
  - El cálculo utiliza la fórmula de amortización del sistema francés implementada en `calculateBorrowerInstallment` utilizando la tasa promedio de referencia de la plataforma (`BORROWER_FIXED_TNA = 0.48`).
  - Para montos no ingresados o en cero, la cuota muestra `$ 0` sin producir valores `NaN` ni errores de consola.
- [ ] **Bloque visual destacado:**
  - Se muestra un recuadro con fondo diferenciado dentro del Paso 2 exhibiendo el valor formateado: *"Cuota mensual estimada: $ X.XXX.XXX / mes"*.
- [ ] **Disclaimer regulatorio y de riesgo:**
  - Inmediatamente adyacente a la cuota calculada se incluye un texto de descargo con icono informativo:
    *"Nota informativa: Este valor es una simulación orientativa calculada con tasas promedio de mercado. La tasa final aplicable y el valor definitivo de la cuota serán determinados luego de la evaluación de riesgo crediticio de tu empresa realizada por nuestro equipo."*
- [ ] **Experiencia de usuario no bloqueante:**
  - La presencia del simulador no entorpece ni bloquea el envío normal del formulario al hacer clic en "Continuar".
- [ ] **Pruebas automatizadas:** `StepProjectConditions.test.tsx` prueba el cálculo exacto de la cuota con distintos montos/plazos y valida que el texto del disclaimer esté presente en el documento.

### Out of scope
- Cálculo de scoring en tiempo real con la API del BCRA en el Paso 2 (ocurre internamente en el panel de riesgos de administración).

### Constraints
- Modificar [StepProjectConditions.tsx](file:///c:/Users/rafah/Documents/lencord/components/solicitar/StepProjectConditions.tsx) y [solicitar.module.css](file:///c:/Users/rafah/Documents/lencord/components/solicitar/solicitar.module.css).
- Reutilizar las constantes y fórmulas probadas en [HeroSimulator.tsx](file:///c:/Users/rafah/Documents/lencord/components/home/HeroSimulator.tsx).

---

## [7. Restricción de acceso a subastas particulares para usuarios sin sesión](https://github.com/rfhfmnn/lencord/issues/58)

### Goal
Permitir que los usuarios no autenticados exploren libremente el catálogo general del marketplace (`/marketplace`), pero restringir el acceso a la vista detallada de cualquier subasta particular (`/marketplace/[id]`), redirigiendo a los visitantes anónimos a `/login?redirect=/marketplace/[id]` con aviso informativo.

### Acceptance criteria
- [ ] **Acceso público a catálogo general:** La ruta `/marketplace` responde exitosamente (HTTP 200) para visitantes no autenticados, permitiendo filtrar y explorar todas las tarjetas de préstamo disponibles.
- [ ] **Protección de subasta individual:**
  - Cualquier intento de ingresar directamente por URL a `/marketplace/[id]` sin sesión activa es interceptado por `middleware.ts` o SSR y redirigido con HTTP 307 a:
    `/login?redirect=/marketplace/[id]&reason=auth_required`
  - Si un usuario sin sesión hace clic en una tarjeta dentro de `/marketplace`, es dirigido al login con la misma redirección configurada.
- [ ] **Aviso informativo en login:**
  - Cuando la página `/login` recibe el parámetro `reason=auth_required`, muestra un banner informativo visible:
    *"Iniciá sesión o registrate para acceder a la información crediticia y financiera detallada de esta subasta."*
- [ ] **Retorno automático post-login:**
  - Una vez que el usuario se autentica con éxito, el sistema lo redirige de inmediato a la subasta `/marketplace/[id]` que intentaba consultar.
- [ ] **Pruebas automatizadas:** Pruebas en `middleware.test.ts` o pruebas de integración de rutas confirman que `/marketplace` es público y `/marketplace/[id]` exige autenticación devolviendo redirección.

### Out of scope
- Bloqueo o paywall para inversores registrados que aún no tienen fondos en custodia.

### Constraints
- Modificar [middleware.ts](file:///c:/Users/rafah/Documents/lencord/middleware.ts), [LoginForm.tsx](file:///c:/Users/rafah/Documents/lencord/components/auth/LoginForm.tsx) y [login.module.css](file:///c:/Users/rafah/Documents/lencord/components/auth/login.module.css).

---

## [8. Descripción breve en Marketplace y cálculo de ganancia (TNA, TEA, TEM) en Modal de Inversión](https://github.com/rfhfmnn/lencord/issues/59)

### Goal
Exhibir una breve descripción del proyecto o PyME solicitante en cada tarjeta del catálogo de oportunidades del marketplace (`LoanCard.tsx`), y dentro del modal "Invertir en esta PyME" (`InvestmentModal.tsx`), calcular en tiempo real el importe neto a ganar junto a la visualización clara de las tres tasas de referencia: TNA, TEA y TEM.

### Acceptance criteria
- [x] **Descripción breve en tarjeta de préstamo (`LoanCard.tsx`):**
  - Cada tarjeta en `/marketplace` renderiza un extracto de la descripción del proyecto (1 a 2 líneas).
  - La descripción es visible para todos los usuarios (con y sin sesión iniciada).
  - Si la descripción supera los 90 caracteres, se trunca limpiamente con puntos suspensivos (`...`) preservando la altura uniforme de la grilla de tarjetas.
- [x] **Cálculo dinámico en Modal de Inversión (`InvestmentModal.tsx`):**
  - Al ingresar o editar el monto en pesos a invertir:
    1. **Importe a ganar:** Calcula el interés estimado a percibir según el plazo del préstamo:
       `rendimiento = monto * (TEM / 100) * plazo_meses`.
    2. **Monto total a cobrar:** Muestra la suma de Capital + Intereses estimados (`monto + rendimiento`).
  - Si el monto ingresado está vacío o es menor al ticket mínimo ($10.000), el importe a ganar muestra `$ 0` sin arrojar errores.
- [x] **Detalle explícito de tasas financieras:**
  - El modal incluye una sección clara con las tres tasas normalizadas:
    - **TNA (Tasa Nominal Anual):** Tasa nominal de la subasta (ej: `45,0% TNA`).
    - **TEM (Tasa Efectiva Mensual):** `TNA / 12` (ej: `3,75% TEM`).
    - **TEA (Tasa Efectiva Anual):** `((1 + TEM/100)^12 - 1) * 100` (ej: `55,5% TEA`).
- [x] **Pruebas automatizadas:** Casos en `LoanCard.test.tsx` validan la presencia y truncado de la descripción; pruebas en `InvestmentModal.test.tsx` verifican la reactividad del cálculo de intereses y la visualización correcta de TNA, TEA y TEM.

### Out of scope
- Deducción de retenciones impositivas de Ganancias o Sellos en el cálculo orientativo (se presenta rendimiento bruto regulatorio).

### Constraints
- Modificar [LoanCard.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/LoanCard.tsx), [loan-card.module.css](file:///c:/Users/rafah/Documents/lencord/components/marketplace/loan-card.module.css), [InvestmentModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/InvestmentModal.tsx) e [investment-modal.module.css](file:///c:/Users/rafah/Documents/lencord/components/marketplace/investment-modal.module.css).

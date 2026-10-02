# Especificación de Cambios: Administrador, Panel PyME, Mesa de Crédito y Checkout de Inversión

Documento de especificación técnica y de producto elaborado a partir del relevamiento de requerimientos y las decisiones acordadas con el equipo.

---

## [1. Header y Navegación del Administrador](https://github.com/rfhfmnn/lencord/issues/73) (Issue #73)

### Goal
Garantizar que al autenticarse como administrador, la plataforma reconozca permanentemente dicho rol sin degradarlo a inversor, ocultando los accesos públicos ("Prestar", "Pedir financiación", "Cómo funciona", "FAQ") y proveyendo un menú dedicado y limpio centrado en la gestión operativa: `Lencord | Solicitudes`.

### Acceptance Criteria
- [ ] Al iniciar sesión con un usuario con rol `admin` en la base de datos, el badge de rol en el Header muestra unívocamente **"Admin"** (con estilo visual distintivo `roleBadgeAdmin`).
- [ ] No se sobreescribe el rol de administrador en `user_metadata` ni en el estado de sesión local tras el login.
- [ ] Se ocultan completamente los enlaces públicos **"Prestar"** y **"Pedir financiación"** cuando el usuario autenticado tiene rol `admin`.
- [ ] Se ocultan los enlaces institucionales **"Cómo funciona"** y **"FAQ"** en el menú de navegación cuando el usuario es `admin`.
- [ ] El menú de navegación principal del Administrador queda compuesto exclusivamente por:
  - Logotipo: **Lencord** (enlace a inicio o dashboard admin).
  - Enlace de navegación: **Solicitudes** (apunta a `/admin`).
- [ ] En la barra superior derecha se mantienen: campana de notificaciones, perfil del usuario con insignia "Admin", acceso a métricas generales de administración y botón para **Cerrar sesión**.

### Constraints & Files
- [components/layout/Header.tsx](file:///c:/Users/SYC/Desktop/lencord/components/layout/Header.tsx)
- [components/auth/LoginForm.tsx](file:///c:/Users/SYC/Desktop/lencord/components/auth/LoginForm.tsx)
- [tests/components/Header.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/Header.test.tsx)

---

## [2. Cuadro de Estado de Solicitud en el Panel PyME](https://github.com/rfhfmnn/lencord/issues/74) (Issue #74)

### Goal
Conectar el panel de control de la PyME con la sesión del usuario autenticado real (eliminando el identificador fijo de prueba) y presentar una tarjeta destacada superior que informe de manera clara, transparente e inmediata el estado actual de su solicitud de financiamiento.

### Acceptance Criteria
- [ ] [BorrowerDashboard.tsx](file:///c:/Users/SYC/Desktop/lencord/components/dashboard/BorrowerDashboard.tsx) resuelve el `borrower_id` a partir del usuario autenticado (`supabase.auth.getUser()`), recuperando sus préstamos y solicitudes reales.
- [ ] En la parte superior del panel, se renderiza una **tarjeta destacada de estado de solicitud** que contiene:
  - **Estado actual** con insignia de color correspondiente (`En evaluación crediticia`, `En subasta`, `Subasta completada`, `Préstamo activo`, `Rechazado`).
  - **Monto solicitado** (formateado en moneda nacional `$`) y **Plazo** en meses.
  - **Fecha de presentación** de la solicitud en formato legible (`DD/MM/AAAA`).
  - **Texto explicativo de la etapa**:
    - Si está en `in_review`: Mensaje explicativo informando análisis de riesgo crediticio con demora estimada de 24 a 48 hs hábiles.
    - Si está en `funding`: Monitor de subasta en vivo con barra de progreso, porcentaje cubierto, monto comprometido y días restantes de fondeo.
    - Si está en `rejected`: Cuadro explicativo con el motivo de rechazo indicado por la mesa de crédito.
    - Si está en `active`: Resumen de cuotas vigentes y botón de pago de cuota.
- [ ] Si la empresa no posee ninguna solicitud creada, se muestra el estado vacío informativo con botón directo a `/solicitar`.

### Constraints & Files
- [components/dashboard/BorrowerDashboard.tsx](file:///c:/Users/SYC/Desktop/lencord/components/dashboard/BorrowerDashboard.tsx)
- [app/dashboard/pyme/page.tsx](file:///c:/Users/SYC/Desktop/lencord/app/dashboard/pyme/page.tsx)
- [tests/components/BorrowerDashboard.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/BorrowerDashboard.test.tsx)

---

## [3. Mesa de Crédito (Datos PyME, Visualización de PDF y Fecha Límite de Solo Lectura)](https://github.com/rfhfmnn/lencord/issues/75) (Issue #75)

### Goal
Eliminar las etiquetas "N/A" en la consola de aprobación crediticia cargando los perfiles reales de la PyME desde la base de datos, habilitar la visualización homogénea de todos los documentos PDF adjuntos y presentar la fecha límite como un dato de solo lectura elegido originalmente por la PyME.

### Acceptance Criteria
- [ ] [AdminConsole.tsx](file:///c:/Users/SYC/Desktop/lencord/components/admin/AdminConsole.tsx) consulta y mapea los datos reales de la PyME solicitante desde la tabla `profiles` y `sme_credit_profiles`:
  - CUIT / Identificación fiscal validada (sin mostrar "N/A").
  - Razón social / Nombre legal.
  - Teléfono de contacto.
  - CBU/CVU bancario de desembolso.
- [ ] En la sección de documentación respaldatoria, todos los archivos PDF (Balance contable, constancias impositivas, F.931) disponen de un botón/enlace estandarizado **"📄 Ver Documento (PDF)"** que abre o descarga el archivo en una pestaña nueva utilizando URL firmada de Supabase Storage.
- [ ] El campo de **Fecha Límite de Subasta** pasa a ser de **estricta solo lectura**, mostrando la opción elegida por la PyME en su solicitud (ej. *"Fecha límite establecida por la PyME: 30 días (hasta 02/11/2026)"*).
- [ ] El administrador no edita la fecha límite; si la solicitud no resulta admisible en los términos solicitados, se utiliza el flujo de rechazo con especificación del motivo.

### Constraints & Files
- [components/admin/AdminConsole.tsx](file:///c:/Users/SYC/Desktop/lencord/components/admin/AdminConsole.tsx)
- [services/supabase/SupabaseStorageService.ts](file:///c:/Users/SYC/Desktop/lencord/services/supabase/SupabaseStorageService.ts)
- [tests/components/AdminConsole.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/AdminConsole.test.tsx)

---

## [4. Checkout de Inversión (Sandbox BaaS y Saldo en Custodia)](https://github.com/rfhfmnn/lencord/issues/76) (Issue #76)

### Goal
Erradicar el "error de base de datos" en el modal de inversión enviando el UUID válido del usuario autenticado a los procedimientos almacenados de Supabase, asegurar el funcionamiento del Sandbox BaaS con tarjeta de prueba y añadir la opción de recarga de saldo de prueba, contemplando la migración futura hacia la infraestructura BaaS por razones regulatorias.

### Acceptance Criteria
- [ ] [InvestmentModal.tsx](file:///c:/Users/SYC/Desktop/lencord/components/marketplace/InvestmentModal.tsx) y [LoanDetail.tsx](file:///c:/Users/SYC/Desktop/lencord/components/marketplace/LoanDetail.tsx) resuelven dinámicamente el `investor_id` desde el usuario autenticado (`auth.getUser()`), evitando el envío de strings estáticos como `'prof-inv-001'` que quiebran las restricciones de tipo `UUID` en PostgreSQL.
- [ ] En pagos mediante **Sandbox BaaS (Tarjeta)**:
  - Al utilizar la tarjeta simulada (terminada en `9010`), la inversión se procesa atómicamente, emite el recibo formal de colocación de fondos y actualiza el fondeo acumulado del préstamo sin arrojar error de base de datos.
- [ ] En pagos mediante **Saldo en Custodia**:
  - Se valida el balance disponible en `custody_transactions` / `profiles`.
  - Si el saldo es insuficiente o `$0`, se ofrece un botón accesible **"Cargar saldo de prueba"** (por ejemplo, `$1.000.000` de prueba) para facilitar testeos de liquidez.
- [ ] [services/supabase/errors.ts](file:///c:/Users/SYC/Desktop/lencord/services/supabase/errors.ts) intercepta los mensajes de negocio de PostgreSQL y muestra advertencias claras al usuario (ej. *"Saldo insuficiente"*, *"Cupo de subasta excedido"*, *"No se permite autofinanciamiento"*) en lugar del mensaje opaco *"Error en la base de datos"*.
- [ ] **Nota regulatoria documentada:** Se preserva la arquitectura modular del servicio de pagos para priorizar la pasarela BaaS integrada, garantizando que los fondos no sean retenidos en custodia propia de la plataforma conforme a la normativa financiera aplicable.

### Constraints & Files
- [components/marketplace/InvestmentModal.tsx](file:///c:/Users/SYC/Desktop/lencord/components/marketplace/InvestmentModal.tsx)
- [components/marketplace/LoanDetail.tsx](file:///c:/Users/SYC/Desktop/lencord/components/marketplace/LoanDetail.tsx)
- [services/supabase/SupabaseInvestmentService.ts](file:///c:/Users/SYC/Desktop/lencord/services/supabase/SupabaseInvestmentService.ts)
- [services/supabase/errors.ts](file:///c:/Users/SYC/Desktop/lencord/services/supabase/errors.ts)
- [tests/components/InvestmentModalCheckout.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/InvestmentModalCheckout.test.tsx)

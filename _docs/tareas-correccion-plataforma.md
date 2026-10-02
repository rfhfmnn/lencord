# Plan de Tareas: Correcciones y Mejoras en Flujos Críticos

Documento generado a partir del diagnóstico de causas raíz, definiciones acordadas y refinamiento (grooming) formal bajo el rol de Product Manager (`_docs/team/pm.md`).

---

## Tarea 1: Redirección automática a Home al Cerrar Sesión ([#77](https://github.com/rfhfmnn/lencord/issues/77))

### Goal
Al hacer clic en "Cerrar sesión" en el Header desde cualquier vista autenticada (desktop o mobile), la sesión debe revocarse y la aplicación debe navegar inmediatamente a la página principal (`/`).

### Acceptance criteria
- [ ] Al hacer clic en "Cerrar sesión" en el Header desktop desde una ruta protegida (`/dashboard/pyme`, `/dashboard/inversor`, `/admin`), la URL del navegador cambia inmediatamente a `/`.
- [ ] Al hacer clic en "Cerrar sesión" desde el menú desplegable mobile, el menú móvil se cierra y la URL del navegador cambia inmediatamente a `/`.
- [ ] El estado del Header se actualiza mostrando de inmediato los botones públicos "Iniciar sesión" y "Registrarse", sin requerir recargar la página.
- [ ] Si la llamada de red a `supabase.auth.signOut()` demora o falla por problemas de conectividad, la navegación a `/` y la limpieza del estado local (`currentUser = null`) ocurren igualmente en el bloque `finally`.
- [ ] Si el usuario tiene un modal abierto en pantalla al momento de cerrar sesión, no queda ningún overlay huérfano bloqueando la pantalla en la página principal.

### Out of scope
- Ninguno: todos los cambios pertenecen directamente a este flujo.

### Constraints
- Modificar exclusivamente `components/layout/Header.tsx`.
- Usar `useRouter` de `next/navigation` (`router.push('/')`) con fallback a `window.location.href = '/'` para asegurar compatibilidad universal en tests y SSR.
- Conservar el callback `onLogout` opcional si fue provisto en props.

---

## Tarea 2: Persistencia de Descripción y Visualización de Tasa en Solicitudes PyME ([#78](https://github.com/rfhfmnn/lencord/issues/78))

### Goal
Asegurar que la descripción obligatoria ingresada en el paso 2 del wizard de financiamiento se persista en la base de datos (tabla `loans.description`) y se renderice en el historial del prestatario, y que la columna "Plazo y Tasa" muestre el porcentaje numérico de tasa estimado durante la revisión y el definitivo una vez aprobado.

### Acceptance criteria
- [ ] En `types/services.ts`, la interfaz `SubmitLoanInput` incluye `description?: string | null;`.
- [ ] En `components/solicitar/LoanWizard.tsx`, el campo `step2Data.description.trim()` se asigna en `loanPayload` al invocar `submitLoanApplication`.
- [ ] En `services/supabase/SupabaseLoanService.ts` y `services/mock/MockLoanService.ts`, el método `submitLoanApplication` incluye `description` en el insert de la tabla `loans`.
- [ ] En el historial de solicitudes (`BorrowerDashboard.tsx`), la fila del préstamo muestra el texto exacto de la descripción en el elemento `loan-desc-${loan.id}` en lugar de `"Sin descripción detallada"`.
- [ ] Si la solicitud está en estado de revisión (`in_review`):
  - Para `TNA_FIXED`, la celda de tasa muestra `68.0% TNA (Estimada)` (o el valor simulado solicitado).
  - Para `CER_SPREAD`, la celda de tasa muestra `CER + 12.0% (Estimada)`.
- [ ] Si la solicitud fue evaluada y aprobada (`approved`, `funding`, `funded`, `active`, `repaying`, `paid`), la celda de tasa muestra el valor definitivo aprobado (ej: `${loan.borrower_rate.toFixed(1)}% TNA` o `CER + ${loan.borrower_rate.toFixed(1)}%`).
- [ ] Si existe un préstamo histórico previo con `description: null`, la UI muestra `'Sin descripción detallada'` como fallback seguro sin arrojar error.

### Out of scope
- Ninguno: todos los cambios pertenecen a este flujo.

### Constraints
- Archivos a modificar:
  - `types/services.ts`
  - `components/solicitar/LoanWizard.tsx`
  - `services/supabase/SupabaseLoanService.ts`
  - `services/mock/MockLoanService.ts`
  - `components/dashboard/BorrowerDashboard.tsx`
- Mantener compatibilidad con los tests unitarios y de integración existentes en Vitest.

---

## Tarea 3: Subsanación de URLs de Documentación y Estado de Archivos en Admin ([#79](https://github.com/rfhfmnn/lencord/issues/79))

### Goal
Eliminar completamente el dominio inexistente `storage.lencord.ar`, conectando los enlaces de documentación a rutas válidas de Supabase Storage (`loan-documents`), y reflejar en la consola de administración el estado real de cada archivo ("Presentado" con acceso de visualización en nueva pestaña, o "No presentado" deshabilitado).

### Acceptance criteria
- [ ] No existe ninguna ocurrencia del host ficticio `storage.lencord.ar` en el código fuente de la aplicación (`LoanWizard.tsx`, `AdminConsole.tsx`, etc.).
- [ ] En la sección "Documentación Respaldatoria" de `AdminConsole.tsx`:
  - Cada documento (Constancia AFIP/ARCA, Extractos bancarios, Balance contable, Formulario F.931) se presenta en una tarjeta individual con su estado explícito.
  - Si el archivo fue subido por el prestatario, la tarjeta muestra el badge verde `"Presentado"` y un enlace o botón accesible que abre el archivo en una nueva pestaña (`target="_blank"`, `rel="noopener noreferrer"`).
  - Si el archivo no fue subido (por ejemplo, extractos bancarios cuando la PyME optó por no adjuntarlos), la tarjeta muestra el badge neutral `"No presentado"` y el elemento queda deshabilitado (`aria-disabled="true"`), sin enlaces rotos ni acciones interactivas.
- [ ] Para los archivos almacenados en Supabase Storage, la URL de apertura se resuelve a través de `client.storage.from('loan-documents')` mediante URL firmada o pública válida.
- [ ] En modo simulado/mock, si se inspecciona una solicitud generada por seed data, el clic sobre un documento presentado no arroja errores de DNS (`DNS_PROBE_FINISHED_NXDOMAIN`) ni ventanas de error de red.

### Out of scope
- Ninguno: todos los cambios pertenecen a este flujo.

### Constraints
- Archivos a modificar:
  - `components/admin/AdminConsole.tsx`
  - `components/solicitar/LoanWizard.tsx`
  - `components/solicitar/StepDocumentUpload.tsx`
  - `services/supabase/SupabaseLoanService.ts`
- Respetar las políticas de acceso y seguridad del bucket de Supabase Storage (`loan-documents`).

---

## Tarea 4: Reorganización del Header para Cuenta de Administrador ([#80](https://github.com/rfhfmnn/lencord/issues/80))

### Goal
En la cuenta de Administrador, remover el enlace "Solicitudes" de la barra de navegación y centrar en el Header el bloque compuesto por el botón/enlace "Administración", el nombre del administrador y el badge "Admin", dejando en el extremo derecho exclusivamente el botón "Cerrar sesión".

### Acceptance criteria
- [ ] Cuando el usuario autenticado tiene rol de Administrador (`currentUser.role === 'admin'`):
  - El enlace `"Solicitudes"` no se muestra en ninguna parte del Header (ni en desktop ni en el menú mobile).
  - En la barra desktop, la sección central alberga de forma centrada el bloque de administración:
    - Enlace/botón navegable `"Administración"` que redirige a `/admin`.
    - Nombre del usuario (`currentUser.name`).
    - Badge visual con la leyenda `"Admin"`.
  - En el extremo derecho (`desktopActions`), solo se muestra el botón `"Cerrar sesión"`.
- [ ] En viewport móvil (< 768px):
  - El menú lateral desplegable no muestra la opción `"Solicitudes"`.
  - Muestra la opción `"Administración"` y el botón `"Cerrar sesión"`.
- [ ] Para usuarios con rol PyME, Inversor o visitantes no autenticados, la distribución del Header se mantiene idéntica a la actual (enlaces a la izquierda, acciones y perfil a la derecha).
- [ ] En pantallas intermedias (768px a 1024px), los elementos centrados no se superponen con la marca "Lencord" a la izquierda ni con "Cerrar sesión" a la derecha.

### Out of scope
- Ninguno: todos los cambios pertenecen a este flujo.

### Constraints
- Archivos a modificar:
  - `components/layout/Header.tsx`
  - `components/layout/Header.module.css`
- Seguir las pautas visuales y tokens de diseño definidos en `_docs/design-system.md`.

---

## Tarea 5: Corrección de Saldo de Custodia y Manejo de Error al Prestar ([#81](https://github.com/rfhfmnn/lencord/issues/81))

### Goal
Asegurar que el Header consulte y muestre el saldo de custodia real del inversor eliminando valores hardcodeados; que el modal de inversión deshabilite la opción de saldo en custodia cuando este sea $0 o insuficiente, preseleccionando tarjeta/transferencia simulada; y que el servidor y cliente mapeen con precisión los errores de validación de `process_investment_checkout_rpc`.

### Acceptance criteria
- [ ] En `components/layout/Header.tsx`, se eliminan por completo los valores fijos hardcodeados de `1250000` tanto en la inicialización de sesión como en los renderizados con fallback.
- [ ] El Header consulta y muestra el saldo de custodia real del usuario inversor invocando el servicio de inversiones (`getCustodyBalance`) o consultando `profiles.custody_balance`. Si la cuenta no tiene fondos, muestra `$ 0,00` (o su formato monetario equivalente).
- [ ] En `components/marketplace/InvestmentModal.tsx`:
  - Si el saldo en custodia del inversor es `$0` o menor al ticket mínimo de inversión (`MIN_INVESTMENT_TICKET` = $10.000):
    - El selector de pago "Saldo en cuenta de custodia" aparece visualmente deshabilitado (`disabled`).
    - Se muestra la aclaración `"Saldo insuficiente ($ 0,00)"`.
    - Se preselecciona de forma automática el medio de pago alternativo (`credit_card` / tarjeta o transferencia simulada).
  - Si el inversor tiene saldo pero ingresa un monto superior (`parsedAmount > custodyBalance`), el modal bloquea el envío y muestra el mensaje `"Saldo en custodia insuficiente para completar la inversión."`.
- [ ] En `services/supabase/errors.ts`, `mapSupabaseError` reconoce explícitamente los mensajes de excepción del procedimiento `process_investment_checkout_rpc` y los traduce a mensajes claros para el usuario:
  - `"Saldo en custodia insuficiente para realizar la inversión"` -> `"Tu saldo en custodia es insuficiente para realizar esta inversión."`
  - `"El préstamo no se encuentra en estado de fondeo"` -> `"La solicitud no se encuentra en etapa de fondeo abierta."`
  - `"El monto excede el cupo disponible de la subasta"` -> `"El monto excede el cupo disponible de la subasta."`
  - `"No se permite autofinanciamiento"` -> `"No podés invertir en tu propia solicitud de crédito."`
- [ ] Ante cualquiera de estas condiciones de negocio, la UI nunca muestra el mensaje opaco `"No se pudo completar la operación en el servidor"`.

### Out of scope
- Ninguno: todos los cambios pertenecen a este flujo.

### Constraints
- Archivos a modificar:
  - `components/layout/Header.tsx`
  - `components/marketplace/InvestmentModal.tsx`
  - `services/supabase/errors.ts`
  - `services/supabase/SupabaseInvestmentService.ts`
- Respetar los contratos de tipos en `@/types`.

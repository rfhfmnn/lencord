# Plan de Tareas: Correcciones y Mejoras en Flujos Críticos

Documento generado a partir del diagnóstico de causas raíz y las definiciones acordadas.

---

## Tarea 1: Redirección automática a Home al Cerrar Sesión ([#77](https://github.com/rfhfmnn/lencord/issues/77))

### Goal
Al hacer clic en "Cerrar sesión" en el Header (tanto en desktop como en mobile), la sesión debe destruirse en Supabase y el usuario debe ser redirigido inmediatamente a la página principal (`/`).

### Acceptance criteria
- [ ] Al pulsar "Cerrar sesión" desde cualquier ruta protegida (`/dashboard/pyme`, `/dashboard/inversor`, `/admin`, etc.), la URL del navegador cambia inmediatamente a `/`.
- [ ] El estado del usuario en el Header pasa a estado no autenticado (mostrando "Iniciar sesión" y "Registrarse").
- [ ] No se producen pantallas en blanco ni estados intermedios bloqueantes.
- [ ] El menú móvil (si está abierto) se cierra correctamente antes de la navegación.

### Out of scope
- Modificación del diseño visual de la landing page principal.

### Constraints
- Archivos a modificar: `components/layout/Header.tsx`.
- Utilizar `useRouter()` de Next.js (`router.push('/')`) con fallback a `window.location.href = '/'`.

---

## Tarea 2: Persistencia de Descripción y Visualización de Tasa en Solicitudes PyME ([#78](https://github.com/rfhfmnn/lencord/issues/78))

### Goal
Asegurar que la descripción obligatoria ingresada en el paso 2 del wizard de financiamiento se persista en la base de datos y se visualice en el historial del prestatario, y mostrar el porcentaje de tasa estimado mientras la solicitud está en revisión y el definitivo una vez aprobada.

### Acceptance criteria
- [ ] El campo `description` ingresado en `StepProjectConditions.tsx` se incluye en el payload de `submitLoanApplication`.
- [ ] La interfaz `SubmitLoanInput` en `types/services.ts` incluye `description?: string | null;`.
- [ ] `SupabaseLoanService` y `MockLoanService` insertan el campo `description` en la tabla `loans`.
- [ ] En la tabla del historial de solicitudes (`BorrowerDashboard.tsx`), se visualiza la descripción real del préstamo en lugar de `"Sin descripción detallada"`.
- [ ] En la columna "Plazo y Tasa" del historial, si el préstamo está en revisión (`in_review`), se muestra la tasa estimada con la leyenda informativa (ej: `68.0% TNA (Estimada)` para tasa fija o el spread correspondiente para CER).
- [ ] Si el préstamo fue aprobado (`approved`, `funding`, `funded`, `active`), se muestra la tasa definitiva fijada por el administrador (ej: `65.0% TNA`).

### Out of scope
- Modificación del algoritmo financiero de amortización de cuotas.

### Constraints
- Archivos a modificar:
  - `types/services.ts`
  - `components/solicitar/LoanWizard.tsx`
  - `services/supabase/SupabaseLoanService.ts`
  - `services/mock/MockLoanService.ts`
  - `components/dashboard/BorrowerDashboard.tsx`
- Respetar la sincronización estricta de tipos de `@/types`.

---

## Tarea 3: Subsanación de URLs de Documentación y Estado de Archivos en Admin ([#79](https://github.com/rfhfmnn/lencord/issues/79))

### Goal
Eliminar las URLs hardcodeadas con el dominio inexistente `storage.lencord.ar`, reemplazándolas por URLs firmadas y seguras de Supabase Storage (`loan-documents`), y reflejar con tarjetas de estado reales cuáles documentos fueron efectivamente presentados y cuáles no.

### Acceptance criteria
- [ ] Ningún enlace en la plataforma apunta a `storage.lencord.ar`.
- [ ] Los documentos obligatorios y opcionales adjuntos se almacenan y resuelven a través del bucket `loan-documents` de Supabase Storage mediante URLs válidas.
- [ ] En `AdminConsole.tsx`, los documentos no subidos (ej: Extractos bancarios si la empresa no los adjuntó) se muestran con una tarjeta informativa con estado `"No presentado"` y enlace deshabilitado.
- [ ] Los documentos efectivamente subidos (ej: Constancia AFIP/ARCA, Balances) se muestran como `"Presentado"` con enlace accesible que abre el visor o descarga en una nueva pestaña sin error de DNS.

### Out of scope
- Implementación de OCR automático o validación visual automatizada del contenido de los PDFs.

### Constraints
- Archivos a modificar:
  - `components/admin/AdminConsole.tsx`
  - `components/solicitar/LoanWizard.tsx`
  - `components/solicitar/StepDocumentUpload.tsx`
  - `services/supabase/SupabaseLoanService.ts`
- Políticas de Storage seguras compatibles con RLS y tokens de sesión.

---

## Tarea 4: Reorganización del Header para Cuenta de Administrador ([#80](https://github.com/rfhfmnn/lencord/issues/80))

### Goal
Remover el enlace innecesario "Solicitudes" del menú lateral del Header cuando el usuario es Administrador, y centrar en la barra superior el bloque de administración compuesto por "Administración", el nombre del administrador y el badge "Admin", dejando a la derecha únicamente el botón "Cerrar sesión".

### Acceptance criteria
- [ ] En la vista de Administrador, el enlace "Solicitudes" ya no aparece en la barra de navegación desktop ni mobile.
- [ ] El bloque central del Header contiene:
  - Enlace/botón "Administración" (que navega a `/admin`).
  - Nombre del Administrador activo.
  - Badge distintivo "Admin".
- [ ] En el extremo derecho (`desktopActions`), solo se visualiza el botón "Cerrar sesión".
- [ ] En vistas no administrativas (PyME, Inversor, público), el layout del Header mantiene su estructura habitual intacta.
- [ ] El diseño responde adecuadamente en resoluciones móviles y tabletas.

### Out of scope
- Modificaciones en las tablas o vistas internas de la consola `/admin`.

### Constraints
- Archivos a modificar:
  - `components/layout/Header.tsx`
  - `components/layout/Header.module.css`

---

## Tarea 5: Corrección de Saldo de Custodia y Manejo de Error al Prestar ([#81](https://github.com/rfhfmnn/lencord/issues/81))

### Goal
Eliminar el valor hardcodeado de $1.250.000 en el Header para inversores, sincronizando el saldo real desde el backend; deshabilitar el método de pago por custodia cuando el saldo sea $0 o insuficiente, y mapear adecuadamente los errores de la RPC en el servidor para evitar mensajes genéricos.

### Acceptance criteria
- [ ] El Header consulta y muestra el saldo de custodia real del inversor (`getCustodyBalance` / `profiles.custody_balance`), mostrando `$0,00` si la cuenta no posee fondos.
- [ ] Si el saldo en custodia es `$0` (o inferior al ticket mínimo de inversión), en `InvestmentModal.tsx`:
  - La opción "Saldo en custodia" aparece deshabilitada con la indicación `"Saldo insuficiente ($0,00)"`.
  - Se preselecciona automáticamente un medio de pago alternativo válido (ej. Tarjeta/Transferencia simulada).
- [ ] Si se intenta forzar una inversión sin fondos suficientes o en un préstamo no habilitado, el servidor devuelve un error específico y legible (ej: `"Saldo en custodia insuficiente para realizar la inversión"` o `"El préstamo no se encuentra disponible para fondeo"`).
- [ ] Se actualiza `mapSupabaseError` en `services/supabase/errors.ts` para reconocer y formatear todos los mensajes de excepción provenientes de `process_investment_checkout_rpc`.

### Out of scope
- Integración con pasarelas de pago reales externas en producción (Mercado Pago / Bind real).

### Constraints
- Archivos a modificar:
  - `components/layout/Header.tsx`
  - `components/marketplace/InvestmentModal.tsx`
  - `services/supabase/errors.ts`
  - `services/supabase/SupabaseInvestmentService.ts`

# Backlog de Nuevas Tareas - Mejoras de Usuario y Plataforma (nuevas_tareas.md)

Este documento contiene las tareas especificadas y refinadas según las respuestas y definiciones del usuario, siguiendo la plantilla `_docs/task-template.md` y las directrices de `_docs/team/pm.md`. Cada tarea cuenta con su correspondiente GitHub Issue bajo la etiqueta `user-feedback`.

---

## [1. Navegación dinámica y Header condicional por rol de usuario](https://github.com/rfhfmnn/lencord/issues/52)

### Goal
Ocultar enlaces irrelevantes en la barra de navegación superior (Header) según el tipo de usuario autenticado: cuando un usuario inicie sesión como PyME no debe figurar la opción de "Prestar", y cuando inicie sesión como Inversor no debe figurar la opción de "Pedir financiación".

### Acceptance criteria
- [ ] Al navegar sin sesión iniciada, se visualizan tanto el enlace "Prestar" como "Pedir financiación" en el Header de escritorio y menú móvil.
- [ ] Al iniciar sesión con rol `sme` o `borrower`, el enlace "Prestar" (hacia `/marketplace`) NO aparece ni en la barra de navegación de escritorio ni en el menú lateral móvil.
- [ ] Al iniciar sesión con rol `sme` o `borrower`, el enlace "Pedir financiación" (hacia `/solicitar`) se mantiene visible.
- [ ] Al iniciar sesión con rol `investor`, el enlace "Pedir financiación" (hacia `/solicitar`) NO aparece ni en la barra de navegación de escritorio ni en el menú lateral móvil.
- [ ] Al iniciar sesión con rol `investor`, el enlace "Prestar" (hacia `/marketplace`) se mantiene visible.
- [ ] Pruebas unitarias de `Header.test.tsx` verifican la visibilidad u ocultamiento de cada enlace según el rol inyectado.

### Out of scope
- Restricciones a nivel middleware de rutas directas (cubiertas en Tarea 7).

### Constraints
- Modificar [Header.tsx](file:///c:/Users/rafah/Documents/lencord/components/layout/Header.tsx) y sus estilos en [header.module.css](file:///c:/Users/rafah/Documents/lencord/components/layout/header.module.css).
- Mantener compatibilidad con los roles `'borrower'`, `'sme'`, `'investor'` y `'admin'`.

---

## [2. Registro con DNI opcional para Inversores y obligatoriedad en perfil para invertir](https://github.com/rfhfmnn/lencord/issues/53)

### Goal
Permitir que los inversores se registren sin ingresar obligatoriamente su DNI/CUIT en el formulario inicial, habilitar la carga/edición del DNI en la sección de perfil del inversor, y bloquear la confirmación de inversiones si el DNI aún no fue cargado.

### Acceptance criteria
- [ ] En `/registro`, al seleccionar la solapa "Inversor", el campo DNI/CUIT es opcional y muestra una leyenda indicando: *"Opcional al registrarse. Requerido posteriormente para poder invertir."*
- [ ] Un inversor puede completar el registro exitosamente dejando el campo de DNI vacío.
- [ ] Si el inversor decide ingresar un DNI al registrarse, se valida formato mínimo (7 u 8 dígitos para DNI, u 11 dígitos con algoritmo AFIP para CUIT).
- [ ] En el panel del inversor (`/dashboard/inversor`), existe una pestaña o sección "Mi Perfil" donde el inversor puede visualizar y cargar/actualizar su DNI/CUIT en cualquier momento.
- [ ] En el modal de inversión (`InvestmentModal.tsx`), si el inversor no tiene cargado su DNI, el botón de confirmar inversión se deshabilita y se muestra un banner de advertencia: *"Para poder invertir en esta PyME es necesario tener registrado tu DNI/CUIT en tu perfil"*, junto con un botón que lleva directamente a la sección de edición de perfil.
- [ ] La base de datos y esquemas de validación relajan la obligatoriedad inicial de `profiles.tax_id` para inversores nuevos y aceptan tanto DNI (7-8 dígitos) como CUIT (11 dígitos).

### Out of scope
- Validación biométrica KYC con Renaper en tiempo real (queda para fase posterior).

### Constraints
- Modificar [RegisterForm.tsx](file:///c:/Users/rafah/Documents/lencord/components/auth/RegisterForm.tsx), [InvestorDashboard.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/InvestorDashboard.tsx), [InvestmentModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/InvestmentModal.tsx).
- Crear migración SQL en `supabase/migrations/` para ajustar la restricción de `profiles.tax_id`.

---

## [3. Inicio de sesión con selección de rol (PyME vs Inversor) y cuenta unificada](https://github.com/rfhfmnn/lencord/issues/54)

### Goal
Implementar un selector de rol al iniciar sesión en `/login` ("Ingresar como PyME" o "Ingresar como Inversor") con un modelo de cuenta unificada, permitiendo que un mismo usuario utilice su cuenta con uno u otro perfil y sea dirigido al panel y contexto correspondiente.

### Acceptance criteria
- [ ] La página `/login` presenta un selector visual destacado con dos pestañas/opciones: "Ingresar como PyME" e "Ingresar como Inversor".
- [ ] Al seleccionar "Ingresar como PyME", tras autenticar credenciales válidas, la sesión activa se establece en modo PyME y el usuario es redirigido a `/dashboard/pyme` (o al parámetro `redirect` si aplica).
- [ ] Al seleccionar "Ingresar como Inversor", tras autenticar credenciales válidas, la sesión activa se establece en modo Inversor y el usuario es redirigido a `/dashboard/inversor` (o al parámetro `redirect` si aplica).
- [ ] Si el usuario tiene ambos roles habilitados en su cuenta unificada, puede alternar fácilmente entre su panel PyME y su panel de Inversor desde el menú de usuario en el Header sin tener que cerrar sesión.
- [ ] Si la cuenta del usuario aún no tiene activado el perfil para el rol seleccionado (por ejemplo, tiene cuenta solo de inversor e intenta entrar como PyME), se le ofrece un botón claro para "Activar perfil PyME" de forma asistida.
- [ ] Pruebas unitarias de `LoginForm.test.tsx` verifican la interacción con el selector y la redirección en base al rol elegido.

### Out of scope
- Recuperación de contraseña por SMS (se mantiene el flujo de email existente).

### Constraints
- Modificar [LoginForm.tsx](file:///c:/Users/rafah/Documents/lencord/components/auth/LoginForm.tsx), [Header.tsx](file:///c:/Users/rafah/Documents/lencord/components/layout/Header.tsx) y tipos en `@/types`.

---

## [4. Limpieza del Panel de Inversor y reemplazo de selector demo por perfil real](https://github.com/rfhfmnn/lencord/issues/55)

### Goal
Eliminar el selector de prueba con usuarios mock ("Juan Ignacio Pérez", "Inversora Austral S.A.", etc.) del Panel del Inversor y conectar el panel exclusivamente a la información real del usuario autenticado y su perfil.

### Acceptance criteria
- [ ] El selector `<select id="investor-select">` con perfiles ficticios es removido por completo de la vista en `InvestorDashboard.tsx`.
- [ ] El encabezado del panel muestra el nombre real y los datos del inversor autenticado provenientes de su sesión.
- [ ] Se incluye una tarjeta o pestaña de "Datos de la Cuenta / Perfil" donde el inversor visualiza su correo, CBU/CVU bancario asociado y su estado de DNI (permitiendo agregarlo o editarlo si no está cargado).
- [ ] Si el inversor no tiene inversiones activas, se presenta un estado vacío amigable con botón directo para explorar oportunidades en el marketplace.

### Out of scope
- Integración bancaria con homebanking en tiempo real.

### Constraints
- Modificar [InvestorDashboard.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/InvestorDashboard.tsx).
- Mantener las métricas financieras (TIR estimada, capital invertido, cronograma de cobros) vinculadas a los servicios de inversión.

---

## [5. Historial y tabla de solicitudes en Panel PyME con vencimiento opcional y descripción](https://github.com/rfhfmnn/lencord/issues/56)

### Goal
Incorporar en el panel de la PyME (`/dashboard/pyme`) una tabla detallada con el historial de todas sus solicitudes de financiamiento, incluyendo descripción del proyecto, fecha de solicitud, estado y la posibilidad de que la subasta tenga fecha de vencimiento opcional o indefinida (con opción de incorporarla o modificarla cuando la PyME lo desee).

### Acceptance criteria
- [ ] En `/dashboard/pyme`, se renderiza una tabla/cuadro "Historial de Solicitudes de Financiamiento".
- [ ] La tabla contiene las siguientes columnas:
  - ID / Destino del Proyecto
  - Breve descripción del proyecto
  - Monto solicitado (en ARS formateado)
  - Plazo (meses) y Tasa
  - Fecha de solicitud (formato `DD/MM/AAAA`)
  - Fecha de vencimiento de la subasta (muestra la fecha estipulada, o la leyenda *"Sin fecha límite"* si no se definió)
  - Estado actual (badge: en evaluación, en subasta, financiado, etc.)
  - Acciones: ver detalle, o botón para "Definir/Modificar vencimiento" de la subasta.
- [ ] En el formulario `/solicitar` (Paso 2), se añade un selector opcional para la duración de la subasta con las opciones: "Sin fecha límite", "15 días", "30 días", "45 días", o fecha personalizada.
- [ ] Si la subasta está activa sin fecha límite, la PyME puede ingresar a su panel y asignarle una fecha de cierre cuando lo considere oportuno.

### Out of scope
- Cancelación unilateral de subastas que ya superaron el 50% de fondeo sin mediación del equipo de riesgos.

### Constraints
- Modificar [BorrowerDashboard.tsx](file:///c:/Users/rafah/Documents/lencord/components/dashboard/BorrowerDashboard.tsx) y [StepProjectConditions.tsx](file:///c:/Users/rafah/Documents/lencord/components/solicitar/StepProjectConditions.tsx).
- Usar el sistema de diseño Lencord (tokens CSS, tipografía Inter, badges semánticos).

---

## [6. Simulador de cuotas y disclaimer en Paso 2 de Solicitud de Financiamiento](https://github.com/rfhfmnn/lencord/issues/57)

### Goal
Integrar en el paso 2 del wizard de solicitud de crédito (`/solicitar`) un simulador dinámico que calcule la cuota mensual estimada bajo el sistema francés a una tasa promedio de referencia, acompañado de un disclaimer explicativo sobre la evaluación de riesgo.

### Acceptance criteria
- [ ] En `StepProjectConditions.tsx`, al cambiar el monto o el plazo pretendido, se calcula automáticamente el valor de la cuota mensual promedio estimada.
- [ ] El cálculo utiliza la fórmula de amortización francesa implementada en `calculateBorrowerInstallment` con la tasa de referencia de la plataforma.
- [ ] Se muestra un bloque visual destacado con el monto de la cuota mensual estimada (ej: *"Cuota mensual estimada: $ 980.500 / mes"*).
- [ ] Inmediatamente debajo se renderiza un disclaimer visible y legible:
  *"Nota informativa: Este valor es una simulación orientativa basada en tasas promedio del mercado. La tasa final y el valor definitivo de la cuota serán determinados luego de la evaluación de riesgo crediticio de tu empresa por parte de nuestro equipo."*
- [ ] El simulador se actualiza en tiempo real de forma reactiva sin bloquear el avance al siguiente paso.

### Out of scope
- Cotización automática vinculada a scoring BCRA antes de subir los balances (Paso 3).

### Constraints
- Modificar [StepProjectConditions.tsx](file:///c:/Users/rafah/Documents/lencord/components/solicitar/StepProjectConditions.tsx).
- Reutilizar la lógica matemática existente en [HeroSimulator.tsx](file:///c:/Users/rafah/Documents/lencord/components/home/HeroSimulator.tsx).

---

## [7. Restricción de acceso a subastas particulares para usuarios sin sesión](https://github.com/rfhfmnn/lencord/issues/58)

### Goal
Permitir que los usuarios no autenticados naveguen libremente el catálogo general del marketplace (`/marketplace`), pero restringir el ingreso a la vista en detalle de una subasta específica (`/marketplace/[id]`), redirigiendo a `/login?redirect=/marketplace/[id]` con aviso informativo.

### Acceptance criteria
- [ ] Un usuario no autenticado puede entrar a `/marketplace` y ver la lista completa de oportunidades disponibles.
- [ ] Si un usuario no autenticado hace clic en una tarjeta de préstamo o intenta ingresar por URL a `/marketplace/[id]`, es redirigido automáticamente a `/login?redirect=/marketplace/[id]`.
- [ ] Al llegar al login vía redirección, se presenta una notificación o banner: *"Iniciá sesión o registrate para ver los detalles financieros y crediticios de esta subasta"*.
- [ ] Tras iniciar sesión exitosamente, el usuario es redirigido automáticamente a la subasta que intentaba consultar.
- [ ] Las reglas en `middleware.ts` protegen el patrón `/marketplace/:id` validando la presencia de sesión activa.

### Out of scope
- Venta de reportes de crédito individuales a no usuarios.

### Constraints
- Modificar [middleware.ts](file:///c:/Users/rafah/Documents/lencord/middleware.ts) y [MarketplaceCatalog.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/MarketplaceCatalog.tsx) / [LoanCard.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/LoanCard.tsx).

---

## [8. Descripción breve en Marketplace y cálculo de ganancia (TNA, TEA, TEM) en Modal de Inversión](https://github.com/rfhfmnn/lencord/issues/59)

### Goal
Mostrar una breve descripción del proyecto/PyME en cada tarjeta del marketplace general (visible para usuarios sin sesión), y dentro del modal "Invertir en esta PyME", calcular dinámicamente el rendimiento a ganar y exhibir las tasas TNA, TEA y TEM.

### Acceptance criteria
- [ ] En cada tarjeta de préstamo (`LoanCard.tsx`) del catálogo, se renderiza una breve descripción de 1 a 2 líneas sobre el destino del crédito o el proyecto de la PyME.
- [ ] Esta descripción es visible tanto para usuarios sin sesión como para usuarios autenticados.
- [ ] En `InvestmentModal.tsx`, al escribir un monto de inversión:
  - Se calcula el importe a ganar estimado en pesos (intereses netos estimados).
  - Se muestra el retorno total a percibir (Capital + Intereses).
  - Se detallan claramente las tres tasas financieras del préstamo:
    - **TNA** (Tasa Nominal Anual)
    - **TEA** (Tasa Efectiva Anual)
    - **TEM** (Tasa Efectiva Mensual)
- [ ] Los cálculos respetan el plazo en meses del préstamo seleccionado.

### Out of scope
- Retención impositiva automática de Ganancias/IVA en el simulador del modal (se mantiene bruto regulatorio).

### Constraints
- Modificar [LoanCard.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/LoanCard.tsx), [InvestmentModal.tsx](file:///c:/Users/rafah/Documents/lencord/components/marketplace/InvestmentModal.tsx) y estilos asociados.

# Backlog de Tareas - Mejoras de Navegación, Paneles y FAQs (`_docs/nuevas_tareas.md`)

Este documento especifica el nuevo conjunto de tareas acordadas a partir del feedback y las definiciones del usuario, siguiendo el formato estándar de `_docs/task-template.md` y las pautas de `_docs/team/pm.md`.

---

## 1. Header fluido y prevención de saltos de línea

### Goal
Hacer que la barra superior de navegación (`Header`) tenga un ancho fluido (100% de la pantalla con márgenes laterales) y reglas de estilo para que todos los enlaces, balances, identificador de usuario y acciones se mantengan alineados en una sola línea horizontal sin quebrar el texto en pantallas de escritorio.

### Acceptance criteria
- [ ] **Contenedor fluido:** En [header.module.css](file:///c:/Users/SYC/Desktop/lencord/components/layout/header.module.css), la clase `.container` cambia de un ancho fijo `max-width: 1200px` a un modelo fluido (`width: 100%`, `max-width: 100%`) con padding horizontal generoso (ej. `1.5rem` a `2.5rem`) que aprovecha el ancho completo del viewport.
- [ ] **Prevención de saltos de línea (`white-space: nowrap`):** 
  - Los contenedores `.desktopNav`, `.desktopActions`, `.sessionArea`, `.userProfile`, `.custodyBalance` y los botones de acción tienen declarada la propiedad `white-space: nowrap`.
  - Ningún botón ni enlace (como *"Cambiar a modo inversor/PyME"*, *"Pedir financiación"*, *"Cerrar sesión"*) divide su texto en dos líneas.
- [ ] **Distribución y espaciado:** Se ajustan los `gap` y márgenes entre los bloques de navegación y de sesión para que en resoluciones típicas de laptop (1366px, 1440px) y superiores todos los elementos convivan ordenados en una sola fila.
- [ ] **Menú móvil preservado:** En pantallas móviles y tablets (< 992px / 768px), el botón hamburguesa y el menú lateral desplegable continúan funcionando de forma reactiva e intacta.
- [ ] **Pruebas automatizadas:** La suite de pruebas de [tests/components/Header.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/Header.test.tsx) ejecuta y pasa sin errores.

### Out of scope
- Modificación del diseño visual del menú desplegable móvil.

### Constraints
- Modificar exclusivamente [components/layout/Header.tsx](file:///c:/Users/SYC/Desktop/lencord/components/layout/Header.tsx) y [components/layout/header.module.css](file:///c:/Users/SYC/Desktop/lencord/components/layout/header.module.css).
- Mantener compatibilidad con los tokens de diseño definidos en [design-system.md](file:///c:/Users/SYC/Desktop/lencord/_docs/design-system.md).

---

## 2. Nombre dinámico según el modo activo (PyME / Inversor) en Header y Paneles

### Goal
Mostrar dinámicamente el nombre o razón social correspondiente al rol en el que el usuario se encuentra operando (si está en modo PyME, su razón social empresarial; si está en modo Inversor, su nombre/razón social de inversor), tanto en la barra superior (`Header`) como en los encabezados de bienvenida de los paneles internos, recurriendo al nombre legal registrado como fallback en caso de no haberse definido uno específico.

### Acceptance criteria
- [ ] **Header superior dinámico:**
  - Al estar activo el modo PyME (`borrower` o `sme`): en la sección de usuario (`data-testid="header-user-name"`) se muestra prioritariamente la razón social de la empresa (`pyme_company_name` o `legal_name`).
  - Al estar activo el modo Inversor (`investor`): en la sección de usuario se muestra prioritariamente el nombre registrado de inversor (`investor_legal_name` o `legal_name`).
  - Al conmutar entre roles mediante el botón de cambio de modo, el nombre mostrado en el Header se actualiza inmediatamente al que corresponde al nuevo modo sin requerir recargar la página.
- [ ] **Encabezados internos de los Dashboards:**
  - En el **Panel del Inversor** (`/dashboard/inversor`): el mensaje de bienvenida y encabezado (`data-testid="investor-name"`) utiliza `investor_legal_name` (o fallback a `legal_name`).
  - En el **Panel de la PyME** (`/dashboard/pyme`): el encabezado principal del panel utiliza `pyme_company_name` (o fallback a `legal_name`).
- [ ] **Regla de fallback:**
  - Si un usuario tiene rol dual pero aún no completó un nombre alternativo específico para el rol secundario, se muestra de manera transparente su nombre legal principal (`profile.legal_name` o `user_metadata.legal_name`).
- [ ] **Pruebas automatizadas:**
  - Casos de prueba en [tests/components/Header.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/Header.test.tsx) y en los tests de dashboards validando que el nombre renderizado cambia según el modo activo.

### Out of scope
- Conexión con padrón en línea de AFIP/ARCA para validación registral de razones sociales.

### Constraints
- Mantener los tipos e interfaces estrictos en `@/types/models.ts` y contratos de sesión.

---

## 3. Reordenamiento de Paneles: Operatoria activa arriba y Mi Perfil abajo en ambos paneles

### Goal
Reorganizar la jerarquía visual tanto en el Panel del Inversor como en el Panel de la PyME para que las secciones de operativa activa (saldo en custodia, métricas de inversión, listado de inversiones activas, solicitudes de préstamos y monitor de subasta) se ubiquen en la parte superior, mientras que la sección de *"Mi perfil"* y configuración de cuenta quede situada abajo del todo.

### Acceptance criteria
- [ ] **Panel del Inversor (`/dashboard/inversor`):**
  - **Ubicación superior:** Saldo ilustrativo en custodia, tarjetas de métricas de resumen (capital invertido, rendimientos estimados, cantidad de préstamos), distribución por riesgo y listado/tabla de inversiones activas (o tarjeta de estado vacío con botón al marketplace).
  - **Ubicación inferior:** La sección *"Mi perfil"* (`id="perfil"`, con estado de DNI/CUIT, cuenta bancaria asociada y formulario de guardado) se traslada debajo de las tablas de inversiones activas y calendario de cobros.
  - La tarjeta de activación de rol PyME se mantiene al final del panel.
- [ ] **Panel de la PyME (`/dashboard/pyme`):**
  - **Ubicación superior:** Encabezado de solicitud actual, estado del préstamo (evaluación crediticia, subasta en vivo o calendario de pagos de cuotas) y selector de solicitudes.
  - **Ubicación inferior:** Preferencias de notificación y tarjeta de perfil/onboarding inversor al pie del panel.
- [ ] **Navegación por anclas:** Cualquier enlace o acción interna que apunte a `#perfil` continúa realizando scroll fluido hacia la sección ubicada en la parte inferior.
- [ ] **Pruebas automatizadas:** Se actualizan las pruebas en [InvestorDashboard.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/InvestorDashboard.test.tsx) y [BorrowerDashboard.test.tsx](file:///c:/Users/SYC/Desktop/lencord/tests/components/BorrowerDashboard.test.tsx) asegurando que el orden de renderizado y las aserciones de elementos sigan cumpliéndose.

### Out of scope
- Incorporación de nuevos campos de edición en el perfil que no existieran previamente.

### Constraints
- Modificaciones en [components/dashboard/InvestorDashboard.tsx](file:///c:/Users/SYC/Desktop/lencord/components/dashboard/InvestorDashboard.tsx) y [components/dashboard/BorrowerDashboard.tsx](file:///c:/Users/SYC/Desktop/lencord/components/dashboard/BorrowerDashboard.tsx).
- Preservar `data-testid` existentes para no romper tests de integración.

---

## 4. Página dedicada de Preguntas Frecuentes (`/faq`) con 3 apartados

### Goal
Implementar una ruta dedicada `/faq` estructurada con tres apartados interactivos ("General", "Para PyMEs" y "Para inversores"), dejando la arquitectura de componentes y estado armada y lista para recibir contenido futuro, y actualizar los enlaces del Header y Footer para que dirijan a `/faq`.

### Acceptance criteria
- [ ] **Ruta dedicada `/faq`:** Se crea la página en `app/faq/page.tsx` integrada con el layout general (`Header` y `Footer`).
- [ ] **Apartados organizados:** La vista dispone de un selector por pestañas (Tabs) o botones con diseño accesible para conmutar entre los 3 apartados:
  1. **"General"**
  2. **"Para PyMEs"**
  3. **"Para inversores"**
- [ ] **Estructura preparada (sin contenido definitivo):**
  - Cada apartado cuenta con un contenedor preparado (lista de preguntas frecuentes tipo acordeón expandible/colapsable accesible con atributos ARIA: `aria-expanded`, `role="region"`, `role="tab"`).
  - Incluye un estado ilustrativo o placeholders semánticos bien formateados indicando que las preguntas de esa categoría estarán disponibles próximamente.
- [ ] **Actualización de enlaces de navegación:**
  - En [Header.tsx](file:///c:/Users/SYC/Desktop/lencord/components/layout/Header.tsx): el enlace "FAQ" tanto de escritorio como móvil se actualiza de `/#faq` a `/faq`.
  - En [Footer.tsx](file:///c:/Users/SYC/Desktop/lencord/components/layout/Footer.tsx): el enlace "FAQ" se actualiza de `/#faq` a `/faq`.
- [ ] **Diseño visual:** Sigue las pautas del sistema de diseño ([design-system.md](file:///c:/Users/SYC/Desktop/lencord/_docs/design-system.md)) con colores institucionales, tipografía limpia y diseño responsive.
- [ ] **Pruebas automatizadas:** Se añade una prueba unitaria comprobando que `/faq` renderiza correctamente, que los 3 apartados están presentes y que la alternancia de pestañas funciona.

### Out of scope
- Redacción del copy comercial y legal final de las preguntas y respuestas.

### Constraints
- Componentes en `components/faq/` y página en `app/faq/page.tsx`.
- Estricto TypeScript sin errores de compilación (`npm run build`).

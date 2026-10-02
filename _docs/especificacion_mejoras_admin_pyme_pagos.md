# Especificación de Cambios: Administrador, Panel PyME, Mesa de Crédito y Checkout de Inversión

Documento de especificación técnica y de producto elaborado a partir del relevamiento de requerimientos y las decisiones acordadas con el equipo.

---

## [1. Header y Navegación del Administrador](https://github.com/rfhfmnn/lencord/issues/73) (Issue #73)

### Goal
Garantizar que al autenticarse como administrador, la plataforma reconozca permanentemente dicho rol sin degradarlo a inversor, ocultando los accesos públicos ("Prestar", "Pedir financiación", "Cómo funciona", "FAQ") tanto en escritorio como en móvil, y proveyendo un menú dedicado y limpio centrado en la gestión operativa: `Lencord | Solicitudes`.

### Acceptance criteria
- [ ] Al iniciar sesión con un usuario con rol `admin` en la base de datos (`profiles.role = 'admin'`), la insignia de rol en el Header muestra unívocamente "Admin" (utilizando la clase CSS `roleBadgeAdmin`).
- [ ] En `components/auth/LoginForm.tsx`, el submit de autenticación para usuarios administradores (`isAdminUser === true`) no sobreescribe su rol en `user_metadata` con `'investor'` ni `'borrower'`, preservando el rol `admin`.
- [ ] En la barra de navegación de escritorio (`desktopNav`), los enlaces públicos "Prestar" y "Pedir financiación" no se renderizan cuando el usuario activo tiene rol `admin`.
- [ ] En la barra de navegación de escritorio (`desktopNav`), los enlaces informativos "Cómo funciona" y "FAQ" no se renderizan cuando el usuario activo tiene rol `admin`.
- [ ] En el cajón de navegación móvil (`mobileDrawer`), se replica la misma lógica: los enlaces "Prestar", "Pedir financiación", "Cómo funciona" y "FAQ" permanecen ocultos para usuarios `admin`.
- [ ] El menú de navegación principal del Administrador queda compuesto exclusivamente por:
  - Logotipo de marca: "Lencord" (enlace a inicio).
  - Enlace de navegación: "Solicitudes" con atributo `href="/admin"` y `data-testid="header-solicitudes-link"`.
- [ ] En la barra de acciones de usuario a la derecha se mantienen visibles: campana de notificaciones (`NotificationBell`), perfil con nombre e insignia "Admin", enlace a panel de administración y botón "Cerrar sesión".
- [ ] El selector de cambio de rol ("Cambiar a modo Inversor / PyME") no se muestra cuando el rol activo es `admin`.
- [ ] Pruebas automatizadas en `tests/components/Header.test.tsx` validan:
  - Renderizado exclusivo de "Solicitudes" para rol `admin`.
  - Ausencia de "Prestar", "Pedir financiación", "Cómo funciona" y "FAQ" para `admin`.
  - Presencia del badge "Admin".

### Out of scope
- Reestructuración o rediseño de las tablas internas de la mesa de crédito en `/admin` (gestionado en #75).

### Constraints
- Modificar exclusivamente `components/layout/Header.tsx`, `components/auth/LoginForm.tsx` y `tests/components/Header.test.tsx`.
- Respetar los lineamientos de diseño de `_docs/design-system.md` y tipado estricto con `types/models.ts`.

---

## [2. Cuadro de Estado de Solicitud en el Panel PyME](https://github.com/rfhfmnn/lencord/issues/74) (Issue #74)

### Goal
Conectar el panel de control de la PyME con la sesión del usuario autenticado real (eliminando el identificador fijo de prueba) y presentar una tarjeta destacada superior que informe de manera clara, transparente e inmediata el estado actual de su solicitud de financiamiento.

### Acceptance criteria
- [ ] `BorrowerDashboard.tsx` resuelve automáticamente el `borrower_id` desde `client.auth.getUser()`. Si el prop `borrowerId` no fue provisto o es el default de test, y existe un usuario con sesión iniciada en Supabase, utiliza el `user.id` real para consultar la lista de préstamos (`listLoans({ borrower_id: user.id })`).
- [ ] Si se pasa un prop `borrowerId` explícito en pruebas unitarias, el componente respeta dicho prop para garantizar compatibilidad con los tests existentes.
- [ ] En la parte superior del panel, se renderiza una tarjeta destacada de estado de solicitud (`data-testid="pyme-status-hero-card"`) visible inmediatamente al cargar, conteniendo:
  - Estado actual con badge distintivo: `in_review` ("En evaluación crediticia"), `funding` ("En subasta en vivo"), `funded` ("Subasta completada - Pagaré listo"), `active` ("Préstamo activo"), `rejected` ("Solicitud rechazada"), `draft` ("Borrador pendiente").
  - Monto solicitado formateado en moneda argentina (ej. `$1.500.000`) y Plazo pretendido en meses.
  - Esquema de tasa pretendida o aprobada.
  - Fecha de presentación / creación de la solicitud formateada (`DD/MM/AAAA`).
- [ ] Renderizado condicional del bloque explicativo según la etapa:
  - Si el estado es `in_review`: Notificación informativa indicando que la solicitud está siendo analizada por el equipo de riesgos en la Central de Deudores del BCRA y documentación contable, con plazo estimado de 24 a 48 hs hábiles.
  - Si el estado es `funding`: Monitor con barra de progreso de subasta, porcentaje financiado, importe comprometido y contador de días restantes.
  - Si el estado es `rejected`: Cuadro de alerta con el motivo de rechazo registrado por la mesa de crédito y botón para volver a solicitar o contactar a soporte.
  - Si el estado es `funded`: Indicación destacada informando que la subasta concluyó exitosamente y botón para firmar el pagaré digital.
  - Si el estado es `active`: Resumen de cuotas vigentes y botón de pago de cuota pendiente.
- [ ] Si la PyME autenticada no tiene solicitudes creadas, se muestra el estado vacío informativo con llamada a la acción hacia `/solicitar`.
- [ ] Si la PyME posee más de una solicitud, el selector de solicitudes permite alternar entre ellas, actualizando la tarjeta destacada en tiempo real.
- [ ] Pruebas automatizadas en `tests/components/BorrowerDashboard.test.tsx` validan:
  - Resolución dinámica de la sesión del usuario.
  - Renderizado de la tarjeta destacada en estados `in_review`, `funding`, `rejected` y `empty`.

### Out of scope
- Módulo de refinanciación anticipada o solicitud de ampliación de créditos ya desembolsados (mover a futuro ticket de producto).

### Constraints
- Modificar exclusivamente `components/dashboard/BorrowerDashboard.tsx`, `app/dashboard/pyme/page.tsx` y `tests/components/BorrowerDashboard.test.tsx`.
- Mantener compatibilidad con `useServices()` y modo mock para testing sin backend activo.
- Seguir el sistema de diseño en `_docs/design-system.md`.

---

## [3. Mesa de Crédito (Datos PyME, Visualización de PDF y Fecha Límite de Solo Lectura)](https://github.com/rfhfmnn/lencord/issues/75) (Issue #75)

### Goal
Eliminar las etiquetas "N/A" en la consola de aprobación crediticia cargando los perfiles reales de la PyME desde la base de datos, habilitar la visualización homogénea de todos los documentos PDF adjuntos y presentar la fecha límite como un dato de solo lectura elegido originalmente por la PyME.

### Acceptance criteria
- [ ] `AdminConsole.tsx` consulta asíncronamente los perfiles de los prestatarios desde la tabla `profiles` para todos los `borrower_id` presentes en las solicitudes `in_review` (combinando con perfiles semilla en modo mock/offline).
- [ ] En la ficha de detalle de la solicitud seleccionada (`loan-detail-view`):
  - **CUIT / Identificación Fiscal**: Muestra el CUIT real del prestatario formateado (ej. `30-71234567-9`), sin mostrar "N/A" para usuarios registrados con `tax_id`.
  - **Razón Social / Nombre**: Muestra el nombre legal o de la empresa correspondiente al perfil del prestatario.
  - **Teléfono de Contacto**: Muestra el teléfono registrado en el perfil. Si no fue provisto, muestra "No registrado" en lugar de "N/A".
  - **CBU/CVU de Desembolso**: Muestra la cuenta bancaria de 22 dígitos registrada en el perfil.
- [ ] Sección de Documentación Respaldatoria:
  - Para cada documento cargado en la solicitud (`balance_sheet_url`, constancias impositivas o formulario F.931), se renderiza un botón/enlace estandarizado `📄 Ver Documento (PDF)` con atributos `target="_blank"` y `rel="noopener noreferrer"`.
  - Para archivos alojados en buckets privados de Supabase Storage (`loan-documents`), se genera y utiliza una URL firmada segura (`createSignedUrl`) para prevenir rechazos 403.
  - La mecánica de visualización y descarga es homogénea para todos los documentos de la solicitud.
- [ ] Parámetro de Fecha Límite de Fondeo (Subasta):
  - El campo de fecha límite en el formulario de aprobación se transforma en un bloque o campo de **estricta solo lectura** (`readOnly`).
  - Muestra la fecha límite establecida por la PyME al solicitar (ej. *"Fecha límite establecida por la PyME: 30 días (hasta 02/11/2026)"* o *"Sin fecha límite (abierta hasta completar fondeo)"*).
  - El administrador no cuenta con controles para alterar arbitrariamente dicha fecha; en caso de disconformidad, se rechaza la solicitud comunicando el motivo en el modal correspondiente.
- [ ] Pruebas automatizadas en `tests/components/AdminConsole.test.tsx` validan:
  - Renderizado correcto de CUIT, CBU y teléfono de prestatarios no estáticos.
  - Carácter de solo lectura del campo de fecha límite.
  - Presencia y funcionalidad de los enlaces a los documentos PDF.

### Out of scope
- Módulo de firma criptográfica y estampado de tiempo PKI del dictamen crediticio (gestionado en ticket legal posterior).

### Constraints
- Modificar exclusivamente `components/admin/AdminConsole.tsx`, `services/supabase/SupabaseStorageService.ts` y pruebas en `tests/components/AdminConsole.test.tsx`.
- Mantener compatibilidad con perfiles semilla para tests offline.
- Seguir el sistema de diseño en `_docs/design-system.md`.

---

## [4. Checkout de Inversión (Sandbox BaaS y Saldo en Custodia)](https://github.com/rfhfmnn/lencord/issues/76) (Issue #76)

### Goal
Erradicar el "error de base de datos" en el modal de inversión enviando el UUID válido del usuario autenticado a los procedimientos almacenados de Supabase, asegurar el funcionamiento del Sandbox BaaS con tarjeta de prueba y añadir la opción de recarga de saldo de prueba, contemplando la migración futura hacia la infraestructura BaaS por razones regulatorias.

### Acceptance criteria
- [ ] `InvestmentModal.tsx` y `LoanDetail.tsx` resuelven dinámicamente el `investor_id` desde el usuario autenticado (`client.auth.getUser()`). Si no se provee un prop explícito o es el valor mock por defecto, y existe una sesión activa, se envía el UUID real del usuario autenticado a PostgreSQL.
- [ ] En pagos mediante **Sandbox BaaS (Tarjeta)**:
  - Al completar la inversión con la tarjeta de prueba (terminada en `9010`), la operación se procesa atómicamente a través de `checkoutInvestment`, sin errores de sintaxis de tipo UUID en PostgreSQL.
  - Se genera y muestra el recibo formal de colocación de fondos (`receiptCard`) con desglose de monto, fecha, método de pago y últimos 4 dígitos.
  - Se actualiza el monto financiado de la subasta en tiempo real.
- [ ] En pagos mediante **Saldo en Custodia**:
  - Se valida el saldo disponible en el balance contable del inversor.
  - Si el saldo disponible es insuficiente o es `$0`, se ofrece un botón accesible (`data-testid="btn-add-test-funds"`) con el texto **"Cargar saldo de prueba"** que acredita de inmediato fondos de test (ej. `$1.000.000`) para posibilitar la inversión.
- [ ] Mapeo y saneamiento de errores en `services/supabase/errors.ts`:
  - Se interceptan y traducen a lenguaje claro los errores arrojados por PostgreSQL y procedimientos almacenados RPC:
    - Excepción de saldo insuficiente: *"Tu saldo en custodia es insuficiente para realizar esta inversión."*
    - Excepción de autofinanciamiento: *"No podés invertir en tu propia solicitud de crédito."*
    - Excepción de sobre-fondeo: *"El monto ingresado excede el cupo remanente de la subasta."*
    - Excepción de estado inválido: *"Esta solicitud de préstamo ya no se encuentra abierta a subasta."*
    - Se elimina el mensaje opaco genérico *"Error en la base de datos"*.
- [ ] **Nota Regulatoria Documentada**:
  - Se preserva la arquitectura modular del servicio de pagos para priorizar la pasarela BaaS integrada, garantizando que los fondos no sean retenidos en custodia propia de la plataforma conforme a la normativa financiera aplicable.
- [ ] Pruebas automatizadas en `tests/components/InvestmentModalCheckout.test.tsx` validan:
  - Resolución dinámica de UUID para usuarios autenticados.
  - Confirmación exitosa con Sandbox BaaS (tarjeta de prueba) y renderizado de recibo.
  - Funcionalidad del botón de carga de saldo de prueba y posterior inversión por saldo.
  - Muestra de mensajes de error de negocio amigables y comprensibles.

### Out of scope
- Integración en producción con webhook bancario de compensación interbancaria COELSA/BCRA.

### Constraints
- Modificar exclusivamente `components/marketplace/InvestmentModal.tsx`, `components/marketplace/LoanDetail.tsx`, `services/supabase/SupabaseInvestmentService.ts`, `services/supabase/errors.ts` y pruebas en `tests/components/InvestmentModalCheckout.test.tsx`.
- Respetar los contratos en `types/services.ts`.
- Seguir el sistema de diseño en `_docs/design-system.md`.

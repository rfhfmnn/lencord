import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_manuals import COMMON_CSS, generate_pdf, MANUALS_DIR

def build_user_manual():
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Manual de Usuario - Plataforma Lencord</title>
    <style>
        {COMMON_CSS}
    </style>
</head>
<body>

    <!-- PORTADA -->
    <div class="cover">
        <div class="cover-top">
            <div class="cover-brand">LEN<span>CORD</span></div>
            <div class="cover-badge">Guía Oficial de Usuario</div>
            <h1>MANUAL INTEGRAL DE USUARIO</h1>
            <div class="cover-subtitle">
                Guía práctica y completa para PyMEs solicitantes de crédito e inversores individuales y corporativos en el ecosistema de crowdlending argentino.
            </div>
        </div>
        <div class="cover-footer">
            <div><strong>Ecosistema:</strong> PyMEs e Inversores | Lencord SAS</div>
            <div><strong>Acceso:</strong> Portal Web (<code>/</code>, <code>/solicitar</code>, <code>/marketplace</code>, <code>/dashboard</code>)</div>
        </div>
    </div>

    <!-- CONTENIDO -->
    <div class="page">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual de Usuario • Bienvenida y Conceptos</div>
        </div>

        <h2>1. Bienvenido a Lencord</h2>
        <p>
            <strong>Lencord</strong> es una plataforma argentina de financiamiento colectivo peer-to-peer (P2P) diseñada para transformar la manera en que las pequeñas y medianas empresas obtienen capital productivo y las personas invierten sus ahorros. Al eliminar la intermediación bancaria burocrática, Lencord conecta de forma directa a empresas en crecimiento con inversores que buscan retornos reales en pesos ajustados a la realidad económica nacional.
        </p>

        <div class="card-grid">
            <div class="card">
                <h4>Para las PyMEs Solicitantes</h4>
                <ul>
                    <li><strong>Proceso 100% digital:</strong> Solicitud online en minutos sin filas ni carpetas físicas.</li>
                    <li><strong>Evaluación ágil:</strong> Respuesta y dictamen crediticio en 24 a 48 horas hábiles.</li>
                    <li><strong>Condiciones a medida:</strong> Plazos desde 30 días hasta 12 meses, a tasa fija o indexada por CER.</li>
                    <li><strong>Sin sorpresas:</strong> Sin comisiones ocultas de mantenimiento bancario.</li>
                </ul>
            </div>
            <div class="card">
                <h4>Para los Inversores</h4>
                <ul>
                    <li><strong>Rendimientos atractivos:</strong> Tasas competitivas superiores a instrumentos tradicionales.</li>
                    <li><strong>Tickets accesibles:</strong> Posibilidad de diversificar desde montos bajos en múltiples PyMEs.</li>
                    <li><strong>Cobro mensual en cuenta:</strong> Amortización de capital e intereses acreditados directamente.</li>
                    <li><strong>Impacto en economía real:</strong> Sus fondos potencian empresas productivas locales.</li>
                </ul>
            </div>
        </div>

        <h3>1.1. Seguridad Jurídica y Regla "Todo o Nada"</h3>
        <p>
            Todas las operaciones se instrumentan mediante contratos de mutuo digital y <strong>Pagarés Electrónicos</strong> con firma digital u OTP, los cuales otorgan <em>vía ejecutiva judicial</em> en caso de mora conforme a la legislación argentina.
        </p>
        <div class="alert-box alert-success">
            <strong>Protección "Todo o Nada":</strong> Las subastas colectivas tienen una meta fija de fondos. Si una subasta no alcanza el 100% de los fondos antes de su fecha límite, la operación se cancela y los importes comprometidos son reintegrados inmediatamente a los inversores sin ningún tipo de comisión ni descuento.
        </div>

        <h2>2. Navegación Inicial y Uso del Simulador de Crédito</h2>
        <p>
            Desde la página de inicio (<code>/</code>), cualquier visitante puede proyectar operaciones en tiempo real antes de registrarse mediante el <strong>Simulador Interactivo</strong> ubicado en la portada:
        </p>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Pestaña del Simulador</th>
                        <th>Parámetros a Configurar</th>
                        <th>Cálculo Inmediato Mostrado</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Quiero Financiación</strong> (Modo PyME)</td>
                        <td>
                            • Monto pretendido ($500.000 a $15.000.000+)<br>
                            • Plazo (30, 60, 90 días o 6 a 12 meses)<br>
                            • Esquema: Tasa Fija TNA o Tasa CER + Margen
                        </td>
                        <td>
                            <strong>Cuota mensual estimada a pagar</strong> con desglose de amortización e interés proyectado.
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Quiero Invertir</strong> (Modo Prestamista)</td>
                        <td>
                            • Importe a invertir<br>
                            • Plazo de preferencia<br>
                            • Modalidad de tasa pretendida
                        </td>
                        <td>
                            <strong>Ganancia neta total proyectada</strong> y rendimiento porcentual anual estimado.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="page-break"></div>
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual de Usuario • Guía para PyMEs</div>
        </div>

        <h2>3. Guía Paso a Paso para PyMEs (Solicitantes de Financiación)</h2>
        <p>
            Para publicar un proyecto en la subasta colectiva, ingrese al formulario multipaso haciendo clic en el botón <strong>"Pedir financiación"</strong> o dirigiéndose a la ruta <code>/solicitar</code>:
        </p>

        <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-text">
                <strong>Paso 1: Identificación y Contacto de la Empresa:</strong><br>
                Complete la Razón Social o Nombre de Fantasía, seleccione la personería jurídica (SAS, SA, SRL, Monotributo o Responsable Inscripto) e ingrese el CUIT de la empresa o titular (el sistema valida la consistencia del dígito verificador). Indique la fecha de inicio de actividades y los datos del apoderado o titular (Nombre, DNI y teléfono móvil de contacto).
            </div>
        </div>

        <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-text">
                <strong>Paso 2: Condiciones del Financiamiento y Destino de Fondos:</strong><br>
                Seleccione la categoría de inversión entre las 5 opciones habilitadas:
                <ul>
                    <li><em>Capital de trabajo:</em> Compra de mercadería, insumos o materias primas.</li>
                    <li><em>Maquinaria y equipamiento:</em> Incorporación o recambio tecnológico.</li>
                    <li><em>Refinanciación de pasivos:</em> Consolidación de deudas de corto plazo a condiciones más favorables.</li>
                    <li><em>Expansión comercial:</em> Apertura de nuevos locales o desarrollo de sucursales.</li>
                    <li><em>Nuevas PyMEs / Emprender:</em> Proyectos productivos en etapa inicial.</li>
                </ul>
                Defina el monto requerido en pesos, el plazo pretendido (de 1 a 12 meses), su preferencia de tasa (fija o variable por inflación) y redacte una breve memoria explicativa del destino de los fondos (hasta 500 caracteres).
            </div>
        </div>

        <div class="step-item">
            <div class="step-num">3</div>
            <div class="step-text">
                <strong>Paso 3: Documentación Respaldatoria (Archivos PDF):</strong><br>
                Suba los documentos para la auditoría de riesgo crediticio:
                <ul>
                    <li><strong>Constancia de AFIP / ARCA (Obligatoria):</strong> Comprobante de inscripción fiscal vigente.</li>
                    <li><strong>Extractos Bancarios de los últimos 3 meses (Recomendado):</strong> Para acreditar el flujo habitual de ingresos.</li>
                    <li><strong>Balance Contable del último ejercicio (Opcional):</strong> Si su empresa dispone de balances certificados.</li>
                    <li><strong>Formulario 931 (Opcional):</strong> Para acreditar nómina de empleados si cuenta con personal en relación de dependencia.</li>
                </ul>
            </div>
        </div>

        <div class="step-item">
            <div class="step-num">4</div>
            <div class="step-text">
                <strong>Paso 4: Datos Bancarios y Conformidad Legal:</strong><br>
                Informe su CBU o CVU de 22 dígitos bancario donde se transferirán los fondos al completarse la subasta. Marque las casillas de Declaración Jurada sobre el origen lícito de los fondos y aceptación de las condiciones marco para la emisión del pagaré digital. Al presionar <strong>"Enviar solicitud"</strong>, su expediente pasa a estado <code>En revisión</code>.
            </div>
        </div>

        <h3>3.1. Hito Clave: Firma Digital del Pagaré Electrónico</h3>
        <p>
            Una vez aprobada su solicitud y completado el 100% del fondeo en el marketplace, la PyME recibe una notificación en su panel (<code>/dashboard/pyme</code>):
        </p>
        <div class="alert-box alert-warning">
            <strong>Firma Pendiente:</strong> El botón <em>"Firmar Pagaré Digital"</em> se habilitará en su tablero. Al pulsarlo, podrá leer el contrato de mutuo con la tabla definitiva de cuotas y fechas de vencimiento. Ingrese el código OTP de verificación de seguridad recibido en su dispositivo para ratificar legalmente la operación. Tras la firma, los fondos se acreditarán de inmediato en su cuenta bancaria y el crédito pasará a estado <code>Activo</code>.
        </div>

        <h3>3.2. Gestión de Pagos y Cuotas Mensuales</h3>
        <p>
            Desde su panel <code>/dashboard/pyme</code>, dispondrá de una tabla interactiva de amortización para consultar el estado de cada cuota (<em>Pendiente</em>, <em>Pagada</em> o <em>Vencida</em>), el monto exacto a debitar o transferir y la descarga de comprobantes.
        </p>

        <div class="page-break"></div>
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual de Usuario • Guía para Inversores</div>
        </div>

        <h2>4. Guía Paso a Paso para Inversores (Prestamistas Colectivos)</h2>
        <p>
            Invertir en Lencord le permite rentabilizar su capital respaldando a la producción nacional bajo un esquema transparente, diversificado y jurídicamente blindado.
        </p>

        <h3>4.1. Exploración del Catálogo en el Marketplace (<code>/marketplace</code>)</h3>
        <p>
            Acceda a la sección <strong>"Prestar"</strong> o <code>/marketplace</code> para visualizar todas las solicitudes activas. Utilice los filtros interactivos para encontrar oportunidades que coincidan con su perfil:
        </p>
        <ul>
            <li><strong>Filtro por Nivel de Riesgo:</strong>
                <span class="tier-badge tier-a">Tier A</span> (Máxima solvencia),
                <span class="tier-badge tier-b">Tier B</span> (Riesgo moderado),
                <span class="tier-badge tier-c">Tier C</span> (Mayor rentabilidad).
            </li>
            <li><strong>Filtro por Tipo de Tasa:</strong> TNA Fija nominal o Variable indexada por inflación (CER).</li>
            <li><strong>Filtro por Plazo:</strong> Corto plazo (30 a 90 días) o mediano plazo (6 a 12 meses).</li>
        </ul>

        <h3>4.2. Interpretación de las Tarjetas de Oportunidad</h3>
        <p>Cada tarjeta exhibe métricas esenciales para tomar decisiones informadas:</p>
        <div class="card-grid">
            <div class="card">
                <h4>Indicadores Financieros</h4>
                <p>• <strong>Tasa Anual Neta:</strong> Retorno anual que percibirá su inversión.</p>
                <p>• <strong>Plazo de Devolución:</strong> Cantidad de meses de duración.</p>
                <p>• <strong>Categoría de Proyecto:</strong> Destino productivo de la empresa.</p>
            </div>
            <div class="card">
                <h4>Progreso de la Subasta</h4>
                <p>• <strong>Barra Porcentual:</strong> Grado de completitud del cupo.</p>
                <p>• <strong>Días Restantes:</strong> Tiempo límite antes del cierre.</p>
                <p>• <strong>Monto Fondeado vs. Solicitado:</strong> Capital comprometido hasta el momento.</p>
            </div>
        </div>

        <h3>4.3. Cómo Comprometer una Inversión</h3>
        <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-text">Haga clic en la oportunidad deseada o presione <strong>"Ver detalle"</strong>.</div>
        </div>
        <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-text">
                Revise la descripción extendida del proyecto y el perfil crediticio anonimizado (categoría BCRA, antigüedad comercial).
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">3</div>
            <div class="step-text">
                Presione <strong>"Invertir ahora"</strong>. Se desplegará el modal de suscripción. Ingrese el monto que desea aportar (el sistema valida que no exceda el cupo restante de la subasta).
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">4</div>
            <div class="step-text">
                Confirme la operación. Sus fondos quedan retenidos bajo el esquema protegido <em>"Todo o Nada"</em> hasta el cierre exitoso de la subasta.
            </div>
        </div>

        <h3>4.4. Control de Cartera en el Panel del Inversor (<code>/dashboard/inversor</code>)</h3>
        <p>
            En su tablero personal podrá realizar el seguimiento integral de sus colocaciones:
        </p>
        <ul>
            <li><strong>Resumen Financiero:</strong> Capital total invertido, intereses brutos devengados y tasa promedio ponderada.</li>
            <li><strong>Diversificación de Cartera:</strong> Distribución porcentual de su capital entre préstamos Tier A, B y C.</li>
            <li><strong>Calendario Mensual de Cobros:</strong> Cronograma detallado de cuotas que irá cobrando cada mes, detallando la fecha estimada de depósito de capital e intereses en su cuenta bancaria.</li>
        </ul>

        <h2>5. Preguntas Frecuentes y Soporte</h2>
        <div class="card-grid">
            <div class="card">
                <h4>¿Qué ocurre si la PyME se retrasa en un pago?</h4>
                <p>El pagaré electrónico otorga fuerza ejecutiva inmediata. Lencord gestiona la cobranza prejudicial automatizada y, de persistir la mora, se activa el cobro por vía ejecutiva judicial en favor de los inversores.</p>
            </div>
            <div class="card">
                <h4>¿Lencord cobra comisiones al inversor?</h4>
                <p>No. El rendimiento publicado en las tarjetas del marketplace es el retorno neto para el inversor. Los honorarios de la plataforma están incluidos en el spread que abona la PyME.</p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    pdf_path = os.path.join(MANUALS_DIR, "Manual_Usuario_Lencord.pdf")
    generate_pdf(html, pdf_path)

if __name__ == "__main__":
    build_user_manual()

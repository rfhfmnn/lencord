import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_manuals import COMMON_CSS, generate_pdf, MANUALS_DIR

def build_admin_manual():
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Manual de Administrador - Plataforma Lencord</title>
    <style>
        {COMMON_CSS}
    </style>
</head>
<body>

    <!-- PORTADA -->
    <div class="cover">
        <div class="cover-top">
            <div class="cover-brand">LEN<span>CORD</span></div>
            <div class="cover-badge">Backoffice & Mesa de Crédito</div>
            <h1>MANUAL DE ADMINISTRADOR DE PLATAFORMA</h1>
            <div class="cover-subtitle">
                Procedimientos operativos para la evaluación crediticia de PyMEs, auditoría documental, scoring de riesgo BCRA y parametrización de subastas colectivas.
            </div>
        </div>
        <div class="cover-footer">
            <div><strong>Consola:</strong> Mesa de Crédito / Backoffice (<code>/admin</code>)</div>
            <div><strong>Perfil Requerido:</strong> Rol Administrador (<code>role = 'admin'</code>)</div>
        </div>
    </div>

    <!-- CONTENIDO -->
    <div class="page">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual de Administrador • Operaciones & Mesa de Riesgo</div>
        </div>

        <h2>1. Rol y Responsabilidades del Administrador en Lencord</h2>
        <p>
            El <strong>Administrador de Mesa de Crédito</strong> en Lencord es el custodio de la calidad crediticia y la transparencia del marketplace. A diferencia de las entidades financieras tradicionales regidas por la Ley 21.526, Lencord no otorga préstamos con fondos propios ni asume intermediación financiera especulativa; actúa como un mandatario tecnológico que analiza y califica la solvencia de las PyMEs solicitantes para presentarlas ante la comunidad inversora con información fidedigna y estandarizada.
        </p>

        <h3>1.1. Principios Fundamentales del Backoffice</h3>
        <ul>
            <li><strong>Diligencia y Veracidad:</strong> Cada solicitud debe ser validada contra fuentes oficiales (AFIP / ARCA y Central de Deudores del BCRA).</li>
            <li><strong>Confidencialidad Estricta:</strong> Los balances contables, extractos bancarios y declaraciones juradas son de uso exclusivo interno y nunca se publican de forma abierta en el marketplace.</li>
            <li><strong>Protección del Ecosistema Inversor:</strong> La asignación de Tiers de riesgo debe reflejar objetivamente la probabilidad de repago y solvencia de la empresa.</li>
            <li><strong>Equidad Financiera para PyMEs:</strong> El spread de intermediación tecnológica debe ser competitivo y permitir tasas de financiamiento razonables para el sector productivo argentino.</li>
        </ul>

        <h2>2. Acceso y Estructura de la Consola Administrativa</h2>
        <p>
            El panel de gestión administrativa se encuentra centralizado en la ruta web segura:
        </p>
        <pre><code>http://localhost:3000/admin</code></pre>

        <div class="alert-box alert-info">
            <strong>Permisos de Acceso:</strong> Esta vista está restringida a usuarios con rol administrativo (<code>role: 'admin'</code>). En modo de desarrollo y mock, la consola se encuentra disponible de forma predeterminada con datos semilla precargados listos para auditar.
        </div>

        <h3>2.1. Anatomía Visual de la Interfaz</h3>
        <p>La consola está diseñada con una disposición ergonómica en dos columnas principales:</p>

        <div class="card-grid">
            <div class="card">
                <h4>Panel Izquierdo: Bandeja de Solicitudes</h4>
                <p>Muestra el listado de todas las solicitudes de crédito en estado de revisión (<code>in_review</code>). Incluye:</p>
                <ul>
                    <li>Contador global de expedientes pendientes.</li>
                    <li>Razón social de la PyME y CUIT.</li>
                    <li>Monto solicitado y etiqueta de categoría.</li>
                    <li>Selector interactivo para alternar entre expedientes.</li>
                </ul>
            </div>
            <div class="card">
                <h4>Panel Derecho: Mesa de Evaluación</h4>
                <p>Permite inspeccionar en profundidad la solicitud seleccionada y ejecutar la aprobación:</p>
                <ul>
                    <li>Ficha corporativa y datos bancarios (CBU/CVU).</li>
                    <li>Destino y justificación comercial del financiamiento.</li>
                    <li>Visor de documentación de respaldo subida en PDF.</li>
                    <li>Consola de scoring, fijación de tasas y publicación.</li>
                </ul>
            </div>
        </div>

        <div class="page-break"></div>
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual de Administrador • Evaluación Crediticia</div>
        </div>

        <h2>3. Proceso Paso a Paso de Evaluación Crediticia</h2>
        <p>
            Cada expediente que ingresa a la plataforma debe someterse al siguiente protocolo de cuatro etapas antes de su autorización:
        </p>

        <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-text">
                <strong>Verificación de Datos Fiscales y Personería Jurídica:</strong><br>
                Revise la razón social, tipo societario (SAS, SA, SRL, Monotributo o Responsable Inscripto) y fecha de inicio de actividades. Verifique la validez del CUIT fiscal mediante el algoritmo módulo 11 incorporado en el sistema.
            </div>
        </div>

        <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-text">
                <strong>Auditoría Documental de Respaldo:</strong><br>
                En el bloque <em>Documentación Respaldatoria</em>, haga clic en los enlaces de los archivos adjuntos en formato PDF:
                <ul>
                    <li><strong>Constancia de AFIP / ARCA (Obligatoria):</strong> Verifique que la empresa se encuentre con CUIT activa, sin bloqueos tributarios y con actividad comercial coherente con el préstamo solicitado.</li>
                    <li><strong>Extractos Bancarios (3 últimos meses):</strong> Compruebe el volumen de acreditaciones mensuales. Como regla de prudencia, la cuota estimada del préstamo no debería superar el 25% del promedio de ingresos mensuales demostrados.</li>
                    <li><strong>Balance Contable (Opcional):</strong> Para empresas con más de un año de ejercicio, analice el índice de liquidez corriente y nivel de endeudamiento patrimonial.</li>
                    <li><strong>Formulario 931 (Opcional):</strong> Evalúe la nómina de empleados y verifique la ausencia de pasivos previsionales críticos.</li>
                </ul>
            </div>
        </div>

        <div class="step-item">
            <div class="step-num">3</div>
            <div class="step-text">
                <strong>Consulta y Calificación en Central de Deudores BCRA:</strong><br>
                El sistema consulta de forma automatizada la API pública de la Central de Deudores del Banco Central de la República Argentina (<code>api.bcra.gob.ar</code>). Seleccione en el menú desplegable la situación crediticia histórica informada por el sistema financiero:
            </div>
        </div>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Nivel BCRA</th>
                        <th>Clasificación Oficial</th>
                        <th>Criterio de Evaluación en Lencord</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Situación 1</strong></td>
                        <td>Normal (Atrasos &lt; 31 días)</td>
                        <td>Apta para máxima calificación (Tier A o Tier B). Historial intachable.</td>
                    </tr>
                    <tr>
                        <td><strong>Situación 2</strong></td>
                        <td>Con seguimiento especial (Mora 31-60 días)</td>
                        <td>Apta para Tier B o Tier C previa justificación operativa en notas.</td>
                    </tr>
                    <tr>
                        <td><strong>Situación 3</strong></td>
                        <td>Con problemas (Mora 61-120 días)</td>
                        <td>Solo admisible en Tier C bajo destino específico de refinanciación.</td>
                    </tr>
                    <tr>
                        <td><strong>Situación 4</strong></td>
                        <td>Alto riesgo de insolvencia (Mora 121-180 días)</td>
                        <td><strong>No admisible:</strong> Requiere rechazo inmediato de la solicitud.</td>
                    </tr>
                    <tr>
                        <td><strong>Situación 5</strong></td>
                        <td>Irrecuperable (Mora &gt; 180 días o quiebra)</td>
                        <td><strong>Rechazo automático:</strong> Incompatible con los estándares de Lencord.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="step-item">
            <div class="step-num">4</div>
            <div class="step-text">
                <strong>Asignación del Semáforo de Riesgo (Risk Tier):</strong><br>
                Seleccione el nivel de riesgo que será exhibido en las tarjetas del marketplace para orientar a los inversores:
                <br><br>
                <span class="tier-badge tier-a">Tier A (Bajo Riesgo)</span>: Empresas con más de 2 años de actividad comprobable, situación BCRA 1, flujo bancario regular y balances positivos.
                <br><br>
                <span class="tier-badge tier-b">Tier B (Riesgo Moderado)</span>: Empresas estables, facturación adecuada para cubrir la cuota, situación BCRA 1 o 2 transitoria ya regularizada.
                <br><br>
                <span class="tier-badge tier-c">Tier C (Mayor Rendimiento)</span>: Startups, PyMEs de reciente inicio o sin balances certificados. Requiere ofrecer mayor tasa al inversor para compensar el riesgo.
            </div>
        </div>

        <div class="page-break"></div>
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Manual de Administrador • Parametrización de Subasta</div>
        </div>

        <h2>4. Parametrización Financiera y Publicación en Subasta</h2>
        <p>
            Una vez validada la solvencia, el administrador procede a completar los parámetros económicos que gobernarán la subasta colectiva:
        </p>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Campo del Formulario</th>
                        <th>Rango Típico</th>
                        <th>Descripción e Impacto</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Tasa Inversor (%)</strong></td>
                        <td>40.0% - 55.0% (TNA fija) / 10% - 18% (CER)</td>
                        <td>Tasa nominal anual neta que percibirán los inversores sobre el capital aportado.</td>
                    </tr>
                    <tr>
                        <td><strong>Spread Lencord (%)</strong></td>
                        <td>1.5% - 3.5%</td>
                        <td>Margen de retención tecnológica de la plataforma en cada liquidación mensual.</td>
                    </tr>
                    <tr>
                        <td><strong>Tasa Final PyME (%)</strong></td>
                        <td><em>Calculada automáticamente</em></td>
                        <td>Tasa final que abonará el solicitante: <code>Tasa Inversor + Spread Lencord</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Fecha Límite de Subasta</strong></td>
                        <td>15 a 30 días posteriores</td>
                        <td>Día y hora exacta en la que expirará la subasta bajo la regla "todo o nada".</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="alert-box alert-success">
            <strong>Fórmula de Transparencia:</strong> Si se define una Tasa Inversor del <code>45.0%</code> y un Spread Lencord del <code>2.5%</code>, el sistema proyecta en pantalla una Tasa Final PyME del <code>47.50%</code>.
        </div>

        <h3>4.1. Ejecución de la Publicación</h3>
        <p>
            Al hacer clic en el botón <strong>"Aprobar y publicar en subasta"</strong>, el sistema ejecuta de forma atómica las siguientes acciones:
        </p>
        <ol>
            <li>Actualiza el perfil crediticio (<code>sme_credit_profiles</code>) con la situación BCRA y el Tier asignado.</li>
            <li>Actualiza el registro del préstamo (<code>loans</code>) con las tasas fijadas y la fecha límite de fondeo.</li>
            <li>Transiciona el estado del préstamo de <code>in_review</code> a <code>funding</code>.</li>
            <li>Hace visible la oportunidad de financiamiento de manera instantánea en el catálogo público del <code>/marketplace</code>.</li>
            <li>Muestra un banner de confirmación exitosa con el identificador del préstamo y selecciona automáticamente la siguiente solicitud pendiente en la lista.</li>
        </ol>

        <h2>5. Supervisión del Ciclo de Vida del Préstamo</h2>
        <p>A lo largo de su existencia en la plataforma, cada crédito transita por los siguientes estados normados:</p>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Estado</th>
                        <th>Significado Operativo</th>
                        <th>Acción de la Plataforma</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>draft</code></td>
                        <td>Borrador en carga por la PyME</td>
                        <td>Aún no enviado para evaluación.</td>
                    </tr>
                    <tr>
                        <td><code>in_review</code></td>
                        <td>En mesa de riesgo administrativa</td>
                        <td>Pendiente de análisis y dictamen en la consola <code>/admin</code>.</td>
                    </tr>
                    <tr>
                        <td><code>funding</code></td>
                        <td>Subasta activa en Marketplace</td>
                        <td>Recibiendo posturas de inversión colectiva hasta alcanzar el 100%.</td>
                    </tr>
                    <tr>
                        <td><code>funded</code></td>
                        <td>100% alcanzado</td>
                        <td>Se genera el pagaré digital con cuadro de cuotas para firma OTP de la PyME.</td>
                    </tr>
                    <tr>
                        <td><code>active</code></td>
                        <td>Pagaré firmado y fondos desembolsados</td>
                        <td>Crédito activo; cobro y distribución mensual de cuotas a inversores.</td>
                    </tr>
                    <tr>
                        <td><code>repaid</code></td>
                        <td>Amortización total exitosa</td>
                        <td>Todas las cuotas de capital e intereses fueron abonadas.</td>
                    </tr>
                    <tr>
                        <td><code>cancelled</code></td>
                        <td>Subasta vencida o solicitud rechazada</td>
                        <td>Reembolso íntegro automático de fondos retenidos a los inversores.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>6. Protocolo de Vencimiento de Subastas y Auditoría Automática</h2>
        <p>
            Para garantizar que ninguna subasta permanezca abierta indefinidamente sin cumplir su meta, Lencord dispone de un servicio programado (Cron Job) que se invoca de manera autónoma:
        </p>
        <pre><code>GET /api/cron/check-deadlines (Header: Authorization: Bearer CRON_SECRET)</code></pre>
        <p>
            Si la fecha límite se supera sin haber alcanzado el 100% del monto solicitado, el sistema transiciona el préstamo a <code>cancelled</code> y libera de manera inmediata los compromisos de fondos de todos los inversores participantes sin costo alguno.
        </p>
    </div>
</body>
</html>
"""
    pdf_path = os.path.join(MANUALS_DIR, "Manual_Administrador_Lencord.pdf")
    generate_pdf(html, pdf_path)

if __name__ == "__main__":
    build_admin_manual()

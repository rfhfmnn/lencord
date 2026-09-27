import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from generate_manuals import COMMON_CSS, generate_pdf, MANUALS_DIR

def build_legal_manual():
    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Marco Legal y Regulatorio - Plataforma Lencord</title>
    <style>
        {COMMON_CSS}
    </style>
</head>
<body>

    <!-- PORTADA -->
    <div class="cover">
        <div class="cover-top">
            <div class="cover-brand">LEN<span>CORD</span></div>
            <div class="cover-badge">Dictamen Jurídico y Compliance Regulatorio</div>
            <h1>Marco Legal y Habilitación para Crowdlending P2P en Argentina</h1>
            <div class="cover-subtitle">
                Análisis exhaustivo del régimen normativo aplicable: delimitación ante la Ley de Entidades Financieras, instrumentación civil y cambiaria, regulaciones del BCRA, CNV, UIF, régimen de datos y checklist de habilitación operativa.
            </div>
        </div>
        <div class="cover-footer">
            <div><strong>Plataforma:</strong> Lencord | Crowdlending P2P PyME</div>
            <div><strong>Jurisdicción:</strong> República Argentina | <strong>Versión:</strong> 1.0.0</div>
        </div>
    </div>

    <!-- PÁGINA 1: INTRODUCCIÓN Y LEY DE ENTIDADES FINANCIERAS -->
    <div class="page">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Marco Legal • Crowdlending Argentina</div>
        </div>

        <h2>1. Resumen ejecutivo y arquitectura jurídica del modelo</h2>
        <p>
            <strong>Lencord</strong> opera como una plataforma tecnológica de financiamiento colectivo <em>peer-to-peer</em> (P2P lending) que vincula directamente a pequeñas y medianas empresas (PyMEs) necesitadas de capital de trabajo con inversores individuales e institucionales en busca de rentabilidad real.
        </p>
        <p>
            En la República Argentina, el financiamiento participativo no cuenta con una ley única consolidada para préstamos entre particulares, sino que requiere la articulación armoniosa de diversas normas del derecho bancario, civil, comercial, cambiario, administrativo y tributario. La viabilidad jurídica de Lencord radica en su posicionamiento como <strong>facilitador tecnológico y mandatario</strong>, excluyéndose rigurosamente de la figura de intermediación financiera bancaria.
        </p>

        <div class="alert-box alert-info">
            <strong>Principio rector de Lencord:</strong> La plataforma nunca toma depósitos del público a cuenta y orden propia ni asume el riesgo crediticio de las operaciones. El contrato de préstamo (mutuo) se perfecciona directa y exclusivamente entre el inversor y la empresa tomadora.
        </div>

        <h2>2. Delimitación ante la Ley de Entidades Financieras (Ley N° 21.526)</h2>
        <p>
            El mayor riesgo regulatorio para cualquier plataforma Fintech de crédito en Argentina es la tipificación de <strong>intermediación financiera no autorizada</strong> (Art. 1° y conc. de la Ley 21.526), conducta sancionada patrimonialmente por el Banco Central (BCRA) y tipificada penalmente por el <strong>Artículo 310 del Código Penal de la Nación</strong> (con penas de prisión de 1 a 6 años e inhabilitación especial).
        </p>

        <h3>2.1. Criterios de exclusión de la Ley 21.526</h3>
        <p>
            Para que una actividad configure intermediación financiera según la doctrina y jurisprudencia del BCRA, deben concurrir copulativamente tres elementos:
        </p>
        <ul>
            <li><strong>Captación pública de fondos:</strong> Recepción habitual de dinero de terceros en calidad de depósito o préstamo.</li>
            <li><strong>Colocación por cuenta y riesgo propio:</strong> Préstamo de esos fondos a terceros asumiendo el riesgo de insolvencia y garantizando una tasa al depositante original.</li>
            <li><strong>Habitualidad masiva e indiscriminada:</strong> Dirigida al público en general.</li>
        </ul>

        <div class="card-grid">
            <div class="card">
                <h4>Esquema Prohibido (Intermediación Bancaria)</h4>
                <p>• La plataforma recibe dinero y garantiza retornos fijos.</p>
                <p>• La plataforma asume la pérdida en caso de impago.</p>
                <p>• Los fondos entran al balance general de la sociedad.</p>
                <p><em>Requiere licencia bancaria previa del BCRA.</em></p>
            </div>
            <div class="card">
                <h4>Esquema Lencord (Facilitación y Mandato)</h4>
                <p>• El inversor elige libremente en qué subasta participar.</p>
                <p>• El riesgo de crédito es asumido por los inversores.</p>
                <p>• Fondos segregados en cuentas recaudadoras / BaaS.</p>
                <p><em>Operación lícita bajo el Código Civil y Comercial.</em></p>
            </div>
        </div>

        <h3>2.2. Disclaimer de Responsabilidad Mandatorio</h3>
        <p>
            En todas las interfaces, simulación de rendimientos, contratos y pie de página de la aplicación, Lencord debe exhibir en forma visible e indubitable la siguiente leyenda legal:
        </p>
        <div class="alert-box alert-warning">
            «Lencord es una plataforma tecnológica que facilita el contacto entre inversores y empresas solicitantes de crédito. Lencord no es una entidad financiera autorizada por el Banco Central de la República Argentina (BCRA) bajo la Ley N° 21.526 y no realiza captación pública de depósitos ni garantiza el recupero del capital o los rendimientos proyectados. Las operaciones son a exclusivo riesgo de las partes contratantes.»
        </div>
    </div>

    <!-- PÁGINA 2: ESTRUCTURA CONTRACTUAL Y PAGARÉ DIGITAL -->
    <div class="page page-break">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Marco Legal • Contratos y Títulos Ejecutivos</div>
        </div>

        <h2>3. Estructura contractual bajo el Código Civil y Comercial (CCyCN)</h2>
        <p>
            La plataforma fundamenta su relación jurídica tripartita (Inversor – Lencord – PyME Solicitante) en las figuras contractuales consagradas por la Ley N° 26.994:
        </p>

        <h3>3.1. Contrato de Mutuo Dinerario (Arts. 1525 a 1532 del CCyCN)</h3>
        <p>
            El mutuo es el contrato por el cual el prestamista (inversor) se compromete a entregar al prestatario (PyME) una determinada cantidad de dinero fungible, obligándose este último a restituir igual cantidad monetaria, más los intereses compensatorios y punitorios pactados (fijos vía TNA o indexados por UVA/CER).
        </p>
        <ul>
            <li><strong>Pluralidad de mutuantes:</strong> En Lencord, cada crédito colectivo se instrumenta como un mutuo fraccionado con pluralidad pasiva/activa, donde cada inversor es titular de una cuota parte del crédito.</li>
            <li><strong>Condición suspensiva:</strong> La entrega efectiva de los fondos está sujeta a la cláusula modal resolutoria de la subasta "todo o nada" (haber completado el 100% del cupo solicitado antes del vencimiento del plazo de cierre).</li>
        </ul>

        <h3>3.2. Contrato de Mandato y Cobranza (Arts. 1319 a 1334 del CCyCN)</h3>
        <p>
            Al registrarse y aceptar los Términos y Condiciones, los inversores otorgan a Lencord un <strong>mandato con representación y facultades especiales</strong> para:
        </p>
        <ol>
            <li>Suscribir el contrato de mutuo y los documentos de crédito en su nombre y representación.</li>
            <li>Gestionar el desembolso y la recaudación de las cuotas mensuales (capital, intereses y gastos).</li>
            <li>Inhibir, intimar formalmente e iniciar acciones de recupero extrajudicial y judicial en caso de mora.</li>
        </ol>

        <h2>4. Título ejecutivo: Pagaré Electrónico y Ley de Firma Digital</h2>
        <p>
            Uno de los mayores desafíos del crowdlending es el costo y tiempo de recupero judicial ante morosidad. Para evitar iniciar un proceso ordinario de conocimiento para probar la causa del mutuo, Lencord utiliza la <strong>vía ejecutiva</strong> cambiaria.
        </p>

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Normativa</th>
                        <th>Objeto</th>
                        <th>Impacto en Lencord</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Decreto-Ley 5965/63</strong></td>
                        <td>Régimen de la Letra de Cambio y Pagaré</td>
                        <td>Define los requisitos esenciales de autonomía, literalidad y ejecutabilidad del título de crédito.</td>
                    </tr>
                    <tr>
                        <td><strong>Ley N° 27.444</strong> (Art. 68)</td>
                        <td>Desburocratización y Simplificación</td>
                        <td>Modificó el régimen cambiario para admitir expresamente la creación, firma y transmisión de <strong>pagarés en soporte electrónico o digital</strong>.</td>
                    </tr>
                    <tr>
                        <td><strong>Ley N° 25.506</strong></td>
                        <td>Ley de Firma Digital</td>
                        <td>Diferencia entre <em>Firma Digital</em> (con certificado licenciado; presunción legal de autoría e integridad) y <em>Firma Electrónica</em> (OTP, biometría; plena validez probatoria).</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="alert-box alert-success">
            <strong>Mecanismo de Ejecución en Lencord:</strong> Al cerrarse la subasta exitosamente, el apoderado de la PyME suscribe digitalmente el pagaré electrónico a favor de Lencord (como mandataria de los inversores) o de un fiduciario. Este pagaré otorga <strong>fuerza ejecutiva inmediata</strong> (embargos preventivos y traba sobre cuentas bancarias) bajo los Códigos Procesales Civiles y Comerciales de las provincias argentinas.
        </div>
    </div>

    <!-- PÁGINA 3: ENCUADRE CNV vs MUTUO PRIVADO & NORMAS BCRA -->
    <div class="page page-break">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Marco Legal • Regulaciones CNV y BCRA</div>
        </div>

        <h2>5. El marco de Crowdfunding de la CNV (Ley N° 27.349) vs. Esquema Privado</h2>
        <p>
            La Ley de Apoyo al Capital Emprendedor (Ley N° 27.349, Título II) y la Resolución General CNV N° 717/2017 crearon formalmente el régimen de las <strong>Plataformas de Financiamiento Colectivo (PFC)</strong> bajo la fiscalización de la Comisión Nacional de Valores (CNV).
        </p>

        <h3>5.1. Comparativa de alternativas regulatorias</h3>
        <div class="card-grid">
            <div class="card">
                <h4>Vía A: Registro como PFC (CNV)</h4>
                <p>• <strong>Alcance:</strong> Emisión de acciones (equity) o préstamos convertibles en acciones con oferta pública.</p>
                <p>• <strong>Requisitos:</strong> Capital social mínimo estricto, balances trimestrales auditados, designación de oficiales de cumplimiento y tasas de fiscalización de la CNV.</p>
                <p>• <strong>Restricción:</strong> Topes máximos de inversión por proyecto e inversor no calificado.</p>
            </div>
            <div class="card">
                <h4>Vía B: Esquema P2P Privado (Elegido Lencord)</h4>
                <p>• <strong>Alcance:</strong> Préstamos comerciales puros de deuda y mutuo entre partes privadas (sin oferta pública de valores negociables).</p>
                <p>• <strong>Requisitos:</strong> Régimen de derecho común (CCyCN) con estricto apego al secreto bancario, protección de datos y normas BCRA.</p>
                <p>• <strong>Ventaja:</strong> Menor burocracia inicial; modelo idéntico al implementado por líderes del sector como <em>Afluenta</em>.</p>
            </div>
        </div>

        <h2>6. Regulaciones del Banco Central de la República Argentina (BCRA)</h2>
        <p>Aunque no sea un banco, Lencord está sujeto a las directivas del BCRA en dos frentes obligatorios:</p>

        <h3>6.1. Gestión de fondos y Proveedores de Servicios de Pago (PSP)</h3>
        <p>
            Bajo las Comunicaciones BCRA "A" 6885, 7146, 7363 y concordantes:
        </p>
        <ul>
            <li><strong>Cuentas de pago (PSPCP):</strong> Si Lencord administrara saldos virtuales acreditables y asignara CVU directamente, debería inscribirse en el Registro de PSP del BCRA y encajar el 100% de los fondos en cuentas a la vista del sistema financiero.</li>
            <li><strong>Delegación en Partner BaaS (Recomendado):</strong> Lencord delega la custodia, cobro y desembolso en un banco o PSP regulado (ej. BIND Pagos, Pomelo, Coelsa). De este modo, los fondos transitan de cuenta a cuenta autorizada, eximiendo a Lencord de constituirse como PSPCP propio en Fase 1.</li>
        </ul>

        <h3>6.2. Registro de Otros Proveedores No Financieros de Crédito (OPNFC)</h3>
        <p>
            Por Comunicación "A" 7146 y modificaciones ("A" 7621 y "A" 7719), las empresas que facilitan financiamiento a personas humanas o jurídicas deben:
        </p>
        <ul>
            <li>Inscribirse en el <strong>Registro de OPNFC del BCRA</strong> si superan los montos operados globales definidos por la autoridad monetaria.</li>
            <li>Publicitar obligatoriamente el <strong>Costo Financiero Total (CFT)</strong> expresado en forma de Tasa Efectiva Anual (TEA) con y sin IVA.</li>
            <li>Acatar los topes máximos de tasas compensatorias y punitorias que fija periódicamente el Directorio del BCRA.</li>
        </ul>

        <h3>6.3. Protección de los Usuarios de Servicios Financieros</h3>
        <p>
            Rigen los principios de transparencia contractual: prohibición de cobro de cargos por servicios no prestados o no consentidos, obligatoriedad del "botón de baja de servicio / revocación" durante los primeros 10 días corridos de contratación, y disponibilidad de canales de atención y reclamos con plazos de resolución tasados.
        </p>
    </div>

    <!-- PÁGINA 4: UIF, DATOS PERSONALES, IMPUESTOS Y CHECKLIST -->
    <div class="page page-break">
        <div class="header-bar">
            <div class="header-brand">LEN<span>CORD</span></div>
            <div class="header-doc-title">Marco Legal • Compliance, Datos y Roadmap</div>
        </div>

        <h2>7. Prevención de Lavado de Activos y Financiamiento del Terrorismo (UIF)</h2>
        <p>
            Regido por la <strong>Ley N° 25.246</strong> y su reforma integral mediante la <strong>Ley N° 27.739 (año 2024)</strong>:
        </p>
        <ul>
            <li><strong>Sujetos obligados y debida diligencia:</strong> Las entidades de crédito no bancario deben aplicar políticas de <em>Conozca a su Cliente</em> (KYC) y enfoque basado en riesgo (EBR).</li>
            <li><strong>Identificación biométrica:</strong> Cotejo de DNI y prueba de vida con bases oficiales (Renaper) y CUIT activo ante ARCA / AFIP.</li>
            <li><strong>Cotejo de listas vinculantes:</strong> Verificación automática contra el Registro Público de Personas Vinculadas a Actos de Terrorismo (RePET) y el padrón de Personas Expuestas Políticamente (PEP).</li>
            <li><strong>Perfil transaccional y justificación de fondos:</strong> Umbrales automáticos para requerir declaraciones juradas impositivas o extractos bancarios cuando el inversor supere determinados límites de fondeo.</li>
        </ul>

        <h2>8. Protección de Datos Personales y Scoring (Ley N° 25.326 - Habeas Data)</h2>
        <p>
            La operatoria de evaluación de riesgo crediticio (Tier A, Tier B, Tier C) que realiza Lencord se encuadra en la Ley 25.326:
        </p>
        <ul>
            <li><strong>Inscripción de bases de datos:</strong> Inscripción formal de las bases de datos de usuarios e inversores ante la <strong>Agencia de Acceso a la Información Pública (AAIP)</strong>.</li>
            <li><strong>Tratamiento de antecedentes comerciales (Art. 26):</strong> Las consultas a la Central de Deudores del BCRA y burós de crédito (Veraz, Nosis) requieren el <em>consentimiento expreso, previo e informado</em> del titular del CUIT.</li>
            <li><strong>Derechos ARCO:</strong> Garantía de los derechos de Acceso, Rectificación, Cancelación y Oposición por parte de cualquier usuario registrado.</li>
        </ul>

        <h2>9. Régimen Impositivo y Facturación (ARCA / AFIP y Provincias)</h2>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Tributo</th>
                        <th>Tratamiento en la Operatoria de Lencord</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>IVA (21%)</strong></td>
                        <td>Aplica sobre el spread o comisión de intermediación facturada por Lencord a la PyME y al inversor. No grava el capital del préstamo.</td>
                    </tr>
                    <tr>
                        <td><strong>Impuesto al Cheque (Ley 25.413)</strong></td>
                        <td>Se evita el doble gravamen operando a través de cuentas recaudadoras exentas / CVU de procesadores de pago regulados.</td>
                    </tr>
                    <tr>
                        <td><strong>Ingresos Brutos (IIBB)</strong></td>
                        <td>Lencord tributa bajo el régimen de Convenio Multilateral sobre sus ingresos netos (comisiones). Retenciones vía SIRCUPA / SIRCREB.</td>
                    </tr>
                    <tr>
                        <td><strong>Ganancias / Retenciones</strong></td>
                        <td>Los intereses cobrados por el inversor están alcanzados por el Impuesto a las Ganancias (según la condición tributaria de cada uno).</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>10. Checklist integral de habilitación paso a paso</h2>
        <div class="step-item">
            <div class="step-num">1</div>
            <div>
                <strong>Constitución societaria:</strong> Inscripción de la Sociedad (SAS o SA) ante la Inspección General de Justicia (IGJ) o Registro Público Provincial, con objeto social tecnológico, facilitación crediticia y servicios de software.
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">2</div>
            <div>
                <strong>Integración con partner financiero regulado:</strong> Contrato de servicio con entidad bancaria o PSP autorizado (BIND, Pomelo, etc.) para recaudación y liquidación en cuentas segregadas.
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">3</div>
            <div>
                <strong>Legal Tech e instrumentación:</strong> Aprobación del Contrato Marco de Mutuo, Términos y Condiciones, Mandato de Cobranza y circuito de emisión de Pagaré Digital con firma electrónica/digital.
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">4</div>
            <div>
                <strong>Inscripción ante la AAIP:</strong> Registro formal de los ficheros de datos personales y crediticios conforme a la Ley 25.326.
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">5</div>
            <div>
                <strong>Compliance UIF y manual de prevención:</strong> Designación de oficial de cumplimiento, manual de prevención de lavado y activación de filtros PEP / RePET.
            </div>
        </div>
        <div class="step-item">
            <div class="step-num">6</div>
            <div>
                <strong>Inscripción en OPNFC del BCRA:</strong> Tramitación de la habilitación en el registro de Otros Proveedores No Financieros de Crédito ante el Banco Central.
            </div>
        </div>
    </div>
</body>
</html>
"""
    pdf_path = os.path.join(MANUALS_DIR, "Manual_Marco_Legal_Lencord.pdf")
    generate_pdf(html, pdf_path)

if __name__ == "__main__":
    build_legal_manual()

import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LegalDocumentView, type LegalDocumentSection } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Políticas de privacidad y advertencia de riesgos',
  description:
    'Políticas de privacidad, tratamiento de datos personales conforme a la Ley 25.326 y advertencia expresa de riesgos de Lencord.',
};

const PRIVACY_SECTIONS: LegalDocumentSection[] = [
  {
    id: 'marco-normativo',
    title: '1. Marco normativo y responsable del tratamiento',
    content: (
      <>
        <p>
          Lencord trata los datos personales de sus usuarios en estricto cumplimiento con la <strong>Ley 25.326 de Protección de los Datos Personales</strong>, su Decreto Reglamentario N° 1558/2001 y las disposiciones emitidas por la <strong>Agencia de Acceso a la Información Pública (AAIP)</strong> de la República Argentina, órgano de control de la mencionada ley.
        </p>
        <p>
          Las bases de datos que contienen la información de nuestros usuarios se encuentran debidamente inscriptas en el Registro Nacional de Bases de Datos.
        </p>
      </>
    ),
  },
  {
    id: 'datos-recolectados',
    title: '2. Datos recolectados y finalidad del tratamiento',
    content: (
      <>
        <p>
          Para operar en la plataforma, recolectamos datos identificatorios, de contacto, fiscales y patrimoniales tanto de personas humanas como de apoderados societarios (DNI, CUIT/CUIL, constancias AFIP/ARCA, comprobantes de domicilio, estados contables y acreditación de CBU bancario).
        </p>
        <p>
          La finalidad exclusiva de la recolección comprende:
        </p>
        <ul>
          <li>Cumplir con los procedimientos de debida diligencia y <em>Conozca a su Cliente</em> (KYC) conforme a las resoluciones vigentes de la <strong>Unidad de Información Financiera (UIF)</strong> para la prevención de lavado de activos y financiamiento del terrorismo.</li>
          <li>Calificar y auditar el riesgo crediticio de las solicitudes de financiamiento presentadas por las PyMEs.</li>
          <li>Gestionar y registrar la titularidad de los préstamos, cuotas y cobros en el sistema de cuentas de custodia.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'seguridad-cifrado',
    title: '3. Medidas de seguridad y cifrado informático',
    content: (
      <>
        <p>
          Lencord implementa estándares internacionales de seguridad física, técnica y organizativa para proteger la confidencialidad e integridad de la información contra accesos no autorizados, pérdida accidental o alteración ilícita.
        </p>
        <p>
          Toda la transmisión de datos sensibles se realiza mediante canales cifrados utilizando protocolos <strong>TLS 1.3</strong>, y la información sensible en reposo se almacena mediante algoritmos de cifrado simétrico <strong>AES-256</strong> con rotación periódica de claves de acceso.
        </p>
      </>
    ),
  },
  {
    id: 'derechos-arco',
    title: '4. Ejercicio de derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)',
    content: (
      <>
        <p>
          El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.
        </p>
        <p>
          Para ejercer sus derechos de <strong>Acceso, Rectificación, Actualización o Supresión</strong>, el usuario debe enviar una solicitud formal por escrito con copia de su documento de identidad a la casilla institucional: <code>legales@lencord.com</code>.
        </p>
        <p>
          La <strong>AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA</strong>, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.
        </p>
      </>
    ),
  },
  {
    id: 'conservacion-datos',
    title: '5. Plazos de conservación de la información',
    content: (
      <>
        <p>
          Los datos y registros transaccionales, auditorías de oferta de préstamos y comprobantes bancarios serán conservados por un plazo mínimo de 10 (diez) años a partir de la finalización de la relación contractual, a fin de dar cumplimiento a las exigencias impuestas por la normativa de la UIF y el Código Civil y Comercial de la Nación en materia de conservación de libros y documentación comercial.
        </p>
      </>
    ),
  },
];

const RISK_WARNING = {
  title: 'Advertencia expresa de riesgo financiero y crediticio',
  description:
    'Lencord informa a todos los inversores participantes que la colocación de capital en préstamos a pequeñas y medianas empresas conlleva riesgos inherentes que deben ser evaluados y aceptados en forma previa e informada:',
  points: [
    'Sin garantía estatal ni SEDESA: los fondos transferidos a la plataforma no constituyen depósitos en entidades financieras ni cuentan con la cobertura del Fondo de Garantía de los Depósitos (SEDESA, Ley 24.485) ni del Banco Central de la República Argentina (BCRA).',
    'Asunción de riesgo crediticio total: el inversor asume en forma íntegra el riesgo de mora o insolvencia de la PyME tomadora. Lencord actúa exclusivamente como plataforma tecnológica facilitadora y no garantiza el repago del capital invertido ni de los rendimientos proyectados.',
    'Iliquidez del instrumento: las participaciones en los préstamos no cotizan en mercados secundarios regulados y están sujetas a un cronograma de amortización prefijado por cuotas.',
    'Decisión independiente: todo inversor debe evaluar su situación financiera y perfil de riesgo antes de confirmar cualquier oferta de financiamiento.',
  ],
};

export default function PrivacidadPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        <LegalDocumentView
          badge="Protección de datos y riesgos"
          title="Políticas de privacidad y advertencia de riesgos"
          subtitle="Tratamiento seguro de datos personales conforme a la Ley 25.326 y divulgación obligatoria de riesgos financieros."
          lastUpdated="Octubre 2026"
          sections={PRIVACY_SECTIONS}
          riskWarning={RISK_WARNING}
          testId="privacy-page-view"
        />
      </main>
      <Footer />
    </>
  );
}

import React from 'react';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LegalDocumentView } from '@/components/legal';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description:
    'Términos y condiciones generales de uso de la plataforma Lencord para PyMEs e inversores conforme a la legislación de la República Argentina.',
};

export default function TerminosPage() {
  const clauses = [
    {
      number: 'Cláusula 1',
      title: 'Naturaleza de la plataforma y alcance del servicio (Ley 21.526)',
      content: (
        <>
          <p>
            Lencord es una solución tecnológica digital que conecta de manera directa y transparente a pequeñas y medianas empresas (PyMEs) radicadas en la República Argentina con inversores individuales e institucionales que buscan financiar proyectos productivos a través de financiamiento colectivo peer-to-peer (P2P).
          </p>
          <p>
            <strong>Aviso regulatorio imperativo:</strong> Lencord <strong>no es una entidad financiera ni banco comercial bajo los términos de la Ley N° 21.526 de Entidades Financieras</strong>, no realiza captación masiva ni intermediación financiera con fondos propios, ni presta asesoramiento financiero o cambiario personalizado.
          </p>
          <p>
            La custodia, segregación, depósito y transferencia de saldos monetarios se realiza íntegramente a través de entidades financieras autorizadas y Proveedores de Servicios de Pago (PSP) supervisados por el Banco Central de la República Argentina (BCRA).
          </p>
        </>
      ),
    },
    {
      number: 'Cláusula 2',
      title: 'Mecanismo de subasta colaborativa y perfección de contratos',
      content: (
        <>
          <p>
            Las solicitudes de crédito cargadas por las empresas pasan por un proceso de precalificación de riesgo crediticio conforme a información objetiva (BCRA Central de Deudores, AFIP y estados contables). Una vez aprobada la solicitud, se publica en el Marketplace durante un período determinado de subasta (plazo máximo de financiamiento).
          </p>
          <ul>
            <li>
              <strong>Fondeo exitoso al 100%:</strong> Si la subasta alcanza el 100% del monto solicitado antes de la fecha límite, se produce el cierre atómico de la subasta, se emite el Pagaré Digital con firma electrónica/digital (Ley 25.506) y se perfecciona el Contrato de Mutuo correspondiente, procediéndose al desembolso de los fondos a la cuenta bancaria (CBU/CVU) de la PyME.
            </li>
            <li>
              <strong>Vencimiento sin fondeo total:</strong> Si la subasta no alcanza el 100% al expirar el plazo establecido, los compromisos de inversión quedan cancelados automáticamente y los saldos retenidos en custodia son liberados a los inversores sin comisión ni costo alguno.
            </li>
          </ul>
        </>
      ),
    },
    {
      number: 'Cláusula 3',
      title: 'Derechos y obligaciones de las partes',
      content: (
        <>
          <p>
            <strong>Para los Inversores:</strong>
          </p>
          <ul>
            <li>
              Derecho a percibir el capital invertido y los intereses compensatorios devengados conforme al cronograma de cuotas pactado (sistema de amortización francés mensual).
            </li>
            <li>
              Obligación de operar con fondos de origen lícito, brindar información fidedigna de identificación (KYC/UIF) y declarar su condición fiscal (DNI/CUIT).
            </li>
            <li>
              Aceptación expresa de que asume el riesgo de crédito y de cobro de los préstamos en los que decide participar voluntariamente.
            </li>
          </ul>
          <p>
            <strong>Para las PyMEs Prestatarias:</strong>
          </p>
          <ul>
            <li>
              Obligación irrevocable de abonar puntualmente cada cuota de capital e intereses en las fechas de vencimiento pactadas mediante débito en cuenta o transferencia a la cuenta de custodia designada.
            </li>
            <li>
              Suscripción de pagarés digitales ejecutables en carácter de título valor y garantía de repago.
            </li>
            <li>
              Suministrar información veraz, completa y actualizada sobre su situación financiera y societaria.
            </li>
          </ul>
        </>
      ),
    },
    {
      number: 'Cláusula 4',
      title: 'Política de comisiones por servicio de la plataforma',
      content: (
        <>
          <p>
            Por los servicios de estructuración, calificación crediticia, provisión de la plataforma tecnológica y facilitación de la liquidación de fondos, Lencord percibe:
          </p>
          <ul>
            <li>
              <strong>Spread de plataforma:</strong> Un diferencial de tasa (spread) acordado en la subasta entre la tasa que abona la PyME (TNA PyME) y la tasa que perciben los inversores (TNA Inversor), cobrado pro-rata en cada cuota recaudada.
            </li>
            <li>
              <strong>Comisión de estructuración:</strong> Un porcentaje único deducido al momento del desembolso de los fondos a la PyME prestataria para cubrir costos de originación, verificación crediticia y emisión documental.
            </li>
            <li>
              No existen costos fijos de mantenimiento de cuenta para los inversores.
            </li>
          </ul>
        </>
      ),
    },
    {
      number: 'Cláusula 5',
      title: 'Mora en los pagos y mandato irrevocable de cobranza',
      content: (
        <>
          <p>
            El atraso en el pago de cualquier cuota por parte de la PyME tomadora constituirá mora de pleno derecho por el mero transcurso del tiempo, devengando intereses compensatorios y punitorios a la tasa pactada en el contrato de mutuo y pagaré.
          </p>
          <p>
            A tales efectos, los inversores otorgan a Lencord (y/o al fiduciario o mandatario legal que la plataforma designe) <strong>mandato irrevocable de cobranza prejudicial y judicial</strong>, con facultades suficientes para:
          </p>
          <ul>
            <li>Emitir intimaciones fehacientes de pago extrajudicial.</li>
            <li>Reportar el estado de morosidad ante las centrales de riesgo crediticio (BCRA y agencias habilitadas).</li>
            <li>Iniciar y proseguir las acciones judiciales ejecutivas sobre la base del Pagaré Digital firmado por la tomadora y sus garantes.</li>
            <li>Percibir las sumas recuperadas y distribuirlas pro-rata entre los inversores acreedores previa deducción de los gastos legales incurridos.</li>
          </ul>
        </>
      ),
    },
  ];

  return (
    <>
      <Header />
      <main id="main-content">
        <LegalDocumentView
          badge="Marco Legal"
          title="Términos y condiciones"
          subtitle="Bases y condiciones generales de uso de la plataforma Lencord para PyMEs e inversores conforme al régimen de financiamiento colectivo en Argentina."
          clauses={clauses}
          testId="terms-page-view"
        />
      </main>
      <Footer />
    </>
  );
}

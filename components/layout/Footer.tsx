import React from 'react';
import Link from 'next/link';
import styles from './footer.module.css';

export interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const currentYear = 2026;

  return (
    <footer className={`${styles.footer} ${className}`.trim()} data-testid="compliance-footer">
      <div className={styles.container}>
        {/* Top Grid */}
        <div className={styles.topGrid}>
          {/* Brand & Mission */}
          <div className={styles.brandCol}>
            <h3 className={styles.brandName}>Lencord</h3>
            <p className={styles.brandDescription}>
              Plataforma peer-to-peer (P2P) de financiamiento colectivo que conecta PyMEs argentinas en
              crecimiento con inversores que buscan retornos reales, sin intermediarios bancarios.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className={styles.colTitle}>Navegación</h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/marketplace" className={styles.link}>
                  Prestar
                </Link>
              </li>
              <li>
                <Link href="/solicitar" className={styles.link}>
                  Pedir financiación
                </Link>
              </li>
              <li>
                <Link href="/#como-funciona" className={styles.link}>
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link href="/#faq" className={styles.link}>
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Regulatory & Institutional */}
          <div>
            <h4 className={styles.colTitle}>Marco Institucional</h4>
            <ul className={styles.linkList}>
              <li>
                <span className={styles.link}>Central de Deudores BCRA</span>
              </li>
              <li>
                <span className={styles.link}>Cumplimiento UIF</span>
              </li>
              <li>
                <span className={styles.link}>Garantías y SGRs</span>
              </li>
              <li>
                <Link href="/#terminos" className={styles.link}>
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/#privacidad" className={styles.link}>
                  Políticas de privacidad
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div>
            <h4 className={styles.colTitle}>Contacto y Soporte</h4>
            <ul className={styles.linkList}>
              <li>
                <a
                  href="https://wa.me/5491100000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.whatsappLink}
                  aria-label="Canal institucional de WhatsApp"
                  data-testid="whatsapp-channel-link"
                >
                  <svg
                    className={styles.whatsappIcon}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.346.491 1.2.534 1.288.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.102-.115.434-.506.55-.679.115-.174.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.044.073.044.419-.1.824z" />
                  </svg>
                  <span>WhatsApp institucional</span>
                </a>
              </li>
              <li className={styles.contactItem}>
                <span>Soporte: </span>
                <a href="mailto:soporte@lencord.com" className={styles.link}>
                  soporte@lencord.com
                </a>
              </li>
              <li className={styles.contactItem}>
                <span>Horario: Lun a Vie 9:00 - 18:00 hs</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal & Regulatory Compliance Box */}
        <div className={styles.complianceSection} data-testid="compliance-section">
          {/* Explicit Legal Disclaimer */}
          <div className={styles.disclaimerBlock}>
            <h5 className={styles.disclaimerTitle}>Aviso legal y estructura de la plataforma</h5>
            <p className={styles.disclaimerText}>
              Lencord es una plataforma tecnológica operada bajo la estructura societaria de Sociedad por
              Acciones Simplificada (SAS). Lencord no es una entidad financiera bajo los términos de la Ley
              N° 21.526 de Entidades Financieras y no realiza intermediación financiera directa ni captación
              pública de depósitos. La plataforma actúa exclusivamente como mandatario y facilitador
              tecnológico entre partes privadas, delegando el procesamiento de pagos, custodia temporal y
              transferencias en entidades de pago y proveedores de banking-as-a-service regulados.
            </p>
          </div>

          {/* BCRA and UIF Compliance Notes */}
          <div className={styles.regulatoryNotesBlock}>
            <h5 className={styles.disclaimerTitle}>Cumplimiento regulatorio y prevención de lavado</h5>
            <p className={styles.disclaimerText}>
              Cumplimiento normativo ante el BCRA y la UIF: La plataforma efectúa consultas automatizadas a
              la Central de Deudores del Banco Central de la República Argentina (BCRA) para la evaluación
              crediticia objetiva. Asimismo, implementa programas y estándares de debida diligencia en
              materia de prevención de lavado de activos y financiamiento del terrorismo, conforme a las
              disposiciones emitidas por la Unidad de Información Financiera (UIF) de la República Argentina.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <div>
            © {currentYear} Lencord SAS. Todos los derechos reservados.
          </div>
          <div>
            Plataforma peer-to-peer de financiamiento colectivo para PyMEs argentinas.
          </div>
        </div>
      </div>
    </footer>
  );
};

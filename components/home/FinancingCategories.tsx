import React from 'react';
import Link from 'next/link';
import styles from './financing-categories.module.css';

export interface FinancingCategory {
  id: string;
  name: string;
  description: string;
  tag: string;
  icon?: string;
  href: string;
}

export function BriefcaseIcon({
  className = '',
  width = 28,
  height = 28,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-testid="icon-working_capital"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function MachineryIcon({
  className = '',
  width = 28,
  height = 28,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-testid="icon-machinery"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function RefinancingIcon({
  className = '',
  width = 28,
  height = 28,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-testid="icon-refinancing"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export function ExpansionIcon({
  className = '',
  width = 28,
  height = 28,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-testid="icon-expansion"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

export function NewSmeIcon({
  className = '',
  width = 28,
  height = 28,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-testid="icon-new_sme"
    >
      <path d="M12 22v-9" />
      <path d="M12 13a5 5 0 0 0 5-5c0-4-5-6-5-6s-5 2-5 6a5 5 0 0 0 5 5z" />
      <path d="M12 18a6 6 0 0 1 6-6h2" />
      <path d="M12 18a6 6 0 0 0-6-6H4" />
    </svg>
  );
}

export function CategoryIcon({
  id,
  className = '',
}: {
  id: string;
  className?: string;
}) {
  switch (id) {
    case 'working_capital':
      return <BriefcaseIcon className={className} />;
    case 'machinery':
      return <MachineryIcon className={className} />;
    case 'refinancing':
      return <RefinancingIcon className={className} />;
    case 'expansion':
      return <ExpansionIcon className={className} />;
    case 'new_sme':
      return <NewSmeIcon className={className} />;
    default:
      return <BriefcaseIcon className={className} />;
  }
}

export const FINANCING_CATEGORIES: FinancingCategory[] = [
  {
    id: 'working_capital',
    name: 'Capital de trabajo',
    description: 'Financiá stock, materias primas y liquidez operativa para afrontar la demanda sin interrupciones.',
    tag: 'Mayor demanda',
    icon: 'briefcase',
    href: '/solicitar?category=working_capital',
  },
  {
    id: 'machinery',
    name: 'Maquinaria y equipamiento',
    description: 'Modernizá tu línea de producción, incorporá tecnología de punta y ampliá la capacidad instalada de tu negocio.',
    tag: 'Activos productivos',
    icon: 'machinery',
    href: '/solicitar?category=machinery',
  },
  {
    id: 'refinancing',
    name: 'Refinanciación de pasivos',
    description: 'Consolidá deudas de corto plazo o sobregiros bancarios con plazos más holgados y condiciones transparentes.',
    tag: 'Optimización financiera',
    icon: 'refinancing',
    href: '/solicitar?category=refinancing',
  },
  {
    id: 'expansion',
    name: 'Expansión comercial',
    description: 'Invertí en nuevas sucursales, desarrollo de canales de distribución y apertura de nuevos mercados.',
    tag: 'Crecimiento',
    icon: 'expansion',
    href: '/solicitar?category=expansion',
  },
  {
    id: 'new_sme',
    name: 'Emprender / nuevas PyMEs',
    description: 'Impulso financiero para proyectos jóvenes, startups y empresas de reciente constitución con modelo validado.',
    tag: 'Innovación',
    icon: 'new_sme',
    href: '/solicitar?category=new_sme',
  },
];

export interface FinancingCategoriesProps {
  categories?: FinancingCategory[];
  className?: string;
}

export function FinancingCategories({
  categories = FINANCING_CATEGORIES,
  className = '',
}: FinancingCategoriesProps) {
  return (
    <section className={`${styles.section} ${className}`} aria-label="Financiá tu empresa">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.badgePill}>Destinos de Fondos</div>
          <h2 className={styles.title}>Financiá tu empresa</h2>
          <p className={styles.subtitle}>
            Diseñamos opciones de crédito a medida para cada etapa y necesidad productiva de tu negocio.
          </p>
        </div>

        <div className={styles.categoriesGrid} data-testid="categories-grid">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              className={styles.categoryCard}
              data-testid={`category-card-${cat.id}`}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardIcon}>
                  <CategoryIcon id={cat.id} className={styles.svgIcon} />
                </span>
                <span className={styles.cardTag}>{cat.tag}</span>
              </div>
              <h3 className={styles.cardTitle}>{cat.name}</h3>
              <p className={styles.cardDescription}>{cat.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.linkText}>Solicitar en esta categoría →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

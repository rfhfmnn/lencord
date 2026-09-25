import React from 'react';
import Link from 'next/link';
import styles from './financing-categories.module.css';

export interface FinancingCategory {
  id: string;
  name: string;
  description: string;
  tag: string;
  icon: string;
  href: string;
}

export const FINANCING_CATEGORIES: FinancingCategory[] = [
  {
    id: 'working_capital',
    name: 'Capital de trabajo',
    description: 'Financiá stock, materias primas y liquidez operativa para afrontar picos de demanda sin interrupciones.',
    tag: 'Mayor demanda',
    icon: '💼',
    href: '/solicitar?category=working_capital',
  },
  {
    id: 'machinery',
    name: 'Maquinaria y equipamiento',
    description: 'Modernizá tu línea de producción, incorporá tecnología de punta y ampliá la capacidad instalada de tu planta.',
    tag: 'Activos productivos',
    icon: '⚙️',
    href: '/solicitar?category=machinery',
  },
  {
    id: 'refinancing',
    name: 'Refinanciación de pasivos',
    description: 'Consolidá deudas de corto plazo o sobregiros bancarios con plazos más holgados y condiciones transparentes.',
    tag: 'Optimización financiera',
    icon: '📊',
    href: '/solicitar?category=refinancing',
  },
  {
    id: 'expansion',
    name: 'Expansión comercial',
    description: 'Invertí en nuevas sucursales, desarrollo de canales de distribución y apertura de nuevos mercados regionales.',
    tag: 'Crecimiento',
    icon: '🚀',
    href: '/solicitar?category=expansion',
  },
  {
    id: 'new_sme',
    name: 'Emprender / nuevas PyMEs',
    description: 'Impulso financiero para proyectos jóvenes, startups y empresas de reciente constitución con modelo validado.',
    tag: 'Innovación',
    icon: '🌱',
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
                <span className={styles.cardIcon}>{cat.icon}</span>
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

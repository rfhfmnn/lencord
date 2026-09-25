import React from 'react';
import styles from './badge.module.css';

export type TierType = 'A' | 'B' | 'C' | 'Tier A' | 'Tier B' | 'Tier C';

export interface TierBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tier: TierType;
  children?: React.ReactNode;
}

export const TIER_CONFIG = {
  A: {
    bg: '#D1FAE5',
    text: '#065F46',
    label: 'Tier A',
    className: styles.tierA,
  },
  B: {
    bg: '#FEF3C7',
    text: '#92400E',
    label: 'Tier B',
    className: styles.tierB,
  },
  C: {
    bg: '#FFEDD5',
    text: '#9A3412',
    label: 'Tier C',
    className: styles.tierC,
  },
} as const;

function normalizeTier(tier: TierType): 'A' | 'B' | 'C' {
  if (tier.endsWith('A')) return 'A';
  if (tier.endsWith('B')) return 'B';
  if (tier.endsWith('C')) return 'C';
  return 'A';
}

export const TierBadge = React.forwardRef<HTMLSpanElement, TierBadgeProps>(
  ({ tier, children, className = '', style, ...props }, ref) => {
    const normalizedKey = normalizeTier(tier);
    const config = TIER_CONFIG[normalizedKey];

    const combinedStyle: React.CSSProperties = {
      backgroundColor: config.bg,
      color: config.text,
      ...style,
    };

    return (
      <span
        ref={ref}
        data-tier={normalizedKey}
        data-testid="tier-badge"
        className={`${styles.badge} ${config.className} ${className}`.trim()}
        style={combinedStyle}
        {...props}
      >
        {children ?? config.label}
      </span>
    );
  }
);

TierBadge.displayName = 'TierBadge';

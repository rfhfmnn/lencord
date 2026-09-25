import React from 'react';
import styles from './badge.module.css';
import { TierBadge, TierBadgeProps, TierType, TIER_CONFIG } from './TierBadge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'tier-a' | 'tier-b' | 'tier-c' | 'default';
  children?: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', children, className = '', style, ...props }, ref) => {
    let variantClass = styles.default;
    let customStyle: React.CSSProperties = {};

    if (variant === 'tier-a') {
      variantClass = styles.tierA;
      customStyle = { backgroundColor: TIER_CONFIG.A.bg, color: TIER_CONFIG.A.text };
    } else if (variant === 'tier-b') {
      variantClass = styles.tierB;
      customStyle = { backgroundColor: TIER_CONFIG.B.bg, color: TIER_CONFIG.B.text };
    } else if (variant === 'tier-c') {
      variantClass = styles.tierC;
      customStyle = { backgroundColor: TIER_CONFIG.C.bg, color: TIER_CONFIG.C.text };
    }

    return (
      <span
        ref={ref}
        className={`${styles.badge} ${variantClass} ${className}`.trim()}
        style={{ ...customStyle, ...style }}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { TierBadge };
export type { TierBadgeProps, TierType };

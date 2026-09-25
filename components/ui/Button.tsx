import React from 'react';
import styles from './button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'bordered' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      type = 'button',
      className = '',
      ...props
    },
    ref
  ) => {
    const isBusy = isLoading || loading;
    const isDisabled = disabled || isBusy;

    const variantClass =
      variant === 'secondary'
        ? styles.secondary
        : variant === 'bordered'
        ? styles.bordered
        : variant === 'ghost'
        ? styles.ghost
        : styles.primary;

    const sizeClass =
      size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;

    const classNames = [
      styles.button,
      variantClass,
      sizeClass,
      isDisabled ? styles.disabled : '',
      isBusy ? styles.loading : '',
      fullWidth ? styles.fullWidth : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isBusy}
        className={classNames}
        {...props}
      >
        {isBusy && (
          <span
            className={styles.spinner}
            role="status"
            aria-label="Cargando..."
            data-testid="button-spinner"
          />
        )}
        {!isBusy && leftIcon && <span className="button-icon-left">{leftIcon}</span>}
        <span>{children}</span>
        {!isBusy && rightIcon && <span className="button-icon-right">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

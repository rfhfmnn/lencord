import React, { useId } from 'react';
import styles from './input.module.css';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  isInvalid?: boolean;
  helperText?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  prefixAdornment?: React.ReactNode;
  suffixAdornment?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      error,
      isInvalid = false,
      helperText,
      prefix,
      suffix,
      prefixAdornment,
      suffixAdornment,
      fullWidth = true,
      disabled = false,
      type = 'text',
      className = '',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error) || isInvalid;
    const resolvedPrefix = prefix ?? prefixAdornment;
    const resolvedSuffix = suffix ?? suffixAdornment;

    const describedBy = [
      hasError && error ? errorId : null,
      !hasError && helperText ? helperId : null,
      props['aria-describedby'],
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div
        className={`${styles.container} ${fullWidth ? styles.fullWidth : ''} ${className}`.trim()}
      >
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}

        <div
          className={[
            styles.inputWrapper,
            hasError ? styles.hasError : '',
            disabled ? styles.isDisabled : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-testid="input-wrapper"
        >
          {resolvedPrefix && (
            <span
              className={`${styles.adornment} ${styles.adornmentPrefix}`}
              data-testid="input-prefix"
            >
              {resolvedPrefix}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={describedBy}
            className={styles.input}
            {...props}
          />

          {resolvedSuffix && (
            <span
              className={`${styles.adornment} ${styles.adornmentSuffix}`}
              data-testid="input-suffix"
            >
              {resolvedSuffix}
            </span>
          )}
        </div>

        {hasError && error && (
          <span
            id={errorId}
            role="alert"
            className={styles.errorMessage}
            data-testid="input-error"
          >
            {error}
          </span>
        )}

        {!hasError && helperText && (
          <span id={helperId} className={styles.helperText}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

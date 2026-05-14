'use client';

import React, { useId } from 'react';
import styles from './checkbox.module.scss';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, helperText, indeterminate, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id || generatedId;
    const innerRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => innerRef.current!);

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate || false;
      }
    }, [indeterminate]);

    const wrapperClasses = [
      styles['checkbox-wrapper'],
      error && styles['checkbox-wrapper--error'],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses}>
        <label className={styles['checkbox-label']} htmlFor={checkboxId}>
          <span className={styles['checkbox-input-wrapper']}>
            <input
              ref={innerRef}
              type="checkbox"
              id={checkboxId}
              className={styles.checkbox}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error ? `${checkboxId}-error` : helperText ? `${checkboxId}-helper` : undefined
              }
              {...props}
            />
            <span className={styles['checkbox-control']}>
              <svg
                className={styles['checkbox-check']}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.5 6L5 8.5L9.5 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <svg
                className={styles['checkbox-indeterminate']}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M2 6H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </span>
          {label && <span className={styles['checkbox-text']}>{label}</span>}
        </label>
        {error && (
          <span id={`${checkboxId}-error`} className={styles['checkbox-error']} role="alert">
            {error}
          </span>
        )}
        {helperText && !error && (
          <span id={`${checkboxId}-helper`} className={styles['checkbox-helper']}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

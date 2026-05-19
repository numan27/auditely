'use client';

import React, { useId, forwardRef } from 'react';
import styles from './toggleSwitch.module.scss';

interface ToggleSwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ToggleSwitch = forwardRef<HTMLInputElement, ToggleSwitchProps>(
  ({ label, error, helperText, size = 'md', className = '', id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const switchId = id || generatedId;

    const wrapperClasses = [
      styles['toggle-wrapper'],
      styles[`toggle-wrapper--${size}`],
      error && styles['toggle-wrapper--error'],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClasses}>
        <label className={styles['toggle-label']} htmlFor={switchId}>
          <span className={styles['toggle-input-wrapper']}>
            <input
              ref={ref}
              type="checkbox"
              id={switchId}
              className={styles['toggle-input']}
              disabled={disabled}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error ? `${switchId}-error` : helperText ? `${switchId}-helper` : undefined
              }
              {...props}
            />
            <span className={styles['toggle-track']}>
              <span className={styles['toggle-thumb']} />
            </span>
          </span>
          {label && <span className={styles['toggle-text']}>{label}</span>}
        </label>
        {error && (
          <span id={`${switchId}-error`} className={styles['toggle-error']} role="alert">
            {error}
          </span>
        )}
        {helperText && !error && (
          <span id={`${switchId}-helper`} className={styles['toggle-helper']}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

ToggleSwitch.displayName = 'ToggleSwitch';

'use client';

import React, { useId } from 'react';
import styles from './input.module.scss';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helpText?: string;
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helpText,
      size = 'md',
      leftIcon,
      rightIcon,
      className = '',
      required,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const inputClasses = [
      styles.input,
      styles[`input--${size}`],
      leftIcon && styles['input--with-left-icon'],
      rightIcon && styles['input--with-right-icon'],
      error && styles['input--error'],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={styles['input-wrapper']}>
        {label && (
          <label
            htmlFor={inputId}
            className={`${styles.label} ${required ? styles['label--required'] : ''}`}
          >
            {label}
          </label>
        )}
        <div className={styles['input-container']}>
          {leftIcon && <span className={styles['left-icon']}>{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
            {...props}
          />
          {rightIcon && <span className={styles['right-icon']}>{rightIcon}</span>}
        </div>
        {error && (
          <span id={`${inputId}-error`} className={styles.error} role="alert">
            {error}
          </span>
        )}
        {helpText && !error && (
          <span id={`${inputId}-help`} className={styles['help-text']}>
            {helpText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

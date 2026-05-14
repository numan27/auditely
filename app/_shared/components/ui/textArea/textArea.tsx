'use client';

import React, { useId, forwardRef } from 'react';
import styles from './textArea.module.scss';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      error,
      helperText,
      rows = 4,
      maxLength,
      showCount = false,
      resize = 'vertical',
      className = '',
      id,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const currentLength = typeof value === 'string' ? value.length : 0;

    const textareaClasses = [
      styles.textarea,
      styles[`textarea--resize-${resize}`],
      error && styles['textarea--error'],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={styles['textarea-wrapper']}>
        {label && (
          <label htmlFor={textareaId} className={styles['textarea-label']}>
            {label}
            {props.required && <span className={styles['textarea-required']}>*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          maxLength={maxLength}
          className={textareaClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined
          }
          value={value}
          onChange={onChange}
          {...props}
        />
        <div className={styles['textarea-footer']}>
          {(error || helperText) && (
            <span
              id={error ? `${textareaId}-error` : `${textareaId}-helper`}
              className={error ? styles['textarea-error'] : styles['textarea-helper']}
              role={error ? 'alert' : undefined}
            >
              {error || helperText}
            </span>
          )}
          {showCount && maxLength && (
            <span className={styles['textarea-count']}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

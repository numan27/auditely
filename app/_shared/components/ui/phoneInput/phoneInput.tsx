'use client';

import React, { useId, useState } from 'react';
import PhoneInputReact from 'react-phone-number-input';
import type { Country, E164Number } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import styles from './phoneInput.module.scss';

interface PhoneInputProps {
  value?: E164Number | undefined;
  onChange?: (value: E164Number | undefined) => void;
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  defaultCountry?: Country;
  countries?: Country[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const PhoneInput = ({
  value,
  onChange,
  label,
  error,
  helperText,
  placeholder = 'Phone number',
  defaultCountry = 'US',
  countries,
  disabled = false,
  required = false,
  className = '',
}: PhoneInputProps) => {
  const generatedId = useId();
  const inputId = generatedId;
  const [isFocused, setIsFocused] = useState(false);

  const wrapperClasses = [
    styles['phone-input-wrapper'],
    isFocused && styles['phone-input-wrapper--focused'],
    error && styles['phone-input-wrapper--error'],
    disabled && styles['phone-input-wrapper--disabled'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={styles['phone-input-label']}>
          {label}
          {required && <span className={styles['phone-input-required']}>*</span>}
        </label>
      )}
      <div className={styles['phone-input-container']}>
        <PhoneInputReact
          id={inputId}
          value={value}
          onChange={onChange}
          defaultCountry={defaultCountry}
          countries={countries}
          placeholder={placeholder}
          disabled={disabled}
          international
          countryCallingCodeEditable={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={styles['phone-input']}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
        />
      </div>
      {error && (
        <span id={`${inputId}-error`} className={styles['phone-input-error']} role="alert">
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={`${inputId}-helper`} className={styles['phone-input-helper']}>
          {helperText}
        </span>
      )}
    </div>
  );
};

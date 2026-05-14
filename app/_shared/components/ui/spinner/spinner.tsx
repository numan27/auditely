'use client';

import React from 'react';
import styles from './spinner.module.scss';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'primary' | 'secondary' | 'white';

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
}

export const Spinner = ({
  size = 'md',
  variant = 'primary',
  className = '',
  label = 'Loading...',
}: SpinnerProps) => {
  const spinnerClasses = [
    styles.spinner,
    styles[`spinner--${size}`],
    styles[`spinner--${variant}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={spinnerClasses} role="status" aria-label={label}>
      <span className={styles['spinner-inner']} />
      <span className={styles['spinner-label']}>{label}</span>
    </span>
  );
};

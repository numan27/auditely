'use client';

import React from 'react';
import styles from './alert.module.scss';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';
type AlertSize = 'sm' | 'md' | 'lg';

interface AlertProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  size?: AlertSize;
  title?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 13.3333V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 6.66667H10.0083" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.66667 10L8.825 12.1583L13.3333 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.07499 2.51667L1.57501 15.5C1.48336 15.6583 1.43444 15.8373 1.4331 16.0196C1.43177 16.2019 1.47806 16.3816 1.56758 16.5411C1.6571 16.7006 1.78661 16.8342 1.9429 16.9273C2.09919 17.0204 2.27669 17.0697 2.45834 17.07H17.5417C17.7233 17.0697 17.9008 17.0204 18.0571 16.9273C18.2134 16.8342 18.3429 16.7006 18.4324 16.5411C18.5219 16.3816 18.5682 16.2019 18.5669 16.0196C18.5655 15.8373 18.5166 15.6583 18.425 15.5L10.925 2.51667C10.8329 2.36025 10.7028 2.2296 10.5473 2.13656C10.3919 2.04352 10.2158 1.99097 10.0354 1.98356C9.85496 1.97615 9.67555 2.01412 9.51303 2.09404C9.35052 2.17397 9.21001 2.29329 9.10499 2.44167L9.07499 2.51667Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 7.5V10.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14.1667H10.0083" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.5 7.5L7.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 7.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export const Alert = ({
  children,
  variant = 'info',
  size = 'md',
  title,
  icon,
  onClose,
  className = '',
}: AlertProps) => {
  const alertClasses = [
    styles.alert,
    styles[`alert--${variant}`],
    styles[`alert--${size}`],
    onClose && styles['alert--dismissible'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={alertClasses} role="alert">
      <span className={styles['alert-icon']}>{icon || defaultIcons[variant]}</span>
      <div className={styles['alert-content']}>
        {title && <h5 className={styles['alert-title']}>{title}</h5>}
        <div className={styles['alert-message']}>{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          className={styles['alert-close']}
          onClick={onClose}
          aria-label="Close alert"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
};

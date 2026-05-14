'use client';

import React from 'react';
import styles from './badge.module.scss';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  pill?: boolean;
  outline?: boolean;
  className?: string;
}

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  pill = false,
  outline = false,
  className = '',
}: BadgeProps) => {
  const badgeClasses = [
    styles.badge,
    styles[`badge--${variant}`],
    styles[`badge--${size}`],
    pill && styles['badge--pill'],
    outline && styles['badge--outline'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={badgeClasses}>{children}</span>;
};

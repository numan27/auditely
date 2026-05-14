'use client';

import React from 'react';
import styles from './noContentCard.module.scss';

interface NoContentCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const defaultIcon = (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M13 2V9H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 18V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 15L12 12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const NoContentCard = ({
  title = 'No content available',
  description = "There's nothing to show here at the moment.",
  icon = defaultIcon,
  action,
  className = '',
}: NoContentCardProps) => {
  return (
    <div className={`${styles['no-content-card']} ${className}`}>
      <div className={styles['no-content-icon']}>{icon}</div>
      <h3 className={styles['no-content-title']}>{title}</h3>
      <p className={styles['no-content-description']}>{description}</p>
      {action && <div className={styles['no-content-action']}>{action}</div>}
    </div>
  );
};

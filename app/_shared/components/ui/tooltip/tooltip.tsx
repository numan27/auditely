'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import styles from './tooltip.module.scss';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  className?: string;
  disabled?: boolean;
}

// Simple subscription for useSyncExternalStore
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const Tooltip = ({
  children,
  content,
  position = 'top',
  delay = 200,
  className = '',
  disabled = false,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Use useSyncExternalStore to detect client-side hydration
  const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // During SSR, just render children
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className={`${styles.tooltip} ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={`${styles['tooltip-content']} ${styles[`tooltip-content--${position}`]}`}
          role="tooltip"
        >
          <div className={styles['tooltip-inner']}>{content}</div>
          <span className={`${styles['tooltip-arrow']} ${styles[`tooltip-arrow--${position}`]}`} />
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './dropdown.module.scss';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export const Dropdown = ({
  trigger,
  children,
  align = 'left',
  className = '',
  onOpen,
  onClose,
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [isOpen, handleOpen, handleClose]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, handleClose]);

  return (
    <div ref={containerRef} className={`${styles.dropdown} ${className}`}>
      <div className={styles['dropdown-trigger']} onClick={toggle}>
        {trigger}
      </div>
      {isOpen && (
        <div className={`${styles['dropdown-menu']} ${styles[`dropdown-menu--${align}`]}`} role="menu">
          {children}
        </div>
      )}
    </div>
  );
};

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  destructive?: boolean;
}

export const DropdownItem = ({
  children,
  leftIcon,
  rightIcon,
  destructive = false,
  className = '',
  ...props
}: DropdownItemProps) => {
  const itemClasses = [
    styles['dropdown-item'],
    destructive && styles['dropdown-item--destructive'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={itemClasses} role="menuitem" {...props}>
      {leftIcon && <span className={styles['dropdown-item-left']}>{leftIcon}</span>}
      <span className={styles['dropdown-item-content']}>{children}</span>
      {rightIcon && <span className={styles['dropdown-item-right']}>{rightIcon}</span>}
    </button>
  );
};

interface DropdownDividerProps {
  className?: string;
}

export const DropdownDivider = ({ className = '' }: DropdownDividerProps) => {
  return <div className={`${styles['dropdown-divider']} ${className}`} role="separator" />;
};

interface DropdownHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const DropdownHeader = ({ children, className = '' }: DropdownHeaderProps) => {
  return <div className={`${styles['dropdown-header']} ${className}`}>{children}</div>;
};

// Attach sub-components
Dropdown.Item = DropdownItem;
Dropdown.Divider = DropdownDivider;
Dropdown.Header = DropdownHeader;

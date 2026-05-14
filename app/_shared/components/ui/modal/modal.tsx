'use client';

import React, { useEffect, useCallback } from 'react';
import styles from './modal.module.scss';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  preventScroll?: boolean;
}

export const Modal = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  className = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  preventScroll = true,
}: ModalProps) => {
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);

      if (preventScroll) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);

      if (preventScroll) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen, handleEscape, preventScroll]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
      <div
        className={[styles.modal, styles[`modal--${size}`], className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
};

interface ModalHeaderProps {
  title?: string;
  showBack?: boolean;
  showClose?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const ModalHeader = ({
  title,
  showBack = false,
  showClose = true,
  onBack,
  onClose,
  className = '',
  children,
}: ModalHeaderProps) => {
  // If no title, no back, no close, and no children, don't render header
  if (!title && !showBack && !showClose && !children) {
    return null;
  }

  return (
    <div className={[styles['modal-header'], className].filter(Boolean).join(' ')}>
      <div className={styles['modal-header-left']}>
        {showBack && (
          <button
            type="button"
            className={styles['modal-back']}
            onClick={onBack}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        {title && <h2 className={styles['modal-title']}>{title}</h2>}
        {children}
      </div>
      {showClose && onClose && (
        <button
          type="button"
          className={styles['modal-close']}
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6 6L18 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalContent = ({ children, className = '' }: ModalContentProps) => {
  return (
    <div className={[styles['modal-content'], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
};

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalFooter = ({ children, className = '' }: ModalFooterProps) => {
  // If no children, don't render footer
  if (!children) {
    return null;
  }

  return (
    <div className={[styles['modal-footer'], className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
};

// Attach sub-components
Modal.Header = ModalHeader;
Modal.Content = ModalContent;
Modal.Footer = ModalFooter;

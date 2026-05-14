'use client';

import React, { useState, createContext, useContext, useCallback } from 'react';
import styles from './accordion.module.scss';

interface AccordionContextValue {
  expandedItems: string[];
  toggleItem: (id: string) => void;
  allowMultiple: boolean;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

const useAccordion = () => {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within an Accordion');
  }
  return context;
};

interface AccordionProps {
  children: React.ReactNode;
  defaultExpanded?: string[];
  allowMultiple?: boolean;
  className?: string;
}

export const Accordion = ({
  children,
  defaultExpanded = [],
  allowMultiple = false,
  className = '',
}: AccordionProps) => {
  const [expandedItems, setExpandedItems] = useState<string[]>(defaultExpanded);

  const toggleItem = useCallback(
    (id: string) => {
      setExpandedItems((prev) => {
        if (allowMultiple) {
          return prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
        }
        return prev.includes(id) ? [] : [id];
      });
    },
    [allowMultiple]
  );

  return (
    <AccordionContext.Provider value={{ expandedItems, toggleItem, allowMultiple }}>
      <div className={`${styles.accordion} ${className}`}>{children}</div>
    </AccordionContext.Provider>
  );
};

interface AccordionItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const AccordionItem = ({ id, children, className = '' }: AccordionItemProps) => {
  return (
    <div className={`${styles['accordion-item']} ${className}`} data-item-id={id}>
      {children}
    </div>
  );
};

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export const AccordionTrigger = ({ children, className = '' }: AccordionTriggerProps) => {
  const { expandedItems, toggleItem } = useAccordion();
  const itemId = React.useContext(ItemIdContext);
  const isExpanded = expandedItems.includes(itemId);

  return (
    <button
      type="button"
      className={`${styles['accordion-trigger']} ${className}`}
      onClick={() => toggleItem(itemId)}
      aria-expanded={isExpanded}
    >
      {children}
      <span className={`${styles['accordion-icon']} ${isExpanded ? styles['accordion-icon--expanded'] : ''}`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
};

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

const ItemIdContext = createContext<string>('');

export const AccordionContent = ({ children, className = '' }: AccordionContentProps) => {
  const { expandedItems } = useAccordion();
  const itemId = React.useContext(ItemIdContext);
  const isExpanded = expandedItems.includes(itemId);

  return (
    <div
      className={`${styles['accordion-content']} ${isExpanded ? styles['accordion-content--expanded'] : ''} ${className}`}
      aria-hidden={!isExpanded}
    >
      <div className={styles['accordion-content-inner']}>{children}</div>
    </div>
  );
};

// Wrapper to provide item id context
export const AccordionItemWithContext = ({ id, children, className = '' }: AccordionItemProps) => {
  return (
    <ItemIdContext.Provider value={id}>
      <AccordionItem id={id} className={className}>
        {children}
      </AccordionItem>
    </ItemIdContext.Provider>
  );
};

// Re-export with corrected names for easier usage
Accordion.Item = AccordionItemWithContext;
Accordion.Trigger = AccordionTrigger;
Accordion.Content = AccordionContent;

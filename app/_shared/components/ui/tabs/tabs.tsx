'use client';

import React, { useState, createContext, useContext } from 'react';
import styles from './tabs.module.scss';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab components must be used within Tabs');
  }
  return context;
};

interface TabsProps {
  children: React.ReactNode;
  defaultTab?: string;
  className?: string;
  onChange?: (tabId: string) => void;
}

export const Tabs = ({ children, defaultTab, className = '', onChange }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab || '');

  const handleSetActiveTab = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab }}>
      <div className={`${styles.tabs} ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
};

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabList = ({ children, className = '' }: TabListProps) => {
  return <div className={`${styles['tab-list']} ${className}`} role="tablist">{children}</div>;
};

interface TabProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const Tab = ({ id, children, disabled = false, className = '' }: TabProps) => {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === id;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      disabled={disabled}
      className={[
        styles.tab,
        isActive && styles['tab--active'],
        disabled && styles['tab--disabled'],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => setActiveTab(id)}
    >
      {children}
    </button>
  );
};

interface TabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel = ({ id, children, className = '' }: TabPanelProps) => {
  const { activeTab } = useTabs();
  const isActive = activeTab === id;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={`${styles['tab-panel']} ${className}`}
    >
      {children}
    </div>
  );
};

// Attach sub-components
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

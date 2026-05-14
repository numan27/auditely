'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/app/_shared/components/ui/themeToggle/themeToggle';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Accordion } from '@/app/_shared/components/ui/accordion/accordion';
import { Alert } from '@/app/_shared/components/ui/alert/alert';
import { Badge } from '@/app/_shared/components/ui/badge/badge';
import { Checkbox } from '@/app/_shared/components/ui/checkbox/checkbox';
import { Dropdown } from '@/app/_shared/components/ui/dropdown/dropdown';
import { FileUpload } from '@/app/_shared/components/ui/fileUpload/fileUpload';
import { Pagination } from '@/app/_shared/components/ui/pagination/pagination';
import { PhoneInput } from '@/app/_shared/components/ui/phoneInput/phoneInput';
import { Tabs } from '@/app/_shared/components/ui/tabs/tabs';
import { TextArea } from '@/app/_shared/components/ui/textArea/textArea';
import { ToggleSwitch } from '@/app/_shared/components/ui/toggleSwitch/toggleSwitch';
import { Tooltip } from '@/app/_shared/components/ui/tooltip/tooltip';
import { NoContentCard } from '@/app/_shared/components/ui/noContentCard/noContentCard';
import { Spinner } from '@/app/_shared/components/ui/spinner/spinner';
import { ToastProvider, useToast } from '@/app/_shared/components/ui/toast/toast';
import { Modal } from '@/app/_shared/components/ui/modal/modal';

function ComponentShowcase() {
  const [currentPage, setCurrentPage] = useState(1);
  const [phone, setPhone] = useState<string | undefined>('');
  const [toggleChecked, setToggleChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimpleModalOpen, setIsSimpleModalOpen] = useState(false);
  const { addToast } = useToast();

  const showToast = (variant: 'info' | 'success' | 'warning' | 'error') => {
    addToast({
      title: `${variant.charAt(0).toUpperCase() + variant.slice(1)} Toast`,
      description: `This is a ${variant} notification message.`,
      variant,
      duration: 5000,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {/* Header */}
      <header className="w-full px-6 py-4 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg-primary)]/80 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--color-primary-600)]">
            UI Components Showcase
          </h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-4 py-2 bg-[var(--color-primary-600)] text-white rounded-lg hover:bg-[var(--color-primary-700)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Hero */}
          <section className="text-center py-12">
            <h2 className="text-4xl font-bold text-[var(--color-text-primary)] mb-4">
              Production-Ready <span className="text-[var(--color-primary-600)]">UI Components</span>
            </h2>
            <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              A comprehensive set of accessible, customizable, and theme-aware components built with React and SCSS.
            </p>
          </section>

          {/* Buttons Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button isLoading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          {/* Alerts Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Alerts</h3>
            <div className="space-y-4">
              <Alert variant="info" title="Information" onClose={() => {}}>
                This is an informational alert message.
              </Alert>
              <Alert variant="success" title="Success" onClose={() => {}}>
                Your changes have been saved successfully!
              </Alert>
              <Alert variant="warning" title="Warning" onClose={() => {}}>
                Please review your input before proceeding.
              </Alert>
              <Alert variant="error" title="Error" onClose={() => {}}>
                Something went wrong. Please try again.
              </Alert>
            </div>
          </section>

          {/* Badges Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Badges</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <Badge>Default</Badge>
              <Badge variant="primary">Primary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info" pill>Pill</Badge>
              <Badge variant="primary" outline>Outline</Badge>
            </div>
          </section>

          {/* Form Inputs Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Form Inputs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Text Input"
                placeholder="Enter text..."
                helpText="This is helper text"
              />
              <Input
                label="With Error"
                placeholder="Enter text..."
                error="This field is required"
              />
              <TextArea
                label="Text Area"
                placeholder="Enter longer text..."
                rows={4}
                showCount
                maxLength={200}
              />
              <PhoneInput
                label="Phone Number"
                value={phone}
                onChange={setPhone}
                defaultCountry="US"
                helperText="International format supported"
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-6">
              <Checkbox
                label="Enable notifications"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
                helperText="Receive email updates"
              />
              <ToggleSwitch
                label="Dark mode preference"
                checked={toggleChecked}
                onChange={(e) => setToggleChecked(e.target.checked)}
              />
            </div>
          </section>

          {/* File Upload Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">File Upload</h3>
            <FileUpload
              multiple
              maxFiles={5}
              maxSize={5 * 1024 * 1024}
              accept="image/*,.pdf,.doc,.docx"
              onFilesChange={(files) => console.log('Files:', files)}
              helperText="Drag and drop files or click to browse"
            />
          </section>

          {/* Dropdown Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Dropdown</h3>
            <Dropdown
              trigger={<Button variant="outline">Open Menu</Button>}
              align="left"
            >
              <Dropdown.Item onClick={() => console.log('View')}>View Profile</Dropdown.Item>
              <Dropdown.Item onClick={() => console.log('Settings')}>Settings</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item destructive onClick={() => console.log('Delete')}>
                Delete Account
              </Dropdown.Item>
            </Dropdown>
          </section>

          {/* Tooltip Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Tooltips</h3>
            <div className="flex flex-wrap gap-8">
              <Tooltip content="This is a top tooltip" position="top">
                <Button variant="outline" size="sm">Hover Top</Button>
              </Tooltip>
              <Tooltip content="This is a bottom tooltip" position="bottom">
                <Button variant="outline" size="sm">Hover Bottom</Button>
              </Tooltip>
              <Tooltip content="This is a left tooltip" position="left">
                <Button variant="outline" size="sm">Hover Left</Button>
              </Tooltip>
              <Tooltip content="This is a right tooltip" position="right">
                <Button variant="outline" size="sm">Hover Right</Button>
              </Tooltip>
            </div>
          </section>

          {/* Accordion Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Accordion</h3>
            <Accordion defaultExpanded={['item-1']} allowMultiple>
              <Accordion.Item id="item-1">
                <Accordion.Trigger>What is this template?</Accordion.Trigger>
                <Accordion.Content>
                  This is a production-ready Next.js template with authentication, form validation,
                  theming, and a comprehensive UI component library.
                </Accordion.Content>
              </Accordion.Item>
              <Accordion.Item id="item-2">
                <Accordion.Trigger>How do I get started?</Accordion.Trigger>
                <Accordion.Content>
                  Clone the repository, install dependencies with npm install, copy the environment
                  variables, and run npm run dev to start the development server.
                </Accordion.Content>
              </Accordion.Item>
              <Accordion.Item id="item-3">
                <Accordion.Trigger>What technologies are used?</Accordion.Trigger>
                <Accordion.Content>
                  Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, SCSS, Redux Toolkit,
                  next-themes, Formik, Yup, and Axios.
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </section>

          {/* Tabs Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Tabs</h3>
            <Tabs defaultTab="overview" onChange={setActiveTab}>
              <Tabs.List>
                <Tabs.Tab id="overview">Overview</Tabs.Tab>
                <Tabs.Tab id="features">Features</Tabs.Tab>
                <Tabs.Tab id="settings">Settings</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel id="overview">
                <div className="p-4 text-[var(--color-text-primary)]">
                  <h4 className="font-semibold mb-2">Overview Content</h4>
                  <p className="text-[var(--color-text-secondary)]">
                    This is the overview tab content. It displays general information about the component.
                  </p>
                </div>
              </Tabs.Panel>
              <Tabs.Panel id="features">
                <div className="p-4 text-[var(--color-text-primary)]">
                  <h4 className="font-semibold mb-2">Features Content</h4>
                  <ul className="list-disc list-inside text-[var(--color-text-secondary)] space-y-1">
                    <li>Accessible design</li>
                    <li>Keyboard navigation</li>
                    <li>Dark mode support</li>
                    <li>Customizable styling</li>
                  </ul>
                </div>
              </Tabs.Panel>
              <Tabs.Panel id="settings">
                <div className="p-4 text-[var(--color-text-primary)]">
                  <h4 className="font-semibold mb-2">Settings Content</h4>
                  <p className="text-[var(--color-text-secondary)]">
                    Configure your preferences and customize the component behavior here.
                  </p>
                </div>
              </Tabs.Panel>
            </Tabs>
          </section>

          {/* Pagination Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Pagination</h3>
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Current Page: {currentPage}
              </p>
              <Pagination
                currentPage={currentPage}
                totalPages={10}
                onPageChange={setCurrentPage}
              />
            </div>
          </section>

          {/* Spinners Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Spinners</h3>
            <div className="flex flex-wrap gap-8 items-center">
              <div className="flex flex-col items-center gap-2">
                <Spinner size="xs" />
                <span className="text-xs text-[var(--color-text-tertiary)]">XS</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Spinner size="sm" />
                <span className="text-xs text-[var(--color-text-tertiary)]">SM</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Spinner size="md" />
                <span className="text-xs text-[var(--color-text-tertiary)]">MD</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Spinner size="lg" />
                <span className="text-xs text-[var(--color-text-tertiary)]">LG</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Spinner size="xl" />
                <span className="text-xs text-[var(--color-text-tertiary)]">XL</span>
              </div>
              <div className="h-8 w-px bg-[var(--color-border)] mx-4" />
              <div className="flex flex-col items-center gap-2">
                <Spinner size="md" variant="secondary" />
                <span className="text-xs text-[var(--color-text-tertiary)]">Secondary</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-[var(--color-gray-800)] rounded">
                  <Spinner size="md" variant="white" />
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)]">White</span>
              </div>
            </div>
          </section>

          {/* No Content Card Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">No Content Card</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NoContentCard
                title="No items found"
                description="Try adjusting your search or filters to find what you're looking for."
                action={<Button variant="outline" size="sm">Clear Filters</Button>}
              />
              <NoContentCard
                title="No notifications"
                description="You're all caught up! Check back later for updates."
                icon={
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
              />
            </div>
          </section>

          {/* Modal Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">Modal / Dialog</h3>
            <div className="flex flex-wrap gap-4 mb-6">
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                Open Full Modal
              </Button>
              <Button variant="outline" onClick={() => setIsSimpleModalOpen(true)}>
                Open Simple Modal
              </Button>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="md">
              <Modal.Header
                title="Confirm Action"
                showBack={false}
                showClose={true}
                onClose={() => setIsModalOpen(false)}
              />
              <Modal.Content>
                <p className="text-[var(--color-text-secondary)]">
                  Are you sure you want to proceed? This cannot be undone.
                </p>
              </Modal.Content>
              <Modal.Footer>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={() => { setIsModalOpen(false); showToast('success'); }}>Confirm</Button>
              </Modal.Footer>
            </Modal>
            <Modal isOpen={isSimpleModalOpen} onClose={() => setIsSimpleModalOpen(false)} size="sm">
              <Modal.Content>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-600)] flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h4 className="font-semibold text-[var(--color-text-primary)] mb-2">Success!</h4>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">Your action was completed successfully.</p>
                  <Button variant="outline" size="sm" onClick={() => setIsSimpleModalOpen(false)}>Close</Button>
                </div>
              </Modal.Content>
            </Modal>
          </section>

          {/* Toast Notifications Section */}
          <section className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-6">
              Toast Notifications
            </h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" onClick={() => showToast('info')}>
                Show Info Toast
              </Button>
              <Button variant="secondary" onClick={() => showToast('success')}>
                Show Success Toast
              </Button>
              <Button variant="outline" onClick={() => showToast('warning')}>
                Show Warning Toast
              </Button>
              <Button variant="danger" onClick={() => showToast('error')}>
                Show Error Toast
              </Button>
            </div>
          </section>

          {/* CTA Section */}
          <section className="text-center py-12 border-t border-[var(--color-border)]">
            <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
              Ready to build something amazing?
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="px-8 py-4 bg-[var(--color-primary-600)] text-white rounded-lg font-semibold hover:bg-[var(--color-primary-700)] transition-colors shadow-lg hover:shadow-xl"
              >
                Get Started
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-semibold hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                View Documentation
              </a>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-8 border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto text-center text-[var(--color-text-secondary)]">
          <p>
            &copy; {new Date().getFullYear()} Next.js Template. Built with Next.js and Tailwind CSS.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider position="top-right">
      <ComponentShowcase />
    </ToastProvider>
  );
}

'use client';

import { useAuth } from '@/app/_shared/lib/hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Welcome back, {user?.name || 'User'}! This is your dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Stats cards */}
        <div className="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Total Users</h3>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">1,234</p>
          <p className="text-sm text-green-600 mt-1">+12% from last month</p>
        </div>

        <div className="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Revenue</h3>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">$12,345</p>
          <p className="text-sm text-green-600 mt-1">+8% from last month</p>
        </div>

        <div className="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">Active Sessions</h3>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">42</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Currently online</p>
        </div>
      </div>

      <div className="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4 py-3 border-b border-[var(--color-border)] last:border-0">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-[var(--color-text-primary)]">Activity {i}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">2 hours ago</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

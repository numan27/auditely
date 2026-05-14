// app/_shared/components/auditely/leadSearchForm/leadSearchForm.tsx

'use client';

import { useState } from 'react';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Button } from '@/app/_shared/components/ui/button/button';

interface LeadSearchFormProps {
  onSearch: (niche: string, location: string) => void;
  isLoading: boolean;
}

export function LeadSearchForm({ onSearch, isLoading }: LeadSearchFormProps) {
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = niche.trim();
    const l = location.trim();
    if (!n || !l || isLoading) return;
    onSearch(n, l);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <Input
          placeholder="Business type (e.g. dentists, plumbers)"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="flex-1">
        <Input
          placeholder="City or location (e.g. Los Angeles)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        isLoading={isLoading}
        disabled={isLoading || !niche.trim() || !location.trim()}
      >
        {isLoading ? 'Finding…' : 'Find Leads →'}
      </Button>
    </form>
  );
}

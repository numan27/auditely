// The header's profile menu: who is signed in, with their picture, and the way to
// edit the profile, see the plan and log out.

import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

import { Avatar, ProfileMenu, ProfilePanel, initialsOf } from '@/app/_shared/components/auditely/profileMenu/profileMenu';
import { ProfileCardContext, type ProfileCard } from '@/app/_shared/lib/hooks/useProfileCard';
import { AppHeader } from '@/app/_shared/components/auditely/appHeader/appHeader';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const numan: ProfileCard = { name: 'Numan Khalil', company: 'My Tool', email: 'numan@x.com', logo: '/api/settings/profile/logo?v=1' };
const bare: ProfileCard = { name: null, company: null, email: 'sam@acme.studio', logo: null };

describe('initialsOf', () => {
  it('takes the first letters of the name, else the company, else the email', () => {
    expect(initialsOf(numan)).toBe('NK');
    expect(initialsOf({ ...bare, name: ' numan ' })).toBe('N');
    expect(initialsOf({ ...bare, name: 'Mary Jane Watson' })).toBe('MJ');
    expect(initialsOf({ ...bare, company: 'acme studio' })).toBe('AS');
    expect(initialsOf(bare)).toBe('S');
  });
});

describe('Avatar', () => {
  it('shows the logo when there is one, and the initials otherwise', () => {
    expect(renderToStaticMarkup(createElement(Avatar, { card: numan, size: 32 }))).toMatch(
      /<img[^>]*src="\/api\/settings\/profile\/logo\?v=1"/
    );
    const initials = renderToStaticMarkup(createElement(Avatar, { card: bare, size: 32 }));
    expect(initials).not.toContain('<img');
    expect(text(initials)).toBe('S');
  });
});

describe('ProfileMenu', () => {
  it('is a button named for the signed-in person, closed until clicked', () => {
    const html = renderToStaticMarkup(createElement(ProfileCardContext.Provider, { value: numan }, createElement(ProfileMenu)));
    expect(html).toMatch(/<button[^>]*aria-label="Your account: Numan Khalil"[^>]*aria-expanded="false"/);
    expect(text(html)).not.toContain('Log out');
  });

  it('leaves Feedback to the button at the bottom right, so the header keeps its room on a phone', () => {
    const html = renderToStaticMarkup(createElement(ProfileCardContext.Provider, { value: numan }, createElement(AppHeader)));
    expect(text(html)).not.toContain('Feedback');
  });

  it('names the account by its email when no name is saved', () => {
    const html = renderToStaticMarkup(createElement(ProfileCardContext.Provider, { value: bare }, createElement(ProfileMenu)));
    expect(html).toContain('aria-label="Your account: sam@acme.studio"');
  });
});

describe('ProfilePanel', () => {
  const panel = (card: ProfileCard, plan = 'Free') =>
    renderToStaticMarkup(createElement(ProfilePanel, { card, planName: plan, onClose: () => {}, onLogout: () => {}, onFeedback: () => {} }));

  it('shows the name, company, email and plan, with Edit profile, plans and Log out', () => {
    const html = panel(numan);
    expect(text(html)).toContain('Numan Khalil');
    expect(text(html)).toContain('My Tool');
    expect(text(html)).toContain('numan@x.com');
    expect(text(html)).toContain('Free plan');
    expect(html).toMatch(/<a[^>]*href="\/settings#profile"[^>]*>Edit profile<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/plans"[^>]*>Plans and usage<\/a>/);
    expect(html).toMatch(/<button[^>]*>Log out<\/button>/);
  });

  it('has Send feedback beside the account links', () => {
    expect(panel(numan)).toMatch(/<button[^>]*type="button"[^>]*>Send feedback<\/button>/);
  });

  it('asks for a name and logo when none are saved, and shows the email once', () => {
    const html = panel(bare, 'Owner');
    expect(text(html)).toContain('Add your name and logo in Settings');
    expect(text(html).match(/sam@acme\.studio/g)).toHaveLength(1);
    expect(text(html)).toContain('Owner plan');
  });
});

describe('AppHeader', () => {
  it('shows the profile menu on the right instead of a bare Log out button', () => {
    const html = renderToStaticMarkup(createElement(ProfileCardContext.Provider, { value: numan }, createElement(AppHeader)));
    expect(html).toContain('aria-label="Your account: Numan Khalil"');
    expect(text(html)).not.toContain('Log out');
  });
});

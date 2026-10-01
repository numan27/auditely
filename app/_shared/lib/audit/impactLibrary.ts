// app/_shared/lib/audit/impactLibrary.ts

// What each problem costs a business owner, in their words. The order is the
// priority: an audit's problems are listed in this order (see impact.ts).
// Rules: "you/your"; problem <= 12 words, cost <= 25, fix <= 20; straight
// quotes only (the PDF font has no curly quotes); no statistics outside STATS.

export interface Stat {
  text: string;
  source: string;
}

// The only two statistics a prospect sees, each always shown with its source
export const STATS = {
  mobileAbandon: {
    text: '53% of mobile site visits are abandoned if a page takes longer than 3 seconds to load.',
    source: 'Think with Google, The Need for Mobile Speed, 2016',
  },
  nearbyVisit: {
    text: '76% of people who search on their phone for something nearby visit a related business within a day.',
    source: 'Think with Google, 2016',
  },
} satisfies Record<string, Stat>;

export interface ImpactEntry {
  /** A finding id, or a speed / SSL signal (see impact.ts) */
  id: string;
  /** The result of the check this entry translates; other results aren't problems */
  status: 'fail' | 'warn';
  problem: string;
  cost: string;
  fix: string;
  stat?: keyof typeof STATS;
  /** Entries in a group are listed once, at the first one found */
  group?: string;
}

export const IMPACT_LIBRARY: ImpactEntry[] = [
  // 1. Invisible, or losing leads
  {
    id: 'seo.noindex', status: 'fail',
    problem: 'Your homepage tells Google not to show it in search',
    cost: 'People searching for you on Google may not find your site at all, so they call a competitor instead.',
    fix: 'Remove the setting that hides your homepage from Google.',
  },
  {
    id: 'seo.robots', status: 'fail',
    problem: 'Your site blocks search engines from reading it',
    cost: 'Google can\'t read your pages properly, so you show up far less often when people search for what you offer.',
    fix: 'Update your robots.txt file so search engines can read your site.',
  },
  {
    id: 'lead.form', status: 'fail',
    problem: 'We found no contact form or email link on your site',
    cost: 'Visitors who\'d rather write than call, or who visit after hours, have no easy way to reach you online.',
    fix: 'Add a short contact form to your homepage and contact page.',
  },
  {
    id: 'lead.clickToCall', status: 'fail', stat: 'nearbyVisit',
    problem: 'Your phone number isn\'t set up as a call link',
    cost: 'A clear call button at the top of the page gets more phone visitors to call you right away.',
    fix: 'Make your phone number a tap-to-call button at the top of every page.',
  },
  {
    id: 'lead.brokenLinks', status: 'fail',
    problem: 'Some links on your site lead to a missing page',
    cost: 'Visitors who click them see a "page not found" error, which looks neglected and makes them leave.',
    fix: 'Repair or redirect the broken links.',
  },
  {
    id: 'lead.contactPage', status: 'fail',
    problem: 'Your homepage has no link to a contact page',
    cost: 'Visitors looking for how to reach you have to search for it, and some won\'t bother.',
    fix: 'Add a "Contact" link to your main menu that leads to a clear contact page.',
  },

  // 2. Driving visitors away
  {
    id: 'speed.slowLoad', status: 'fail', stat: 'mobileAbandon',
    problem: 'Your site is slow to load on phones',
    cost: 'Most local customers search on their phone, and many leave before a slow page appears, choosing another business.',
    fix: 'Speed up the page (images, code and hosting) so it loads faster on phones.',
  },
  {
    id: 'ssl.invalid', status: 'fail',
    problem: 'Browsers warn visitors that your site is "Not secure"',
    cost: 'That warning scares many visitors away before they read anything, and it makes your business look less trustworthy.',
    fix: 'Install a valid security (SSL) certificate so your site loads securely.',
  },
  {
    id: 'seo.viewport', status: 'fail',
    problem: 'Your site isn\'t set up for phones',
    cost: 'On a phone your pages appear tiny and zoomed out, so visitors have to pinch and scroll, and most won\'t.',
    fix: 'Set up your pages to fit phone screens, then check each one on a phone.',
  },
  {
    id: 'speed.layoutShift', status: 'fail',
    problem: 'Your page jumps around while it loads',
    cost: 'Parts of the page can shift just as visitors try to tap, causing wrong taps and frustration on phones.',
    fix: 'Reserve space for images and banners so the page stays still while it loads.',
  },
  {
    id: 'lead.form', status: 'warn',
    problem: 'Your site has no contact form, only an email link',
    cost: 'Many people won\'t open their email app to write to you, but would fill in a short form on the page.',
    fix: 'Add a short contact form so visitors can message you without leaving your site.',
  },
  {
    id: 'lead.clickToCall', status: 'warn', stat: 'nearbyVisit',
    problem: 'Your homepage has no tap-to-call button',
    cost: 'A clear call button on the page visitors land on gets more of them to call you right away.',
    fix: 'Add a tap-to-call button to the top of your homepage.',
  },

  // 3. Found less often
  {
    id: 'geo.nap.phone', status: 'fail', stat: 'nearbyVisit', group: 'nap',
    problem: 'Your homepage phone number is missing or doesn\'t match your listing',
    cost: 'Customers may call the wrong number or doubt they found the right business, and search engines trust mismatched details less.',
    fix: 'Show the same phone number on your site as on your Google and other listings.',
  },
  {
    id: 'geo.nap.address', status: 'fail', stat: 'nearbyVisit', group: 'nap',
    problem: 'Your homepage address is missing or doesn\'t match your listing',
    cost: 'Customers may go to the wrong place or doubt your details, and search engines trust mismatched details less.',
    fix: 'Show the same address on every page as on your Google and other listings.',
  },
  {
    id: 'geo.nap.name', status: 'fail', group: 'nap',
    problem: 'Your homepage business name is missing or doesn\'t match your listing',
    cost: 'Customers and search engines may not be sure your website and your listing belong to the same business.',
    fix: 'Use the same business name on your site as on your Google and other listings.',
  },
  {
    id: 'geo.jsonld', status: 'fail', group: 'schema',
    problem: 'AI search tools can\'t easily tell what your business is',
    cost: 'Tools like ChatGPT and Google\'s AI answers rely on business details your site doesn\'t provide, so they may suggest others.',
    fix: 'Add business details (schema markup) that search engines and AI tools can read.',
  },
  {
    id: 'geo.businessType', status: 'fail', group: 'schema',
    problem: 'Search engines can\'t tell what kind of business you are',
    cost: 'AI tools and Google are less likely to suggest you when someone asks for a business like yours nearby.',
    fix: 'Mark your site with your exact business type, like Dentist or School.',
  },
  {
    id: 'geo.businessType', status: 'warn', group: 'schema',
    problem: 'Your site describes your type of business too generally',
    cost: 'AI tools may not match you to searches for your specific service, so they suggest a more clearly described competitor.',
    fix: 'Mark your site with your exact business type, like Dentist or School.',
  },
  {
    id: 'seo.title', status: 'fail',
    problem: 'Your homepage has no title for Google to show',
    cost: 'Google has to guess the headline it shows for you in search results, which usually gets fewer clicks.',
    fix: 'Write a clear page title with your business name, main service and city.',
  },
  {
    id: 'seo.metaDescription', status: 'fail',
    problem: 'Your homepage has no description for Google to show',
    cost: 'Google shows random text from your page under your name in search results, so fewer people click.',
    fix: 'Write a short description of what you do and where.',
  },
  {
    id: 'speed.heavyImages', status: 'fail',
    problem: 'Your images are much larger than they need to be',
    cost: 'Oversized images make your pages slow on phones, especially on mobile data, so some visitors give up.',
    fix: 'Resize and compress your images and use modern image formats.',
  },
  {
    id: 'lead.booking', status: 'warn',
    problem: 'Customers can\'t book with you online',
    cost: 'If you take appointments, people who\'d rather book at 10 pm than call in office hours can\'t do it online.',
    fix: 'Add an online booking or appointment-request button.',
  },

  // 4. Polish
  {
    id: 'geo.entityComplete', status: 'fail', group: 'schema',
    problem: 'Your business details for search engines are incomplete',
    cost: 'Missing your name, address or phone in those details makes AI tools less sure about recommending you.',
    fix: 'Complete your schema markup with your business name, address and phone.',
  },
  {
    id: 'geo.entityComplete', status: 'warn', group: 'schema',
    problem: 'Your business details for search engines are incomplete',
    cost: 'Missing your name, address or phone in those details makes AI tools less sure about recommending you.',
    fix: 'Complete your schema markup with your business name, address and phone.',
  },
  {
    id: 'geo.extras', status: 'warn',
    problem: 'Search engines can\'t read your opening hours or map location',
    cost: 'AI tools may not show your hours or location when people ask who\'s open nearby.',
    fix: 'Add your opening hours, map location and social profiles to your schema markup.',
  },
  {
    id: 'aeo.questions', status: 'fail', group: 'aeo',
    problem: 'Your site doesn\'t answer the questions customers ask',
    cost: 'AI assistants like ChatGPT quote sites that answer questions directly, and yours gives them little to quote.',
    fix: 'Add a short FAQ answering the questions customers ask you most.',
  },
  {
    id: 'aeo.faqSection', status: 'fail', group: 'aeo',
    problem: 'Your homepage has no questions-and-answers section',
    cost: 'Customers and AI assistants look for quick answers, and a page without them gives both less reason to pick you.',
    fix: 'Add a short FAQ answering the questions customers ask you most.',
  },
  {
    id: 'aeo.faqSchema', status: 'fail', group: 'aeo',
    problem: 'Your answers aren\'t marked up for search engines',
    cost: 'Google and AI assistants can\'t easily pick out your answers to show or quote them.',
    fix: 'Mark up your FAQ so search engines and AI tools can read it.',
  },
  {
    id: 'aeo.h1', status: 'fail', group: 'aeo',
    problem: 'Your homepage has no single clear main heading',
    cost: 'Visitors and search engines can\'t tell at a glance what you offer or where.',
    fix: 'Give the page one clear main heading with your main service and city.',
  },
  {
    id: 'aeo.h2', status: 'fail', group: 'aeo',
    problem: 'Your homepage isn\'t split into clear sections',
    cost: 'Without clear section headings, visitors skim past what you offer and AI tools struggle to quote you.',
    fix: 'Break the page into clear sections, each with its own heading.',
  },
  {
    id: 'aeo.hierarchy', status: 'fail', group: 'aeo',
    problem: 'Your page headings are missing or out of order',
    cost: 'Jumbled headings make the page harder for search engines and screen readers to follow.',
    fix: 'Put the page\'s headings in a logical order.',
  },
];

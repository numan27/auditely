// HTML fixtures for audit-engine tests

export const DENTIST_HOME = `<!doctype html><html><head>
<title>Smile Dental | Family Dentist in Springfield</title>
<meta name="description" content="Gentle family dentistry in Springfield, IL. Cleanings, crowns, whitening and emergency care. Book online today.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://smiledental.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Smile Dental","telephone":"+1-555-123-4567","address":{"@type":"PostalAddress","streetAddress":"123 Main St","addressLocality":"Springfield","addressRegion":"IL","postalCode":"62701"},"openingHours":"Mo-Fr 08:00-17:00"}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>
</head><body>
<h1>Smile Dental</h1>
<p>Welcome to Smile Dental, Springfield's family dentist since 1998. We offer cleanings, fillings, crowns, whitening and same-day emergency appointments for patients of all ages.</p>
<h2>Our Services</h2><p>Preventive care, cosmetic dentistry and restorative treatments.</p>
<h2>How much does a dental crown cost?</h2><p>Most crowns cost between $900 and $1,500 depending on the material.</p>
<h2>Do you accept insurance?</h2><p>Yes, we accept most major PPO plans.</p>
<h3>FAQ</h3><details><summary>Do you see children?</summary><p>Yes, from age 2.</p></details>
<footer>123 Main St, Springfield, IL 62701 · <a href="tel:+15551234567">(555) 123-4567</a></footer>
</body></html>`;

// A client-rendered app shell: real content only appears after JavaScript runs
export const JS_SHELL = `<!doctype html><html><head><title>Loading…</title></head>
<body><div id="root"></div><script src="/static/app.js"></script></body></html>`;

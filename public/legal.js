// Fills in the support email from stripe-config.json (via /api/premium/tiers) when one is set.
fetch('/api/premium/tiers').then((r) => r.json()).then(({ supportEmail }) => {
  if (!supportEmail) return;
  for (const el of document.querySelectorAll('.support-contact')) {
    el.textContent = 'Email ';
    el.appendChild(Object.assign(document.createElement('a'), { href: `mailto:${supportEmail}`, textContent: supportEmail }));
  }
}).catch(() => {});

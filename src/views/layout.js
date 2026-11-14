import { escapeHtml, icon } from '../html.js';

const navigation = [
  ['Docs', '/docs'],
  ['Models', '/models'],
  ['Pricing', '/pricing'],
  ['Chat', '/chat'],
  ['Console', '/console'],
  ['Changelog', '/changelog'],
];

const socialLinks = [
  ['GitHub', 'https://github.com/GonidonCloud'],
  ['YouTube', 'https://www.youtube.com/@GonidonCloud'],
  ['Hugging Face', 'https://huggingface.co/GonidonCloud'],
  ['Telegram', 'https://t.me/GonidonCloud'],
  ['Discord', 'https://discord.com/invite/gonidoncloud'],
];

export function brand() {
  return '<span class="brand-mark" aria-hidden="true"><span></span></span><span class="brand-word">mindlarp</span>';
}

export function publicLayout({ title, description = 'A family of AI models for clear thinking and ambitious ideas.', path = '/', content, bodyClass = '', nonce = '' }) {
  const siteUrl = (process.env.PUBLIC_URL || 'https://mindlarp.ai').replace(/\/$/, '');
  const canonical = `${siteUrl}${path === '' ? '/' : path}`;
  const noindex = path === '/console' || bodyClass.includes('auth-page') || title === 'Page not found';
  const nav = navigation.map(([label, href], index) => {
    const active = path === href || (href !== '/' && path.startsWith(`${href}/`));
    return `<a class="rail-link ${active ? 'active' : ''}" href="${href}" ${active ? 'aria-current="page"' : ''}><span class="rail-index">[${index + 1}]</span> ${label}</a>`;
  }).join('');
  const socials = socialLinks.map(([label, href]) => `<a href="${href}" target="_blank" rel="noreferrer" aria-label="MindLarp on ${label}">${label} ${icon('arrow')}</a>`).join('');
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Organization', name: 'MindLarp', url: siteUrl,
    logo: `${siteUrl}/assets/favicon.svg`, parentOrganization: { '@type': 'Organization', name: 'GonidonCloud' },
    sameAs: socialLinks.map(([, href]) => href),
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0a0a0a">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="MindLarp">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${escapeHtml(title)} · MindLarp">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${siteUrl}/assets/og.svg">
  <meta property="og:image:alt" content="MindLarp — the open intelligence model family">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)} · MindLarp">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${siteUrl}/assets/og.svg">
  <title>${escapeHtml(title)} · MindLarp</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/assets/style.css">
  <script type="application/ld+json" nonce="${nonce}">${structuredData}</script>
  <script type="module" src="/bootstrap.js" nonce="${nonce}"></script>
</head>
<body class="public-page ${bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="announcement"><span class="status-dot"></span> MindLarp Sol 1 is here <a href="/changelog">Read the release notes ${icon('arrow')}</a></div>
  <header class="mobile-header">
    <a href="/" class="brand" aria-label="MindLarp home">${brand()}</a>
    <button class="icon-button nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false">${icon('menu')}</button>
  </header>
  <aside class="public-rail">
    <a href="/" class="brand" aria-label="MindLarp home">${brand()}</a>
    <nav class="rail-nav" aria-label="Main navigation">${nav}</nav>
    <div class="rail-bottom">
      <a class="rail-console" href="/chat">Start chat ${icon('arrow')}</a>
      <span class="system-status"><span class="status-dot"></span> All systems normal</span>
    </div>
  </aside>
  <main id="main" class="public-main">${content}</main>
  <footer class="public-footer">
    <div class="footer-top"><a href="/" class="brand">${brand()}</a><a href="/chat" class="button button-light">Start chat ${icon('arrow')}</a></div>
    <div class="footer-grid">
      <div><span class="footer-label">Explore</span><a href="/models">Models</a><a href="/pricing">Pricing</a><a href="/changelog">Changelog</a></div>
      <div><span class="footer-label">Developers</span><a href="/docs">Documentation</a><a href="/docs/api-reference">API reference</a><a href="/console">Console</a></div>
      <div><span class="footer-label">Company</span><a href="mailto:hello@mindlarp.ai">Contact</a><a href="/legal">Legal & privacy</a><a href="/status">System status</a></div>
    </div>
    <div class="footer-socials" aria-label="Social links">${socials}</div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} GonidonCloud</span><span>MindLarp is a GonidonCloud project.</span></div>
  </footer>
</body>
</html>`;
}

export function consoleLayout({ title, path, content, user, csrf, nonce = '' }) {
  const items = [
    ['/console', 'Overview', 'home'],
    ['/chat', 'Chat', 'arrow'],
    ['/console/keys', 'API keys', 'key'],
    ['/console/usage', 'Usage', 'chart'],
    ['/console/billing', 'Billing', 'chart'],
    ['/console/settings', 'Settings', 'settings'],
  ];
  const nav = items.map(([href, label, iconName]) => {
    const active = path === href;
    return `<a href="${href}" class="console-nav-link ${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${icon(iconName)} ${label}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0a0a0a">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)} · MindLarp Console</title>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/style.css">
  <script type="module" src="/bootstrap.js" nonce="${nonce}"></script>
</head>
<body class="console-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <aside class="console-sidebar">
    <div class="console-sidebar-head"><a href="/" class="brand">${brand()}</a><span class="console-badge">CONSOLE</span></div>
    <nav class="console-nav" aria-label="Console navigation">${nav}</nav>
    <div class="console-sidebar-bottom">
      <a href="/docs" class="console-nav-link">${icon('arrow')} Documentation</a>
      <form method="post" action="/console/logout"><input type="hidden" name="csrf" value="${csrf}"><button class="console-nav-link logout-button" type="submit">${icon('logout')} Sign out</button></form>
      <div class="user-chip"><span class="avatar">${escapeHtml(user.displayName.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(user.displayName)}</strong><small>${escapeHtml(user.email)}</small></span></div>
    </div>
  </aside>
  <main id="main" class="console-main">${content}</main>
</body>
</html>`;
}

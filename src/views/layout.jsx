import { headers } from 'next/headers';
import { StaticContent } from '@/components/static-content.jsx';
import { TrustedController } from '@/components/trusted-controller.jsx';
import { icon } from '../html.js';

export const navigation = [
  ['Docs', '/docs'],
  ['Models', '/models'],
  ['Pricing', '/pricing'],
  ['Chat', '/chat'],
  ['Console', '/console'],
  ['Changelog', '/changelog'],
];

export const socialLinks = [
  ['GitHub', 'https://github.com/GonidonCloud'],
  ['YouTube', 'https://www.youtube.com/@GonidonCloud'],
  ['Hugging Face', 'https://huggingface.co/GonidonCloud'],
  ['Telegram', 'https://t.me/GonidonCloud'],
  ['Discord', 'https://discord.com/invite/gonidoncloud'],
];

export function Icon({ name, className = '' }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: icon(name) }} />;
}

export function Brand() {
  return <><span className="brand-mark" aria-hidden="true"><span /></span><span className="brand-word">mindlarp</span></>;
}

function renderContent(content) {
  return typeof content === 'string' ? <StaticContent html={content} /> : content;
}

export async function publicLayout({ path = '/', content, bodyClass = '' }) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  const siteUrl = (process.env.PUBLIC_URL || 'https://mindlarp.ai').replace(/\/$/, '');
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Organization', name: 'MindLarp', url: siteUrl,
    logo: `${siteUrl}/assets/favicon.svg`, parentOrganization: { '@type': 'Organization', name: 'GonidonCloud' },
    sameAs: socialLinks.map(([, href]) => href),
  }).replaceAll('<', '\\u003c');

  return <div className={`public-page ${bodyClass}`}>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="announcement"><span className="status-dot" /> MindLarp Sol 1 is here <a href="/changelog">Read the release notes <Icon name="arrow" /></a></div>
    <header className="mobile-header">
      <a href="/" className="brand" aria-label="MindLarp home"><Brand /></a>
      <button className="icon-button nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"><Icon name="menu" /></button>
    </header>
    <aside className="public-rail">
      <a href="/" className="brand" aria-label="MindLarp home"><Brand /></a>
      <nav className="rail-nav" aria-label="Main navigation">{navigation.map(([label, href], index) => {
        const active = path === href || (href !== '/' && path.startsWith(`${href}/`));
        return <a key={href} className={`rail-link ${active ? 'active' : ''}`} href={href} aria-current={active ? 'page' : undefined}><span className="rail-index">[{index + 1}]</span> {label}</a>;
      })}</nav>
      <div className="rail-bottom"><a className="rail-console" href="/chat">Start chat <Icon name="arrow" /></a><span className="system-status"><span className="status-dot" /> All systems normal</span></div>
    </aside>
    <main id="main" className="public-main">{renderContent(content)}</main>
    <footer className="public-footer">
      <div className="footer-top"><a href="/" className="brand"><Brand /></a><a href="/chat" className="button button-light">Start chat <Icon name="arrow" /></a></div>
      <div className="footer-grid">
        <div><span className="footer-label">Explore</span><a href="/models">Models</a><a href="/pricing">Pricing</a><a href="/changelog">Changelog</a></div>
        <div><span className="footer-label">Developers</span><a href="/docs">Documentation</a><a href="/docs/api-reference">API reference</a><a href="/console">Console</a></div>
        <div><span className="footer-label">Company</span><a href="mailto:hello@mindlarp.ai">Contact</a><a href="/legal">Legal &amp; privacy</a><a href="/status">System status</a></div>
      </div>
      <div className="footer-socials" aria-label="Social links">{socialLinks.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={`MindLarp on ${label}`}>{label} <Icon name="arrow" /></a>)}</div>
      <div className="footer-bottom"><span>{`© ${new Date().getFullYear()} GonidonCloud`}</span><span>MindLarp is a GonidonCloud project.</span></div>
    </footer>
    <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: structuredData }} />
    <TrustedController />
  </div>;
}

export function consoleLayout({ path, content, user, csrf }) {
  const items = [['/console', 'Overview', 'home'], ['/chat', 'Chat', 'arrow'], ['/console/keys', 'API keys', 'key'], ['/console/usage', 'Usage', 'chart'], ['/console/billing', 'Billing', 'chart'], ['/console/settings', 'Settings', 'settings']];
  return <div className="console-page">
    <a className="skip-link" href="#main">Skip to content</a>
    <aside className="console-sidebar">
      <div className="console-sidebar-head"><a href="/" className="brand"><Brand /></a><span className="console-badge">CONSOLE</span></div>
      <nav className="console-nav" aria-label="Console navigation">{items.map(([href, label, iconName]) => <a key={href} href={href} className={`console-nav-link ${path === href ? 'active' : ''}`} aria-current={path === href ? 'page' : undefined}><Icon name={iconName} /> {label}</a>)}</nav>
      <div className="console-sidebar-bottom">
        <a href="/docs" className="console-nav-link"><Icon name="arrow" /> Documentation</a>
        <form method="post" action="/console/logout"><input type="hidden" name="csrf" value={csrf} /><button className="console-nav-link logout-button" type="submit"><Icon name="logout" /> Sign out</button></form>
        <div className="user-chip"><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.email}</small></span></div>
      </div>
    </aside>
    <main id="main" className="console-main">{renderContent(content)}</main>
  </div>;
}

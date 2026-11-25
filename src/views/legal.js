import { plans } from '../content.js';
import { escapeHtml } from '../html.js';
import { billingFootnote, formatRub, rubAmount } from '../money.js';
import { legalUi, privacyDocument, supportEmail, termsDocument } from '../legal/index.js';
import { publicLayout } from './layout.jsx';

const paths = {
  privacy: { en: '/privacy', ru: '/ru/privacy' },
  terms: { en: '/terms', ru: '/ru/terms' },
};

function renderClause(clause) {
  const text = escapeHtml(clause.text).replaceAll(
    '{supportEmail}',
    `<a href="mailto:${supportEmail}">${supportEmail}</a>`,
  );
  const list = clause.list
    ? `<ul class="legal-list">${clause.list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
  return `<div class="legal-clause"><p><span class="legal-number">${clause.number}.</span> ${text}</p>${list}</div>`;
}

function languageSwitcher(kind, lang) {
  const ui = legalUi[lang];
  return `<nav class="legal-lang" aria-label="${ui.languageLabel}"><a href="${paths[kind].en}" ${lang === 'en' ? 'aria-current="page"' : ''} hreflang="en">English</a><a href="${paths[kind].ru}" ${lang === 'ru' ? 'aria-current="page"' : ''} hreflang="ru">Русский</a></nav>`;
}

function plansAppendix(lang) {
  const ui = legalUi[lang];
  const rows = plans
    .map(
      plan =>
        `<tr><td>${escapeHtml(plan.name)}</td><td>$${plan.price}</td><td>≈${formatRub(rubAmount(plan.price))} ₽</td></tr>`,
    )
    .join('');
  return `<section class="legal-section legal-appendix"><h2>${escapeHtml(ui.appendixTitle)}</h2><p>${escapeHtml(ui.appendixIntro)}</p><div class="table-wrap"><table class="docs-table"><thead><tr><th>${escapeHtml(ui.planColumn)}</th><th>${escapeHtml(ui.usdColumn)}</th><th>${escapeHtml(ui.rubColumn)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="legal-footnote">${escapeHtml(billingFootnote(lang))}</p></section>`;
}

function legalShell(kind, lang, { appendix = false } = {}) {
  const doc = kind === 'privacy' ? privacyDocument(lang) : termsDocument(lang);
  const sections = doc.sections
    .map(
      section =>
        `<section class="legal-section"><h2><span class="legal-number">${section.number}.</span> ${escapeHtml(section.title)}</h2>${section.clauses.map(renderClause).join('')}</section>`,
    )
    .join('');
  return `<article class="prose-page legal-document" lang="${doc.lang}"><span class="section-kicker">${escapeHtml(doc.kicker)}</span><h1>${escapeHtml(doc.title)}</h1><p class="legal-byline">${escapeHtml(doc.byline)}</p>${languageSwitcher(kind, lang)}${sections}${appendix ? plansAppendix(lang) : ''}</article>`;
}

export function privacyPage(lang = 'en') {
  return publicLayout({
    path: paths.privacy[lang],
    content: legalShell('privacy', lang),
    bodyClass: 'legal-page',
  });
}

export function termsPage(lang = 'en') {
  return publicLayout({
    path: paths.terms[lang],
    content: legalShell('terms', lang, { appendix: true }),
    bodyClass: 'legal-page',
  });
}

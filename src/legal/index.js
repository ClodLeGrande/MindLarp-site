import { privacyEn } from './privacy.en.js';
import { privacyRu } from './privacy.ru.js';
import { termsEn } from './terms.en.js';
import { termsRu } from './terms.ru.js';

export const supportEmail = 'mindlarp.inbox@gmail.com';

export function privacyDocument(lang = 'en') {
  return lang === 'ru' ? privacyRu : privacyEn;
}

export function termsDocument(lang = 'en') {
  return lang === 'ru' ? termsRu : termsEn;
}

export const legalUi = {
  en: {
    languageLabel: 'Document language',
    appendixTitle: 'Appendix — Plans',
    appendixIntro: 'Service plans and fixed ruble prices as of the publication date of this version.',
    planColumn: 'Plan',
    usdColumn: 'USD / month',
    rubColumn: 'RUB / month',
    perMonth: '/ month',
  },
  ru: {
    languageLabel: 'Язык документа',
    appendixTitle: 'Приложение — Тарифы',
    appendixIntro: 'Тарифы Сервиса и фиксированные цены в рублях на дату публикации настоящей редакции.',
    planColumn: 'Тариф',
    usdColumn: 'USD в месяц',
    rubColumn: 'RUB в месяц',
    perMonth: 'в месяц',
  },
};

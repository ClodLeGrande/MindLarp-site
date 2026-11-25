import { privacyEn } from './privacy.en.js';
import { privacyRu } from './privacy.ru.js';
import { termsEn } from './terms.en.js';
import { termsRu } from './terms.ru.js';

export const supportEmail = 'maksimansakov423@gmail.com';

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
    appendixIntro:
      'Service plans as of the publication date of this version. Ruble amounts are indicative.',
    planColumn: 'Plan',
    usdColumn: 'USD / month',
    rubColumn: 'RUB / month (indicative)',
    perMonth: '/ month',
  },
  ru: {
    languageLabel: 'Язык документа',
    appendixTitle: 'Приложение — Тарифы',
    appendixIntro:
      'Тарифы Сервиса на дату публикации настоящей редакции. Суммы в рублях указаны ориентировочно.',
    planColumn: 'Тариф',
    usdColumn: 'USD в месяц',
    rubColumn: 'RUB в месяц (ориентировочно)',
    perMonth: 'в месяц',
  },
};

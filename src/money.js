const DEFAULT_USD_TO_RUB = 90;

export function usdToRubRate() {
  const value = Number(process.env.USD_TO_RUB);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_TO_RUB;
}

export function rubAmount(usd) {
  return Math.round(usd * usdToRubRate());
}

export function formatRub(amount) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount);
}

export function formatUsdWithRub(usd, rub) {
  return rub == null ? `${usd}` : `${usd} = ${formatRub(rub)} ₽`;
}

export function billingFootnote(lang = 'en') {
  return lang === 'ru'
    ? 'Стоимость в рублях указана рядом с ценой в USD; итоговая сумма и доступные способы оплаты отображаются перед подтверждением платежа.'
    : 'The fixed ruble price is shown alongside USD; the final amount and available payment methods are displayed before payment confirmation.';
}

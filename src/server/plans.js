import { plans } from '../content.js';

export function planPaymentLink(plan) {
  const link = process.env[plan.linkEnv] || '';
  return link.startsWith('https://') ? link : '';
}

export function acceptedStripePriceIds() {
  return [process.env.STRIPE_PRICE_ID, ...plans.map((plan) => process.env[plan.priceEnv])].filter(Boolean);
}

export function planForPriceId(priceId) {
  if (!priceId) return null;
  return plans.find((plan) => process.env[plan.priceEnv] && process.env[plan.priceEnv] === priceId) || null;
}

export function planDailyLimit(plan) {
  return Number(process.env[plan.limitEnv] || plan.dailyLimit);
}
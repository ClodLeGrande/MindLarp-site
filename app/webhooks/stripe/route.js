import { getStripe } from '@/src/server/config.js';
import { json } from '@/src/server/responses.js';
import { getStore } from '@/src/server/store.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return json({ error: 'Stripe webhook is not configured.' }, 503);
  let event;
  try {
    event = stripe.webhooks.constructEvent(Buffer.from(await request.arrayBuffer()), request.headers.get('stripe-signature') || '', webhookSecret);
  } catch {
    return json({ error: 'Invalid webhook signature.' }, 400);
  }
  const object = event.data.object;
  const store = await getStore();
  const user = store.data.users.find((item) => item.id === object.client_reference_id || item.billing?.stripeCustomerId === object.customer);
  if (user && ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    await store.update((data) => {
      const stored = data.users.find((item) => item.id === user.id);
      stored.billing = { ...stored.billing, stripeCustomerId: String(object.customer || stored.billing?.stripeCustomerId || ''), subscriptionId: object.subscription || object.id, status: event.type === 'checkout.session.completed' ? 'active' : object.status, priceId: object.items?.data?.[0]?.price?.id || stored.billing?.priceId || process.env.STRIPE_PRICE_ID, currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : stored.billing?.currentPeriodEnd || null };
    });
  }
  return json({ received: true });
}

import { publicUrl } from './config.js';

export function pageMetadata(title, description, path = '/', locale = 'en_US') {
  const image = '/assets/og.svg';
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: 'MindLarp', locale, type: 'website', images: [{ url: image, alt: 'MindLarp — the open intelligence model family' }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export const publicPaths = ['/', '/models', '/models/larp-1', '/models/larp-1-code', '/pricing', '/docs', '/docs/getting-started', '/docs/models', '/docs/authentication', '/docs/api-reference', '/docs/errors', '/changelog', '/legal', '/privacy', '/terms', '/ru/privacy', '/ru/terms', '/status'];

export { publicUrl };

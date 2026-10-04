import type { SwipeCard } from './supabase';

// Card photos are self-hosted in public/cards/, so image_url is stored relative to the app's base path.
export function cardImageUrl(card: Pick<SwipeCard, 'image_url'>): string | null {
  const url = card.image_url;
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${import.meta.env.BASE_URL}${url}`;
}

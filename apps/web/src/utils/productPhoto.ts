import API_URL from './apiUrl.js';

/**
 * Returns the full URL for a product photo.
 * If photoUrl is null/empty, returns undefined.
 */
export function productPhotoUrl(photoUrl: string | null | undefined): string | undefined {
  if (!photoUrl) return undefined;
  // If it's already a full URL (http/https), return as-is
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) return photoUrl;
  return `${API_URL}/${photoUrl}`;
}

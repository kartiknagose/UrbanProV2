// Resolve a profile photo URL from the API or DB to a browser-usable URL.
import { API_ORIGIN } from '../config/runtime';

export function resolveProfilePhotoUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${API_ORIGIN}${url}`;
  }
  return `${API_ORIGIN}/${url}`;
}

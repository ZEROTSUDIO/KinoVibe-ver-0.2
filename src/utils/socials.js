// KinoVibe Socials & External Platforms Utility
import { escapeHtml, Toast } from './ui.js';

export const SOCIAL_PLATFORMS = {
  letterboxd: {
    id: 'letterboxd',
    name: 'Letterboxd',
    color: '#00e054',
    bg: 'rgba(0, 224, 84, 0.12)',
    border: 'rgba(0, 224, 84, 0.3)',
    baseUrl: 'https://letterboxd.com/',
    placeholder: 'username or letterboxd.com/user',
    iconSvg: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="6" cy="12" r="3.6" fill="#ff8000" />
      <circle cx="12" cy="12" r="3.6" fill="#00e054" />
      <circle cx="18" cy="12" r="3.6" fill="#40bcf4" />
    </svg>`
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    color: '#ffffff',
    bg: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.2)',
    baseUrl: 'https://x.com/',
    placeholder: '@handle or x.com/handle',
    iconSvg: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>`
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    color: '#f43f5e',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.3)',
    baseUrl: 'https://instagram.com/',
    placeholder: '@username or instagram.com/user',
    iconSvg: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>`
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.3)',
    baseUrl: 'https://youtube.com/',
    placeholder: '@channel or youtube.com/@channel',
    iconSvg: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>`
  },
  website: {
    id: 'website',
    name: 'Website',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.12)',
    border: 'rgba(167, 139, 250, 0.3)',
    baseUrl: '',
    placeholder: 'https://yourwebsite.com',
    iconSvg: `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`
  }
};

/**
 * Normalizes input string (handle or url) into a clean, clickable URL
 */
export function normalizeSocialUrl(platformKey, input) {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  const cfg = SOCIAL_PLATFORMS[platformKey];
  if (!cfg) return raw;

  // Already a full URL
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  // Domain included without protocol (e.g. letterboxd.com/username)
  if (raw.includes('.com') || raw.includes('.org') || raw.includes('.net') || raw.includes('.io') || raw.includes('/')) {
    return `https://${raw.replace(/^\/+/, '')}`;
  }

  // Handle only (e.g. @username or username)
  const cleanHandle = raw.replace(/^@+/, '');
  if (platformKey === 'youtube' && !cleanHandle.startsWith('@')) {
    return `${cfg.baseUrl}@${cleanHandle}`;
  }
  return `${cfg.baseUrl}${cleanHandle}`;
}

/**
 * Extracts a concise display handle from input or URL
 */
export function getDisplayHandle(platformKey, input) {
  if (!input) return '';
  const raw = String(input).trim();
  if (!raw) return '';

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
      return url.hostname.replace(/^www\./, '');
    }
  } catch (e) {}

  return raw.replace(/^@+/, '');
}

/**
 * Renders HTML for a social badge button
 */
export function renderSocialBadge(platformKey, value) {
  const cfg = SOCIAL_PLATFORMS[platformKey];
  if (!cfg || !value || !value.trim()) return '';

  const href = normalizeSocialUrl(platformKey, value);
  const handle = getDisplayHandle(platformKey, value);

  return `
    <a href="${escapeHtml(href)}" 
       target="_blank" 
       rel="noopener noreferrer" 
       class="social-pill group" 
       style="--accent-color: ${cfg.color}; --accent-bg: ${cfg.bg}; --accent-border: ${cfg.border}"
       title="Visit ${cfg.name}: ${escapeHtml(handle)}">
      <span class="social-icon">${cfg.iconSvg}</span>
      <span class="social-name">${cfg.name}</span>
      <span class="social-handle">@${escapeHtml(handle)}</span>
      <span class="social-arrow">↗</span>
    </a>
  `;
}

/**
 * Copies user profile shareable link to clipboard
 */
export async function copyProfileShareLink(usernameOrId) {
  if (!usernameOrId) return;
  const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
  const url = `${baseUrl}/profile.html?u=${encodeURIComponent(usernameOrId)}`;

  try {
    await navigator.clipboard.writeText(url);
    Toast.success('Profile link copied to clipboard!');
  } catch (err) {
    // Fallback for older browsers
    const tempInput = document.createElement('input');
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    Toast.success('Profile link copied to clipboard!');
  }
}

/**
 * Central config: resolves API base URL from environment variable.
 * - In local dev: Vite proxy handles `/api` → no prefix needed (uses relative paths),
 *   but VITE_API_URL can be set to http://localhost:8000 for direct use.
 * - In production (Vercel): VITE_API_URL = https://your-backend.onrender.com
 */
const rawBase = import.meta.env['VITE_API_URL'] as string | undefined;

// Strip trailing slash if present
export const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : '';

/**
 * Builds a full API URL.
 * - Local dev (no VITE_API_URL): returns relative path e.g. "/api/..."
 * - Production (VITE_API_URL set): returns absolute URL e.g. "https://backend.onrender.com/api/..."
 */
export function apiUrl(path: string): string {
  // Ensure leading slash on path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

/**
 * Builds a WebSocket URL. Automatically converts http(s) → ws(s).
 */
export function wsUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE) {
    const wsBase = API_BASE.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    return `${wsBase}${normalizedPath}`;
  }
  // Local dev: use relative WebSocket URL (converts current page protocol)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${normalizedPath}`;
}

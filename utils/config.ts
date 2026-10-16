/**
 * utils/config.ts — Smart Campus Digital Twin API & WebSocket Configuration
 *
 * Dynamically resolves relative paths in production cloud (Vercel) co-hosted environments
 * and falls back to local development server URLs when running locally.
 */

const isDev = process.env.NODE_ENV === 'development';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined' && !isDev) {
    return ''; // Relative path for Vercel production
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
};

export const getWsBaseUrl = (): string => {
  if (typeof window !== 'undefined' && !isDev) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  return process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws';
};

export const API_BASE_URL: string = getApiBaseUrl();
export const WS_BASE_URL: string = getWsBaseUrl();

/**
 * utils/config.ts — Smart Campus Digital Twin API Configuration
 */

export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export const WS_BASE_URL: string =
  process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws/state';


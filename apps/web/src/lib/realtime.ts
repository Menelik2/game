'use client';

/**
 * Connect to /realtime namespace for wallet + jackpot updates.
 * Financial truth remains on the server; this is display-only.
 */
export function getRealtimeUrl() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return api.replace(/\/$/, '');
}

/** Dynamic import socket.io-client in the browser when you add the dependency:
 *   npm install socket.io-client --workspace=@apex/web
 *
 * Example:
 *   const { io } = await import('socket.io-client');
 *   const socket = io(`${getRealtimeUrl()}/realtime`, { auth: { token } });
 *   socket.on('wallet:update', (data) => ...);
 *   socket.on('jackpot:update', (data) => ...);
 */

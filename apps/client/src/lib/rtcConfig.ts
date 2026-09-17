import { parseIceServers } from '@fluxroom/shared';

const DEFAULT_STUN: RTCIceServer = {
  urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
};

type TurnEnv = Partial<Record<'VITE_TURN_URL' | 'VITE_TURN_USERNAME' | 'VITE_TURN_CREDENTIAL', string>>;

/** An optional relay baked in at build time (comma-separated URLs). Prefer configuring TURN on the server instead, so credentials stay out of the bundle. */
export function staticTurnServer(env: TurnEnv = import.meta.env): RTCIceServer | null {
  const urls = (env.VITE_TURN_URL ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (urls.length === 0 || !env.VITE_TURN_USERNAME || !env.VITE_TURN_CREDENTIAL) return null;
  return { urls, username: env.VITE_TURN_USERNAME, credential: env.VITE_TURN_CREDENTIAL };
}

export function buildRtcConfig(
  remoteServers: RTCIceServer[],
  staticTurn: RTCIceServer | null = staticTurnServer()
): RTCConfiguration {
  const iceServers = [DEFAULT_STUN, ...remoteServers];
  if (staticTurn) iceServers.push(staticTurn);
  return { iceServers };
}

/** `wss://host/path` → `https://host/path/ice-servers` (and ws → http). */
export function iceServersEndpoint(signalingUrl: string): string {
  const url = new URL(signalingUrl);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/ice-servers`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

/**
 * Fetches TURN relays from the signaling server. Never throws: on any failure it
 * returns an empty list and the room still works for peers that can connect directly.
 */
export async function fetchIceServers(signalingUrl: string, timeoutMs: number): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(iceServersEndpoint(signalingUrl), { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return [];
    return parseIceServers(await res.json()) ?? [];
  } catch {
    return [];
  }
}

import { parseIceServers, type IceServer } from '@fluxroom/shared';

export type IceServerProvider = () => Promise<IceServer[]>;

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

interface ProviderEnv {
  TURN_URLS?: string;
  TURN_USERNAME?: string;
  TURN_CREDENTIAL?: string;
  TURN_CREDENTIALS_URL?: string;
}

const REMOTE_FETCH_TIMEOUT_MS = 5_000;
const DEFAULT_CACHE_MS = 60 * 60 * 1000;

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Builds the TURN relay list handed to browsers. Without a relay, peers on different
 * mobile networks (carrier-grade NAT) usually cannot connect to each other at all.
 *
 * Sources, both optional and combinable:
 * - TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL: a static relay (comma-separated URLs).
 * - TURN_CREDENTIALS_URL: an HTTPS endpoint returning an ICE server list, e.g. Metered's
 *   `https://<app>.metered.live/api/v1/turn/credentials?apiKey=<key>`. Cached, and a failed
 *   refresh keeps serving the last good list.
 */
export function createIceServerProvider(
  env: ProviderEnv,
  fetchImpl: FetchLike = fetch,
  cacheMs: number = DEFAULT_CACHE_MS
): IceServerProvider {
  const staticServers: IceServer[] = [];
  const urls = splitList(env.TURN_URLS);
  if (urls.length > 0 && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    staticServers.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  }

  const remoteUrl = env.TURN_CREDENTIALS_URL?.trim();
  let cache: { at: number; servers: IceServer[] } | null = null;

  return async () => {
    if (!remoteUrl) return staticServers;

    if (!cache || Date.now() - cache.at >= cacheMs) {
      try {
        const res = await fetchImpl(remoteUrl, { signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS) });
        const servers = res.ok ? parseIceServers(await res.json()) : null;
        if (servers) cache = { at: Date.now(), servers };
      } catch {
        // keep serving the previous list, if any
      }
    }

    return [...(cache?.servers ?? []), ...staticServers];
  };
}

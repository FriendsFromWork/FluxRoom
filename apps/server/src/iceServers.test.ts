import { describe, it, expect, vi } from 'vitest';
import { createIceServerProvider } from './iceServers.js';

const remoteList = [
  { urls: 'stun:stun.relay.example.com:80' },
  { urls: 'turn:global.relay.example.com:443?transport=tcp', username: 'remote-u', credential: 'remote-c' },
];

function okResponse(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

describe('createIceServerProvider', () => {
  it('returns nothing when no TURN env is set', async () => {
    const provider = createIceServerProvider({});
    expect(await provider()).toEqual([]);
  });

  it('builds a static relay from comma-separated TURN_URLS', async () => {
    const provider = createIceServerProvider({
      TURN_URLS: 'turn:a.example.com:80, turns:a.example.com:443?transport=tcp ,',
      TURN_USERNAME: 'u',
      TURN_CREDENTIAL: 'c',
    });
    expect(await provider()).toEqual([
      { urls: ['turn:a.example.com:80', 'turns:a.example.com:443?transport=tcp'], username: 'u', credential: 'c' },
    ]);
  });

  it('ignores a static relay missing its credentials', async () => {
    const provider = createIceServerProvider({ TURN_URLS: 'turn:a.example.com:80', TURN_USERNAME: 'u' });
    expect(await provider()).toEqual([]);
  });

  it('fetches remote credentials and caches them', async () => {
    const fetchImpl = vi.fn(() => okResponse(remoteList));
    const provider = createIceServerProvider({ TURN_CREDENTIALS_URL: 'https://x.example.com/creds' }, fetchImpl);

    expect(await provider()).toEqual(remoteList);
    expect(await provider()).toEqual(remoteList);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps serving the last good list when a refresh fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => okResponse(remoteList))
      .mockImplementationOnce(() => Promise.reject(new Error('network down')))
      .mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }));
    const provider = createIceServerProvider({ TURN_CREDENTIALS_URL: 'https://x.example.com/creds' }, fetchImpl, 0);

    expect(await provider()).toEqual(remoteList);
    expect(await provider()).toEqual(remoteList);
    expect(await provider()).toEqual(remoteList);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('combines remote and static relays', async () => {
    const provider = createIceServerProvider(
      { TURN_CREDENTIALS_URL: 'https://x.example.com/creds', TURN_URLS: 'turn:b:80', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'c' },
      () => okResponse({ iceServers: remoteList })
    );
    expect(await provider()).toEqual([...remoteList, { urls: ['turn:b:80'], username: 'u', credential: 'c' }]);
  });
});

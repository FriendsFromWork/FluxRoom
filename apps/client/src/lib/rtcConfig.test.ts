import { describe, it, expect } from 'vitest';
import { buildRtcConfig, iceServersEndpoint, staticTurnServer } from './rtcConfig';

describe('iceServersEndpoint', () => {
  it('maps wss → https and ws → http', () => {
    expect(iceServersEndpoint('wss://fluxroom.onrender.com')).toBe('https://fluxroom.onrender.com/ice-servers');
    expect(iceServersEndpoint('ws://localhost:3001')).toBe('http://localhost:3001/ice-servers');
  });

  it('handles trailing slashes, sub-paths, and query strings', () => {
    expect(iceServersEndpoint('wss://host.example.com/')).toBe('https://host.example.com/ice-servers');
    expect(iceServersEndpoint('wss://host.example.com/signal/?x=1')).toBe(
      'https://host.example.com/signal/ice-servers'
    );
  });
});

describe('staticTurnServer', () => {
  it('returns null unless URL, username, and credential are all set', () => {
    expect(staticTurnServer({})).toBeNull();
    expect(staticTurnServer({ VITE_TURN_URL: 'turn:a:80', VITE_TURN_USERNAME: 'u' })).toBeNull();
    expect(staticTurnServer({ VITE_TURN_URL: ' , ', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'c' })).toBeNull();
  });

  it('splits comma-separated URLs', () => {
    expect(
      staticTurnServer({ VITE_TURN_URL: 'turn:a:80, turns:a:443', VITE_TURN_USERNAME: 'u', VITE_TURN_CREDENTIAL: 'c' })
    ).toEqual({ urls: ['turn:a:80', 'turns:a:443'], username: 'u', credential: 'c' });
  });
});

describe('buildRtcConfig', () => {
  it('always includes STUN, then server relays, then a static relay', () => {
    const remote = { urls: 'turn:r:443', username: 'ru', credential: 'rc' };
    const local = { urls: ['turn:s:80'], username: 'su', credential: 'sc' };
    const config = buildRtcConfig([remote], local);
    expect(config.iceServers?.[0].urls).toContain('stun:stun.l.google.com:19302');
    expect(config.iceServers?.slice(1)).toEqual([remote, local]);
  });

  it('works with no relays at all', () => {
    expect(buildRtcConfig([], null).iceServers).toHaveLength(1);
  });
});

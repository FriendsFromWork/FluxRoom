/**
 * ICE server configuration. STUN is Google's free public server. TURN is optional
 * and only added when the corresponding env vars are set, so the app runs fully
 * free with zero config and can be upgraded with a TURN provider (e.g. Metered.ca
 * free tier) later for better reliability behind strict/symmetric NATs.
 */
export function getRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return { iceServers };
}

import { createSignalingServer } from './server.js';
import { createIceServerProvider } from './iceServers.js';

const PORT = Number(process.env.PORT) || 3001;
const ORIGINS = process.env.ORIGIN
  ? process.env.ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : null;

const RELAY = process.env.RELAY_ENABLED?.trim().toLowerCase() !== 'false';

const { httpServer } = createSignalingServer({
  allowedOrigins: ORIGINS,
  iceServers: createIceServerProvider(process.env),
  relay: RELAY,
});

httpServer.listen(PORT, () => {
  console.log(`fluxroom signaling server listening on :${PORT} (server relay ${RELAY ? 'on' : 'off'})`);
  if (!RELAY && !process.env.TURN_CREDENTIALS_URL && !process.env.TURN_URLS) {
    console.warn('Relay is off and no TURN server is configured: peers on different mobile networks will likely fail to connect.');
  }
});

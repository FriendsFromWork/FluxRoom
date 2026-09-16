import { createSignalingServer } from './server.js';

const PORT = Number(process.env.PORT) || 3001;
const ORIGINS = process.env.ORIGIN ? process.env.ORIGIN.split(',').map((o) => o.trim()) : null;

const { httpServer } = createSignalingServer({ allowedOrigins: ORIGINS });

httpServer.listen(PORT, () => {
  console.log(`fluxroom signaling server listening on :${PORT}`);
});

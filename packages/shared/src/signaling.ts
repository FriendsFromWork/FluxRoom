import { z } from 'zod';

/**
 * Messages exchanged between browser clients and the signaling server (over `ws`).
 * The server only ever relays SDP/ICE payloads inside `signal` messages — it never
 * inspects or stores their contents, and nothing here ever carries chat/file data.
 */

export const AvatarIdSchema = z.number().int().min(1).max(8);

/** One entry of an RTCConfiguration's `iceServers` list (STUN or TURN). */
export const IceServerSchema = z.object({
  urls: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
export type IceServer = z.infer<typeof IceServerSchema>;

/** Response body of the signaling server's `GET /ice-servers` endpoint. */
export const IceServersResponseSchema = z.object({
  iceServers: z.array(IceServerSchema),
});
export type IceServersResponse = z.infer<typeof IceServersResponseSchema>;

/**
 * Parses an ICE server list from either a bare array (the shape TURN providers like
 * Metered return) or an `{ iceServers: [...] }` object. Invalid entries are dropped
 * rather than failing the whole list. Returns null if nothing usable was found.
 */
export function parseIceServers(body: unknown): IceServer[] | null {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { iceServers?: unknown }).iceServers)
      ? (body as { iceServers: unknown[] }).iceServers
      : null;
  if (!list) return null;

  const servers: IceServer[] = [];
  for (const entry of list) {
    const result = IceServerSchema.safeParse(entry);
    if (result.success) servers.push(result.data);
  }
  return servers.length > 0 ? servers : null;
}

export const PeerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarId: AvatarIdSchema,
});
export type PeerInfo = z.infer<typeof PeerInfoSchema>;

export const SignalDataSchema = z.union([
  z.object({ kind: z.literal('offer'), sdp: z.string() }),
  z.object({ kind: z.literal('answer'), sdp: z.string() }),
  z.object({
    kind: z.literal('ice-candidate'),
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
  }),
]);
export type SignalData = z.infer<typeof SignalDataSchema>;

export const ClientToServerSchema = z.union([
  z.object({
    type: z.literal('join'),
    room: z.string().min(1).max(64),
    name: z.string().min(1).max(40),
    avatarId: AvatarIdSchema,
  }),
  z.object({
    type: z.literal('signal'),
    to: z.string(),
    data: SignalDataSchema,
  }),
  /**
   * App-level keepalive sent as a regular JSON message rather than a raw WebSocket
   * ping/pong control frame — some reverse proxies (e.g. Cloudflare in front of a
   * Render free-tier service) don't reliably relay control frames, which silently
   * breaks server-side liveness checks built on them. A normal message always
   * gets through the same path as join/signal traffic.
   */
  z.object({
    type: z.literal('ping'),
  }),
]);
export type ClientToServer = z.infer<typeof ClientToServerSchema>;

export const ServerToClientSchema = z.union([
  z.object({
    type: z.literal('room-state'),
    selfId: z.string(),
    /** The server may append a numeric suffix if the requested name collided with an existing peer's. */
    selfName: z.string(),
    room: z.string(),
    peers: z.array(PeerInfoSchema),
    /** Whether this server will relay traffic between peers that can't connect directly. */
    relay: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('peer-joined'),
    peer: PeerInfoSchema,
  }),
  z.object({
    type: z.literal('peer-left'),
    id: z.string(),
  }),
  z.object({
    type: z.literal('signal'),
    from: z.string(),
    data: SignalDataSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('pong'),
  }),
]);
export type ServerToClient = z.infer<typeof ServerToClientSchema>;

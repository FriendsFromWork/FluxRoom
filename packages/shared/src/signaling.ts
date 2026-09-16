import { z } from 'zod';

/**
 * Messages exchanged between browser clients and the signaling server (over `ws`).
 * The server only ever relays SDP/ICE payloads inside `signal` messages — it never
 * inspects or stores their contents, and nothing here ever carries chat/file data.
 */

export const AvatarIdSchema = z.number().int().min(1).max(8);

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
]);
export type ServerToClient = z.infer<typeof ServerToClientSchema>;

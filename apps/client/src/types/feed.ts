export type FileStatus = 'transferring' | 'done' | 'failed';

export type FeedItem =
  | { kind: 'chat'; id: string; from: string; avatarId: number; self: boolean; text: string; ts: number }
  | { kind: 'text'; id: string; from: string; avatarId: number; self: boolean; content: string; ts: number }
  | {
      kind: 'code';
      id: string;
      from: string;
      avatarId: number;
      self: boolean;
      lang: string;
      content: string;
      ts: number;
    }
  | {
      kind: 'file';
      id: string;
      from: string;
      avatarId: number;
      self: boolean;
      name: string;
      size: number;
      mime: string;
      ts: number;
      status: FileStatus;
      progress: number;
      blobUrl?: string;
    }
  | { kind: 'system'; id: string; text: string; ts: number };

/**
 * - connected: direct peer-to-peer link
 * - relayed: no direct route (e.g. different mobile networks) — traffic goes through the server
 * - failed: no direct route and the server doesn't relay
 */
export type PeerStatus = 'connecting' | 'connected' | 'relayed' | 'disconnected' | 'failed';

export interface RoomPeer {
  id: string;
  name: string;
  avatarId: number;
  status: PeerStatus;
}

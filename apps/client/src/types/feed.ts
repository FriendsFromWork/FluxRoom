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

export type PeerStatus = 'connecting' | 'connected' | 'disconnected';

export interface RoomPeer {
  id: string;
  name: string;
  avatarId: number;
  status: PeerStatus;
}

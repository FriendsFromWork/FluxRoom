import { create } from 'zustand';
import { RoomConnection } from '@/lib/roomConnection';
import type { FeedItem, RoomPeer } from '@/types/feed';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:3001';

/**
 * - connecting: first join in progress (or still retrying before it ever succeeded)
 * - reconnecting: was in the room, lost the signaling server, retrying
 * - error: unrecoverable (e.g. room full) — no more retries
 */
export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface RoomState {
  status: RoomStatus;
  errorMessage: string | null;
  connectAttempt: number;
  /** The server relays traffic for peers that can't connect directly. */
  relay: boolean;
  selfId: string | null;
  selfName: string;
  selfAvatarId: number;
  roomName: string;
  peers: Record<string, RoomPeer>;
  feed: FeedItem[];

  joinRoom: (name: string, room: string, avatarId: number) => void;
  leaveRoom: () => void;
  sendChat: (text: string) => void;
  sendText: (content: string) => void;
  sendCode: (lang: string, content: string) => void;
  sendFile: (file: File) => void;
}

let connection: RoomConnection | null = null;

/** Whether messages sent now will reach this peer (directly, or through the relay). */
export function canReachPeer(peer: RoomPeer, relay: boolean): boolean {
  return peer.status === 'connected' || peer.status === 'relayed' || (relay && peer.status === 'connecting');
}

export const useRoomStore = create<RoomState>((set) => ({
  status: 'idle',
  errorMessage: null,
  connectAttempt: 0,
  relay: false,
  selfId: null,
  selfName: '',
  selfAvatarId: 1,
  roomName: '',
  peers: {},
  feed: [],

  joinRoom: (name, room, avatarId) => {
    connection?.disconnect();
    const conn = new RoomConnection();
    connection = conn;

    set({
      status: 'connecting',
      errorMessage: null,
      connectAttempt: 0,
      relay: false,
      selfId: null,
      selfName: name,
      selfAvatarId: avatarId,
      roomName: room,
      peers: {},
      feed: [],
    });

    conn.on('self-joined', ({ selfId, selfName, roomName, relay }) => {
      set({ status: 'connected', errorMessage: null, connectAttempt: 0, relay, selfId, selfName, roomName });
    });

    conn.on('reconnecting', ({ attempt }) => {
      set((state) => ({
        status: state.selfId ? 'reconnecting' : 'connecting',
        connectAttempt: attempt,
      }));
    });

    conn.on('peer-update', (peer) => {
      set((state) => ({ peers: { ...state.peers, [peer.id]: peer } }));
    });

    conn.on('peer-removed', ({ id }) => {
      set((state) => {
        if (!(id in state.peers)) return state;
        const peers = { ...state.peers };
        delete peers[id];
        return { peers };
      });
    });

    conn.on('feed-item', (item) => {
      set((state) => ({ feed: [...state.feed, item] }));
    });

    conn.on('feed-item-update', (patch) => {
      set((state) => ({
        feed: state.feed.map((item) => (item.id === patch.id ? ({ ...item, ...patch } as FeedItem) : item)),
      }));
    });

    conn.on('error', ({ message }) => {
      set({ status: 'error', errorMessage: message, peers: {} });
    });

    conn.connect(SIGNALING_URL, room, name, avatarId);
  },

  leaveRoom: () => {
    connection?.disconnect();
    connection = null;
    set({ status: 'idle', errorMessage: null, connectAttempt: 0, selfId: null, peers: {}, feed: [], roomName: '' });
  },

  sendChat: (text) => connection?.sendChat(text),
  sendText: (content) => connection?.sendText(content),
  sendCode: (lang, content) => connection?.sendCode(lang, content),
  sendFile: (file) => void connection?.sendFile(file),
}));

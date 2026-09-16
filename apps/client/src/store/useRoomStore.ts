import { create } from 'zustand';
import { RoomConnection } from '@/lib/roomConnection';
import type { FeedItem, RoomPeer } from '@/types/feed';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'ws://localhost:3001';

export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface RoomState {
  status: RoomStatus;
  errorMessage: string | null;
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

export const useRoomStore = create<RoomState>((set, get) => ({
  status: 'idle',
  errorMessage: null,
  selfId: null,
  selfName: '',
  selfAvatarId: 1,
  roomName: '',
  peers: {},
  feed: [],

  joinRoom: (name, room, avatarId) => {
    connection?.disconnect();
    connection = new RoomConnection();

    set({
      status: 'connecting',
      errorMessage: null,
      selfName: name,
      selfAvatarId: avatarId,
      roomName: room,
      peers: {},
      feed: [],
    });

    connection.on('self-joined', ({ selfId, selfName, roomName }) => {
      set({ status: 'connected', selfId, selfName, roomName });
    });

    connection.on('peer-update', (peer) => {
      set((state) => ({ peers: { ...state.peers, [peer.id]: peer } }));
    });

    connection.on('peer-removed', ({ id }) => {
      set((state) => {
        const peers = { ...state.peers };
        delete peers[id];
        return { peers };
      });
    });

    connection.on('feed-item', (item) => {
      set((state) => ({ feed: [...state.feed, item] }));
    });

    connection.on('feed-item-update', (patch) => {
      set((state) => ({
        feed: state.feed.map((item) => (item.id === patch.id ? ({ ...item, ...patch } as FeedItem) : item)),
      }));
    });

    connection.on('error', ({ message }) => {
      set({ status: 'error', errorMessage: message });
    });

    connection.on('socket-closed', () => {
      if (get().status !== 'error') {
        set({ status: 'error', errorMessage: 'Disconnected from the signaling server.' });
      }
    });

    connection.connect(SIGNALING_URL, room, name, avatarId);
  },

  leaveRoom: () => {
    connection?.disconnect();
    connection = null;
    set({ status: 'idle', selfId: null, peers: {}, feed: [], roomName: '' });
  },

  sendChat: (text) => connection?.sendChat(text),
  sendText: (content) => connection?.sendText(content),
  sendCode: (lang, content) => connection?.sendCode(lang, content),
  sendFile: (file) => void connection?.sendFile(file),
}));

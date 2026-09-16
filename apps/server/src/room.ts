import type { WebSocket } from 'ws';

export interface Peer {
  id: string;
  name: string;
  avatarId: number;
  ws: WebSocket;
  isAlive: boolean;
}

export class Room {
  readonly name: string;
  readonly peers = new Map<string, Peer>();

  constructor(name: string) {
    this.name = name;
  }

  get isEmpty(): boolean {
    return this.peers.size === 0;
  }

  /** Appends a numeric suffix if `name` is already taken in this room, so joins never fail. */
  uniqueName(desired: string): string {
    const taken = new Set(Array.from(this.peers.values()).map((p) => p.name));
    if (!taken.has(desired)) return desired;

    let n = 2;
    while (taken.has(`${desired} (${n})`)) n++;
    return `${desired} (${n})`;
  }

  add(peer: Peer): void {
    this.peers.set(peer.id, peer);
  }

  remove(peerId: string): void {
    this.peers.delete(peerId);
  }

  others(exceptId: string): Peer[] {
    return Array.from(this.peers.values()).filter((p) => p.id !== exceptId);
  }
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  getOrCreate(name: string): Room {
    let room = this.rooms.get(name);
    if (!room) {
      room = new Room(name);
      this.rooms.set(name, room);
    }
    return room;
  }

  get(name: string): Room | undefined {
    return this.rooms.get(name);
  }

  deleteIfEmpty(name: string): void {
    const room = this.rooms.get(name);
    if (room && room.isEmpty) {
      this.rooms.delete(name);
    }
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get peerCount(): number {
    let total = 0;
    for (const room of this.rooms.values()) total += room.peers.size;
    return total;
  }
}

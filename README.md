<p align="center">
  <img src="logo.png" alt="Fluxroom logo" width="220" />
</p>

<h3 align="center">Fluxroom</h3>
<p align="center">
  Share files, text, code snippets, and chat — peer-to-peer, in real time.<br/>
  No accounts. No database. Nothing ever stored on any server.
</p>

## What is Fluxroom?

Fluxroom is a real-time room for a small group of people to instantly share
things with each other — files, pasted text, code snippets, and chat
messages — all in one unified live feed with avatars, like a lightweight
private group chat. Whenever the network allows it, everything transfers
**directly between browsers over WebRTC**. When two devices can't reach each
other directly (typically phones on different mobile networks), the room's own
server relays their traffic in memory instead, so it still works everywhere.
When everyone leaves, the room and everything in it disappears — there's no
database, no accounts, and nothing is ever persisted anywhere.

## Features

- 💬 **Chat** — real-time messages between everyone in the room
- 📋 **Text** — paste and share larger blocks of text
- 💻 **Code** — paste snippets with syntax highlighting and a language picker
- 📁 **Files** — send files peer-to-peer with a live transfer progress bar
- 🙂 **Avatars** — pick a pixel-art avatar when you join
- 🔗 **Instant rooms** — memorable auto-generated room codes, shareable via link or QR code
- 🌓 **Light/dark theme**, smooth animations, and a clean enterprise-style UI
- 🔒 **Zero server storage** — nothing is stored anywhere except in the browser tabs that are open
- 🆓 **Free to run** — no database, deployable entirely on free hosting tiers

## How to use it

1. Open the app, type a name, and pick an avatar.
2. **Create a room** to get a fresh room code, or **join** one using a code
   someone shared with you.
3. Share the room with others via the room code, the direct link, or the QR
   code (click **Share** in the room header).
4. Once someone joins, use the composer at the bottom to send:
   - **Message** — a quick chat line
   - **Text** — a pasted block of text
   - **Code** — a snippet, with a language dropdown for syntax highlighting
   - 📎 the paperclip button — attach and send a file
5. Everything appears in one live feed with the sender's avatar, name, and
   timestamp — file transfers show a live progress bar and a download button
   once complete.
6. Close the tab (or hit the leave button) whenever you're done — nothing
   about the room persists anywhere after that.

## How it works

- A tiny **signaling server** (Node + TypeScript + `ws`) holds rooms in
  memory and passes WebRTC handshake messages (SDP offers/answers, ICE
  candidates) between peers in the same room.
- Every peer in a room tries to open a direct `RTCDataChannel` to every other
  peer (full mesh). Chat, pasted text, code snippets, and chunked file
  transfers flow over these data channels, with progress computed locally.
- **Relay fallback:** until a direct channel opens — or if it never can, as
  between two different mobile networks (carrier-grade NAT) — the same traffic
  goes through the signaling server's WebSocket instead. The server forwards
  it in memory, only between members of the same room, and never stores it.
  Relayed file transfers use acknowledgement-based flow control, so the server
  holds at most ~1 MB per transfer. The people list shows who is "Direct" and
  who is "Relayed via server". A direct link that opens later takes over
  automatically.
- Rooms and messages exist only in memory (server) and in the browser tab
  (client) — closing the tab or restarting the server clears everything.

## Tech stack

```
apps/client       Vite + React + TypeScript + Tailwind CSS + shadcn/ui (Base UI)
apps/server       Node + TypeScript + ws (signaling only, no database)
packages/shared   TypeScript types + zod schemas shared by both
```

Avatars are generated locally with [DiceBear](https://www.dicebear.com)
(no network calls), code snippets use CodeMirror 6, and animations use
Motion — all free and open-source.

## Local setup, testing & deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step instructions:
installing dependencies, running it locally, running the test suite, and
deploying the client to Vercel and the signaling server to Render — entirely
on free tiers.

# Fluxroom — Setup & Deployment Guide

Everything you need to run Fluxroom locally, test it, and deploy it for free.
The whole stack runs on free tiers with no database anywhere — rooms and
messages live only in memory and in the browser.

## Prerequisites

- Node.js 18+ and npm
- A GitHub account (to deploy to Vercel/Render)
- Free accounts on [Vercel](https://vercel.com) and [Render](https://render.com)

## 1. Install dependencies

From the repo root (this is an npm workspaces monorepo — one install covers
`apps/client`, `apps/server`, and `packages/shared`):

```bash
npm install
```

## 2. Configure local environment variables

Copy the example env file for the client:

```bash
cp apps/client/.env.example apps/client/.env.local
```

Its default already points at the local signaling server:

```
VITE_SIGNALING_URL=ws://localhost:3001
```

The server needs no env vars for local dev (see the reference table below for
what's available).

## 3. Run it locally

```bash
npm run dev
```

This starts the signaling server on `:3001` and the Vite dev server (usually
`:5173`, or the next free port). Open the printed URL in **two separate
browser windows/tabs**, use the same room code in both, and you should see
the peers connect and be able to exchange chat/text/code/files.

## 4. Run the test suite

```bash
npm test
```

Runs vitest: protocol schema validation + binary chunk round-trip tests in
`packages/shared`, and real WebSocket integration tests against the signaling
server in `apps/server` (roster broadcast, signal relay, room isolation,
disconnect cleanup, name de-duplication, malformed-input handling, origin
allow-list). WebRTC/data-channel behavior itself can only be exercised in a
real browser, so verify that manually via step 3 before deploying.

## 5. Build for production (optional local check)

```bash
npm run build
```

Builds `packages/shared`, then `apps/server`, then `apps/client` in that
order (the client and server both depend on the shared package's compiled
output).

## Environment variables reference

| Variable | App | Default | Purpose |
|---|---|---|---|
| `VITE_SIGNALING_URL` | client | `ws://localhost:3001` | WebSocket URL of the signaling server |
| `VITE_TURN_URL` | client | unset | Optional build-time TURN relay (comma-separated URLs). Prefer the server-side variables below |
| `VITE_TURN_USERNAME` | client | unset | Username for `VITE_TURN_URL` |
| `VITE_TURN_CREDENTIAL` | client | unset | Credential for `VITE_TURN_URL` |
| `PORT` | server | `3001` | Port the signaling server listens on |
| `ORIGIN` | server | unset (allow all) | Comma-separated allow-list of origins permitted to connect and to fetch TURN credentials |
| `RELAY_ENABLED` | server | `true` | Relay traffic through this server for peers that can't connect directly. Set `false` to disable |
| `TURN_CREDENTIALS_URL` | server | unset | Optional. HTTPS URL returning a TURN server list (not needed; the built-in relay covers this) |
| `TURN_URLS` | server | unset | Static TURN relay, comma-separated URLs |
| `TURN_USERNAME` | server | unset | Username for `TURN_URLS` |
| `TURN_CREDENTIAL` | server | unset | Credential for `TURN_URLS` |

## 6. Deploy the signaling server → Render

1. Push this repo to GitHub.
2. In Render, click **New → Web Service** and point it at the repo.
3. Set:
   - **Root Directory**: leave as the repo root (so the build can see the workspace and `packages/shared`)
   - **Build Command**: `npm install && npm run build:shared && npm run build:server`
   - **Start Command**: `node apps/server/dist/index.js`
4. Add the `ORIGIN` environment variable once you know your Vercel URL (step
   7), e.g. `https://fluxroom.vercel.app` — comma-separate multiple origins
   if needed. You can leave it unset initially and add it after deploying
   the client.
5. Deploy. Render gives you a URL like `https://fluxroom-server.onrender.com`.
   Verify it's alive: `curl https://fluxroom-server.onrender.com/` should
   return `{"status":"ok",...}`.
6. The signaling WebSocket URL for the client is the same host with `wss://`
   instead of `https://`: `wss://fluxroom-server.onrender.com`.

**Note:** Render's free tier sleeps after 15 minutes of inactivity and takes
a few seconds to wake on the next request — fine for personal/small-scale
use. Fluxroom's client shows a "connecting…" state and times out gracefully
with a retry-friendly error if the wake-up takes too long.

## 7. Deploy the client → Vercel

1. Import the repo into Vercel.
2. Set:
   - **Root Directory**: `apps/client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (leave "Install Command" as default —
     Vercel will run the workspace root install automatically)
3. Add environment variable `VITE_SIGNALING_URL` = `wss://<your-render-app>.onrender.com`.
4. Deploy. `vercel.json` (already in `apps/client`) includes the SPA rewrite
   so refreshing a `/r/<room-code>` link works instead of 404ing.
5. Go back to Render and set `ORIGIN` to this Vercel URL if you hadn't
   already, then redeploy the server.

## 8. Post-deploy checklist

- [ ] Open the deployed client on two different devices/networks (not just
      two tabs on the same machine — that hides real-world NAT traversal
      issues).
- [ ] Create a room, share the link/QR/code, join from the second device.
- [ ] Send a chat message, a text block, a code snippet, and a file both
      ways; confirm the file's progress bar completes and the download works.
- [ ] Close one tab and confirm the other sees "left the room" and the peer
      list updates.

## Different networks: the built-in relay

Peers connect directly when they can. Two devices on the **same** Wi-Fi, or two
tabs on one machine, always can. Phones on **different mobile carriers** usually
cannot: carrier-grade NAT blocks direct connections.

For those peers, the signaling server itself relays chat and files over the
WebSocket they already have open. It's **on by default** and needs no extra
service or account: it's just your existing Render server.

- The people list shows **Direct** or **Relayed via server** for each person.
- Relayed traffic passes through server memory only, between members of one
  room, and is never stored. File transfers use acknowledgement-based flow
  control, so the server holds at most ~1 MB per transfer.
- If a direct route appears later, it takes over automatically.
- Relayed data counts toward your Render plan's outbound bandwidth. Check the
  usage in the Render dashboard if people share large files often.

To turn the relay off (direct-only), set `RELAY_ENABLED=false` on Render. Peers
that can't connect directly will then show "Can't connect".

### Optional: a TURN server instead

If you ever prefer a dedicated TURN relay (e.g. to keep relayed traffic
encrypted end-to-end by WebRTC), set `TURN_CREDENTIALS_URL`, or
`TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL`, on the server. Browsers pick
it up from `GET /ice-servers`. It's not required.

# MAYDAY: Tower Control — Phase 4

A real-time, server-authoritative lobby for 2–6 players. This phase includes create/join room codes, nicknames, live player lists, host-only start, activity messages, reconnection and host transfer. The playable airport includes two runways, arrivals/departures, hold/land/taxi/takeoff commands, server-controlled movement, seven-minute rounds, team scoring, missed-flight penalties, increasing traffic and a results screen. Crew selections and quick messages synchronize in real time. Crosswinds close a free runway for 25 seconds; emergency arrivals have 35 seconds of fuel and earn +250 when handled safely (−150 if missed).

## Run

Requires Node.js 22.12+ and pnpm:

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. Join from another browser using the room code. For devices on the same network, use the computer's LAN address on port 3000, subject to firewall settings.

```sh
pnpm test
pnpm build
NODE_ENV=production pnpm start
```

## Deployment

Use one Node service with HTTPS and WebSocket proxy support. Set NODE_ENV=production, PORT, and optionally PUBLIC_ORIGIN to the exact public HTTPS origin. The server serves both browser files and /ws. Room data is in memory: use a single instance; restarts end sessions. Disconnects reserve seats for 30 seconds. Rooms expire after 30 minutes without membership/start activity. A localhost preview is not a public submission URL.

## Usability

Open How to play in the lobby or during a round. Aircraft selection opens a fixed clearance panel on smaller screens; Close deselects the aircraft. Emergency flights appear first in the flight list. Sound is off by default and can be enabled per browser tab for radio, emergency, weather and round-end tones. Results replace the airport at shift end; the host can return everyone to the lobby.

## Remaining work

Separate physical-device playtesting, public hosting and contest submission assets. Confirm the separate Handshake mission instructions before submission.

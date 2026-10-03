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

Separate physical-device playtesting and feedback. The game and dashboard are publicly hosted. Confirm the separate Handshake mission instructions before submission.

## Solo practice

Create a room and choose **Start solo practice** to learn the controls without another player. Practice uses the same seven-minute shift and scoring. Return to the lobby after the shift to invite friends. Multiplayer requires 2–6 connected players.

## Realism upgrade

Host-selectable Easy KPRC (3 runways), Medium KPHX (3), Hard KLAX (4), Expert KORD (8). Geometry uses OurAirports threshold coordinates retrieved 2026-10-03. True headings are distinct from magnetic runway numbers. Closed historical KORD runways are excluded. The stored source snapshot is airport-runways-source.json; source: https://github.com/davidmegginson/ourairports-data/blob/main/runways.csv.

Taxiway A, gates G1–G6 and connecting routes are schematic game constructs, not claimed airport infrastructure. All paths and timing are controlled by the server; the browser interpolates positions for smooth display. Ground speed is integrated using a per-airport nautical-mile map scale. The server advances motion in 0.1-second steps; speeds are in knots and altitude is AGL feet. Ground travel now takes distance-based time. Heavy wake delays are simplified (25 seconds for other traffic, 17 seconds for following heavies), not regulatory minima. Wind shifts defer until moving traffic clears, then retaxi queued departures.

Validation stages: A choose each airport as host and check guest synchronization; B compare aircraft profiles and arrival/departure waves; C land and taxi, queue departures, check heavy wake warnings; D watch reciprocal runway changes and occupied-short-final go-arounds. Physical-phone and cellular playtests remain outstanding.

The original engine is retained as a regression fixture for calls without a difficulty; all actual lobby starts use the airport-aware engine.

## Accuracy pass — Stage 1

Heading is unwrapped and rate limited using shortest angular differences. Near-zero velocity does not change heading. Holding circuits and wind reroutes begin at the current aircraft position. Approach targets: light 70 kt, regional 130 kt, narrowbody 140 kt, heavy 150 kt. Taxi caps 16–18 kt, corner targets 6–8 kt. Rollout uses gradual braking; taxi acceleration and altitude changes are bounded. Debug toggle exposes selected-aircraft heading, ground speed, AGL altitude and state.

Original regression tests remain; airport-aware timing tests now wait for physical arrival instead of the old fixed countdown. Stage 3 verified routes/curves and Stage 4 stands/map controls remain pending user approval. Existing taxi paths and holding geometry remain schematic.

## Accuracy pass — Stage 2

Radar blocks show callsign, type, ground speed in knots, altitude MSL feet (AGL plus airport elevation) and squawk. Normal codes are unique four-digit octal values, reserving 7500, 7600 and 7700; assigned normal codes remain reserved during special-code use. Emergencies share 7700 as appropriate; temporary radio failures use 7600 and restore normal codes after 25 seconds. Radio failures retain existing clearances.

Server-generated alerts predict 15 seconds ahead using current headings and speeds, with compressed game thresholds of 0.12 NM / 100 ft and 0.18 NM behind a heavy. These are game rules, not regulatory ATC minima. Surface entry prediction checks five seconds ahead against schematic runway geometry. Alerts synchronize with room state, flash tracks, and sound only when enabled. Actual separation losses cost 100 points and incursions 75; sustained incidents are penalized once, while blocked clearances cost nothing. Forecasts use constant altitude and velocity; verified ground geometry and larger airspace remain later stages.

## Accuracy pass — Stage 3 and rankings

Arrivals spawn at a defined map boundary along named IN game fixes, descending along the runway approach. Departures remain tracked while climbing to OUT boundary fixes and score only at the boundary. Fix names are fictional game labels, not published procedures. Ground routes use circular fillets with minimum radii of 60/100/150/220 feet for light/regional/narrowbody/heavy aircraft, approximated by small arc segments; short schematic connectors are collapsed before smoothing. The actual server taxi path is drawn on the radar. These are simplified centerlines, not surveyed airport taxi geometry. Static ground diagrams and gates remain approximate.

Verified name references: PRC A/B/D https://www.faa.gov/flight_deck/prc ; PHX E/F/C https://www.faa.gov/air_traffic/publications/domesticnotices/dom21022_af.html and https://www.faa.gov/airports/runway_safety/publications/Tips-from-PHX-ATC-Tower-Kneecard.pdf ; LAX E https://www.lawa.org/groups-and-divisions/airport-operations/ops-advisory?id=9167&page=2 ; ORD A https://www.faa.gov/flight_deck/ord . Name verification does not imply current operational routes or construction status. PRC runway 3L/21R is not for air-carrier operations in the cited FAA guidance; this game remains simplified.

/leaderboard shows top 100 completed shifts per difficulty and mode, separated into crew and practice. Server-authoritative scores sort descending, ties favor fewer violations, then more handled flights and earlier completion. Only completed seven-minute rounds enter; nicknames are public and unverified, and there is no login. Rankings default to current server memory and reset on free Render restarts/deploys. Optional RANKINGS_FILE enables atomic file saves and reload; permanent retention requires a persistent disk or database, which the free service does not currently have. The page makes the reset limitation visible.

All 43 tests pass, including original regressions plus boundary entry/exit, circular-radius and continuous-turn tests, completed-round scoring, board separation, tie-breaking, single recording and optional storage reload. Stage 4 remains pending approval. Physical phone/cellular playtests remain outstanding.

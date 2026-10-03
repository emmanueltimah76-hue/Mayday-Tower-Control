# Stage 2: traffic patterns and recovery — local review

Branch: `fix/stage-1-movement`. No merge to main and no live deployment.
Preview on this computer: http://localhost:3010/

## What changed

The server guides aircraft through inbound → downwind → base → final. Land authorizes the existing route, without skipping legs. Clearance persists through recovery when issued after Hold or a go-around. Hold cancels the old clearance, climbs toward 1,500 ft AGL, flies runway heading then crosswind, turns, and rejoins downwind. It never freezes or resets fuel, position, heading or speed. Short final checks use runway-relative distance; a missing clearance, occupied runway, closure or wake delay causes a go-around before touchdown. Unstable approaches also go around. A go-around requires a new landing clearance.

Departures line up, roll, climb on runway heading, then turn left toward an OUT fix. They leave and score at the airspace boundary. Flight strips show pattern legs and clearance status; debug shows the actual steering target, phase, AGL, speed, heading, command history and FPS.

Patterns and named IN/OUT fixes are schematic game geometry, not published procedures. Left-hand patterns are a game default, not a claim about operational procedures at KPRC/KPHX/KLAX/KORD. Taxi geometry remains visibly approximate. FAA general guidance is the basis for the pattern heights: https://www.faa.gov/air_traffic/publications/aim_html/chap4_section_3.html

## Exact desktop test

1. Create a room on the local preview. Choose Easy and Start solo practice. Select the first arrival and turn Debug on.
2. Press Land. Expect Accepted, “cleared to land” in the strip, and inbound → downwind → base → final. It must keep moving forward without skipping to the runway. Wait for touchdown, smooth braking, and “taxi now”; Taxi to a stand. Expect +100 once after parking.
3. In another shift, press Hold on an arrival. Expect clearance cancelled, go-around/crosswind/rejoin legs, a climb toward 1,500 ft AGL, continuous motion and decreasing fuel. Press Land during recovery. Expect it to finish recovery, rejoin downwind and continue the pattern with the clearance still active.
4. In another shift, leave an arrival uncleared. Expect a go-around before it reaches the runway, a reason in the tower log, and no score for a prevented unsafe landing. Issue Land to let it try again.
5. Taxi a departure, wait until queued, then Take off. Expect line-up → takeoff-roll → climb-out → outbound. It must remain tracked beyond the runway and score only when it leaves the boundary.
6. Repeat on Medium, Hard and Expert. Use matching assigned runway first. Try a different runway as a separate stress test; it requires a recovery route and additional flying time.
7. Join the same room from a second browser/device. Check that leg, clearance, Hold feedback, position and log agree. Retry an invalid or outdated command: expect an explicit rejection, with the reason in debug.
8. Pan, zoom, recenter and toggle sound. Watch an emergency and a conflict: emergency/actual-loss priority, maximum four flashing tracks, no repeated warning spam.

## Exact phone test

Localhost on a phone refers to the phone, so use this computer's LAN address with port 3010 while both devices are on the same Wi-Fi. The local server must be running; firewall/network access may need user setup. A cellular test needs a separate staging URL, which has not been deployed. Do not test this change at the live URL yet.

1. Join a desktop-created room, start with the host, and select an arrival by its strip.
2. Check leg/clearance labels are readable; scroll to Hold/Land; verify visible acceptance and rejection messages.
3. Turn Debug on and watch FPS during a pattern, recovery, alerts, and map panning. Aim for smooth movement near 60 FPS. Record phone model, browser and measured FPS if it drops persistently.
4. Pinch and drag; recenter; verify the command panel remains reachable and does not cover the map. Rotate the phone and check for horizontal page overflow.
5. Repeat with six connected players. Disconnect/reconnect one phone and verify state/clearance continuity and host transfer if the host leaves.

Real mid-range phone performance and cellular networking remain unverified. Browser phone-width emulation does not establish device performance.

## Balance values

Seven-minute rounds and 2–6 players remain unchanged. First wave: 25 seconds. First emergency attempt: 20 seconds. Additional crew reduces the spawn interval by one second per player above two, minimum 14 seconds. Waves are spaced by `interval × wave size + 25 seconds`.

| Difficulty | Spawn interval at 2 / 6 players | Wave size | Emergency attempt interval | Normal fuel reserve | Emergency reserve |
|---|---:|---:|---:|---:|---:|
| Easy | 34 / 30 s | 2 | 160 s | 180 s | 100 s |
| Medium | 28 / 24 s | 3 | 140 s | 150 s | 85 s |
| Hard | 22 / 18 s | 3 | 120 s | 120 s | 70 s |
| Expert | 18 / 14 s | 4 | 100 s | 100 s | 60 s |

Arrival fuel = schematic route distance / type downwind speed + 60 seconds for turns, rounded up, plus the reserve above. Airborne fuel burn is one timer second per elapsed second, including holds/go-arounds. Ground service/taxi burn behavior and departure patience are retained. Normal arrivals are omitted when fewer than route budget + 60 shift seconds remain; emergencies require budget + 30. A late normal arrival can be replaced by a departure if a stand is available and more than 100 shift seconds remain. Emergency attempts can be skipped when insufficient time remains, so the interval is not a promise of a new emergency.

| Aircraft | Inbound / downwind / final | Pattern AGL | Base target AGL | Recovery climb |
|---|---:|---:|---:|---:|
| Light | 90 / 80 / 70 kt | 1,000 ft | 600 ft | 10 ft/s |
| Regional | 150 / 140 / 130 kt | 1,500 ft | 900 ft | 15 ft/s |
| Narrowbody | 160 / 150 / 140 kt | 1,500 ft | 900 ft | 15 ft/s |
| Heavy | 170 / 160 / 150 kt | 1,500 ft | 1,000 ft | 15 ft/s |

Airborne turns: light 6°/s, jets 3°/s; airborne speed changes 2 kt/s. Final follows an approximate 3° descent profile. Recovery target is 1,500 ft AGL for all types. Ground speeds/braking are preserved from Stage 1.

Scoring was reviewed and retained: normal handled +100, emergency +250, missed normal −50, missed emergency −150, actual separation loss −100, actual incursion −75. Prevented unsafe clearances/go-arounds do not themselves cost points. Scores still come from server state, with arrivals credited after parking and departures at the boundary. Weather cadence, 25-second closures, 25-second heavy wake countdown and radio-loss timings are retained. Stage 1 alert priority/throttling remains: four flashing aircraft, top three conflicts, 20-second duplicate-warning suppression and five-second sound spacing.

Stage 3 ground reservations/collision prevention is intentionally pending your confirmation after testing Stage 2.

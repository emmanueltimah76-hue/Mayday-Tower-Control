# Stage 3: ground safety review

Preview: http://localhost:3010/ . Review branch: `fix/stage-1-movement`. Nothing in this stage is deployed to the live game.

## What changed

The server reserves shared surface cells and crossings before moving aircraft. Existing reservations take priority; otherwise aircraft vacating a runway go first, followed by emergencies and the oldest request. Physical following clearance is the two aircraft footprint radii plus 50 feet. Conflicting routes wait automatically with a yellow HOLD SHORT marker, a flight-strip reason, and a tower log message. Head-on blocking cycles trigger an automatic curved move to a holding bay and subsequent route rejoin.

Taxi routes avoid parked aircraft, schematic terminal footprints, and unassigned runways. Takeoff line-up uses continuous curves. Pushback follows the same reservation system at 3 kt while preserving nose orientation. Straight taxi speed is 16–18 kt, with 6–8 kt in turns. Stands remain protected until departing traffic clears a 350-foot area. New departure patience is at least 240 seconds; airborne fuel and scoring retain the Stage 2 settings.

Reservations deliberately cover a whole traversal rather than acquiring partial segments. This prevents resource deadlocks but can reduce throughput. Airport taxi centerlines, terminal blocks, stands, bypass routes, and holding bays are simplified game geometry, marked APPROXIMATE in debug. They are not verified airport taxi instructions.

## Test before approving deployment

1. **Basic taxi and line-up:** Start Medium practice, enable Debug, select a departure and Taxi. It should accelerate along its route, slow through turns, reach the hold point, then respond to Take off with a curved line-up and forward runway roll. Use Focus flight to inspect ground spacing. Check every airport, including heavy aircraft.
2. **Shared-route holds:** Taxi two departures toward the same runway. The second should stop for a reservation or traffic, show a reason and yellow marker, and resume automatically when clear. Neither aircraft should overlap or pass through the other. Long waits are possible; report the callsigns, airport, runway, and debug reason.
3. **Crossings and blocked routes:** Assign traffic to different runways while arrivals taxi in. Check that aircraft avoid parked traffic and grey terminal blocks, stay on their displayed routes, and do not cross an unrelated runway. A blocked route must visibly hold or reject the command. Head-on and three-aircraft cycles are also exercised by automated tests; report any in-game cycle that does not resolve.
4. **Parking and pushback:** Land and taxi an arrival into an open stand, let turnaround finish, and request pushback. It should reverse slowly without flipping its nose, protect its stand while exiting, and then taxi normally. A blocked pushback should reject clearly without changing state.
5. **Weather and multiplayer:** Repeat with two to six players. Everyone should see the same positions, hold reasons, and clearance results. Refresh one player to test reconnect; disconnect the host to test transfer. A closed or occupied runway must reject a clearance visibly, without a scoring penalty.
6. **Phone:** On the same Wi-Fi, open this computer's local IP with port 3010 (localhost on the phone refers to the phone itself). Try portrait and landscape, flight selection, pan/pinch, Focus flight, fullscreen, and clearance buttons. Check FPS with six connected players and report stutters. Actual phone hardware and cellular access remain unverified; the live URL still runs the previous version.

## Verification and remaining balance checks

71 automated tests pass, including 12 new ground tests: crossing exclusivity, following gaps, head-on recovery, three-aircraft cycle recovery, disappearing-owner release, safe pushback, obstacle/runway avoidance, all-airport routing, bounded heading, and continuous taxi-to-takeoff line-up. Type checking, frontend build, and server compilation pass. A six-WebSocket-client smoke test received identical state while a departure taxied under a server reservation. A 390 × 844 browser preview had no horizontal overflow; this is not a real-phone performance measurement.

Some distant runway choices take several minutes to taxi, and a measured Medium emergency arrival finished parking near the seven-minute round limit. Departure recommendations now prefer the nearest active threshold, but long routes and conservative holds need human playtesting before further traffic or score tuning. Please report whether rounds feel too slow or difficult alongside any safety bugs.

# Movement bug-fix review — not deployed

Branch: `audit/movement-stress`. Preview: http://localhost:3010/ . This is a local preview; the Render site is unchanged.

## Fixes

- Both airborne and ground positions now integrate from a stored, turn-limited heading. Pushback is the explicit reverse exception. Motion steps are at most 0.1 seconds; large delayed server ticks process at most two seconds of movement while retaining the seven-minute wall-clock round duration.
- Rollout no longer snaps the nose toward its next point. After braking, aircraft follow a reserved curved exit toward the parking side when safe. If no safe exit exists, they remain stopped on the runway with a log instruction. Taxi to parking remains a player clearance.
- Runways stay blocked through rollout and until the complete aircraft footprint is outside the protected runway corridor. Taxi-in status no longer keeps a physically clear runway occupied until parking. Heavy wake timing begins when the runway is released.
- Explicit legal state transitions reject illegal changes. A moving aircraft missing its route logs a violation and recovers: airborne traffic begins a 1,500-ft go-around; ground traffic receives a new route and waits for safety/reservation checks.
- Land availability and its disabled reason are sent by the server, including ground state, already-active clearance, occupancy, weather, and wake spacing. A race or stale revision still returns the server rejection visibly.
- The client only replays server poses. Stable React transform attributes prevent command broadcasts at the same simulation time from resetting an animated aircraft to the tick endpoint. Heading interpolation takes the shortest angle across north.
- Debug shows heading, measured travel direction, speed, altitude, state, path status, command results, FPS, and per-aircraft/round invariant counters. Runtime substep checks record motion violations. Detailed diagnostic samples remain server-side.
- Ground motion uses a small copy of mutable pose fields rather than cloning complete routes ten times a second. Route distance caches and bounded visibility-graph connectors reduce repeated work. Display routes are compacted to 128 points; wire poses use rounded coordinates while server physics retains full precision. This approximation only affects displayed route polylines, not physical movement or reservations.

## Verification

82 tests pass, retaining all 71 previous tests and adding 11 regressions. Existing rollout/scoring/wake tests were updated for the required automatic exit and physical release behavior; no tests were removed. The isolated original diagnostic suite also passes all nine checks. Frontend type checking, production build, and server compilation pass.

Four deterministic 420-second stress rounds cover Hard and Expert, six controllers, 18 aircraft, 2,520 commands per round, stale revisions, invalid state requests, and Hold variants. All reported invariants and the runtime counter remain at zero. The no-random-Hold variants provide touchdown coverage. Every substep's displacement is checked against its actual average speed; speed and turn-rate checks use aircraft type. Two ordinary-wave comparison runs also pass. Six actual local WebSocket connections received identical state during a reserved taxi movement.

A 390 × 844 browser check had no horizontal overflow, showed the disabled Land reason, valid path, matching heading/travel direction, and zero violations. Its FPS readout was around 57–59 during the captured phone-size check; this is desktop emulation, not a mid-range phone measurement. Browser observation did not separately record an animated command-burst trace, so real-device visual testing remains required.

## Before and after measurements

Same seed 2703, Hard, six simulated players, ordinary configured waves, no random Hold; local computer with CPU profiling:

| Measure | Before fix | After fix |
| --- | ---: | ---: |
| Median server tick | 31.00 ms | 2.78 ms |
| p95 server tick | 42.58 ms | 10.34 ms |
| Slowest server tick | 2,717.34 ms | 267.39 ms |
| Largest room snapshot | 211,765 bytes | 54,509 bytes |
| Largest six-client broadcast | 1,270,590 bytes | 327,054 bytes |

About 91% lower median tick time and 74% smaller peak snapshots. Simulation changes alter command outcomes and trajectories; these are comparable scenarios, not identical physical traces. Timings vary and are not Render measurements. Tick timing excludes socket serialization and transmission. Occasional route-planning spikes still occur, so phone/server performance should not be treated as certified. Expert after-fix p95 was 8.10 ms, maximum 335.82 ms, and peak snapshot 56,917 bytes.

## Exactly what to test

1. **Arrival and rollout:** Start Medium practice and issue Land early. Watch inbound through final, touchdown, braking, and the curved exit. Nose and travel should agree throughout. The runway must remain occupied until the whole aircraft is clear. Taxi to parking after the exit stops. Repeat with a heavy and another airport.
2. **Blocked exit:** Taxi other traffic near an arrival's exit. If no safe exit is available, the aircraft should stop with an explanation and keep the runway occupied. It must not float, reverse, spin, or pass through traffic. Request Taxi when a safe route opens.
3. **Land button:** Select a gate aircraft or landed aircraft: Land must be disabled with the ground-state reason. For an airborne arrival, select occupied or weather-closed runways: disabled reason must match. Issue a valid clearance: it becomes disabled with “already active.” Competing/stale requests from another player must show a rejection.
4. **Hold:** On an arrival, use Hold, then Land during recovery. It should remain nose-first, climb to 1,500 ft AGL, burn fuel, rejoin, and retain the newly issued clearance.
5. **Heavy traffic and phones:** Join with six players, give competing commands, and pan/zoom/select aircraft while traffic builds. Enable Debug and report any invariant count above zero, heading/travel mismatch, sustained FPS below 30, or stutter. Include airport, callsign, state/phase, last command result, and phone/browser model. On the same Wi-Fi, a phone uses this computer's local IP with port 3010; phone localhost does not reach this preview. The live Render link still runs the previous version.
6. **Existing behavior:** Refresh one player to check reconnect, leave as host to check transfer, and finish a seven-minute round to check scoring and restart.

Please test before approving deployment. No merge to main or live deployment has been performed.

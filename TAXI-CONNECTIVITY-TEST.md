# Gate / runway taxi connectivity fix

Local branch: `fix/automatic-gate-turnaround`. Not deployed.

## Confirmed causes

- The connector planner tried only three joins to a smoothed route and one fixed end heading. It could reject an empty-airport route because that particular corner could not meet the aircraft's turn radius.
- Runways were impassable obstacles for every taxi route. Some gates and departure hold points require crossing a different runway, so retrying the unchanged geometry could never succeed.
- The gate label said "needs taxi" even when boarding was complete but pushback was still required.

## Changes

- Bounded searches over connector joins and eight final approach headings; aircraft still follow heading, speed, radius and collision constraints.
- Declared, server-managed crossings are a fallback. They reserve runway space, block new landing clearance, and wait for existing cleared arrivals or runway traffic. Reservations recompute as the aircraft travels clear. Crossing authorization is removed at parking and takeoff; it does not carry into pushback or line-up.
- Debug lists managed runway crossings; real waits identify the crossing or traffic involved. Gate labels and Taxi availability explain pushback.
- No airport layout, round duration, scoring or aircraft speed changes. Taxi routes remain schematic.

## Verification

- Full suite: 92 tests pass, including four deterministic heavy-traffic rounds with six simulated controllers.
- 178 empty-airport heavy-aircraft gate/runway/direction combinations produce safe planned routes.
- A separate diagnostic exercised 36 post-touchdown runway/direction cases; all reached a stand (up to 900 simulated seconds allowed to isolate connectivity from the seven-minute round).
- Regression checks cover blocked crossings, resume when cleared arrival traffic leaves, reserved runway state, arrival-to-boarding, and zero movement invariant violations.
- Build and TypeScript checks pass. A pre-existing analytics test now pins its own clock so its October 3/4 midnight fixture does not depend on today's date; analytics production code is unchanged.

## Please test at http://localhost:3020/

1. Phoenix: taxi a heavy departure from Terminal 3 to runway 7R. It should accept the route. If another runway must be crossed, watch its reservation and crossing hold reason; the aircraft must continue when cleared traffic has gone.
2. Prescott: land an arrival on runway 12 (or its reciprocal, 30). After rollout, it should automatically taxi to a reserved gate and start a 60-second boarding countdown.
3. Chicago: repeat a landing on different runways, then pushback and taxi after boarding. Gate status must say ready for pushback; Taxi unlocks after pushback finishes.
4. Keep one arrival cleared toward a crossing runway. The crossing aircraft must stop, Land must not authorize conflicting new traffic, and the taxi aircraft must resume after the existing arrival vacates.
5. Fill the gates, then clear a ready aircraft's pushback/taxi. Waiting arrivals must show a real capacity/route reason and retry automatically when a gate becomes reachable.
6. On a phone with the crew, check selection and disabled-button reasons. Use Debug to record airport, callsign, state, hold reason and FPS if an aircraft stalls. The invariant counter should stay zero.

A valid route does not mean immediate permission to move: occupied gates, cleared runway traffic and active surface reservations remain real holds. No public deployment until test approval.

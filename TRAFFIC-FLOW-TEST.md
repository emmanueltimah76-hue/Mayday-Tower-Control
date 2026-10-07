# Traffic and gate flow fix — local preview only

## Changes
- Only the initial departure starts at a gate. Later waves spawn inbound arrivals; landed aircraft are reused as departures after boarding. No wave refills a newly vacant gate.
- Emergency SOS/7700 clears at safe parking, after crediting the 250-point rescue. Radio-loss status also clears there.
- Runway crossing checks use the actual curved route, rather than a shortened chord that can incorrectly cut across another runway. Physical runway occupancy and final approaches still block crossings; a distant precleared arrival does not lock taxi routes.
- The first emergency is at 180 seconds, subject to gate capacity. There is at most one active emergency. Full committed gate capacity pauses arrivals.

## Timing
Arrival spacing with two controllers: Easy 55s, Medium 45s, Hard 38s, Expert 32s. With six controllers: 51/41/34/28s. Waves contain 2/3/3/4 arrivals, followed by a 60-second gap added to the wave schedule. Gate admission can extend waits.
Emergency intervals: Easy 240s, Medium 210s, Hard 180s, Expert 150s. Capacity or an existing emergency causes a retry after 5s.
Boarding stays 60s (four 15s steps). Fuel burn, reserves, aircraft speed and scoring remain unchanged.

## Test locally
1. On each difficulty, land arrivals. Confirm automatic taxi reaches distinct available gates; SOS disappears after parking and the rescue bonus stays credited.
2. Watch the full minute of boarding. Push back a ready aircraft, request Taxi, then Takeoff. The vacated gate must not instantly generate a new departure.
3. Try different runway buttons, including O'Hare's 4R/22L in both wind directions. Legitimate occupied-runway/weather/wake waits still apply.
4. Give an inbound aircraft an early landing clearance while another taxis across that runway. The distant clearance must not stop taxiing; final approach or physical occupancy must stop a new crossing.
5. Fill the ramp. Arrival admission should pause until you send a ready departure out. Ready aircraft intentionally await your pushback/taxi/takeoff commands.
6. Repeat with two devices including a phone: matching positions, gate statuses, clearances and waits; no unexpected SOS at boarding, spinning or teleporting.

Gate and taxi geometry remains schematic, not operational airport navigation data. Automated runway coverage uses empty surface fixtures; busy multi-device play still needs human testing. Do not deploy until preview approval.

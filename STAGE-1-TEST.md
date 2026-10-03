# Stage 1 movement review — not deployed

Branch: `fix/stage-1-movement`. Preview: http://localhost:3010/ while the local server runs.

## Confirmed causes
- `advanceMotion` previously traveled along each target segment while limiting displayed heading independently. Position could move sideways relative to the nose.
- Hold assigned positions on a small circle while heading turned at only 3/6 degrees per second. The circle's angular speed could exceed that limit.
- Radar independently transitioned position and rotation for one second, hiding the server's actual path through turns.
- Aircraft revisions were checked and rejected explicitly already, but rejected commands were not retained for the selected aircraft. Disabled controls also gave no reason why a command was unavailable.

## Changed in this branch
- Airborne steps turn first, with the existing 3°/s jet and 6°/s light limits, then advance strictly along that heading. Existing type speeds and acceleration limits remain. Targets inside the turn circle trigger a forward reposition leg instead of endless pursuit.
- Hold uses the forward integrator. The 1,500-ft climb and pattern re-entry are Stage 2, not part of this stage.
- Ground paths retain curved fillets; nose direction follows travel rather than a separate delayed rotation. Pushback retains intentional reverse movement; ground reservations and crossing safety remain Stage 3.
- Single physical scale: 0.004 NM/unit = 24.30448 ft/unit, defined in `src/mapConstants.ts`. Imported runway and stand coordinates are normalized to this scale; airport geometry remains schematic. Airspace/map bounds cover the normalized ORD runways.
- Radar replays the server's ten substeps each second, interpolating position and heading together. It does not predict game movement or change authoritative state. Display is one server tick behind, by design.
- Commands show accepted/rejected feedback and the most recent five receipts in the selected aircraft debug view. Rejected state commands leave score and aircraft revision unchanged.
- Debug includes state, heading, knots, AGL altitude, route target, command results, FPS and approximate taxi geometry labels. FPS measures browser animation frames, not network latency or real-device certification.
- Predicted alert messages are throttled per conflict for 20 seconds, tones at least five seconds apart, and at most four tracks flash. The three highest-priority conflicts appear in the panel, with an additional-conflict count. All conflicts remain in authoritative state; throttling does not suppress actual scoring.
- How to play updated. All 49 original tests plus five new regression tests pass. Production build and both TypeScript checks pass. Six live local websocket peers received identical accepted-command feedback. Phone-sized layout at 390 px has no horizontal overflow; commands remain below the map.

## Test exactly this before approving Stage 2
1. Create a room on the preview, select Medium, start Solo practice, select an arrival, and enable Debug. Repeat with Easy, Hard and Expert in fresh rooms.
2. Watch the nose through turns and north-wrap: no sideways/backward airborne drift, sudden heading flip or position snap. Check type speeds: light 70 kt, regional 130, narrowbody 140, heavy 150 on approach.
3. Send Hold. It must keep flying and burning fuel, not freeze. Then Land on a clear runway. Watch it make a smooth turn and eventually reach landing; record callsign, state and target if it circles indefinitely. The new pattern legs and 1,500-ft hold climb will arrive in Stage 2.
4. Send Take off or Taxi to an airborne arrival. Check the clear rejection and REJECTED receipt. Send a valid Land or Hold; check ACCEPTED and tower-log feedback.
5. Land, wait until rollout stops, then Taxi. Taxi a departure and, once queued, Take off. Commands before the valid state must explain what to wait for. Check smooth acceleration/deceleration and route-following direction. Ground overlap avoidance is Stage 3.
6. Join one room from two separate browser sessions; issue competing commands to the same aircraft. The stale command must explain that another controller updated it, and both sessions must receive the authoritative result. Reload to verify reconnect, then leave as host to verify transfer.
7. With sound enabled, observe conflicts and emergencies: highest-priority alerts stay visible, at most four tracks flash, and tones don't repeat rapidly. Predictions do not reduce score; actual violations retain their penalties.
8. On a real mid-range phone, test tapping/selecting/scrolling, pan/zoom and every command, with six connected crew. Turn Debug on and record FPS with busy traffic for at least one minute. Aim for 60 FPS; report sustained drops below 30, lag, or controls covering the map. Phone emulation here does not replace this test.

A phone cannot reach the computer's `localhost`. Use a reachable LAN address with port 3010 while on the same network, or a separate preview deployment. No live deployment is authorized until user confirmation.

## Next stage, after confirmation
Build the requested patterns, hold climb and go-around re-entry. Then retune traffic intervals, emergency reserves, fuel burn and scoring together and report every final value. Do not tune around the old straight-in flight times or begin ground reservations before their stage is approved.

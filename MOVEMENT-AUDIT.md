# Movement reproduction — fixes not started

Audit branch: `audit/movement-stress`, based on review commit `3e57c6a`. Only diagnostic scripts and reports were added. No gameplay, UI, hosting, or deployment changes.

## Reproduction

Seed 2703; full 420-second rounds; six simulated players connected through the real Lobby command handler; six commands per simulated second (2,520 attempts), including useful clearances, invalid-state commands, Hold, and stale aircraft revisions. Hard and Expert were tested on both the review branch and an extracted `origin/main` baseline (`3f57d55`). This checks source code corresponding to the expected public deployment, not a verified build fingerprint fetched from Render. Simulated peers exercise broadcast state delivery in process; they do not measure network latency or phone rendering.

The baseline uses one-second observations because it does not publish substep motion samples. Heading tolerances are 4 degrees airborne and 15 degrees on the ground at that resolution. Review observations use 0.1-second published samples with a 1-degree tolerance. Direction checks ignore movement below 2 kt and allow intentional reverse pushback relative to the nose. A holding circle counts as a valid path when initialized. Waiting holding-bay traffic is excluded from moving-path checks.

Maximum speeds tested: light 95, regional 155, narrowbody 165, heavy 175 kt (current maximum configured inbound/takeoff speeds). Displacement bounds allow the configured acceleration envelope within each observed second; the protocol does not contain per-substep speeds, so this does not prove instantaneous speed matching at every substep. Transition checks observe commands and tick boundaries, not every intermediate internal state. Runway occupancy uses aircraft centers below 10 ft AGL, not on final, within 100 ft of the runway centerline between its ends; footprint-based clearance needs a stricter follow-up.

## Results

| Observation | Main Hard | Main Expert | Review Hard | Review Expert |
| --- | ---: | ---: | ---: | ---: |
| Peak aircraft | 18 | 18 | 11 | 14 |
| Heading/travel mismatches | 1,871 | 1,124 | 0 | 0 |
| Moving states without route, target, or initialized circle | 37 | 1 | 0 | 0 |
| Multiple aircraft physically occupying a runway (tick/runway observations) | 17 | 31 | 0 | 0 |
| Speed/displacement-bound violations | 0 | 0 | 0 | 0 |
| Observed illegal transitions | 0 | 0 | 0 | 0 |
| Touchdowns | 5 | 6 | 0 | 0 |

Mismatch counts are repeated failing observations, not numbers of aircraft or crashes. The review random-Hold runs did not reach touchdown, so those runs cannot validate rollout. A separate seeded Hard round substituting an invalid Take off request for random Hold reached two touchdowns and passed its seven round-level invariants.

A targeted rollout probe starts from an allowed stabilized touchdown: 7-degree heading error, less than .012 NM lateral error, narrowbody at 140 kt. The review changes heading at **64.23 degrees/second**, exceeding its **18 degrees/second** limit. Main obeys the turn rate but travels up to **4.62 degrees away from the nose**. Land during rollout is rejected by both servers. Another targeted probe places taxi-in traffic well outside the runway: both versions still report the runway busy.

The isolated diagnostic suite has **7 passes and 2 expected failures**: rollout turn-rate limit and runway release after physical exit. The original **71 tests still pass**. These diagnostics are deliberately separate from that suite until the bugs are fixed.

## Root causes

1. **Main: position and nose use different rules.** `advanceMotion` moves directly along waypoint segments and then separately turns the displayed heading toward that travel direction. At a sharp path change the aircraft travels sideways or backward while the nose catches up. This directly matches the reproduced landing, taxi and go-around direction errors.
2. **Main: Hold circle is too tight for its turn limit.** Hold places the aircraft directly on a 32-unit circle, then limits heading to 3 degrees/second for jets. At 150 kt on Hard the circle requires roughly 13.4 degrees/second. The position and heading cannot agree. Recovery/arrival completion also switches into holding before initializing a new circle, leaving a transient no-path state until the next tick.
3. **Review: rollout bypasses the turn limiter.** The ground movement branch assigns heading directly from the next route segment. A permissible small touchdown heading offset therefore becomes an instantaneous nose adjustment. Ground routes already curved in advance do not cover this touchdown-to-rollout connector.
4. **Land feedback is misleading.** The UI enables Land whenever connected, not pending, and unfinished; it does not check landable state, occupancy, or weather. The server rejects invalid clicks, but button appearance does not explain that. The rollout probe did not reproduce a rejected Land command corrupting aircraft state.
5. **Runway ownership follows status labels rather than physical exit.** Busy checks include every taxi-in aircraft until parking. Main also permits taxi routes through unrelated runways without a surface reservation, explaining the reproduced simultaneous physical occupants. Rollout stops on the runway and requires Taxi; there is no dedicated automatic runway-exit state and path.
6. **Main renderer can exaggerate drift.** Position and rotation independently use one-second CSS transitions, so a curved server path becomes a straight visual chord while the nose rotates separately. The review renderer also has two writers to SVG transforms: React writes current endpoints on re-render, while the animation loop replays previous samples and only resets on elapsed-time changes. Command broadcasts at the same elapsed time can therefore produce visual corrections. This latter issue is a source-supported rendering risk, not a measured browser reproduction in this audit.
7. **Review ground processing is expensive.** CPU profiling puts `advanceGround` and `structuredClone` at the top: each 0.1-second ground step deep-copies the complete aircraft, including long route arrays and motion samples. Route planning also searches dense visibility graphs, and repeated reservation checks scan path segments. Full snapshots send those route arrays to all six clients on ticks and commands.

## Load measurements (local computer, not Render)

| Run | Tick median | Tick p95 | Tick maximum | Largest room snapshot |
| --- | ---: | ---: | ---: | ---: |
| Main Hard | 0.61 ms | 0.97 ms | 2.10 ms | 29,734 bytes |
| Main Expert | 1.41 ms | 2.07 ms | 3.07 ms | 38,044 bytes |
| Review Hard, random Hold | 26.19 ms | 34.12 ms | 1,708.70 ms | 182,727 bytes |
| Review Hard, no random Hold, profiled | 31.00 ms | 42.58 ms | 2,717.34 ms | 211,765 bytes |

The largest measured snapshot is about 1.27 MB across six clients per broadcast, before WebSocket framing/compression. Expert worst-tick timings varied dramatically between runs (3.8 to 95 seconds); do not treat that outlier as a stable benchmark. It reinforces the need to remove unbounded work. Tick measurements include game processing and the in-process broadcast but exclude actual socket serialization/network transmission. Seeded simulation results are deterministic; timings are not.

Existing motion uses ten fixed 0.1-second steps. However Lobby catches up every elapsed second in one synchronous call, with no overall catch-up cap. A slow tick can therefore accumulate further work. No evidence here establishes an excessive type speed, near-zero atan2 instability, or an angle-wrap bug as the primary cause.

## Run again

From this project, using Node with `--import tsx`:

- `scripts/movement-audit.ts`: full Expert round. Set `AUDIT_DIFFICULTY=hard` for Hard; `AUDIT_SEED` changes the seed.
- `AUDIT_BASE`: alternate checkout root for baseline comparison.
- `AUDIT_NO_HOLD=1`: keep randomized invalid/stale commands but replace random Hold with invalid Take off, so landing coverage improves.
- `scripts/landing-audit.ts`: isolated touchdown, invalid Land, and physical runway-release probes.
- `--test scripts/movement-invariants.test.ts`: isolated nine-test regression suite; currently fails two tests intentionally.

Next work, only after the user has reviewed this report: correct movement and rollout integration, establish physical runway ownership and state/path recovery, align command availability with server state, then address the measured cloning/snapshot costs and validate rendering under command bursts. No new game features and no live deployment.

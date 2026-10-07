# Endless survival test

All public lobby starts and solo practice starts create endless games. No shift deadline is shown. The HUD displays time played, handled flights, score, missed/violations and crashed aircraft out of three.

Failure rules:
- Three crashed aircraft in total. Only actual physical contact counts; predicted conflicts, wake warnings and separation losses alone do not.
- One aircraft makes three forced go-arounds. A manual Hold does not count.
- An emergency aircraft's fuel timer reaches zero.

The server decides the result, freezes the game, announces the cause to the room, records the final ranking, and allows the host to return to the lobby and start fresh. Normal arrival fuel expiry remains a diversion. Existing gate capacity, automatic taxi, boarding and protected crossings remain active. Traffic continues spawning after seven minutes whenever capacity permits.

## Local checks at http://localhost:3020/

1. Start a new room or solo practice. Confirm ENDLESS / TIME PLAYED counts up and CRASHED AIRCRAFT starts at 0 / 3. Play past 7:00; the room must stay active.
2. Let an SOS timer reach zero. Every connected player must see the same game-over reason and frozen time/aircraft; aircraft commands must stop. The host can return to lobby and restart with zero crashes and new traffic.
3. Let the same arrival reach short final without landing clearance three times. Its strip shows each go-around count. The third forced go-around must end the run. A Hold command by itself must not increment the count.
4. Verify normal fuel expiry is a diversion, not an automatic game over. Continue handling departures and boarding aircraft.
5. On a phone, verify the elapsed clock, crash counter, reason banner and restart controls fit. Check gate flow and runway-crossing holds with the crew.

Automated tests cover a 20-minute quiet simulation, emergency expiry and freeze, three forced approaches, Hold exemption, distinct collision victims, vertical separation, swept trajectories, HUD, reconnection, host-only restart, rankings, analytics and the existing fixed-duration physics stress fixtures. Those seven-minute fixtures deliberately retain their finite clock to measure movement invariants without terminating on intentionally overlapping overload spawn positions.

Not deployed. Go-around interpretation currently uses one aircraft reaching three; the user may choose three total instead.

import { TICK_MS } from '../shared/constants.js';

// Drives every active match at a fixed tick rate and broadcasts the
// resulting state to each match's room. Runs regardless of match phase so
// 'select' (character picks) and 'over' (rematch readiness) updates also
// reach clients promptly.
export function startGameLoop(io, matches) {
  return setInterval(() => {
    for (const match of matches.values()) {
      match.tick(TICK_MS / 1000);
      io.to(match.id).emit('state', match.serialize());
    }
  }, TICK_MS);
}

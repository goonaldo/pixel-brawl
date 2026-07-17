import {
  GRAVITY,
  MOVE_SPEED,
  JUMP_SPEED,
  MIN_X,
  MAX_X,
} from '../shared/constants.js';

// Mutates `player` in place: applies horizontal movement, gravity/jumping,
// knockback decay, and clamps to the arena bounds. Called once per player
// per simulation tick.
//
// player.vy: vertical velocity, positive = moving upward.
// player.jumpY: height above the ground (0 = grounded).
export function applyPhysics(player, dtSeconds) {
  const canAct = player.attackState === null && player.hurtMs <= 0;

  let vx = 0;
  if (player.dashVX !== 0) {
    vx = player.dashVX;
  } else if (canAct) {
    vx = player.moveDir * MOVE_SPEED;
  }
  vx += player.knockbackVX;

  player.x += vx * dtSeconds;
  player.x = Math.min(MAX_X, Math.max(MIN_X, player.x));

  // Knockback bleeds off quickly rather than persisting like normal movement.
  player.knockbackVX *= Math.max(0, 1 - 10 * dtSeconds);
  if (Math.abs(player.knockbackVX) < 5) player.knockbackVX = 0;

  if (!player.grounded) {
    player.vy -= GRAVITY * dtSeconds;
    player.jumpY += player.vy * dtSeconds;
    if (player.jumpY <= 0) {
      player.jumpY = 0;
      player.vy = 0;
      player.grounded = true;
    }
  }
}

export function tryJump(player) {
  const canAct = player.attackState === null && player.hurtMs <= 0;
  if (canAct && player.grounded) {
    player.vy = JUMP_SPEED;
    player.grounded = false;
  }
}

import {
  GRAVITY,
  MOVE_SPEED,
  JUMP_SPEED,
  SPRINT_MULTIPLIER,
  MIN_X,
  MAX_X,
} from '../shared/constants.js';

// Mutates `player` in place: applies horizontal movement, gravity/jumping,
// platform landings, knockback decay, and clamps to the arena bounds.
// Called once per player per simulation tick.
//
// `platforms` is the current match's stage layout (shared/stage.js).
// `character` is the player's character def, needed to look up groundSmash's
// slamSpeed while a slam is in progress.
//
// player.vy: vertical velocity, positive = moving upward.
// player.jumpY: height above the ground (0 = grounded), or above whichever
// platform the player is currently standing on.
export function applyPhysics(player, dtSeconds, platforms, character) {
  const canAct = player.attackState === null && player.hurtMs <= 0;

  let vx = 0;
  if (player.dashVX !== 0) {
    vx = player.dashVX;
  } else if (canAct) {
    const speed = player.sprinting ? MOVE_SPEED * SPRINT_MULTIPLIER : MOVE_SPEED;
    vx = player.moveDir * speed;
  }
  vx += player.knockbackVX;

  player.x += vx * dtSeconds;
  player.x = Math.min(MAX_X, Math.max(MIN_X, player.x));

  // Knockback bleeds off quickly rather than persisting like normal movement.
  player.knockbackVX *= Math.max(0, 1 - 10 * dtSeconds);
  if (Math.abs(player.knockbackVX) < 5) player.knockbackVX = 0;

  // Vertical knockback (e.g. an upward launcher kick) is a one-shot impulse,
  // not a decaying channel like knockbackVX — gravity below already pulls
  // it back down every subsequent tick, so a second decay curve would just
  // fight the normal jump-arc math.
  if (player.knockbackVY !== 0) {
    player.vy += player.knockbackVY;
    player.knockbackVY = 0;
    player.grounded = false;
    player.standingOn = null;
  }

  // A grounded player can walk off the edge of a platform — check the
  // surface they're on is still under their feet before anything else.
  if (player.grounded && player.standingOn !== null) {
    const platform = platforms.find((p) => p.id === player.standingOn);
    const stillSupported = platform && player.x >= platform.x1 && player.x <= platform.x2;
    if (!stillSupported) {
      player.grounded = false;
      player.standingOn = null;
      player.vy = 0;
    }
  }

  if (!player.grounded) {
    const smashPhase = player.attackState?.key === 'groundSmash' ? player.attackState.phase : null;

    if (smashPhase === 'startup') {
      // Windup: suspended in the air, no gravity, no drift — telegraphs the
      // slam before it happens.
      player.vy = 0;
    } else {
      if (smashPhase === 'falling') {
        player.vy = -character.attacks.groundSmash.slamSpeed;
      } else {
        player.vy -= GRAVITY * dtSeconds;
      }

      const jumpYBefore = player.jumpY;
      player.jumpY += player.vy * dtSeconds;

      const candidates = platforms.filter(
        (p) => p.height <= jumpYBefore && p.height >= player.jumpY && player.x >= p.x1 && player.x <= p.x2
      );
      if (candidates.length > 0) {
        const landing = candidates.reduce((a, b) => (b.height > a.height ? b : a));
        player.jumpY = landing.height;
        player.vy = 0;
        player.grounded = true;
        player.standingOn = landing.id;
      }
    }
  }
}

export function tryJump(player) {
  const canAct = player.attackState === null && player.hurtMs <= 0;
  if (canAct && player.grounded) {
    player.vy = JUMP_SPEED;
    player.grounded = false;
    player.standingOn = null;
  }
}

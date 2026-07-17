import { GROUND_Y, PLAYER_WIDTH, PLAYER_HEIGHT } from '../shared/constants.js';

export function aabbOverlap(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

export function getHurtbox(player) {
  const bottom = GROUND_Y - player.jumpY;
  return {
    x1: player.x - PLAYER_WIDTH / 2,
    x2: player.x + PLAYER_WIDTH / 2,
    y1: bottom - PLAYER_HEIGHT,
    y2: bottom,
  };
}

// A melee hitbox extends from the attacker's leading edge outward, in
// whichever direction they're currently facing.
export function getMeleeHitbox(player, atk) {
  const hurtbox = getHurtbox(player);
  const centerY = (hurtbox.y1 + hurtbox.y2) / 2;
  const y1 = centerY - atk.hitboxHeight / 2;
  const y2 = centerY + atk.hitboxHeight / 2;
  if (player.facing >= 0) {
    return { x1: hurtbox.x2, x2: hurtbox.x2 + atk.hitboxWidth, y1, y2 };
  }
  return { x1: hurtbox.x1 - atk.hitboxWidth, x2: hurtbox.x1, y1, y2 };
}

// Advances an in-progress attack's startup/active/recovery timer by dtMs.
// Returns { enteredActive, finished } so the caller can react (resolve a
// melee hit / spawn a projectile the instant the attack becomes active).
export function advanceAttackState(player, atk, dtMs) {
  const state = player.attackState;
  if (!state) return { enteredActive: false, finished: false };

  state.elapsedMs += dtMs;
  let enteredActive = false;
  let finished = false;

  if (state.phase === 'startup' && state.elapsedMs >= atk.startupMs) {
    state.phase = 'active';
    state.elapsedMs = 0;
    enteredActive = true;
  } else if (state.phase === 'active' && state.elapsedMs >= atk.activeMs) {
    state.phase = 'recovery';
    state.elapsedMs = 0;
  } else if (state.phase === 'recovery' && state.elapsedMs >= atk.recoveryMs) {
    finished = true;
  }

  return { enteredActive, finished };
}

export function spawnProjectiles(id, attacker, atk, atkKey) {
  const count = atk.projectileCount || 1;
  const projectiles = [];
  const hurtbox = getHurtbox(attacker);
  const centerY = (hurtbox.y1 + hurtbox.y2) / 2;
  const x = attacker.facing >= 0 ? hurtbox.x2 : hurtbox.x1;
  for (let i = 0; i < count; i++) {
    projectiles.push({
      id: `${id}-${i}`,
      ownerId: attacker.id,
      x,
      y: centerY,
      w: atk.hitboxWidth,
      h: atk.hitboxHeight,
      vx: attacker.facing * atk.projectileSpeed,
      lifeMs: atk.projectileLifetimeMs + i * (atk.projectileSpreadMs || 0),
      delayMs: i * (atk.projectileSpreadMs || 0),
      damage: atk.damage,
      knockback: atk.knockback || 180,
      attackName: atk.name,
      attackKey: atkKey,
    });
  }
  return projectiles;
}

export function advanceProjectile(proj, dtMs) {
  if (proj.delayMs > 0) {
    proj.delayMs -= dtMs;
    return;
  }
  proj.x += proj.vx * (dtMs / 1000);
  proj.lifeMs -= dtMs;
}

export function projectileBox(proj) {
  return {
    x1: proj.x - proj.w / 2,
    x2: proj.x + proj.w / 2,
    y1: proj.y - proj.h / 2,
    y2: proj.y + proj.h / 2,
  };
}

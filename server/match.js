import {
  ARENA_WIDTH,
  MAX_HEALTH,
  ROUND_TIME_SECONDS,
  GROUND_Y,
  HURT_MS,
  COMBO_WINDOW_MS,
  COMBO_MULTIPLIER_STEP,
  SCORE_PER_DAMAGE,
  MANA_REGEN_PER_SEC,
  SPRINT_MANA_DRAIN_PER_SEC,
  PLAYER_WIDTH,
  MIN_X,
  MAX_X,
  FALL_DEATH_JUMP_Y,
  SPECIAL_CHARGE_MAX,
  SPECIAL_CHARGE_PER_HIT,
  SPECIAL_CHARGE_COMBO_INSTANT,
  SPECIAL_CHARGE_MULT_MIN,
  SPECIAL_CHARGE_MULT_MAX,
} from '../shared/constants.js';
import { getCharacter } from '../shared/characters.js';
import { STAGE_LAYOUTS, getStageLayout } from '../shared/stage.js';
import { applyPhysics, tryJump } from './physics.js';
import {
  aabbOverlap,
  getHurtbox,
  getMeleeHitbox,
  getGroundSmashBox,
  getSpinKickBox,
  advanceAttackState,
  spawnProjectiles,
  advanceProjectile,
  projectileBox,
} from './combat.js';

const ATTACK_KEYS = ['shortRange', 'longRange', 'special'];
const ALL_ATTACK_KEYS = [...ATTACK_KEYS, 'groundSmash', 'spinKick', 'throw', 'launcherKick'];

function freshPlayerState(id) {
  return {
    id,
    characterId: null,
    x: 0,
    jumpY: 0,
    vy: 0,
    grounded: true,
    standingOn: null,
    facing: 1,
    moveDir: 0,
    health: MAX_HEALTH,
    mana: 0,
    duckHeld: false,
    crouching: false,
    sprintHeld: false,
    sprinting: false,
    attackState: null, // { key, phase, elapsedMs, hasHit }
    cooldowns: { shortRange: 0, longRange: 0, special: 0, groundSmash: 0, spinKick: 0, throw: 0, launcherKick: 0 },
    hurtMs: 0,
    knockbackVX: 0,
    knockbackVY: 0,
    grabbedBy: null, // id of the player currently holding us in a throw, or null
    dashVX: 0,
    rematchReady: false,
    score: 0,
    comboCount: 0,
    comboTimerMs: 0,
    specialCharge: 0,
    lastHitPoints: 0, // most recent score awarded, for client popup dedup
  };
}

export class Match {
  constructor(id, playerIds) {
    this.id = id;
    this.players = playerIds.map(freshPlayerState);
    this.phase = 'select'; // 'select' -> 'playing' -> 'over'
    this.stageId = null;
    this.platforms = [];
    this.projectiles = [];
    this.timeRemaining = ROUND_TIME_SECONDS;
    this.winnerId = undefined; // undefined = n/a, null = draw, id = winner
    this._projectileCounter = 0;
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  getOpponent(id) {
    return this.players.find((p) => p.id !== id);
  }

  hasPlayer(id) {
    return Boolean(this.getPlayer(id));
  }

  selectCharacter(playerId, characterId) {
    if (this.phase !== 'select') return;
    if (!getCharacter(characterId)) return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.characterId = characterId;
    this._maybeStartRound();
  }

  selectStage(playerId, stageId) {
    if (this.phase !== 'select') return;
    if (!this.getPlayer(playerId)) return;
    if (!STAGE_LAYOUTS.some((s) => s.id === stageId)) return;
    this.stageId = stageId;
    this._maybeStartRound();
  }

  _maybeStartRound() {
    if (this.phase !== 'select') return;
    if (!this.stageId) return;
    if (this.players.every((p) => p.characterId)) {
      this._startRound();
    }
  }

  _startRound() {
    const [a, b] = this.players;
    const layout = getStageLayout(this.stageId);
    const spawnAX = 150;
    const spawnBX = ARENA_WIDTH - 150;
    // Spawning "grounded" only works if standingOn names the actual surface
    // under the spawn point (and jumpY matches its height) — a null/
    // unmatched id means the walked-off-the-edge check in physics.js never
    // fires, so the player would slide right off it as if it were solid.
    // Prefer the floor when one covers the spawn point; stages with no
    // floor there at all (e.g. a platforms-only map) fall back to whichever
    // platform is under it instead, so a fighter can spawn on a ledge. Pick
    // the LOWEST overlapping platform, not the highest — a spawn platform
    // can have another platform floating directly above it (to climb to
    // later), and the fighter should start on the ground-level one, not get
    // teleported up to whatever's stacked on top of it.
    const surfaceAt = (x) => {
      const floorSeg = layout.floor.find((f) => x >= f.x1 && x <= f.x2);
      if (floorSeg) return floorSeg;
      return layout.platforms
        .filter((p) => x >= p.x1 && x <= p.x2)
        .reduce((best, p) => (!best || p.height < best.height ? p : best), null) || { id: null, height: 0 };
    };
    const spawnA = surfaceAt(spawnAX);
    const spawnB = surfaceAt(spawnBX);
    Object.assign(a, {
      x: spawnAX,
      jumpY: spawnA.height,
      vy: 0,
      grounded: true,
      standingOn: spawnA.id,
      facing: 1,
      moveDir: 0,
      health: MAX_HEALTH,
      mana: getCharacter(a.characterId).maxMana,
      duckHeld: false,
      crouching: false,
      sprintHeld: false,
      sprinting: false,
      attackState: null,
      cooldowns: { shortRange: 0, longRange: 0, special: 0, groundSmash: 0, spinKick: 0, throw: 0, launcherKick: 0 },
      hurtMs: 0,
      knockbackVX: 0,
      knockbackVY: 0,
      grabbedBy: null,
      dashVX: 0,
      specialCharge: 0,
    });
    Object.assign(b, {
      x: spawnBX,
      jumpY: spawnB.height,
      vy: 0,
      grounded: true,
      standingOn: spawnB.id,
      facing: -1,
      moveDir: 0,
      health: MAX_HEALTH,
      mana: getCharacter(b.characterId).maxMana,
      duckHeld: false,
      crouching: false,
      sprintHeld: false,
      sprinting: false,
      attackState: null,
      cooldowns: { shortRange: 0, longRange: 0, special: 0, groundSmash: 0, spinKick: 0, throw: 0, launcherKick: 0 },
      hurtMs: 0,
      knockbackVX: 0,
      knockbackVY: 0,
      grabbedBy: null,
      dashVX: 0,
      specialCharge: 0,
    });
    this.platforms = [...layout.platforms, ...layout.floor];
    this.projectiles = [];
    this.timeRemaining = ROUND_TIME_SECONDS;
    this.winnerId = undefined;
    this.phase = 'playing';
  }

  setMoveDir(playerId, dir) {
    if (this.phase !== 'playing') return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.moveDir = Math.max(-1, Math.min(1, dir));
  }

  setDuckHeld(playerId, held) {
    if (this.phase !== 'playing') return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.duckHeld = Boolean(held);
  }

  setSprintHeld(playerId, held) {
    if (this.phase !== 'playing') return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.sprintHeld = Boolean(held);
  }

  jump(playerId) {
    if (this.phase !== 'playing') return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (player.grabbedBy !== null) return;
    tryJump(player);
  }

  startAttack(playerId, attackKey) {
    if (this.phase !== 'playing') return;
    if (!ATTACK_KEYS.includes(attackKey)) return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (player.attackState !== null || player.hurtMs > 0) return;
    if (player.grabbedBy !== null) return; // frozen while being grabbed

    // Down + short attack, in the air: a ground smash instead of the normal
    // melee swing. Resolved here (server-authoritative on `grounded`) rather
    // than trusting the client's own airborne/duck state.
    if (attackKey === 'shortRange' && player.duckHeld && !player.grounded) {
      this._startGroundSmash(player);
      return;
    }

    // Sprint + short attack, grounded: a wide spinning kick instead of the
    // normal jab.
    if (attackKey === 'shortRange' && player.sprintHeld && player.grounded) {
      this._startSpinKick(player);
      return;
    }

    // Duck + long attack, grounded: an unblockable grab instead of the
    // normal ranged attack. Range is resolved later (in _advanceThrow, once
    // startup finishes) rather than here, so a duck+K attempt can still
    // whiff if the opponent isn't close by the time the windup completes.
    if (attackKey === 'longRange' && player.duckHeld && player.grounded) {
      this._startThrow(player);
      return;
    }

    // Special key while airborne: a rising launcher kick instead of the
    // character's normal grounded special.
    if (attackKey === 'special' && !player.grounded) {
      this._startLauncherKick(player);
      return;
    }

    if (player.cooldowns[attackKey] > 0) return;

    const character = getCharacter(player.characterId);
    const atk = character.attacks[attackKey];
    if (player.mana < atk.manaCost) return;

    // Casting a special locks in its power from the charge meter at this
    // exact moment and spends the whole meter — whether or not it actually
    // lands. `chargeFraction` rides along on the attack state so the hit
    // resolution below (tick()) knows how hard to hit.
    const chargeFraction = attackKey === 'special' ? player.specialCharge / SPECIAL_CHARGE_MAX : 0;
    player.attackState = { key: attackKey, phase: 'startup', elapsedMs: 0, hasHit: false, chargeFraction };
    player.cooldowns[attackKey] = atk.cooldownMs;
    player.mana -= atk.manaCost;
    if (attackKey === 'special') player.specialCharge = 0;
  }

  _startGroundSmash(player) {
    const character = getCharacter(player.characterId);
    const atk = character.attacks.groundSmash;
    if (player.cooldowns.groundSmash > 0) return;
    if (player.mana < atk.manaCost) return;

    player.attackState = { key: 'groundSmash', phase: 'startup', elapsedMs: 0, hasHit: false };
    player.cooldowns.groundSmash = atk.cooldownMs;
    player.mana -= atk.manaCost;
  }

  _startSpinKick(player) {
    const character = getCharacter(player.characterId);
    const atk = character.attacks.spinKick;
    if (player.cooldowns.spinKick > 0) return;
    if (player.mana < atk.manaCost) return;

    player.attackState = { key: 'spinKick', phase: 'startup', elapsedMs: 0, hasHit: false };
    player.cooldowns.spinKick = atk.cooldownMs;
    player.mana -= atk.manaCost;
  }

  _startThrow(player) {
    const character = getCharacter(player.characterId);
    const atk = character.attacks.throw;
    if (player.cooldowns.throw > 0) return;
    if (player.mana < atk.manaCost) return;

    player.attackState = { key: 'throw', phase: 'startup', elapsedMs: 0, hasHit: false };
    player.cooldowns.throw = atk.cooldownMs;
    player.mana -= atk.manaCost;
  }

  _startLauncherKick(player) {
    const character = getCharacter(player.characterId);
    const atk = character.attacks.launcherKick;
    if (player.cooldowns.launcherKick > 0) return;
    if (player.mana < atk.manaCost) return;

    player.attackState = { key: 'launcherKick', phase: 'startup', elapsedMs: 0, hasHit: false };
    player.cooldowns.launcherKick = atk.cooldownMs;
    player.mana -= atk.manaCost;
  }

  requestRematch(playerId) {
    if (this.phase !== 'over') return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.rematchReady = true;
    if (this.players.every((p) => p.rematchReady)) {
      this.players.forEach((p) => {
        const id = p.id;
        Object.assign(p, freshPlayerState(id));
      });
      this.phase = 'select';
      this.stageId = null;
    }
  }

  // Interpolates a special's damage/knockback between the uncharged and
  // fully-charged multipliers based on the charge fraction locked in when
  // it was cast. Leaves hitbox size, timing, and every other field alone.
  _chargeScaledAtk(atk, chargeFraction) {
    const mult = SPECIAL_CHARGE_MULT_MIN + (SPECIAL_CHARGE_MULT_MAX - SPECIAL_CHARGE_MULT_MIN) * (chargeFraction || 0);
    return { ...atk, damage: atk.damage * mult, knockback: (atk.knockback || 160) * mult };
  }

  applyDamage(attackerId, target, damage, dirSign, knockback, knockbackVY = 0, isSpecialCast = false) {
    if (this.phase !== 'playing') return;
    const attacker = this.getPlayer(attackerId);

    // Chained hits land harder, not just score more — attacker.comboCount
    // here is how many hits already landed in the current chain (0 for the
    // opener), so the first hit is unaffected and each subsequent hit within
    // the combo window scales up, same rate the score bonus already used.
    const comboMultiplier = 1 + attacker.comboCount * COMBO_MULTIPLIER_STEP;
    const scaledDamage = Math.round(damage * comboMultiplier);

    target.health = Math.max(0, target.health - scaledDamage);
    target.hurtMs = HURT_MS;
    target.attackState = null;
    target.dashVX = 0;
    target.knockbackVX = dirSign * knockback;
    target.knockbackVY = knockbackVY;

    // Being hit interrupts whatever combo the victim had going.
    target.comboCount = 0;
    target.comboTimerMs = 0;

    attacker.comboCount += 1;
    attacker.comboTimerMs = COMBO_WINDOW_MS;

    // Landing a hit charges up the special attack; a bigger combo charges
    // it faster (same multiplier that's already boosting this hit's
    // damage), and a 4-hit combo maxes it out instantly regardless of
    // however much charge had built up before. A special's own hit is
    // excluded — it was just cast by spending the meter, so it landing
    // shouldn't immediately refill the very meter it just spent.
    if (!isSpecialCast) {
      if (attacker.comboCount >= SPECIAL_CHARGE_COMBO_INSTANT) {
        attacker.specialCharge = SPECIAL_CHARGE_MAX;
      } else {
        attacker.specialCharge = Math.min(
          SPECIAL_CHARGE_MAX,
          attacker.specialCharge + SPECIAL_CHARGE_PER_HIT * comboMultiplier
        );
      }
    }

    const points = Math.round(scaledDamage * SCORE_PER_DAMAGE);
    attacker.score += points;
    attacker.lastHitPoints = points;

    if (target.health <= 0) {
      this._endRound(this.getOpponent(target.id).id);
    }
  }

  _endRound(winnerId) {
    if (this.phase !== 'playing') return;
    this.phase = 'over';
    this.winnerId = winnerId;
    this.projectiles = [];
    for (const p of this.players) p.grabbedBy = null;
  }

  tick(dtSeconds) {
    if (this.phase !== 'playing') return;
    const dtMs = dtSeconds * 1000;

    this.timeRemaining -= dtSeconds;

    for (const player of this.players) {
      // While grabbed, the victim's position is fully owned by the
      // attacker's _advanceThrow this tick — skip their own physics/attack
      // advance entirely so nothing fights the repositioning.
      if (player.grabbedBy !== null) continue;

      const character = getCharacter(player.characterId);
      const opponent = this.getOpponent(player.id);

      for (const key of ALL_ATTACK_KEYS) {
        player.cooldowns[key] = Math.max(0, player.cooldowns[key] - dtMs);
      }
      if (player.hurtMs > 0) player.hurtMs = Math.max(0, player.hurtMs - dtMs);

      if (player.comboTimerMs > 0) {
        player.comboTimerMs = Math.max(0, player.comboTimerMs - dtMs);
        if (player.comboTimerMs === 0) player.comboCount = 0;
      }

      // Dash-type specials (e.g. Rogue's Dash Strike) move the player during
      // their attack's startup window, then release control back to physics.
      player.dashVX = 0;
      if (player.attackState) {
        const atk = character.attacks[player.attackState.key];
        if (
          atk.dashSpeed &&
          player.attackState.phase === 'startup' &&
          player.attackState.elapsedMs < atk.dashMs
        ) {
          player.dashVX = player.facing * atk.dashSpeed;
        }
      }

      if (player.dashVX === 0 && player.hurtMs <= 0) {
        player.facing = opponent.x >= player.x ? 1 : -1;
      }

      // Sprinting must be derived before physics runs, since physics reads
      // it to pick the movement speed this tick.
      player.sprinting =
        player.sprintHeld && player.moveDir !== 0 && player.mana > 0 && player.attackState === null;

      applyPhysics(player, dtSeconds, this.platforms, character);

      // Fell through a gap in the stage floor with nothing catching them —
      // an instant round loss, same as health hitting 0.
      if (!player.grounded && player.jumpY < FALL_DEATH_JUMP_Y) {
        this._endRound(opponent.id);
      }

      // Crouching reflects the post-physics grounded state (e.g. a player
      // who just landed this tick can crouch immediately).
      player.crouching = player.duckHeld && player.grounded && player.attackState === null;

      if (player.sprinting) {
        player.mana = Math.max(0, player.mana - SPRINT_MANA_DRAIN_PER_SEC * dtSeconds);
      } else {
        player.mana = Math.min(character.maxMana, player.mana + MANA_REGEN_PER_SEC * dtSeconds);
      }

      if (player.attackState) {
        const atk = character.attacks[player.attackState.key];
        // Charge-scaled damage/knockback for a special cast — hitbox size
        // and timing stay the same as the base attack data (`atk`); only
        // the actual power dealt reads from this.
        const dealAtk = player.attackState.key === 'special'
          ? this._chargeScaledAtk(atk, player.attackState.chargeFraction)
          : atk;

        if (player.attackState.key === 'groundSmash') {
          this._advanceGroundSmash(player, opponent, atk, dtMs);
        } else if (player.attackState.key === 'throw') {
          this._advanceThrow(player, opponent, atk, dtMs);
        } else {
          const { enteredActive, finished } = advanceAttackState(player, atk, dtMs);

          if (enteredActive && atk.projectileSpeed) {
            const id = `p${this._projectileCounter++}`;
            this.projectiles.push(...spawnProjectiles(id, player, dealAtk, player.attackState.key));
          }

          if (
            player.attackState &&
            player.attackState.phase === 'active' &&
            !atk.projectileSpeed &&
            !player.attackState.hasHit
          ) {
            const box = player.attackState.key === 'spinKick'
              ? getSpinKickBox(player, atk)
              : getMeleeHitbox(player, atk);
            const oppBox = getHurtbox(opponent);
            if (aabbOverlap(box, oppBox)) {
              player.attackState.hasHit = true;
              const dirSign = player.attackState.key === 'spinKick'
                ? (Math.sign(opponent.x - player.x) || player.facing || 1)
                : player.facing;
              this.applyDamage(
                player.id,
                opponent,
                dealAtk.damage,
                dirSign,
                dealAtk.knockback || 160,
                dealAtk.knockbackVY || 0,
                player.attackState.key === 'special'
              );
            }
          }

          if (finished && player.attackState) {
            player.attackState = null;
          }
        }
      }
    }

    this._tickProjectiles(dtMs);

    if (this.phase === 'playing' && this.timeRemaining <= 0) {
      const [a, b] = this.players;
      let winnerId = null;
      if (a.health > b.health) winnerId = a.id;
      else if (b.health > a.health) winnerId = b.id;
      this._endRound(winnerId);
    }
  }

  // Ground smash has its own startup/falling/recovery machine — `falling`
  // has no fixed duration (it ends whenever physics.js sets grounded=true),
  // so it can't go through the generic advanceAttackState timer.
  _advanceGroundSmash(player, opponent, atk, dtMs) {
    const state = player.attackState;
    state.elapsedMs += dtMs;

    if (state.phase === 'startup') {
      if (state.elapsedMs >= atk.startupMs) {
        state.phase = 'falling';
        state.elapsedMs = 0;
      }
    } else if (state.phase === 'falling') {
      if (player.grounded) {
        const landingSurfaceY = GROUND_Y - player.jumpY;
        const box = getGroundSmashBox(player.x, landingSurfaceY, atk.aoeRadius);
        if (aabbOverlap(box, getHurtbox(opponent))) {
          const dirSign = Math.sign(opponent.x - player.x) || player.facing || 1;
          this.applyDamage(player.id, opponent, atk.damage, dirSign, atk.knockback);
        }
        if (player.attackState) {
          state.phase = 'recovery';
          state.elapsedMs = 0;
        }
      }
    } else if (state.phase === 'recovery') {
      if (state.elapsedMs >= atk.recoveryMs) {
        player.attackState = null;
      }
    }
  }

  // Throw has its own startup/active/recovery machine (like groundSmash)
  // because its 'active' phase repositions the opponent every tick, and its
  // hit resolution is a one-time proximity check at the startup->active
  // transition rather than a continuous AABB overlap test.
  _advanceThrow(player, opponent, atk, dtMs) {
    const state = player.attackState;
    state.elapsedMs += dtMs;

    if (state.phase === 'startup') {
      if (state.elapsedMs >= atk.startupMs) {
        const dist = Math.abs(opponent.x - player.x);
        if (dist <= atk.grabRange && opponent.grabbedBy === null) {
          opponent.grabbedBy = player.id;
          opponent.attackState = null;
          opponent.dashVX = 0;
          opponent.knockbackVX = 0;
          opponent.knockbackVY = 0;
          state.phase = 'active';
        } else {
          state.phase = 'recovery'; // whiffed — opponent was out of range
        }
        state.elapsedMs = 0;
      }
    } else if (state.phase === 'active') {
      const holdOffset = PLAYER_WIDTH * 1.1;
      opponent.x = Math.min(MAX_X, Math.max(MIN_X, player.x + player.facing * holdOffset));
      opponent.jumpY = 0;
      opponent.vy = 0;
      opponent.grounded = true;
      opponent.standingOn = null;

      if (state.elapsedMs >= atk.activeMs) {
        opponent.grabbedBy = null;
        this.applyDamage(player.id, opponent, atk.damage, player.facing, atk.knockback);
        state.phase = 'recovery';
        state.elapsedMs = 0;
      }
    } else if (state.phase === 'recovery') {
      if (state.elapsedMs >= atk.recoveryMs) {
        player.attackState = null;
      }
    }
  }

  _tickProjectiles(dtMs) {
    const remaining = [];
    for (const proj of this.projectiles) {
      advanceProjectile(proj, dtMs);

      if (proj.delayMs <= 0) {
        const target = this.getOpponent(proj.ownerId);
        const box = projectileBox(proj);
        const targetBox = getHurtbox(target);
        if (aabbOverlap(box, targetBox)) {
          this.applyDamage(proj.ownerId, target, proj.damage, Math.sign(proj.vx) || 1, proj.knockback, 0, proj.attackKey === 'special');
          continue; // consumed on hit
        }
        if (proj.lifeMs <= 0 || proj.x < -50 || proj.x > ARENA_WIDTH + 50) {
          continue; // expired / off-arena
        }
      }
      remaining.push(proj);
    }
    this.projectiles = remaining;
  }

  serialize() {
    return {
      phase: this.phase,
      stageId: this.stageId,
      timeRemaining: Math.max(0, Math.ceil(this.timeRemaining)),
      winnerId: this.winnerId,
      groundY: GROUND_Y,
      players: this.players.map((p) => ({
        id: p.id,
        characterId: p.characterId,
        x: p.x,
        jumpY: p.jumpY,
        facing: p.facing,
        health: p.health,
        mana: p.mana,
        maxMana: getCharacter(p.characterId)?.maxMana ?? 0,
        crouching: p.crouching,
        sprinting: p.sprinting,
        grounded: p.grounded,
        grabbedBy: p.grabbedBy,
        hurt: p.hurtMs > 0,
        attack: p.attackState
          ? { key: p.attackState.key, phase: p.attackState.phase, chargeFraction: p.attackState.chargeFraction || 0 }
          : null,
        rematchReady: p.rematchReady,
        score: p.score,
        comboCount: p.comboCount,
        lastHitPoints: p.lastHitPoints,
        specialCharge: p.specialCharge,
      })),
      projectiles: this.projectiles
        .filter((p) => p.delayMs <= 0)
        .map((p) => ({ id: p.id, x: p.x, y: p.y, ownerId: p.ownerId })),
    };
  }
}

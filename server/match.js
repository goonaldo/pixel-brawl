import {
  ARENA_WIDTH,
  MAX_HEALTH,
  ROUND_TIME_SECONDS,
  GROUND_Y,
  HURT_MS,
} from '../shared/constants.js';
import { getCharacter } from '../shared/characters.js';
import { applyPhysics, tryJump } from './physics.js';
import {
  aabbOverlap,
  getHurtbox,
  getMeleeHitbox,
  advanceAttackState,
  spawnProjectiles,
  advanceProjectile,
  projectileBox,
} from './combat.js';

const ATTACK_KEYS = ['shortRange', 'longRange', 'special'];

function freshPlayerState(id) {
  return {
    id,
    characterId: null,
    x: 0,
    jumpY: 0,
    vy: 0,
    grounded: true,
    facing: 1,
    moveDir: 0,
    health: MAX_HEALTH,
    attackState: null, // { key, phase: 'startup'|'active'|'recovery', elapsedMs, hasHit }
    cooldowns: { shortRange: 0, longRange: 0, special: 0 },
    hurtMs: 0,
    knockbackVX: 0,
    dashVX: 0,
    rematchReady: false,
  };
}

export class Match {
  constructor(id, playerIds) {
    this.id = id;
    this.players = playerIds.map(freshPlayerState);
    this.phase = 'select'; // 'select' -> 'playing' -> 'over'
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

    if (this.players.every((p) => p.characterId)) {
      this._startRound();
    }
  }

  _startRound() {
    const [a, b] = this.players;
    Object.assign(a, {
      x: 150,
      jumpY: 0,
      vy: 0,
      grounded: true,
      facing: 1,
      moveDir: 0,
      health: MAX_HEALTH,
      attackState: null,
      cooldowns: { shortRange: 0, longRange: 0, special: 0 },
      hurtMs: 0,
      knockbackVX: 0,
      dashVX: 0,
    });
    Object.assign(b, {
      x: ARENA_WIDTH - 150,
      jumpY: 0,
      vy: 0,
      grounded: true,
      facing: -1,
      moveDir: 0,
      health: MAX_HEALTH,
      attackState: null,
      cooldowns: { shortRange: 0, longRange: 0, special: 0 },
      hurtMs: 0,
      knockbackVX: 0,
      dashVX: 0,
    });
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

  jump(playerId) {
    if (this.phase !== 'playing') return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    tryJump(player);
  }

  startAttack(playerId, attackKey) {
    if (this.phase !== 'playing') return;
    if (!ATTACK_KEYS.includes(attackKey)) return;
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (player.attackState !== null || player.hurtMs > 0) return;
    if (player.cooldowns[attackKey] > 0) return;

    const character = getCharacter(player.characterId);
    const atk = character.attacks[attackKey];
    player.attackState = { key: attackKey, phase: 'startup', elapsedMs: 0, hasHit: false };
    player.cooldowns[attackKey] = atk.cooldownMs;
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
    }
  }

  applyDamage(target, damage, dirSign, knockback) {
    if (this.phase !== 'playing') return;
    target.health = Math.max(0, target.health - damage);
    target.hurtMs = HURT_MS;
    target.attackState = null;
    target.dashVX = 0;
    target.knockbackVX = dirSign * knockback;
    if (target.health <= 0) {
      this._endRound(this.getOpponent(target.id).id);
    }
  }

  _endRound(winnerId) {
    if (this.phase !== 'playing') return;
    this.phase = 'over';
    this.winnerId = winnerId;
    this.projectiles = [];
  }

  tick(dtSeconds) {
    if (this.phase !== 'playing') return;
    const dtMs = dtSeconds * 1000;

    this.timeRemaining -= dtSeconds;

    for (const player of this.players) {
      const character = getCharacter(player.characterId);
      const opponent = this.getOpponent(player.id);

      for (const key of ATTACK_KEYS) {
        player.cooldowns[key] = Math.max(0, player.cooldowns[key] - dtMs);
      }
      if (player.hurtMs > 0) player.hurtMs = Math.max(0, player.hurtMs - dtMs);

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

      applyPhysics(player, dtSeconds);

      if (player.attackState) {
        const atk = character.attacks[player.attackState.key];
        const { enteredActive, finished } = advanceAttackState(player, atk, dtMs);

        if (enteredActive && atk.projectileSpeed) {
          const id = `p${this._projectileCounter++}`;
          this.projectiles.push(...spawnProjectiles(id, player, atk, player.attackState.key));
        }

        if (
          player.attackState &&
          player.attackState.phase === 'active' &&
          !atk.projectileSpeed &&
          !player.attackState.hasHit
        ) {
          const box = getMeleeHitbox(player, atk);
          const oppBox = getHurtbox(opponent);
          if (aabbOverlap(box, oppBox)) {
            player.attackState.hasHit = true;
            this.applyDamage(opponent, atk.damage, player.facing, atk.knockback || 160);
          }
        }

        if (finished && player.attackState) {
          player.attackState = null;
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

  _tickProjectiles(dtMs) {
    const remaining = [];
    for (const proj of this.projectiles) {
      advanceProjectile(proj, dtMs);

      if (proj.delayMs <= 0) {
        const target = this.getOpponent(proj.ownerId);
        const box = projectileBox(proj);
        const targetBox = getHurtbox(target);
        if (aabbOverlap(box, targetBox)) {
          this.applyDamage(target, proj.damage, Math.sign(proj.vx) || 1, proj.knockback);
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
        grounded: p.grounded,
        hurt: p.hurtMs > 0,
        attack: p.attackState ? { key: p.attackState.key, phase: p.attackState.phase } : null,
        rematchReady: p.rematchReady,
      })),
      projectiles: this.projectiles
        .filter((p) => p.delayMs <= 0)
        .map((p) => ({ id: p.id, x: p.x, y: p.y, ownerId: p.ownerId })),
    };
  }
}

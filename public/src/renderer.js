// Procedural canvas renderer. No spritesheets, no asset pipeline — every
// fighter is drawn from rotated primitives ("limbs") each frame, posed by
// simple hand-picked keyframe angles per animation state. This keeps the
// whole visual layer as plain, easily-tweakable JS instead of an external
// art pipeline.

import { getCharacter } from '/shared/characters.js';
import { getStageLayout } from '/shared/stage.js';
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  GROUND_Y,
  PLAYER_HEIGHT,
  TICK_MS,
} from '/shared/constants.js';
import { sfx, music } from './audio.js';

// ---------------------------------------------------------------- themes --

const THEMES = {
  warrior: { skin: '#e8b58c', primary: '#b23a2e', secondary: '#7a2620', metal: '#c9c9d6', accent: '#ffd23f' },
  archer: { skin: '#e3b98f', primary: '#2f8f4e', secondary: '#1f5f34', metal: '#8a5a2b', accent: '#dff0c8' },
  mage: { skin: '#e0b48a', primary: '#3b5bdb', secondary: '#26399e', metal: '#c9a6ff', accent: '#7ee7ff' },
  rogue: { skin: '#d9a679', primary: '#5b2a86', secondary: '#3a1b58', metal: '#232026', accent: '#ff5fa2' },
};
const OUTLINE = '#1a1015';

// -------------------------------------------------------------- geometry --

const LEG_LEN = 24;
const TORSO_LEN = 26;
const HEAD_R = 9;
const ARM_LEN = 20;
const SHOULDER_Y = -(LEG_LEN + TORSO_LEN);
const HIP_Y = -LEG_LEN;
const HEAD_Y = SHOULDER_Y - HEAD_R - 2;

function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function limb(ctx, pivotX, pivotY, len, w, angle, color, weaponDraw) {
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  roundRectPath(ctx, -w / 2, 0, w, len, w * 0.4);
  ctx.fill();
  ctx.stroke();
  if (weaponDraw) {
    ctx.translate(0, len);
    weaponDraw(ctx);
  }
  ctx.restore();
}

function weaponSword(ctx, theme) {
  ctx.fillStyle = theme.metal;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, -3, -4, 6, 8, 2); // hilt
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8e8f0';
  roundRectPath(ctx, -2.5, -38, 5, 34, 1.5); // blade
  ctx.fill(); ctx.stroke();
}

function weaponBow(ctx, theme) {
  ctx.strokeStyle = theme.metal;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -6, 20, -1.3, 1.3);
  ctx.stroke();
  ctx.strokeStyle = '#e8e8e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-19, -21);
  ctx.lineTo(-19, 9);
  ctx.stroke();
}

function weaponStaff(ctx, theme, glow) {
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(0, -34);
  ctx.stroke();
  const r = 5 + glow * 4;
  const grad = ctx.createRadialGradient(0, -36, 0, 0, -36, r * 2.2);
  grad.addColorStop(0, theme.accent);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, -36, r * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(0, -36, r, 0, Math.PI * 2);
  ctx.fill();
}

function weaponDagger(ctx, theme) {
  ctx.fillStyle = theme.metal;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  roundRectPath(ctx, -2, -2, 4, 5, 1); // hilt
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dcdce4';
  roundRectPath(ctx, -1.5, -18, 3, 16, 1);
  ctx.fill(); ctx.stroke();
}

// ---------------------------------------------------- animation keyframes --

const ATTACK_POSE = {
  shortRange: { startup: -0.9, active: 1.25, recovery: 0.25, lean: { startup: -0.1, active: 0.3, recovery: 0.05 } },
  longRange: { startup: -1.1, active: 0.75, recovery: 0.15, lean: { startup: -0.06, active: 0.12, recovery: 0.02 } },
  special: { startup: -1.4, active: 1.5, recovery: 0.35, lean: { startup: -0.2, active: 0.4, recovery: 0.08 } },
};

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// -------------------------------------------------------------- trackers --

const trackers = new Map(); // playerId -> per-player animation memory

function trackerFor(id) {
  if (!trackers.has(id)) {
    trackers.set(id, {
      animKey: 'idle',
      lastX: null,
      lastJumpY: 0,
      walkCycle: 0,
      phase: null,
      phaseStart: 0,
      idleStart: performance.now(),
      tumbling: false,
      airCycle: 0,
      lastStepPhase: null,
    });
  }
  return trackers.get(id);
}

// --------------------------------------------------------------- effects --

let particles = [];
let popups = [];
let shakeMag = 0;
let lastDrawTime = null;

function spawnParticles(x, y, count, color, opts = {}) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (opts.speed || 90) * (0.4 + Math.random() * 0.8);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (opts.upBias || 40),
      life: opts.life || 0.4,
      maxLife: opts.life || 0.4,
      size: opts.size || 3,
      color,
      gravity: opts.gravity ?? 260,
    });
  }
}

function spawnPopup(x, y, text, color) {
  popups.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function triggerShake(amount) {
  shakeMag = Math.min(14, shakeMag + amount);
}

function updateEffects(dt) {
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  popups = popups.filter((p) => p.life > 0);
  for (const p of popups) {
    p.y -= 26 * dt;
    p.life -= dt;
  }
  shakeMag *= Math.max(0, 1 - 6 * dt);
  if (shakeMag < 0.05) shakeMag = 0;
}

function drawEffects(ctx) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px "Courier New", monospace';
  for (const p of popups) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// ----------------------------------------------------------------- state --

let prevState = null;
let currState = null;
let arrivalTime = 0;
let localId = null;
const tauntBubbles = new Map(); // playerId -> { text, until }

export function setLocalId(id) {
  localId = id;
}

export function showTaunt(playerId, message) {
  tauntBubbles.set(playerId, { text: message, until: performance.now() + 2500 });
  sfx.taunt();
}

export function ingestState(state) {
  const prevPhase = currState?.phase;
  if (state.players && currState?.players) {
    for (let i = 0; i < state.players.length; i++) {
      const now = state.players[i];
      const old = currState.players.find((p) => p.id === now.id);
      if (!old) continue;

      if (old.grounded && !now.grounded) {
        sfx.jump();
        spawnParticles(now.x, GROUND_Y, 6, '#cfc6b8', { speed: 60, life: 0.3, size: 2, upBias: 10 });
      }
      if (!old.grounded && now.grounded) {
        sfx.land();
        spawnParticles(now.x, GROUND_Y, 8, '#cfc6b8', { speed: 70, life: 0.35, size: 2, upBias: 20 });
        trackerFor(now.id).squashUntil = performance.now() + 140;
      }
      const oldPhase = old.attack?.phase;
      const newPhase = now.attack?.phase;
      if (oldPhase !== 'active' && newPhase === 'active') {
        sfx.swing(now.attack.key);
        if (now.attack.key === 'special') {
          const theme = THEMES[now.characterId] || THEMES.warrior;
          const cf = now.attack.chargeFraction || 0;
          spawnParticles(now.x + now.facing * 20, GROUND_Y - PLAYER_HEIGHT / 2, Math.round(8 + 14 * cf), theme.accent, {
            speed: 100 + 90 * cf, life: 0.5, size: 3,
          });
          if (cf >= 1) triggerShake(5);
        } else if (now.attack.key === 'spinKick') {
          spawnParticles(now.x, GROUND_Y - PLAYER_HEIGHT / 2, 12, '#ffd23f', { speed: 150, life: 0.35, size: 2 });
        } else if (now.attack.key === 'throw') {
          const opponent = state.players.find((p) => p.id !== now.id);
          if (opponent?.grabbedBy === now.id) {
            sfx.hit(4, 1);
            spawnParticles(opponent.x, GROUND_Y - PLAYER_HEIGHT / 2, 8, '#ff5fa2', { speed: 90, life: 0.3, size: 2 });
          }
        } else if (now.attack.key === 'launcherKick') {
          spawnParticles(now.x + now.facing * 16, GROUND_Y - PLAYER_HEIGHT / 2, 10, '#7ee7ff', { speed: 130, life: 0.4, size: 3, upBias: 60 });
        }
      }
      if (old.attack?.key === 'groundSmash' && oldPhase === 'falling' && newPhase === 'recovery') {
        sfx.land();
        triggerShake(10);
        spawnParticles(now.x, GROUND_Y - now.jumpY, 16, '#cfc6b8', { speed: 130, life: 0.4, size: 3, upBias: 20 });
      }

      if (now.score > old.score) {
        const opponent = state.players.find((p) => p.id !== now.id);
        const oldOpponent = currState.players.find((p) => p.id === opponent?.id);
        const damage = oldOpponent ? Math.max(1, oldOpponent.health - opponent.health) : 8;
        sfx.hit(damage, now.comboCount);
        sfx.hurt();
        if (opponent) {
          triggerShake(4 + Math.min(10, damage / 3));
          if (now.attack?.key === 'throw' || now.attack?.key === 'launcherKick') triggerShake(6);
          spawnParticles(opponent.x, GROUND_Y - PLAYER_HEIGHT / 2, 10, '#fff', { speed: 160, life: 0.35, size: 3 });
          spawnPopup(opponent.x, GROUND_Y - PLAYER_HEIGHT - 10, `+${now.lastHitPoints}`, '#ffd23f');
          if (now.comboCount > 1) {
            spawnPopup(now.x, GROUND_Y - PLAYER_HEIGHT - 26, `${now.comboCount} HIT COMBO`, '#ff5fa2');
          }
        }
      }
    }
  }

  if (prevPhase && prevPhase !== state.phase) {
    if (state.phase === 'playing') {
      sfx.roundStart();
      music.play();
    } else if (state.phase === 'over') {
      music.stop();
      const iWon = state.winnerId === localId;
      const draw = state.winnerId === null;
      if (draw) { /* no fanfare either way */ }
      else if (iWon) sfx.victory();
      else sfx.defeat();
    }
  }

  prevState = currState;
  currState = state;
  arrivalTime = performance.now();
}

function interpolatedPlayers() {
  if (!currState) return [];
  if (!prevState) return currState.players;
  const t = Math.min(1, (performance.now() - arrivalTime) / TICK_MS);
  return currState.players.map((now) => {
    const old = prevState.players.find((p) => p.id === now.id);
    if (!old) return now;
    return {
      ...now,
      x: old.x + (now.x - old.x) * t,
      jumpY: old.jumpY + (now.jumpY - old.jumpY) * t,
    };
  });
}

function interpolatedProjectiles() {
  if (!currState) return [];
  if (!prevState) return currState.projectiles;
  const t = Math.min(1, (performance.now() - arrivalTime) / TICK_MS);
  return currState.projectiles.map((now) => {
    const old = prevState.projectiles.find((p) => p.id === now.id);
    if (!old) return now;
    return { ...now, x: old.x + (now.x - old.x) * t, y: old.y + (now.y - old.y) * t };
  });
}

// ------------------------------------------------------------- background --

let stageVideo = null;
(async function tryLoadStageVideo() {
  try {
    const head = await fetch('/assets/video/stage-bg.mp4', { method: 'HEAD' });
    if (!head.ok) return;
  } catch {
    return;
  }
  const el = document.createElement('video');
  el.src = '/assets/video/stage-bg.mp4';
  el.loop = true;
  el.muted = true;
  el.playsInline = true;
  el.addEventListener('loadeddata', () => {
    stageVideo = el;
    el.play().catch(() => {});
  }, { once: true });
  el.load();
})();

const FULL_FLOOR = [{ id: 'floor', x1: -Infinity, x2: Infinity, height: 0 }];

function drawBackground(ctx) {
  if (stageVideo && stageVideo.readyState >= 2) {
    const vw = stageVideo.videoWidth, vh = stageVideo.videoHeight;
    const scale = Math.max(ARENA_WIDTH / vw, ARENA_HEIGHT / vh);
    const dw = vw * scale, dh = vh * scale;
    ctx.drawImage(stageVideo, (ARENA_WIDTH - dw) / 2, (ARENA_HEIGHT - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(10,5,20,0.35)';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#1a1030');
    sky.addColorStop(1, '#3a2456');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, ARENA_WIDTH, GROUND_Y);

    ctx.fillStyle = 'rgba(90,60,120,0.4)';
    for (const [x, w, h] of [[83, 96, 164], [303, 69, 123], [715, 124, 191], [963, 76, 136]]) {
      ctx.fillRect(x, GROUND_Y - h, w, h);
    }

    const glow = ctx.createRadialGradient(ARENA_WIDTH / 2, GROUND_Y, 10, ARENA_WIDTH / 2, GROUND_Y, 260);
    glow.addColorStop(0, 'rgba(255,140,60,0.18)');
    glow.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, ARENA_WIDTH, GROUND_Y);
  }

  const floor = currState?.stageId ? getStageLayout(currState.stageId).floor : FULL_FLOOR;

  // Void behind everything, so any gap in the floor reads as a bottomless pit.
  const void_ = ctx.createLinearGradient(0, GROUND_Y, 0, ARENA_HEIGHT);
  void_.addColorStop(0, '#0c0714');
  void_.addColorStop(1, '#000000');
  ctx.fillStyle = void_;
  ctx.fillRect(0, GROUND_Y, ARENA_WIDTH, ARENA_HEIGHT - GROUND_Y);

  const ground = ctx.createLinearGradient(0, GROUND_Y, 0, ARENA_HEIGHT);
  ground.addColorStop(0, '#4a2f66');
  ground.addColorStop(1, '#241634');

  for (const seg of floor) {
    const x1 = Math.max(0, seg.x1);
    const x2 = Math.min(ARENA_WIDTH, seg.x2);
    if (x2 <= x1) continue;

    ctx.fillStyle = ground;
    ctx.fillRect(x1, GROUND_Y, x2 - x1, ARENA_HEIGHT - GROUND_Y);

    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(x1 / 40) * 40; x < x2; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 4);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }

    ctx.strokeStyle = '#8a6ab0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, GROUND_Y);
    ctx.lineTo(x2, GROUND_Y);
    ctx.stroke();
  }

  drawPlatforms(ctx);
}

function drawPlatforms(ctx) {
  const stageId = currState?.stageId;
  if (!stageId) return;
  const thickness = 14;
  for (const p of getStageLayout(stageId).platforms) {
    const topY = GROUND_Y - p.height;
    const w = p.x2 - p.x1;

    const grad = ctx.createLinearGradient(0, topY, 0, topY + thickness);
    grad.addColorStop(0, '#8a6ab0');
    grad.addColorStop(1, '#4a2f66');
    ctx.fillStyle = grad;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    roundRectPath(ctx, p.x1, topY, w, thickness, 4);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x1 + 3, topY + 2);
    ctx.lineTo(p.x2 - 3, topY + 2);
    ctx.stroke();
  }
}

// --------------------------------------------------------------- fighter --

function pickAnimKey(player, tracker, matchOver, iWon) {
  if (matchOver) return iWon ? 'victory' : 'defeat';
  const bubble = tauntBubbles.get(player.id);
  if (bubble && bubble.until > performance.now()) return 'taunt';
  if (player.grabbedBy) return 'grabbed';
  if (player.attack) return player.attack.key;

  // A hit that leaves you airborne (a launcher kick, or knockback off a
  // ledge) tumbles until you land, rather than snapping back to a plain
  // jump pose the instant hitstun ends.
  if (player.grounded) tracker.tumbling = false;
  else if (player.hurt) tracker.tumbling = true;
  if (tracker.tumbling) return 'tumble';

  if (player.hurt) return 'hurt';
  if (player.crouching) return 'duck';
  if (!player.grounded) return player.jumpY >= tracker.lastJumpY ? 'jumpRise' : 'jumpFall';
  const moving = tracker.lastX !== null && Math.abs(player.x - tracker.lastX) > 0.4;
  return moving ? 'walk' : 'idle';
}

// A single layered teardrop "flame" pointing up from the origin, base to tip.
function drawFlame(ctx, size, lean) {
  const layers = [
    { color: '#c62a10', h: size, w: size * 0.55 },
    { color: '#ff8a00', h: size * 0.72, w: size * 0.42 },
    { color: '#ffe066', h: size * 0.42, w: size * 0.26 },
  ];
  for (const l of layers) {
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.bezierCurveTo(-l.w, -l.h * 0.35, -l.w * 0.5 + lean, -l.h * 0.9 + lean, lean, -l.h + lean);
    ctx.bezierCurveTo(l.w * 0.5 + lean, -l.h * 0.9 + lean, l.w, -l.h * 0.35, 0, 2);
    ctx.closePath();
    ctx.fillStyle = l.color;
    ctx.fill();
  }
}

// A ring of flickering flames orbiting the character while a combo is live —
// more/bigger flames the longer the chain runs. Drawn in the same local,
// facing-flipped space as the rest of the fighter (called right before
// ctx.restore() in drawFighter), so it's centered on them for free.
function drawComboAura(ctx, comboCount, now) {
  const count = Math.min(9, 5 + Math.floor(comboCount / 2));
  const intensity = Math.min(1, 0.55 + comboCount * 0.07);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + now / 700;
    const bob = Math.sin(now / 130 + i * 1.9);
    const fx = Math.cos(angle) * 26;
    const fy = -34 + Math.sin(angle) * 17 + bob * 2;
    const flicker = 0.7 + 0.3 * Math.sin(now / 85 + i * 2.6);
    const size = (9 + flicker * 5) * intensity;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.globalAlpha = 0.75 * intensity;
    drawFlame(ctx, size, Math.sin(now / 100 + i) * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawFighter(ctx, player, now, dt) {
  const charId = player.characterId;
  const theme = THEMES[charId] || THEMES.warrior;
  const charDef = charId ? getCharacter(charId) : null;
  const tracker = trackerFor(player.id);
  const matchOver = currState?.phase === 'over';
  const iWon = currState?.winnerId === player.id;

  const animKey = pickAnimKey(player, tracker, matchOver, iWon);
  if (tracker.animKey !== animKey) {
    tracker.animKey = animKey;
    tracker.phase = null;
  }

  if (animKey === 'walk') tracker.walkCycle += dt * (player.sprinting ? 15 : 9);

  let armAngle = 0.1, legSwing = 0, lean = 0, bob = 0, glow = 0, headTiltExtra = 0;
  let knockdown = false;
  let squash = 1;
  let spinAngle = 0;

  if (animKey === 'idle') {
    bob = Math.sin((now - tracker.idleStart) / 420) * 1.5;
    armAngle = 0.12 + Math.sin((now - tracker.idleStart) / 500) * 0.05;
    lean = Math.sin((now - tracker.idleStart) / 900) * 0.04;
    headTiltExtra = Math.sin((now - tracker.idleStart) / 650) * 1.2;
  } else if (animKey === 'walk') {
    const amp = player.sprinting ? 1.25 : 1;
    legSwing = Math.sin(tracker.walkCycle) * 0.55 * amp;
    armAngle = -Math.sin(tracker.walkCycle) * 0.35 * amp;
    bob = Math.abs(Math.sin(tracker.walkCycle)) * (player.sprinting ? 2.6 : 1.5);
    // Lean into the stride — forward while chasing, back while retreating.
    const moveRelToFacing = Math.sign(player.moveDir) * player.facing;
    lean = moveRelToFacing * (player.sprinting ? 0.22 : 0.1);

    // A little dust puff every time a foot plants (each half walk-cycle).
    const stepPhase = Math.floor(tracker.walkCycle / Math.PI);
    if (stepPhase !== tracker.lastStepPhase) {
      tracker.lastStepPhase = stepPhase;
      spawnParticles(player.x, GROUND_Y - player.jumpY, player.sprinting ? 4 : 2, 'rgba(210,200,180,0.55)', {
        speed: 30, life: 0.25, size: 2, upBias: 4, gravity: 80,
      });
    }
  } else if (animKey === 'jumpRise' || animKey === 'jumpFall') {
    // Continuous cycling limbs while airborne instead of a single frozen
    // pose — reads as actively paddling/running through the air.
    tracker.airCycle += dt * 11;
    const cycle = Math.sin(tracker.airCycle);
    legSwing = cycle * 0.45;
    armAngle = -cycle * 0.5 - 0.35;
    bob = Math.sin(tracker.airCycle * 2) * 1.4;
    lean = animKey === 'jumpRise' ? -0.14 : 0.12;
  } else if (animKey === 'hurt') {
    lean = -0.2;
    armAngle = -0.3;
  } else if (animKey === 'taunt') {
    lean = 0.08;
    armAngle = 0.9;
    bob = Math.sin(now / 180) * 1.5;
  } else if (animKey === 'victory') {
    armAngle = -2.1;
    bob = Math.sin(now / 260) * 2.5;
  } else if (animKey === 'defeat') {
    knockdown = true;
  } else if (animKey === 'duck') {
    legSwing = 0.45;
    armAngle = -0.15;
    squash = 0.72;
  } else if (animKey === 'groundSmash') {
    const phase = player.attack?.phase || 'startup';
    if (phase === 'startup') {
      armAngle = -1.6; // arms raised overhead, coiled for the slam
      lean = -0.05;
    } else if (phase === 'falling') {
      armAngle = 1.3; // tucked dive, arms driven down/forward
      lean = 0.25;
    } else {
      armAngle = 0.3; // recovery: crouched impact pose
      lean = 0.05;
      squash = 0.8;
    }
  } else if (animKey === 'spinKick') {
    const phase = player.attack?.phase || 'startup';
    if (tracker.phase !== phase) { tracker.phase = phase; tracker.phaseStart = now; }
    const atk = charDef?.attacks.spinKick;
    if (phase === 'startup') {
      spinAngle = -0.3; // slight counter-wind before the kick
      legSwing = -0.2;
    } else if (phase === 'active' && atk) {
      const t = Math.min(1, (now - tracker.phaseStart) / atk.activeMs);
      spinAngle = t * Math.PI * 2; // one full 360deg spin over the active window
      legSwing = 0.6;
    } else {
      spinAngle = 0;
      legSwing = 0.2;
    }
  } else if (animKey === 'throw') {
    const phase = player.attack?.phase || 'startup';
    armAngle = phase === 'startup' ? -0.4 : phase === 'active' ? 0.6 : 0.1; // reach out, hold, release
    lean = phase === 'active' ? 0.1 : 0;
  } else if (animKey === 'grabbed') {
    armAngle = -0.1;
    legSwing = Math.sin(now / 90) * 0.15; // small struggle jitter
    lean = 0.1;
  } else if (animKey === 'launcherKick') {
    const phase = player.attack?.phase || 'startup';
    if (phase === 'startup') { legSwing = -0.5; lean = 0.1; } // leg cocked back
    else if (phase === 'active') { legSwing = 1.4; lean = -0.2; } // driven upward
    else { legSwing = 0.3; lean = 0; } // settling
  } else if (animKey === 'tumble') {
    knockdown = true; // reuse the knockdown rotation trick for a ragdoll spin
    legSwing = Math.sin(now / 120) * 0.4;
    armAngle = Math.cos(now / 120) * 0.4;
  } else if (charDef && ATTACK_POSE[animKey]) {
    const atk = charDef.attacks[animKey];
    const phase = player.attack?.phase || 'recovery';
    if (tracker.phase !== phase) {
      tracker.phase = phase;
      tracker.phaseStart = now;
    }
    const durMs = atk[`${phase}Ms`] || 200;
    const t = easeOut(Math.min(1, (now - tracker.phaseStart) / durMs));
    const pose = ATTACK_POSE[animKey];
    const fromAngle = phase === 'startup' ? 0.1 : phase === 'active' ? pose.startup : pose.active;
    const toAngle = pose[phase];
    armAngle = fromAngle + (toAngle - fromAngle) * t;
    const fromLean = phase === 'startup' ? 0 : phase === 'active' ? pose.lean.startup : pose.lean.active;
    lean = fromLean + (pose.lean[phase] - fromLean) * t;
    if (animKey === 'special') {
      // A charged special glows brighter — reads as "more powerful" on top
      // of the damage/knockback boost that's actually happening server-side.
      const chargeFraction = player.attack?.chargeFraction ?? 0;
      const peak = phase === 'startup' ? t : phase === 'active' ? 1 : 1 - t;
      glow = peak * (0.5 + 0.5 * chargeFraction);
    }
  }

  // Landing squash/stretch — a brief bounce pulse layered on top of
  // whatever pose squash the current animKey already set.
  if (tracker.squashUntil && now < tracker.squashUntil) {
    const p = Math.max(0, 1 - (tracker.squashUntil - now) / 140);
    squash *= 1 - 0.25 * Math.sin(p * Math.PI);
  }

  const bottom = GROUND_Y - player.jumpY;

  // ground shadow — shrinks/fades with height for a cheap grounding cue
  const shadowScale = Math.max(0.35, 1 - player.jumpY / 140);
  ctx.save();
  ctx.globalAlpha = 0.35 * shadowScale;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(player.x, GROUND_Y + 3, 18 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(Math.round(player.x), Math.round(bottom - bob));
  if (player.facing < 0) ctx.scale(-1, 1);
  if (knockdown) {
    ctx.rotate(Math.PI / 2.1);
    ctx.translate(-LEG_LEN - 6, 0);
  } else {
    ctx.rotate(lean);
    if (spinAngle) ctx.rotate(spinAngle);
    if (squash !== 1) ctx.scale(1, squash);
  }

  const backArmAngle = knockdown ? 0.2 : -armAngle * 0.4 + 0.15;
  const frontArmAngle = knockdown ? -0.1 : armAngle;
  const backLegAngle = -legSwing;
  const frontLegAngle = legSwing;

  // back leg
  limb(ctx, -4, HIP_Y, LEG_LEN, 10, backLegAngle, theme.secondary);
  // back arm
  limb(ctx, -6, SHOULDER_Y + 2, ARM_LEN, 7, backArmAngle, theme.skin);

  // torso (robe for mage, block for everyone else)
  ctx.fillStyle = theme.primary;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  if (charId === 'mage') {
    ctx.beginPath();
    ctx.moveTo(-9, SHOULDER_Y);
    ctx.lineTo(9, SHOULDER_Y);
    ctx.lineTo(15, HIP_Y + 4);
    ctx.lineTo(-15, HIP_Y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const torsoW = charId === 'warrior' ? 30 : 24;
    roundRectPath(ctx, -torsoW / 2, SHOULDER_Y, torsoW, TORSO_LEN, 6);
    ctx.fill();
    ctx.stroke();
  }

  // cape / cloak flourish for rogue
  if (charId === 'rogue') {
    const flare = 10 + Math.abs(legSwing) * 14;
    ctx.fillStyle = theme.secondary;
    ctx.beginPath();
    ctx.moveTo(-8, SHOULDER_Y + 4);
    ctx.lineTo(-8 - flare, HIP_Y + 10);
    ctx.lineTo(-2, HIP_Y);
    ctx.closePath();
    ctx.fill();
  }

  // head
  const headY = HEAD_Y + headTiltExtra;
  ctx.fillStyle = theme.skin;
  ctx.beginPath();
  ctx.arc(0, headY, HEAD_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (charId === 'warrior') {
    ctx.fillStyle = theme.metal;
    ctx.beginPath();
    ctx.arc(0, headY, HEAD_R + 1, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
  } else if (charId === 'mage') {
    ctx.fillStyle = theme.secondary;
    ctx.beginPath();
    ctx.moveTo(-HEAD_R - 1, headY - 2);
    ctx.lineTo(HEAD_R + 1, headY - 2);
    ctx.lineTo(0, headY - 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (charId === 'rogue') {
    ctx.fillStyle = theme.secondary;
    ctx.beginPath();
    ctx.arc(0, headY, HEAD_R + 2, Math.PI * 1.1, Math.PI * 1.95);
    ctx.lineTo(HEAD_R, headY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (charId === 'archer') {
    ctx.strokeStyle = theme.secondary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, headY - HEAD_R + 2);
    ctx.lineTo(-4, headY - HEAD_R - 6);
    ctx.stroke();
  }

  // eyes (small readable facing cue)
  ctx.fillStyle = '#1a1015';
  ctx.beginPath();
  ctx.arc(4, headY - 1, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // front leg (in front of torso, slightly brighter than the back leg for depth)
  limb(ctx, 4, HIP_Y, LEG_LEN, 10, frontLegAngle, theme.primary);

  // front arm + weapon
  const weaponForKey = (drawCtx) => {
    if (charId === 'warrior') weaponSword(drawCtx, theme);
    else if (charId === 'archer') weaponBow(drawCtx, theme);
    else if (charId === 'mage') weaponStaff(drawCtx, theme, glow);
    else if (charId === 'rogue') weaponDagger(drawCtx, theme);
  };
  limb(ctx, 6, SHOULDER_Y + 2, ARM_LEN, 7, frontArmAngle, theme.skin, weaponForKey);
  if (charId === 'rogue') {
    // off-hand dagger too — twin blades read better for a "flurry" class
    limb(ctx, -6, SHOULDER_Y + 2, ARM_LEN, 7, backArmAngle, theme.skin, (c) => weaponDagger(c, theme));
  }

  if (player.hurt) {
    ctx.fillStyle = 'rgba(255,50,50,0.28)';
    ctx.beginPath();
    ctx.arc(0, SHOULDER_Y + TORSO_LEN / 2, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.comboCount > 1) {
    drawComboAura(ctx, player.comboCount, now);
  }

  ctx.restore();

  // speech bubble (taunt) — drawn outside the facing-flip transform so text
  // never renders mirrored
  const bubble = tauntBubbles.get(player.id);
  if (bubble && bubble.until > now) {
    drawTauntBubble(ctx, player.x, bottom - LEG_LEN - TORSO_LEN - HEAD_R * 2 - 6, bubble.text);
  } else if (bubble) {
    tauntBubbles.delete(player.id);
  }

  tracker.lastX = player.x;
  tracker.lastJumpY = player.jumpY;
}

function drawTauntBubble(ctx, x, y, text) {
  ctx.font = 'bold 11px "Courier New", monospace';
  const padX = 8, padY = 6;
  const w = Math.min(180, ctx.measureText(text).width + padX * 2);
  const h = 22 + padY;
  const bx = Math.max(4, Math.min(ARENA_WIDTH - w - 4, x - w / 2));
  const by = y - h;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = '#1a1015';
  ctx.lineWidth = 2;
  roundRectPath(ctx, bx, by, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, by + h);
  ctx.lineTo(x + 6, by + h);
  ctx.lineTo(x, by + h + 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1a1015';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  wrapText(ctx, text, bx + w / 2, by + h / 2, w - padX * 2, 12);
  ctx.restore();
}

function wrapText(ctx, text, cx, cy, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}

// ------------------------------------------------------------- projectile --

const PROJECTILE_COLORS = {
  shortRange: '#e8e8f0',
  longRange: '#d8b46a',
  special: '#ffb347',
};

function drawProjectile(ctx, proj) {
  const player = currState.players.find((p) => p.id === proj.ownerId);
  const charId = player?.characterId;
  const theme = THEMES[charId] || THEMES.warrior;

  if (charId === 'mage') {
    const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, 9);
    grad.addColorStop(0, '#fff3c4');
    grad.addColorStop(0.5, theme.accent);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (charId === 'archer') {
    ctx.strokeStyle = '#d8b46a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(proj.x - 10, proj.y);
    ctx.lineTo(proj.x + 8, proj.y);
    ctx.stroke();
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath();
    ctx.moveTo(proj.x + 8, proj.y);
    ctx.lineTo(proj.x + 2, proj.y - 3);
    ctx.lineTo(proj.x + 2, proj.y + 3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = theme.metal;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(performance.now() / 60);
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(0, -3); ctx.lineTo(6, 0); ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ draw --

export async function loadAssets() {
  // No external assets to preload — kept as a no-op for main.js compatibility.
}

export function draw(ctx) {
  const now = performance.now();
  const dt = lastDrawTime ? Math.min(0.05, (now - lastDrawTime) / 1000) : 0;
  lastDrawTime = now;
  updateEffects(dt);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  if (!currState || (currState.phase !== 'playing' && currState.phase !== 'over')) return;

  ctx.save();
  if (shakeMag > 0) {
    ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
  }

  drawBackground(ctx);
  for (const proj of interpolatedProjectiles()) drawProjectile(ctx, proj);
  for (const player of interpolatedPlayers()) {
    if (player.characterId) drawFighter(ctx, player, now, dt);
  }
  drawEffects(ctx);

  ctx.restore();
}

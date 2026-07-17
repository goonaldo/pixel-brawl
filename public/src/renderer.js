import { getCharacter } from '/shared/characters.js';
import { ARENA_WIDTH, ARENA_HEIGHT, GROUND_Y, HURT_MS } from '/shared/constants.js';
import { colorFor } from './palette.js';

let manifest = null;
const images = new Map(); // characterId -> HTMLImageElement
const trackers = new Map(); // playerId -> { animKey, animStart, lastX }

export async function loadAssets() {
  try {
    const res = await fetch('/assets/sprites/manifest.json');
    if (res.ok) manifest = await res.json();
  } catch {
    manifest = null; // fine — draw() falls back to colored placeholders
  }
  if (manifest) {
    for (const c of manifest.characters) {
      const img = new Image();
      img.src = `/assets/sprites/${c.file}`;
      images.set(c.id, img);
    }
  }
}

function trackerFor(playerId) {
  if (!trackers.has(playerId)) {
    trackers.set(playerId, { animKey: 'idle', animStart: performance.now(), lastX: null });
  }
  return trackers.get(playerId);
}

function pickAnimKey(player, tracker) {
  if (player.attack) return player.attack.key; // shortRange | longRange | special
  if (player.hurt) return 'hurt';
  if (!player.grounded) return 'idle'; // no dedicated jump animation sourced yet
  const moving = tracker.lastX !== null && Math.abs(player.x - tracker.lastX) > 0.5;
  return moving ? 'walk' : 'idle';
}

function frameIndexFor(animKey, tracker, frames, charDef) {
  if (frames <= 1) return 0;
  if (animKey === 'walk') {
    return Math.floor(performance.now() / 125) % frames; // ~8fps loop
  }
  const now = performance.now();
  let durationMs = HURT_MS;
  if (animKey !== 'hurt' && charDef) {
    const atk = charDef.attacks[animKey];
    durationMs = atk.startupMs + atk.activeMs + atk.recoveryMs;
  }
  const t = Math.min(1, (now - tracker.animStart) / durationMs);
  return Math.min(frames - 1, Math.floor(t * frames));
}

function drawBackground(ctx) {
  ctx.fillStyle = '#241934';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  ctx.fillStyle = '#3d2a52';
  ctx.fillRect(0, GROUND_Y, ARENA_WIDTH, ARENA_HEIGHT - GROUND_Y);
  ctx.strokeStyle = '#5a3f7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(ARENA_WIDTH, GROUND_Y);
  ctx.stroke();
}

function drawPlayer(ctx, player) {
  const tracker = trackerFor(player.id);
  const animKey = pickAnimKey(player, tracker);
  if (tracker.animKey !== animKey) {
    tracker.animKey = animKey;
    tracker.animStart = performance.now();
  }

  const manifestChar = manifest?.characters.find((c) => c.id === player.characterId);
  const charDef = player.characterId ? getCharacter(player.characterId) : null;
  const img = images.get(player.characterId);
  const bottom = GROUND_Y - player.jumpY;

  ctx.save();
  ctx.translate(Math.round(player.x), Math.round(bottom));
  if (player.facing < 0) ctx.scale(-1, 1);

  const spriteReady = img && manifestChar && img.complete && img.naturalWidth > 0;
  if (spriteReady) {
    const anim = manifestChar.animations[animKey] || manifestChar.animations.idle;
    const frameW = manifest.frameWidth;
    const frameH = manifest.frameHeight;
    const frameIdx = frameIndexFor(animKey, tracker, anim.frames, charDef);
    const sx = frameIdx * frameW;
    const drawW = 64;
    const drawH = 64;
    ctx.drawImage(img, sx, anim.row, frameW, frameH, -drawW / 2, -drawH, drawW, drawH);
  } else {
    ctx.fillStyle = colorFor(player.characterId);
    ctx.fillRect(-22, -64, 44, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-10, -56, 20, 14); // face marker so facing direction is readable
    if (player.attack && player.attack.phase === 'active') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(22, -46, 22, 10); // attack "limb" flash toward facing
    }
  }
  if (player.hurt) {
    ctx.fillStyle = 'rgba(255,60,60,0.35)';
    ctx.fillRect(-24, -66, 48, 66);
  }

  ctx.restore();
  tracker.lastX = player.x;
}

function drawProjectile(ctx, proj) {
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2);
  ctx.fill();
}

export function draw(ctx, state) {
  drawBackground(ctx);
  for (const proj of state.projectiles) drawProjectile(ctx, proj);
  for (const player of state.players) drawPlayer(ctx, player);
}

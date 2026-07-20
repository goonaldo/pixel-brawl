import { network } from './network.js';

const MOVE_LEFT_KEYS = ['a', 'arrowleft'];
const MOVE_RIGHT_KEYS = ['d', 'arrowright'];
const JUMP_KEYS = ['w', 'arrowup', ' '];
const DUCK_KEYS = ['s', 'arrowdown'];
const SPRINT_KEYS = ['shift'];
const HELD_KEYS = [...MOVE_LEFT_KEYS, ...MOVE_RIGHT_KEYS, ...DUCK_KEYS, ...SPRINT_KEYS];
const TAUNT_COOLDOWN_MS = 1500;

export function initInput() {
  const pressed = new Set();
  let currentDir = 0;
  let duckActive = false;
  let sprintActive = false;
  let lastTauntAt = 0;

  function updateMoveDir() {
    let dir = 0;
    if (MOVE_LEFT_KEYS.some((k) => pressed.has(k))) dir -= 1;
    if (MOVE_RIGHT_KEYS.some((k) => pressed.has(k))) dir += 1;
    if (dir !== currentDir) {
      currentDir = dir;
      network.move(dir);
    }
  }

  function updateDuck() {
    const active = DUCK_KEYS.some((k) => pressed.has(k));
    if (active !== duckActive) {
      duckActive = active;
      network.duck(active);
    }
  }

  function updateSprint() {
    const active = SPRINT_KEYS.some((k) => pressed.has(k));
    if (active !== sprintActive) {
      sprintActive = active;
      network.sprint(active);
    }
  }

  function updateHeld() {
    updateMoveDir();
    updateDuck();
    updateSprint();
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (HELD_KEYS.includes(key)) {
      e.preventDefault();
      if (!pressed.has(key)) {
        pressed.add(key);
        updateHeld();
      }
      return;
    }

    if (e.repeat) return; // ignore OS key-repeat for one-shot actions

    if (JUMP_KEYS.includes(key)) {
      e.preventDefault();
      network.jump();
    } else if (key === 'j') {
      // Down + J while airborne is resolved server-side as a ground smash
      // instead of the normal short-range swing — see match.js startAttack.
      network.attack('shortRange');
    } else if (key === 'k') {
      network.attack('longRange');
    } else if (key === 'l') {
      network.attack('special');
    } else if (key === 't') {
      const now = performance.now();
      if (now - lastTauntAt >= TAUNT_COOLDOWN_MS) {
        lastTauntAt = now;
        network.taunt();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (pressed.has(key)) {
      pressed.delete(key);
      updateHeld();
    }
  });

  window.addEventListener('blur', () => {
    pressed.clear();
    if (currentDir !== 0) {
      currentDir = 0;
      network.move(0);
    }
    if (duckActive) {
      duckActive = false;
      network.duck(false);
    }
    if (sprintActive) {
      sprintActive = false;
      network.sprint(false);
    }
  });
}

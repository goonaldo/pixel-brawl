import { network } from './network.js';

const MOVE_LEFT_KEYS = ['a', 'arrowleft'];
const MOVE_RIGHT_KEYS = ['d', 'arrowright'];
const JUMP_KEYS = ['w', 'arrowup', ' '];

export function initInput() {
  const pressed = new Set();
  let currentDir = 0;

  function updateMoveDir() {
    let dir = 0;
    if (MOVE_LEFT_KEYS.some((k) => pressed.has(k))) dir -= 1;
    if (MOVE_RIGHT_KEYS.some((k) => pressed.has(k))) dir += 1;
    if (dir !== currentDir) {
      currentDir = dir;
      network.move(dir);
    }
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (MOVE_LEFT_KEYS.includes(key) || MOVE_RIGHT_KEYS.includes(key)) {
      e.preventDefault();
      if (!pressed.has(key)) {
        pressed.add(key);
        updateMoveDir();
      }
      return;
    }

    if (e.repeat) return; // ignore OS key-repeat for one-shot actions

    if (JUMP_KEYS.includes(key)) {
      e.preventDefault();
      network.jump();
    } else if (key === 'j') {
      network.attack('shortRange');
    } else if (key === 'k') {
      network.attack('longRange');
    } else if (key === 'l') {
      network.attack('special');
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (pressed.has(key)) {
      pressed.delete(key);
      updateMoveDir();
    }
  });

  window.addEventListener('blur', () => {
    pressed.clear();
    if (currentDir !== 0) {
      currentDir = 0;
      network.move(0);
    }
  });
}

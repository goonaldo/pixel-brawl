import { MAX_HEALTH } from '/shared/constants.js';

const screens = {
  waiting: document.getElementById('waitingScreen'),
  disconnected: document.getElementById('disconnectedScreen'),
  select: document.getElementById('selectScreen'),
  game: document.getElementById('gameScreen'),
  over: document.getElementById('overScreen'),
};

export function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

const p1NameEl = document.getElementById('p1Name');
const p2NameEl = document.getElementById('p2Name');
const p1HealthEl = document.getElementById('p1Health');
const p2HealthEl = document.getElementById('p2Health');
const timerEl = document.getElementById('timer');
const resultTextEl = document.getElementById('resultText');
const rematchStatusEl = document.getElementById('rematchStatus');

export function updateHud(state, myId) {
  const me = state.players.find((p) => p.id === myId);
  const opponent = state.players.find((p) => p.id !== myId);
  if (!me || !opponent) return;
  p1NameEl.textContent = me.characterId || '';
  p2NameEl.textContent = opponent.characterId || '';
  p1HealthEl.style.width = `${Math.max(0, (me.health / MAX_HEALTH) * 100)}%`;
  p2HealthEl.style.width = `${Math.max(0, (opponent.health / MAX_HEALTH) * 100)}%`;
  timerEl.textContent = state.timeRemaining;
}

export function updateOverScreen(state, myId) {
  const me = state.players.find((p) => p.id === myId);
  if (state.winnerId === null) {
    resultTextEl.textContent = "It's a draw!";
  } else if (state.winnerId === myId) {
    resultTextEl.textContent = 'You win!';
  } else {
    resultTextEl.textContent = 'You lose.';
  }
  rematchStatusEl.textContent = me?.rematchReady ? 'Waiting for opponent to rematch...' : '';
}

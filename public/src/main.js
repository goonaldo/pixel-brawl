import { network } from './network.js';
import { initInput } from './input.js';
import { renderCharacterGrid, updateSelectStatus } from './characterSelect.js';
import { loadAssets, draw } from './renderer.js';
import { showScreen, updateHud, updateOverScreen } from './ui.js';
import { loadShareLinks } from './hostInfo.js';

let myId = null;
let latestState = null;

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');

network.on('waiting', () => {
  showScreen('waiting');
  loadShareLinks();
});

network.on('youAre', ({ id }) => {
  myId = id;
});

network.on('matchFound', ({ characters }) => {
  renderCharacterGrid(characters);
});

network.on('opponentDisconnected', () => showScreen('disconnected'));

network.on('state', (state) => {
  latestState = state;
  if (!myId) return; // haven't received youAre yet
  if (state.phase === 'select') {
    showScreen('select');
    updateSelectStatus(state, myId);
  } else if (state.phase === 'playing') {
    showScreen('game');
    updateHud(state, myId);
  } else if (state.phase === 'over') {
    showScreen('over');
    updateHud(state, myId);
    updateOverScreen(state, myId);
  }
});

document.getElementById('rematchBtn').addEventListener('click', () => {
  network.rematch();
  rematchStatusHint();
});

function rematchStatusHint() {
  document.getElementById('rematchStatus').textContent = 'Waiting for opponent to rematch...';
}

document.getElementById('backToLobbyBtn').addEventListener('click', () => {
  location.reload();
});

initInput();
loadAssets();

function renderLoop() {
  if (latestState && latestState.phase === 'playing') {
    draw(ctx, latestState);
  }
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

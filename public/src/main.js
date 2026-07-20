import { network } from './network.js';
import { initInput } from './input.js';
import { renderCharacterGrid, updateSelectStatus } from './characterSelect.js';
import { renderStageGrid, updateStageHighlight } from './stageSelect.js';
import { loadAssets, draw, ingestState, setLocalId, showTaunt } from './renderer.js';
import { showScreen, updateHud, updateOverScreen } from './ui.js';
import { loadShareLinks } from './hostInfo.js';
import { setMuted, isMuted } from './audio.js';
import { STAGE_LAYOUTS } from '/shared/stage.js';

let myId = null;

const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');

network.on('waiting', () => {
  showScreen('waiting');
  loadShareLinks();
});

network.on('youAre', ({ id }) => {
  myId = id;
  setLocalId(id);
});

network.on('matchFound', ({ characters }) => {
  renderCharacterGrid(characters);
  renderStageGrid(STAGE_LAYOUTS);
});

network.on('opponentDisconnected', () => showScreen('disconnected'));

network.on('taunt', ({ playerId, message }) => {
  showTaunt(playerId, message);
});

network.on('state', (state) => {
  ingestState(state);
  if (!myId) return; // haven't received youAre yet
  if (state.phase === 'select') {
    showScreen('select');
    updateSelectStatus(state, myId);
    updateStageHighlight(state.stageId);
  } else if (state.phase === 'playing') {
    showScreen('game');
    updateHud(state, myId);
  } else if (state.phase === 'over') {
    showScreen('game'); // keep the canvas up so the KO pose stays visible
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

const muteBtn = document.getElementById('muteBtn');
muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? '\u{1F507}' : '\u{1F50A}';
});

initInput();
loadAssets();

function renderLoop() {
  draw(ctx);
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

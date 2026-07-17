import { network } from './network.js';
import { colorFor } from './palette.js';

const grid = document.getElementById('characterGrid');
const statusEl = document.getElementById('selectStatus');

let myPickedId = null;

export function renderCharacterGrid(characters) {
  grid.innerHTML = '';
  for (const character of characters) {
    const card = document.createElement('div');
    card.className = 'charCard';
    card.dataset.id = character.id;

    const swatch = document.createElement('div');
    swatch.style.width = '48px';
    swatch.style.height = '48px';
    swatch.style.margin = '0 auto 8px';
    swatch.style.background = colorFor(character.id);
    swatch.style.border = '2px solid #000';

    const name = document.createElement('div');
    name.className = 'charName';
    name.textContent = character.name;

    const blurb = document.createElement('div');
    blurb.className = 'charBlurb';
    blurb.textContent = character.blurb;

    card.append(swatch, name, blurb);
    card.addEventListener('click', () => {
      myPickedId = character.id;
      network.selectCharacter(character.id);
      updatePickedHighlight();
    });
    grid.appendChild(card);
  }
}

function updatePickedHighlight() {
  for (const card of grid.children) {
    card.classList.toggle('picked', card.dataset.id === myPickedId);
  }
}

export function updateSelectStatus(state, myId) {
  const me = state.players.find((p) => p.id === myId);
  const opponent = state.players.find((p) => p.id !== myId);
  myPickedId = me?.characterId || null;
  updatePickedHighlight();

  if (!me?.characterId) {
    statusEl.textContent = 'Pick a fighter above.';
  } else if (!opponent?.characterId) {
    statusEl.textContent = `You picked ${me.characterId}. Waiting for opponent to pick...`;
  } else {
    statusEl.textContent = 'Starting...';
  }
}

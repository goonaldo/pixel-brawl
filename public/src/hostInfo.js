const container = document.getElementById('shareLinks');

function makeRow(url) {
  const row = document.createElement('div');
  row.className = 'shareLinkRow';

  const text = document.createElement('span');
  text.className = 'url';
  text.textContent = url;

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = 'Copied!';
    } catch {
      copyBtn.textContent = 'Select & copy';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
  });

  row.append(text, copyBtn);
  return row;
}

export async function loadShareLinks() {
  if (!container) return;
  try {
    const res = await fetch('/api/host-info');
    if (!res.ok) throw new Error('bad response');
    const { port, addresses } = await res.json();
    container.innerHTML = '';
    if (addresses.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = "Couldn't detect a wifi address — make sure this device is on wifi (not just ethernet/offline).";
      container.appendChild(p);
      return;
    }
    for (const addr of addresses) {
      container.appendChild(makeRow(`http://${addr}:${port}`));
    }
  } catch {
    container.innerHTML = '<p class="hint">Could not load connection info.</p>';
  }
}

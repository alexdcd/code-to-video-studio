export const CHARACTER = {
  id: 'minimal-block',
  views: ['front', 'q', 'side', 'qback', 'back'],
  actions: ['idle', 'think', 'point', 'walk'],
  expressions: ['neutral', 'thinking', 'surprised', 'happy'],
};

export function getCharacterCapabilities() {
  return CHARACTER;
}

function wave(t, speed = 1) {
  return Math.sin(t * Math.PI * 2 * speed);
}

export function renderCharacter(target, t, state = {}) {
  const view = state.view || 'front';
  const action = state.action || 'idle';
  const bob = action === 'idle' ? wave(t, 0.5) * 2 : 0;
  const side = view === 'q' || view === 'side' || view === 'qback';
  const face = view !== 'back' && view !== 'qback';
  const eye2 = view !== 'side';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">
    <g transform="translate(0 ${bob.toFixed(3)})" stroke="#111" stroke-width="3" fill="#fff" stroke-linejoin="round">
      <rect x="50" y="20" width="100" height="90"/>
      ${side ? '<polygon points="150,20 170,10 170,100 150,110" fill="#eee"/>' : ''}
      ${face ? '<rect x="78" y="58" width="8" height="22" rx="4" fill="#111" stroke="none"/>' : ''}
      ${face && eye2 ? '<rect x="112" y="58" width="8" height="22" rx="4" fill="#111" stroke="none"/>' : ''}
      <rect x="72" y="112" width="58" height="72"/>
      <rect x="45" y="118" width="24" height="78"/><rect x="133" y="118" width="24" height="78"/>
      <rect x="78" y="184" width="20" height="58"/><rect x="106" y="184" width="20" height="58"/>
    </g></svg>`;
  if (target && 'innerHTML' in target) target.innerHTML = svg;
  return svg;
}

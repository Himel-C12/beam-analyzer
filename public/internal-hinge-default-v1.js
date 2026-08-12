/* Beam Analyzer — canonical internal-hinge symbol.
 * This is the only visual treatment for internal hinges.
 * It deliberately leaves the analysis model untouched.
 */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const n = v => Number(v);

  function hingeRows() {
    return $$('#supportRows tr').map((tr, index) => {
      const select = $('select[data-k="type"]', tr);
      const position = $('input[data-k="position"]', tr);
      const type = select?.value || '';
      if (type !== 'internal-hinge') return null;
      const p = n(position?.value);
      return Number.isFinite(p) ? { id: select.dataset.sup, position: p, index } : null;
    }).filter(Boolean);
  }

  function beamGeometry(svg) {
    const beam = $('.beamLine', svg);
    if (!beam) return null;
    const x1 = n(beam.getAttribute('x1'));
    const x2 = n(beam.getAttribute('x2'));
    const y = n(beam.getAttribute('y1'));
    const lengths = $$('#spanRows input[data-k="length"]')
      .map(input => n(input.value)).filter(Number.isFinite);
    const total = lengths.reduce((a, b) => a + b, 0);
    if (![x1, x2, y, total].every(Number.isFinite) || total <= 0) return null;
    return { x1, x2, y, total };
  }

  function hideNativeSupport(group) {
    // Hide the old pin/roller artwork completely. Do not delete the group:
    // app.js uses it for dragging and redraws it when the model changes.
    $$(':scope > *', group).forEach(node => {
      node.classList.add('native-support-art');
      node.style.display = 'none';
    });
    group.classList.add('internal-hinge-native-hidden');
    group.style.display = '';
  }

  function makeHinge(x, y, index, position) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'canonical-internal-hinge');
    g.setAttribute('pointer-events', 'none');
    g.dataset.hingeIndex = String(index);

    // Canonical symbol: a circular rotational release centred directly on
    // the beam, with a clean white face and dark outline.
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '11');
    circle.setAttribute('fill', '#ffffff');
    circle.setAttribute('stroke', '#20252b');
    circle.setAttribute('stroke-width', '2.5');
    g.appendChild(circle);

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y + 42);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'canonical-hinge-label');
    label.textContent = `H${index + 1} (Internal Hinge)`;
    g.appendChild(label);

    const pos = document.createElementNS(NS, 'text');
    pos.setAttribute('x', x);
    pos.setAttribute('y', y + 58);
    pos.setAttribute('text-anchor', 'middle');
    pos.setAttribute('class', 'canonical-hinge-position');
    pos.textContent = `@ ${position} ${document.documentElement.classList.contains('dark') ? 'm' : 'm'}`;
    g.appendChild(pos);

    return g;
  }

  function repair() {
    const svg = $('#beamCanvas svg');
    if (!svg) return;
    const geometry = beamGeometry(svg);
    if (!geometry) return;

    $$('.canonical-internal-hinge', svg).forEach(el => el.remove());
    const hinges = hingeRows();

    hinges.forEach((hinge, index) => {
      const x = geometry.x1 + (hinge.position / geometry.total) * (geometry.x2 - geometry.x1);
      let group = hinge.id
        ? $(`g.supportDrag[data-id="${CSS.escape(String(hinge.id))}"]`, svg)
        : null;

      if (!group) {
        const groups = $$('.supportDrag', svg);
        group = groups[hinge.index] || null;
      }
      if (!group) return;

      hideNativeSupport(group);
      svg.appendChild(makeHinge(x, geometry.y, index, hinge.position));
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .canonical-internal-hinge { overflow: visible; }
    .canonical-hinge-label,
    .canonical-hinge-position { font: 600 12px system-ui, sans-serif; fill: currentColor; }
    .beamCanvas .internal-hinge-native-hidden > .native-support-art { display: none !important; }
  `;
  document.head.appendChild(style);

  // app.js redraws the entire SVG after edits, so re-apply the canonical
  // representation after each redraw without modifying the analysis model.
  const canvas = $('#beamCanvas');
  if (canvas) new MutationObserver(() => requestAnimationFrame(repair))
    .observe(canvas, { childList: true, subtree: true });

  [0, 50, 150, 300, 600].forEach(delay => setTimeout(repair, delay));
})();

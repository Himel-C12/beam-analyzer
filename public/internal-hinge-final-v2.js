/* Beam Analyzer — final internal-hinge renderer.
 * Loaded last on purpose. It owns only the visual representation of
 * internal hinges and does not touch solver/model values.
 */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const num = v => Number(v);

  function hingeRows() {
    return $$('#supportRows tr').map(row => {
      const select = $('select[data-k="type"]', row);
      const pos = $('input[data-k="position"]', row);
      if (!select || select.value !== 'internal-hinge') return null;
      const p = num(pos?.value);
      return Number.isFinite(p) ? { id: String(select.dataset.sup), position: p } : null;
    }).filter(Boolean);
  }

  function geometry(svg) {
    const beam = $('.beamLine', svg);
    if (!beam) return null;
    const x1 = num(beam.getAttribute('x1'));
    const x2 = num(beam.getAttribute('x2'));
    const y = num(beam.getAttribute('y1'));
    const total = $$('#spanRows input[data-k="length"]')
      .map(e => num(e.value)).filter(Number.isFinite)
      .reduce((a, b) => a + b, 0);
    if (![x1, x2, y, total].every(Number.isFinite) || total <= 0) return null;
    return { x1, x2, y, total };
  }

  function addDragHandler(group, id) {
    group.onpointerdown = e => {
      if (typeof viewMode !== 'undefined' && viewMode !== 'select') return;
      if (typeof dragItem === 'function') dragItem(e, 'support', Number(id));
    };
  }

  function renderOne(svg, hinge, index, geo) {
    const x = geo.x1 + (hinge.position / geo.total) * (geo.x2 - geo.x1);
    const groups = $$(`g.supportDrag[data-id="${CSS.escape(hinge.id)}"]`, svg);

    groups.forEach(g => {
      // Keep the existing supportDrag group so its drag behaviour survives,
      // but completely replace the native pin/roller/fixed artwork.
      g.innerHTML = '';
      g.classList.add('final-internal-hinge');
      g.setAttribute('data-internal-hinge', 'true');
      g.setAttribute('pointer-events', 'all');

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', geo.y);
      circle.setAttribute('r', '11');
      circle.setAttribute('fill', '#fff');
      circle.setAttribute('stroke', '#20252b');
      circle.setAttribute('stroke-width', '2.5');
      g.appendChild(circle);

      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', geo.y + 43);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'final-hinge-label');
      label.textContent = `H${index + 1} (Internal Hinge)`;
      g.appendChild(label);

      const pos = document.createElementNS(NS, 'text');
      pos.setAttribute('x', x);
      pos.setAttribute('y', geo.y + 59);
      pos.setAttribute('text-anchor', 'middle');
      pos.setAttribute('class', 'final-hinge-position');
      pos.textContent = `@ ${hinge.position} m`;
      g.appendChild(pos);
      addDragHandler(g, hinge.id);
    });

    // Remove older standalone hinge implementations.
    $$(`g.finalInternalHinge[data-id="${CSS.escape(hinge.id)}"]`, svg).forEach(g => g.remove());
    $$('.canonical-internal-hinge', svg).forEach(g => g.remove());
  }

  function ensureOption() {
    $$('#supportRows tr').forEach(row => {
      const select = $('select[data-k="type"]', row);
      if (!select) return;

      if (!select.querySelector('option[value="internal-hinge"]')) {
        const option = document.createElement('option');
        option.value = 'internal-hinge';
        option.textContent = 'Internal Hinge';
        select.appendChild(option);
      }

      // app.js does not know the custom type, so explicitly restore the
      // model's selected value after every base-render.
      if (typeof model !== 'undefined' && Array.isArray(model.supports)) {
        const support = model.supports.find(s => String(s.id) === String(select.dataset.sup));
        if (support?.type === 'internal-hinge') select.value = 'internal-hinge';
      }
    });
  }

  function repair() {
    ensureOption();
    const svg = $('#beamCanvas svg');
    if (!svg) return;
    const geo = geometry(svg);
    if (!geo) return;
    const hinges = hingeRows();

    if (!hinges.length) {
      $$('.finalInternalHinge,.canonical-internal-hinge', svg).forEach(g => g.remove());
      return;
    }

    hinges.forEach((hinge, i) => renderOne(svg, hinge, i, geo));
  }

  const style = document.createElement('style');
  style.textContent = `
    .beamCanvas g.final-internal-hinge { cursor: grab; }
    .beamCanvas g.final-internal-hinge:active { cursor: grabbing; }
    .beamCanvas .final-hinge-label { fill: var(--text); font: 600 13px Inter, system-ui, sans-serif; }
    .beamCanvas .final-hinge-position { fill: var(--muted); font: 600 11px Inter, system-ui, sans-serif; }
  `;
  document.head.appendChild(style);

  // A short polling loop is intentional. Several older UI patches redraw the
  // SVG asynchronously; this renderer must win that race without observing
  // its own DOM mutations and causing an infinite mutation loop.
  [0, 100, 300, 700, 1200, 2000].forEach(t => setTimeout(repair, t));
  setInterval(repair, 300);
})();

/* Beam Analyzer — native internal-hinge renderer v3.
 * This is intentionally self-contained and does not depend on any older hinge patch.
 */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function n(v) { return Number(v); }
  function finite(v) { return Number.isFinite(n(v)); }
  function near(a, b) { return Math.abs(n(a) - n(b)) < 1e-7; }

  function getHinges() {
    return Array.from(document.querySelectorAll('#supportRows tr')).map(function (row) {
      const select = row.querySelector('select[data-k="type"]');
      const pos = row.querySelector('input[data-k="position"]');
      if (!select || select.value !== 'internal-hinge' || !pos) return null;
      const id = String(select.getAttribute('data-sup') || '');
      const position = n(pos.value);
      return id && finite(position) ? { id, position } : null;
    }).filter(Boolean);
  }

  function render() {
    const svg = document.querySelector('#beamCanvas svg');
    const beam = svg && svg.querySelector('.beamLine');
    if (!svg || !beam) return;

    const x1 = n(beam.getAttribute('x1'));
    const x2 = n(beam.getAttribute('x2'));
    const y = n(beam.getAttribute('y1'));
    const total = Array.from(document.querySelectorAll('#spanRows input[data-k="length"]'))
      .map(e => n(e.value)).filter(finite).reduce((a, b) => a + b, 0);
    if (![x1, x2, y, total].every(finite) || total <= 0) return;

    const hinges = getHinges();
    const activeIds = new Set(hinges.map(h => h.id));

    // Remove any previously generated native hinge groups if that support is no longer a hinge.
    svg.querySelectorAll('.nativeInternalHinge').forEach(g => {
      if (!activeIds.has(String(g.getAttribute('data-id') || ''))) g.remove();
    });

    hinges.forEach(function (h, index) {
      const x = x1 + Math.max(0, Math.min(total, h.position)) / total * (x2 - x1);
      let group = svg.querySelector('g.nativeInternalHinge[data-id="' + h.id.replace(/"/g, '\\"') + '"]');

      // Remove the actual native Pin/Roller/Fix drawing for this support.
      svg.querySelectorAll('g.supportDrag').forEach(function (g) {
        if (String(g.getAttribute('data-id') || '') !== h.id) return;
        g.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector,.supportBadge,.supportNumber,.supportText').forEach(e => e.remove());
        g.style.display = 'none';
      });

      if (!group) {
        group = document.createElementNS(NS, 'g');
        group.setAttribute('class', 'nativeInternalHinge');
        group.setAttribute('data-id', h.id);
        group.setAttribute('pointer-events', 'none');
        svg.appendChild(group);
      }
      group.innerHTML = '';

      const outer = document.createElementNS(NS, 'circle');
      outer.setAttribute('cx', x);
      outer.setAttribute('cy', y);
      outer.setAttribute('r', '10');
      outer.setAttribute('fill', 'var(--card, #171a1f)');
      outer.setAttribute('stroke', 'currentColor');
      outer.setAttribute('stroke-width', '2.5');
      group.appendChild(outer);

      const inner = document.createElementNS(NS, 'circle');
      inner.setAttribute('cx', x);
      inner.setAttribute('cy', y);
      inner.setAttribute('r', '4');
      inner.setAttribute('fill', 'none');
      inner.setAttribute('stroke', 'currentColor');
      inner.setAttribute('stroke-width', '2');
      group.appendChild(inner);

      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', y + 43);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'supportText');
      label.textContent = 'H' + (index + 1) + ' (Internal Hinge)';
      group.appendChild(label);

      const pos = document.createElementNS(NS, 'text');
      pos.setAttribute('x', x);
      pos.setAttribute('y', y + 59);
      pos.setAttribute('text-anchor', 'middle');
      pos.setAttribute('class', 'dimText');
      pos.textContent = '@ ' + h.position + ' m';
      group.appendChild(pos);
    });
  }

  // Run after the base renderer and after every redraw. No observer is attached
  // to the generated hinge itself, so this cannot create an observer loop.
  function safeRender() { try { render(); } catch (e) { console.warn('native internal hinge renderer:', e); } }
  [0, 100, 300, 600, 1000, 2000].forEach(t => setTimeout(safeRender, t));
  setInterval(safeRender, 250);
  const canvas = document.querySelector('#beamCanvas');
  if (canvas) new MutationObserver(safeRender).observe(canvas, { childList: true, subtree: true });
  const rows = document.querySelector('#supportRows');
  if (rows) new MutationObserver(safeRender).observe(rows, { childList: true, subtree: true, attributes: true });
})();

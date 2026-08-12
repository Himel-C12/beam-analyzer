/* Beam Analyzer — authoritative internal-hinge renderer.
 * Self-contained final visual owner. Does not modify solver/model data.
 */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const n = v => Number(v);
  const finite = v => Number.isFinite(n(v));
  const near = (a, b) => Math.abs(n(a) - n(b)) < 1e-7;

  function hingeRows() {
    return Array.from(document.querySelectorAll('#supportRows tr')).map(row => {
      const select = row.querySelector('select[data-k="type"]');
      const pos = row.querySelector('input[data-k="position"]');
      if (!select || select.value !== 'internal-hinge' || !pos) return null;
      const id = String(select.getAttribute('data-sup') || '');
      const position = n(pos.value);
      return id && finite(position) ? { id, position } : null;
    }).filter(Boolean);
  }

  function repair() {
    const svg = document.querySelector('#beamCanvas svg');
    const beam = svg && svg.querySelector('.beamLine');
    if (!svg || !beam) return;

    const x1 = n(beam.getAttribute('x1'));
    const x2 = n(beam.getAttribute('x2'));
    const y = n(beam.getAttribute('y1'));
    const total = Array.from(document.querySelectorAll('#spanRows input[data-k="length"]'))
      .map(e => n(e.value)).filter(finite).reduce((a, b) => a + b, 0);
    if (![x1, x2, y, total].every(finite) || total <= 0) return;

    const hinges = hingeRows();
    const ids = new Set(hinges.map(h => h.id));

    svg.querySelectorAll('g.hardInternalHinge').forEach(g => {
      if (!ids.has(String(g.getAttribute('data-id') || ''))) g.remove();
    });

    hinges.forEach((h, index) => {
      const x = x1 + Math.max(0, Math.min(total, h.position)) / total * (x2 - x1);

      // Hide/remove every native support graphic at this support. The beam line
      // itself remains untouched, so the hinge is visibly part of the beam.
      svg.querySelectorAll('g.supportDrag').forEach(g => {
        if (String(g.getAttribute('data-id') || '') !== h.id) return;
        g.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector,.supportBadge,.supportNumber,.supportText').forEach(e => e.remove());
        g.style.display = 'none';
      });

      let g = svg.querySelector('g.hardInternalHinge[data-id="' + h.id.replace(/"/g, '\\"') + '"]');
      if (!g) {
        g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'hardInternalHinge');
        g.setAttribute('data-id', h.id);
        g.setAttribute('pointer-events', 'none');
        svg.appendChild(g);
      }
      g.innerHTML = '';

      const outer = document.createElementNS(NS, 'circle');
      outer.setAttribute('cx', x); outer.setAttribute('cy', y); outer.setAttribute('r', 10);
      outer.setAttribute('fill', 'var(--card, #171a1f)');
      outer.setAttribute('stroke', 'currentColor'); outer.setAttribute('stroke-width', 2.5);
      g.appendChild(outer);

      const inner = document.createElementNS(NS, 'circle');
      inner.setAttribute('cx', x); inner.setAttribute('cy', y); inner.setAttribute('r', 4);
      inner.setAttribute('fill', 'none'); inner.setAttribute('stroke', 'currentColor'); inner.setAttribute('stroke-width', 2);
      g.appendChild(inner);

      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', x); label.setAttribute('y', y + 43); label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'supportText'); label.textContent = 'H' + (index + 1) + ' (Internal Hinge)';
      g.appendChild(label);

      const pos = document.createElementNS(NS, 'text');
      pos.setAttribute('x', x); pos.setAttribute('y', y + 59); pos.setAttribute('text-anchor', 'middle');
      pos.setAttribute('class', 'dimText'); pos.textContent = '@ ' + h.position + ' m';
      g.appendChild(pos);
    });
  }

  const safe = () => { try { repair(); } catch (e) { console.warn('Internal hinge hardfix:', e); } };
  [0, 100, 300, 600, 1000, 2000].forEach(t => setTimeout(safe, t));
  setInterval(safe, 250);
  const canvas = document.querySelector('#beamCanvas');
  if (canvas) new MutationObserver(safe).observe(canvas, { childList: true, subtree: true });
  const rows = document.querySelector('#supportRows');
  if (rows) new MutationObserver(safe).observe(rows, { childList: true, subtree: true, attributes: true });
})();

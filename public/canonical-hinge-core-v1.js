/* Beam Analyzer — canonical internal-hinge integration.
 * Owns the support type, beam-model icon, and support input persistence.
 * Runs after app.js so the normal renderer remains responsible for all
 * non-hinge supports, loads, dimensions, results, and diagrams.
 */
(function(){
  'use strict';

  const originalRenderInputs = window.renderInputs;
  const originalRenderBeam = window.renderBeam;
  if(typeof originalRenderInputs !== 'function' || typeof originalRenderBeam !== 'function') return;

  const $$ = s => [...document.querySelectorAll(s)];
  const $ = s => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const num = v => Number(v);
  const finite = v => Number.isFinite(num(v));

  function ensureHingeOption(sel, support){
    if(!sel) return;
    let opt = sel.querySelector('option[value="internal-hinge"]');
    if(!opt){
      opt = document.createElement('option');
      opt.value = 'internal-hinge';
      opt.textContent = 'Internal Hinge';
      sel.appendChild(opt);
    }
    if(support?.type === 'internal-hinge') sel.value = 'internal-hinge';
  }

  function bindSupportInputs(){
    $$('#supportRows select[data-k="type"], #supportRows input[data-k="position"], #supportRows input[data-k="settlement"]').forEach(el=>{
      const id = el.dataset.sup;
      const support = (typeof model !== 'undefined' && Array.isArray(model.supports))
        ? model.supports.find(s => String(s.id) === String(id)) : null;
      if(el.dataset.k === 'type') ensureHingeOption(el, support);

      el.onchange = () => {
        if(typeof mutate !== 'function' || !support) return;
        mutate(() => {
          if(el.dataset.k === 'type') support.type = el.value;
          else support[el.dataset.k] = num(el.value);
        });
      };
    });
  }

  window.renderInputs = function(){
    originalRenderInputs();

    const supports = (typeof model !== 'undefined' && Array.isArray(model.supports)) ? model.supports : [];
    $$('#supportRows select[data-k="type"]').forEach(sel => {
      const support = supports.find(s => String(s.id) === String(sel.dataset.sup));
      ensureHingeOption(sel, support);
    });
    bindSupportInputs();
  };

  function hingeRows(){
    return $$('#supportRows tr').map((tr, index) => {
      const sel = tr.querySelector('select[data-k="type"]');
      const pos = tr.querySelector('input[data-k="position"]');
      if(!sel || !pos) return null;
      return {id:String(sel.dataset.sup || index + 1), type:sel.value, position:num(pos.value), index};
    }).filter(Boolean);
  }

  function patchHingeGraphics(){
    const svg = $('#beamCanvas svg');
    if(!svg || typeof model === 'undefined' || !Array.isArray(model.supports)) return;

    svg.querySelectorAll('.canonicalInternalHinge').forEach(g => g.remove());

    const beam = svg.querySelector('.beamLine');
    if(!beam) return;

    const bx1 = num(beam.getAttribute('x1'));
    const bx2 = num(beam.getAttribute('x2'));
    const by = num(beam.getAttribute('y1'));
    const total = typeof len === 'function' ? num(len()) : 0;
    if(!finite(bx1)||!finite(bx2)||!finite(by)||!(total>0)) return;

    // Remove the entire normal support group for every internal hinge.
    const hinges = model.supports.filter(s => s && s.type === 'internal-hinge');
    hinges.forEach(s => {
      svg.querySelectorAll('g.supportDrag[data-id]').forEach(g => {
        if(String(g.getAttribute('data-id')) === String(s.id)) g.remove();
      });
    });

    // Rename dimension/support labels at hinge locations.
    model.supports.forEach((s, i) => {
      if(s.type !== 'internal-hinge') return;
      const prefix = `S${i+1}`;
      const replacement = `H${hinges.indexOf(s)+1}`;
      svg.querySelectorAll('text').forEach(t => {
        const text = (t.textContent || '').trim();
        if(text === prefix) t.textContent = replacement;
        else if(text.startsWith(prefix + ':')) t.textContent = text.replace(prefix + ':', replacement + ':');
      });
    });

    hinges.forEach((s, hi) => {
      const x = bx1 + Math.max(0, Math.min(total, num(s.position))) / total * (bx2 - bx1);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'canonicalInternalHinge');
      g.setAttribute('pointer-events', 'none');

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(by));
      circle.setAttribute('r', '8.5');
      circle.setAttribute('fill', 'var(--card,#fff)');
      circle.setAttribute('stroke', 'var(--text,#20252b)');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(circle);

      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(by + 45));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'supportText');
      label.textContent = `H${hi+1} (Internal Hinge)`;
      g.appendChild(label);

      const position = document.createElementNS(NS, 'text');
      position.setAttribute('x', String(x));
      position.setAttribute('y', String(by + 62));
      position.setAttribute('text-anchor', 'middle');
      position.setAttribute('class', 'dimText');
      position.textContent = `@ ${typeof fmt === 'function' ? fmt(s.position) : s.position} ${typeof unitText === 'function' ? unitText('length') : ''}`;
      g.appendChild(position);

      svg.appendChild(g);
    });
  }

  window.renderBeam = function(){
    originalRenderBeam();
    requestAnimationFrame(patchHingeGraphics);
  };

  // Keep the canonical view in sync after model-driven redraws.
  const canvas = $('#beamCanvas');
  if(canvas && !canvas.__canonicalHingeObserver){
    const observer = new MutationObserver(() => requestAnimationFrame(patchHingeGraphics));
    observer.observe(canvas, {childList:true, subtree:true});
    canvas.__canonicalHingeObserver = observer;
  }

  // Initial canonical render after app initialization.
  requestAnimationFrame(() => {
    if(typeof window.renderInputs === 'function') window.renderInputs();
    if(typeof window.renderBeam === 'function') window.renderBeam();
  });
})();

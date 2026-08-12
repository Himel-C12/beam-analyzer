/* Beam Analyzer — canonical support/hinge integration v2.
 *
 * One source of truth for support UI + beam-model rendering:
 *   model.supports[].type === 'internal-hinge'
 *
 * The base app historically rebuilt support rows with only Pin/Roller/Fixed
 * and rendered every non-fixed/non-roller support as a Pin. This layer owns
 * the support-row contract after app.js and normalizes the beam SVG from the
 * live support rows before every beam redraw.
 */
(function(){
  'use strict';

  const originalRenderInputs = window.renderInputs;
  const originalRenderBeam = window.renderBeam;
  if(typeof originalRenderInputs !== 'function' || typeof originalRenderBeam !== 'function') return;

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const num = v => Number(v);
  const finite = v => Number.isFinite(num(v));
  const near = (a,b) => Math.abs(num(a)-num(b)) <= 1e-8 * Math.max(1,Math.abs(num(a)),Math.abs(num(b)));
  let syncing = false;

  function supportsFromModel(){
    return Array.isArray(window.model) ? window.model : [];
  }

  function ensureOption(select, support){
    if(!select) return;
    let option = select.querySelector('option[value="internal-hinge"]');
    if(!option){
      option = document.createElement('option');
      option.value = 'internal-hinge';
      option.textContent = 'Internal Hinge';
      select.appendChild(option);
    }
    if(support) select.value = support.type === 'internal-hinge' ? 'internal-hinge' : support.type;
  }

  function normalizeSupportOrder(){
    if(typeof model === 'undefined' || !Array.isArray(model.supports)) return;
    model.supports = model.supports.slice().sort((a,b)=>num(a.position)-num(b.position));
  }

  function syncModelFromRows(){
    if(syncing || typeof model === 'undefined' || !Array.isArray(model.supports)) return;
    const rows = $$('#supportRows tr');
    if(!rows.length) return;
    const byId = new Map(model.supports.map(s=>[String(s.id),s]));
    syncing = true;
    try{
      for(const row of rows){
        const select = row.querySelector('select[data-k="type"]');
        const pos = row.querySelector('input[data-k="position"]');
        const settlement = row.querySelector('input[data-k="settlement"]');
        if(!select) continue;
        const id = String(select.dataset.sup || '');
        const support = byId.get(id);
        if(!support) continue;
        support.type = select.value;
        if(pos && finite(pos.value)) support.position = num(pos.value);
        if(settlement && finite(settlement.value)) support.settlement = num(settlement.value);
      }
    }finally{
      syncing = false;
    }
  }

  function renumberSupportRows(){
    const tbody = $('#supportRows');
    if(!tbody) return;
    const rows = $$('#supportRows tr');
    rows.sort((a,b)=>{
      const pa = num(a.querySelector('input[data-k="position"]')?.value);
      const pb = num(b.querySelector('input[data-k="position"]')?.value);
      return (finite(pa)?pa:Infinity) - (finite(pb)?pb:Infinity);
    }).forEach(row=>tbody.appendChild(row));

    $$('#supportRows tr').forEach((row,index)=>{
      const first = row.children[0];
      if(first) first.textContent = String(index+1);
    });
  }

  function bindSupportRows(){
    const supports = (typeof model !== 'undefined' && Array.isArray(model.supports)) ? model.supports : [];
    $$('#supportRows select[data-k="type"]').forEach(select=>{
      const support = supports.find(s=>String(s.id)===String(select.dataset.sup));
      ensureOption(select,support);
    });

    // Replace the base support handlers with one canonical handler. It writes
    // the selected type to the same model that the solver and beam renderer use.
    $$('#supportRows select[data-k="type"],#supportRows input[data-k="position"],#supportRows input[data-k="settlement"]').forEach(control=>{
      const id = String(control.dataset.sup || '');
      control.onchange = () => {
        if(syncing || typeof mutate !== 'function' || typeof model === 'undefined') return;
        const support = model.supports.find(s=>String(s.id)===id);
        if(!support) return;
        mutate(()=>{
          if(control.dataset.k==='type') support.type = control.value;
          else if(finite(control.value)) support[control.dataset.k] = num(control.value);
        });
      };
    });
  }

  window.renderInputs = function(){
    originalRenderInputs();
    normalizeSupportOrder();

    const supports = (typeof model !== 'undefined' && Array.isArray(model.supports)) ? model.supports : [];
    $$('#supportRows select[data-k="type"]').forEach(select=>{
      const support = supports.find(s=>String(s.id)===String(select.dataset.sup));
      ensureOption(select,support);
    });

    renumberSupportRows();
    bindSupportRows();
  };

  function beamGeometry(){
    const svg = $('#beamCanvas svg');
    const beam = svg?.querySelector('.beamLine');
    if(!svg || !beam) return null;
    const x1 = num(beam.getAttribute('x1'));
    const x2 = num(beam.getAttribute('x2'));
    const y = num(beam.getAttribute('y1'));
    const total = typeof len === 'function' ? num(len()) : 0;
    if(!finite(x1)||!finite(x2)||!finite(y)||!(total>0)) return null;
    return {svg,x1,x2,y,total,xFor:p=>x1+(num(p)/total)*(x2-x1)};
  }

  function removeSupportGraphics(svg, id, expectedX){
    svg.querySelectorAll('g.supportDrag').forEach(group=>{
      const gid = String(group.getAttribute('data-id') || '');
      if(gid===String(id)) group.remove();
    });

    // Defensive fallback for stale support IDs: remove a support group whose
    // numbered badge lies at the same beam coordinate.
    if(!finite(expectedX)) return;
    svg.querySelectorAll('g.supportDrag').forEach(group=>{
      const badge = group.querySelector('.supportBadge');
      if(!badge) return;
      const cx = num(badge.getAttribute('cx'));
      if(finite(cx) && near(cx,expectedX)) group.remove();
    });
  }

  function patchHingeGraphics(){
    const geo = beamGeometry();
    if(!geo || typeof model === 'undefined' || !Array.isArray(model.supports)) return;

    // Read the actual visible support rows before deciding what the beam should
    // show. This prevents stale model/UI state from reintroducing a Pin.
    syncModelFromRows();
    normalizeSupportOrder();

    geo.svg.querySelectorAll('.canonicalInternalHinge').forEach(g=>g.remove());

    const hinges = model.supports.filter(s=>s && s.type==='internal-hinge' && finite(s.position));
    const hingeIndex = new Map(hinges.map((s,i)=>[String(s.id),i+1]));

    // Remove every normal support graphic for hinge supports.
    hinges.forEach(s=>removeSupportGraphics(geo.svg,s.id,geo.xFor(s.position)));

    // Rebuild only the true internal-hinge symbol at the exact beam coordinate.
    hinges.forEach(s=>{
      const x = geo.xFor(Math.max(0,Math.min(geo.total,s.position)));
      const g = document.createElementNS(NS,'g');
      g.setAttribute('class','canonicalInternalHinge');
      g.setAttribute('pointer-events','none');

      const circle = document.createElementNS(NS,'circle');
      circle.setAttribute('cx',String(x));
      circle.setAttribute('cy',String(geo.y));
      circle.setAttribute('r','8.5');
      circle.setAttribute('fill','var(--card,#fff)');
      circle.setAttribute('stroke','var(--text,#20252b)');
      circle.setAttribute('stroke-width','2');
      circle.setAttribute('vector-effect','non-scaling-stroke');
      g.appendChild(circle);

      const n = hingeIndex.get(String(s.id)) || 1;
      const label = document.createElementNS(NS,'text');
      label.setAttribute('x',String(x));
      label.setAttribute('y',String(geo.y+45));
      label.setAttribute('text-anchor','middle');
      label.setAttribute('class','supportText');
      label.textContent = `H${n} (Internal Hinge)`;
      g.appendChild(label);

      const position = document.createElementNS(NS,'text');
      position.setAttribute('x',String(x));
      position.setAttribute('y',String(geo.y+62));
      position.setAttribute('text-anchor','middle');
      position.setAttribute('class','dimText');
      position.textContent = `@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;
      g.appendChild(position);

      geo.svg.appendChild(g);
    });
  }

  window.renderBeam = function(){
    // Make the live UI authoritative before the base renderer reads model.
    syncModelFromRows();
    normalizeSupportOrder();
    originalRenderBeam();
    patchHingeGraphics();
  };

  // Initial pass after app.js has created the DOM.
  normalizeSupportOrder();
  requestAnimationFrame(()=>{
    if(typeof window.renderInputs==='function') window.renderInputs();
    if(typeof window.renderBeam==='function') window.renderBeam();
  });
})();

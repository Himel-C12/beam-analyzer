(function(){
  'use strict';

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const STORAGE = 'ba-model';
  const NS = 'http://www.w3.org/2000/svg';

  function savedModel(){
    try { return JSON.parse(localStorage.getItem(STORAGE) || 'null'); }
    catch { return null; }
  }

  function addOptions(){
    $$('#supportRows select[data-k="type"]').forEach(sel => {
      if(!sel.querySelector('option[value="internal-hinge"]')){
        const o = document.createElement('option');
        o.value = 'internal-hinge';
        o.textContent = 'Internal Hinge';
        sel.appendChild(o);
      }
    });
  }

  function positionFor(id){
    const m = savedModel();
    const s = m?.supports?.find(x => String(x.id) === String(id));
    return s?.position ?? '';
  }

  function isHinge(id){
    const m = savedModel();
    const s = m?.supports?.find(x => String(x.id) === String(id));
    return s?.type === 'internal-hinge';
  }

  function drawHinges(){
    addOptions();

    const svg = $('#beamCanvas svg');
    const beam = svg?.querySelector('.beamLine');
    if(!svg || !beam) return;

    const by = Number(beam.getAttribute('y1'));
    if(!Number.isFinite(by)) return;

    $$('#supportRows select[data-k="type"]').forEach(sel => {
      const id = sel.dataset.sup;
      if(sel.value !== 'internal-hinge' || !isHinge(id)) return;

      const g = svg.querySelector(`g.supportDrag[data-id="${CSS.escape(String(id))}"]`);
      if(!g) return;

      const old = g.querySelector('.supportBadge');
      const x = Number(old?.getAttribute('cx'));
      if(!Number.isFinite(x)) return;

      // Replace the normal pin/roller drawing with the standard open-circle
      // internal-hinge symbol. The circle sits directly on the beam line.
      g.innerHTML = '';
      g.classList.add('internal-hinge-native');
      g.setAttribute('data-internal-hinge','true');

      const circle = document.createElementNS(NS,'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', by);
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', 'var(--card, #17191d)');
      circle.setAttribute('stroke', 'var(--text, #d7dbe2)');
      circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('vector-effect', 'non-scaling-stroke');
      circle.setAttribute('class', 'internal-hinge-symbol');
      g.appendChild(circle);

      const number = document.createElementNS(NS,'text');
      number.setAttribute('x', x);
      number.setAttribute('y', by - 18);
      number.setAttribute('text-anchor', 'middle');
      number.setAttribute('class', 'internal-hinge-number');
      number.textContent = id;
      g.appendChild(number);

      const pos = positionFor(id);
      const name = document.createElementNS(NS,'text');
      name.setAttribute('x', x);
      name.setAttribute('y', by + 45);
      name.setAttribute('text-anchor', 'middle');
      name.setAttribute('class', 'internal-hinge-label');
      name.textContent = `Internal Hinge · ${pos} m`;
      g.appendChild(name);
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    #supportRows select[data-k="type"]{min-width:138px}
    #supportRows input[data-k="settlement"]:disabled{opacity:.45;cursor:not-allowed}
    #beamCanvas .internal-hinge-native{cursor:grab}
    #beamCanvas .internal-hinge-native:active{cursor:grabbing}
    #beamCanvas .internal-hinge-symbol{pointer-events:none}
    #beamCanvas .internal-hinge-number{fill:var(--muted,#8b93a1);font:600 10px Inter,system-ui,sans-serif;pointer-events:none}
    #beamCanvas .internal-hinge-label{fill:var(--text,#f2f4f7);font:600 12px Inter,system-ui,sans-serif;pointer-events:none}
  `;
  document.head.appendChild(style);

  let queued = false;
  function schedule(){
    if(queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; drawHinges(); });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('change', e => {
    if(e.target.matches?.('#supportRows select[data-k="type"], #supportRows input[data-k="position"]')) schedule();
  });

  [0,100,300,700,1200].forEach(t => setTimeout(schedule,t));
})();

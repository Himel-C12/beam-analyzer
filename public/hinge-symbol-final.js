(function(){
  'use strict';

  // FINAL VISUAL OVERRIDE: internal hinges are drawn here, directly in the
  // beam SVG. No solver/calculation code is touched.
  const NS='http://www.w3.org/2000/svg';
  const BG='var(--card,#17191d)';
  const FG='var(--text,#d7dbe2)';

  function model(){
    try{return JSON.parse(localStorage.getItem('ba-model')||'null')||{};}
    catch{return {};}
  }
  function hingeIds(){
    return new Set((model().supports||[]).filter(s=>s.type==='internal-hinge').map(s=>String(s.id)));
  }
  function patch(){
    const svg=document.querySelector('#beamCanvas svg');
    const beam=svg?.querySelector('.beamLine');
    if(!svg||!beam)return;
    const y=Number(beam.getAttribute('y1'));
    if(!Number.isFinite(y))return;
    const ids=hingeIds();

    svg.querySelectorAll('g.supportDrag[data-id]').forEach(g=>{
      const id=String(g.getAttribute('data-id'));
      if(!ids.has(id))return;

      const badge=g.querySelector('.supportBadge');
      const x=Number(badge?.getAttribute('cx'));
      if(!Number.isFinite(x))return;

      // Remove every existing support graphic. This prevents the normal
      // pin/roller triangle from ever being visible for an internal hinge.
      g.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector').forEach(el=>el.remove());

      // Reuse the existing badge as the actual hinge symbol.
      if(badge){
        badge.setAttribute('cx',String(x));
        badge.setAttribute('cy',String(y));
        badge.setAttribute('r','9');
        badge.setAttribute('fill',BG);
        badge.setAttribute('stroke',FG);
        badge.setAttribute('stroke-width','2.5');
        badge.setAttribute('vector-effect','non-scaling-stroke');
        badge.style.display='block';
        badge.classList.add('final-internal-hinge');
      }

      const number=g.querySelector('.supportNumber');
      if(number)number.style.display='none';

      const label=g.querySelector('.supportText');
      const s=(model().supports||[]).find(v=>String(v.id)===id);
      if(label&&s){
        label.textContent=`Internal Hinge · ${s.position} ${model().units==='imperial'?'ft':'m'}`;
      }
    });
  }

  const style=document.createElement('style');
  style.textContent='#beamCanvas .final-internal-hinge{pointer-events:none}';
  document.head.appendChild(style);

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;patch();});
  }

  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{
    if(e.target.matches?.('#supportRows select[data-k="type"],#supportRows input[data-k="position"]'))schedule();
  });
  window.addEventListener('load',schedule);
  [0,50,150,300,600,1000,2000,4000].forEach(t=>setTimeout(schedule,t));
})();

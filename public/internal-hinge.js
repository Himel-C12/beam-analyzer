(function(){
  'use strict';

  // UI-only fix for the internal-hinge symbol.
  // The calculation engine is intentionally untouched.
  function modelNow(){
    try{return JSON.parse(localStorage.getItem('ba-model')||'null');}
    catch{return null;}
  }

  function addHingeOption(){
    document.querySelectorAll('#supportRows select[data-k="type"]').forEach(sel=>{
      if(!sel.querySelector('option[value="internal-hinge"]')){
        const o=document.createElement('option');
        o.value='internal-hinge';
        o.textContent='Internal Hinge';
        sel.appendChild(o);
      }
      const m=modelNow();
      const s=m?.supports?.find(x=>String(x.id)===String(sel.dataset.sup));
      if(s)sel.value=s.type;
    });
  }

  function patch(){
    addHingeOption();
    const svg=document.querySelector('#beamCanvas svg');
    const beam=svg?.querySelector('.beamLine');
    if(!svg||!beam)return;

    const y=Number(beam.getAttribute('y1'));
    if(!Number.isFinite(y))return;

    const model=modelNow();
    (model?.supports||[]).filter(s=>s.type==='internal-hinge').forEach(s=>{
      const g=svg.querySelector(`g.supportDrag[data-id="${CSS.escape(String(s.id))}"]`);
      if(!g)return;

      // Remove the normal support geometry only for this support.
      g.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector').forEach(el=>el.remove());

      // Reuse the existing draggable badge as the hinge symbol.
      const badge=g.querySelector('.supportBadge');
      if(badge){
        badge.setAttribute('cx',badge.getAttribute('cx')||'0');
        badge.setAttribute('cy',String(y));
        badge.setAttribute('r','9');
        badge.setAttribute('fill','var(--card,#17191d)');
        badge.setAttribute('stroke','var(--text,#d7dbe2)');
        badge.setAttribute('stroke-width','2.5');
        badge.style.pointerEvents='none';
      }

      const number=g.querySelector('.supportNumber');
      if(number)number.remove();

      const label=g.querySelector('.supportText');
      if(label){
        const u=model?.units==='imperial'?'ft':'m';
        label.textContent=`Internal Hinge · ${s.position} ${u}`;
      }
    });
  }

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

  [0,50,150,300,600,1000,1500].forEach(t=>setTimeout(schedule,t));
})();

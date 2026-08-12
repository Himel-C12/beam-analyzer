/* Beam Analyzer — hard visual fix for internal hinges.
 * DOM/SVG only. Solver/model data is untouched.
 */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const root=()=>document.querySelector('#beamCanvas');
  const num=v=>Number(v);
  const esc=v=>CSS.escape(String(v));

  function hingeRows(){
    return [...document.querySelectorAll('#supportRows select[data-sup][data-k="type"]')]
      .filter(s=>s.value==='internal-hinge').map(s=>String(s.dataset.sup));
  }

  function fix(){
    const svg=root()?.querySelector('svg');
    if(!svg)return;
    const ids=hingeRows();
    if(!ids.length){svg.querySelectorAll('.hardInternalHinge').forEach(e=>e.remove());return;}

    ids.forEach((id,index)=>{
      const group=svg.querySelector(`g.supportDrag[data-id="${esc(id)}"]`);
      if(!group)return;

      // Capture the native support's beam coordinate before removing it.
      const oldBadge=group.querySelector('.supportBadge');
      const x=num(oldBadge?.getAttribute('cx'));
      const y=num(oldBadge?.getAttribute('cy'))+4;
      if(!Number.isFinite(x)||!Number.isFinite(y))return;

      // Remove the legacy support graphic itself. No covering/overlaying.
      group.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector,.supportBadge,.supportNumber,.supportText').forEach(e=>e.remove());

      let hinge=group.querySelector('.hardInternalHinge');
      if(!hinge){
        hinge=document.createElementNS(NS,'g');
        hinge.setAttribute('class','hardInternalHinge');
        hinge.setAttribute('pointer-events','none');
        group.appendChild(hinge);
      }

      // Idempotent: once the new symbol exists, do not mutate it on every
      // MutationObserver pass. This prevents an observer feedback loop.
      if(!hinge.querySelector('.hardHingeOuter')){
        const outer=document.createElementNS(NS,'circle');
        outer.setAttribute('class','hardHingeOuter');outer.setAttribute('cx',x);outer.setAttribute('cy',y);outer.setAttribute('r','10');
        outer.setAttribute('fill','var(--card,#171a1f)');outer.setAttribute('stroke','currentColor');outer.setAttribute('stroke-width','2.5');
        hinge.appendChild(outer);
        const inner=document.createElementNS(NS,'circle');
        inner.setAttribute('cx',x);inner.setAttribute('cy',y);inner.setAttribute('r','4.5');inner.setAttribute('fill','none');inner.setAttribute('stroke','currentColor');inner.setAttribute('stroke-width','2');
        hinge.appendChild(inner);
        const label=document.createElementNS(NS,'text');
        label.setAttribute('x',x);label.setAttribute('y',y+40);label.setAttribute('text-anchor','middle');label.setAttribute('class','hardHingeLabel');
        label.textContent=`H${index+1} (Internal Hinge)`;hinge.appendChild(label);
        const pos=document.createElementNS(NS,'text');
        pos.setAttribute('x',x);pos.setAttribute('y',y+56);pos.setAttribute('text-anchor','middle');pos.setAttribute('class','hardHingePos');
        const input=document.querySelector(`#supportRows select[data-sup="${esc(id)}"]`)?.parentElement?.parentElement?.querySelector('input[data-k="position"]');
        pos.textContent=`@ ${input?.value ?? ''} ${typeof unitText==='function'?unitText('length'):''}`.trim();hinge.appendChild(pos);
      }
    });
  }

  const run=()=>{try{fix()}catch(e){console.warn('Internal hinge hardfix:',e)}};
  const canvas=root();if(canvas)new MutationObserver(run).observe(canvas,{childList:true,subtree:true});
  const rows=document.querySelector('#supportRows');if(rows)new MutationObserver(run).observe(rows,{childList:true,subtree:true,attributes:true});
  run();[50,150,300,600,1000,2000,4000].forEach(ms=>setTimeout(run,ms));
})();

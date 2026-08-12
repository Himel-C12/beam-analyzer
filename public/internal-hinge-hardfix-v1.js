/* Beam Analyzer — hard visual fix for internal hinges.
 * This intentionally uses only rendered DOM/SVG and the Support table.
 * It does NOT depend on the app's lexical `model` variable and does NOT
 * modify solver data.
 */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const root=()=>document.querySelector('#beamCanvas');
  const num=v=>Number(v);

  function hingeRows(){
    return [...document.querySelectorAll('#supportRows select[data-sup][data-k="type"]')]
      .filter(s=>s.value==='internal-hinge')
      .map(s=>String(s.dataset.sup));
  }

  function fix(){
    const canvas=root(),svg=canvas?.querySelector('svg');
    if(!svg)return;
    const ids=hingeRows();
    if(!ids.length){svg.querySelectorAll('.hardInternalHinge').forEach(e=>e.remove());return;}

    ids.forEach((id,index)=>{
      const group=svg.querySelector(`g.supportDrag[data-id="${CSS.escape(id)}"]`);
      if(!group)return;
      const badge=group.querySelector('.supportBadge');
      const x=num(badge?.getAttribute('cx'));
      const y=num(badge?.getAttribute('cy'))+4;
      if(!Number.isFinite(x)||!Number.isFinite(y))return;

      // Remove the original support graphic completely. This is the source
      // of the confusing pin triangle.
      group.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector,.supportBadge,.supportNumber,.supportText').forEach(e=>e.remove());

      let hinge=group.querySelector('.hardInternalHinge');
      if(!hinge){
        hinge=document.createElementNS(NS,'g');
        hinge.setAttribute('class','hardInternalHinge');
        hinge.setAttribute('pointer-events','none');
        group.appendChild(hinge);
      }else hinge.replaceChildren();

      const outer=document.createElementNS(NS,'circle');
      outer.setAttribute('cx',x);outer.setAttribute('cy',y);outer.setAttribute('r','10');
      outer.setAttribute('fill','var(--card,#171a1f)');outer.setAttribute('stroke','currentColor');outer.setAttribute('stroke-width','2.5');
      hinge.appendChild(outer);
      const inner=document.createElementNS(NS,'circle');
      inner.setAttribute('cx',x);inner.setAttribute('cy',y);inner.setAttribute('r','4.5');
      inner.setAttribute('fill','none');inner.setAttribute('stroke','currentColor');inner.setAttribute('stroke-width','2');
      hinge.appendChild(inner);

      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',x);label.setAttribute('y',y+40);label.setAttribute('text-anchor','middle');
      label.setAttribute('class','hardHingeLabel');
      label.textContent=`H${index+1} (Internal Hinge)`;
      hinge.appendChild(label);
      const pos=document.createElementNS(NS,'text');
      pos.setAttribute('x',x);pos.setAttribute('y',y+56);pos.setAttribute('text-anchor','middle');
      pos.setAttribute('class','hardHingePos');
      const input=document.querySelector(`#supportRows select[data-sup="${CSS.escape(id)}"]`)?.parentElement?.parentElement?.querySelector('input[data-k="position"]');
      pos.textContent=`@ ${input?.value ?? ''} ${typeof unitText==='function'?unitText('length'):''}`.trim();
      hinge.appendChild(pos);
    });

    // Hide any old loose labels at the same support x-coordinate.
    svg.querySelectorAll('text.supportText').forEach(t=>{
      const x=num(t.getAttribute('x'));
      ids.forEach(id=>{
        const g=svg.querySelector(`g.supportDrag[data-id="${CSS.escape(id)}"]`),b=g?.querySelector('.hardInternalHinge circle');
        if(b&&Math.abs(x-num(b.getAttribute('cx')))<1)t.remove();
      });
    });
  }

  function run(){
    try{fix()}catch(e){console.warn('Internal hinge hardfix:',e)}
  }
  const canvas=root();
  if(canvas)new MutationObserver(run).observe(canvas,{childList:true,subtree:true});
  const rows=document.querySelector('#supportRows');
  if(rows)new MutationObserver(run).observe(rows,{childList:true,subtree:true,attributes:true});
  run();
  [50,150,300,600,1000,2000,4000].forEach(ms=>setTimeout(run,ms));
})();

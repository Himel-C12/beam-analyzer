/* Beam Analyzer — final internal-hinge visual renderer v3.
 * Loaded LAST so no later renderer can overwrite the hinge symbol.
 * Calculation data is untouched.
 */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const $=s=>document.querySelector(s);
  const n=v=>Number(v);
  const near=(a,b,t=1.5)=>Number.isFinite(n(a))&&Math.abs(n(a)-n(b))<=t;

  function model(){
    return (typeof window.model!=='undefined' && window.model && Array.isArray(window.model.supports)) ? window.model : null;
  }

  function getGeometry(svg){
    const beam=svg&&svg.querySelector('.beamLine');
    if(!beam)return null;
    const x1=n(beam.getAttribute('x1')),x2=n(beam.getAttribute('x2')),y=n(beam.getAttribute('y1'));
    const total=typeof window.len==='function'?n(window.len()):0;
    if(![x1,x2,y,total].every(Number.isFinite)||!(total>0))return null;
    return {beam,x1,x2,y,total};
  }

  function removeNativeSupportAt(svg,x){
    // Current renderer uses supportDrag/supportBadge. Keep several selectors
    // because older visual patches used slightly different wrappers.
    svg.querySelectorAll('g.supportDrag,g.supportGroup,g[data-support-id],g[data-id]').forEach(g=>{
      const badge=g.querySelector('.supportBadge');
      const candidates=[badge?.getAttribute('cx'),g.getAttribute('data-x'),g.getAttribute('cx')];
      if(candidates.some(v=>near(v,x)))g.remove();
    });
    svg.querySelectorAll('.supportBadge').forEach(c=>{
      if(near(c.getAttribute('cx'),x))c.closest('g')?.remove();
    });
    svg.querySelectorAll('text.supportText').forEach(t=>{
      if(near(t.getAttribute('x'),x))t.remove();
    });
  }

  function draw(svg,x,y,index,position){
    const g=document.createElementNS(NS,'g');
    g.setAttribute('class','finalInternalHinge');
    g.setAttribute('pointer-events','none');
    g.setAttribute('aria-label',`Internal Hinge H${index}`);

    // Two concentric circles are the standard visual cue for a rotational
    // release and are deliberately unlike the triangular pin-support symbol.
    const outer=document.createElementNS(NS,'circle');
    outer.setAttribute('cx',x);outer.setAttribute('cy',y);outer.setAttribute('r','11');
    outer.setAttribute('fill','#171a1f');outer.setAttribute('stroke','#f5f7fa');outer.setAttribute('stroke-width','2.2');
    g.appendChild(outer);
    const inner=document.createElementNS(NS,'circle');
    inner.setAttribute('cx',x);inner.setAttribute('cy',y);inner.setAttribute('r','6');
    inner.setAttribute('fill','none');inner.setAttribute('stroke','#f5f7fa');inner.setAttribute('stroke-width','1.8');
    g.appendChild(inner);

    const label=document.createElementNS(NS,'text');
    label.setAttribute('x',x);label.setAttribute('y',y-34);label.setAttribute('text-anchor','middle');
    label.setAttribute('fill','#35d58a');label.setAttribute('font-size','14');label.setAttribute('font-weight','700');
    label.textContent='Internal Hinge';g.appendChild(label);

    const id=document.createElementNS(NS,'text');
    id.setAttribute('x',x);id.setAttribute('y',y+39);id.setAttribute('text-anchor','middle');
    id.setAttribute('fill','#f5f7fa');id.setAttribute('font-size','13');id.setAttribute('font-weight','600');
    id.textContent=`H${index}`;g.appendChild(id);

    const pos=document.createElementNS(NS,'text');
    pos.setAttribute('x',x);pos.setAttribute('y',y+56);pos.setAttribute('text-anchor','middle');
    pos.setAttribute('fill','#9da7b3');pos.setAttribute('font-size','11');
    const unit=typeof window.unitText==='function'?window.unitText('length'):'';
    const value=typeof window.fmt==='function'?window.fmt(position):position;
    pos.textContent=`@ ${value} ${unit}`.trim();g.appendChild(pos);

    svg.appendChild(g);
  }

  function repair(){
    const m=model(),svg=$('#beamCanvas svg'),geo=getGeometry(svg);
    if(!m||!svg||!geo)return;
    svg.querySelectorAll('.finalInternalHinge').forEach(e=>e.remove());
    const hinges=m.supports.filter(s=>s&&s.type==='internal-hinge'&&Number.isFinite(n(s.position)))
      .sort((a,b)=>n(a.position)-n(b.position));
    hinges.forEach((s,i)=>{
      const x=geo.x1+(Math.max(0,Math.min(geo.total,n(s.position)))/geo.total)*(geo.x2-geo.x1);
      removeNativeSupportAt(svg,x);
      draw(svg,x,geo.y,i+1,n(s.position));
    });
  }

  function schedule(){requestAnimationFrame(()=>requestAnimationFrame(repair));}
  const canvas=$('#beamCanvas');
  if(canvas){
    let queued=false;
    const obs=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;repair();});});
    obs.observe(canvas,{childList:true,subtree:true});
  }
  const rows=$('#supportRows');
  if(rows){
    const obs=new MutationObserver(schedule);obs.observe(rows,{childList:true,subtree:true});
  }
  schedule();
  setTimeout(repair,100);setTimeout(repair,300);setTimeout(repair,700);
})();

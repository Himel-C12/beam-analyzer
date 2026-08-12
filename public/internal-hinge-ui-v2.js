/* Beam Analyzer — authoritative internal-hinge UI repair.
 * The base renderer does not know the custom support type, so it can draw
 * an internal hinge as a Pin. This script repairs the final SVG after every
 * render and keeps the support table option/value synchronized.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const NS='http://www.w3.org/2000/svg';
  const n=v=>Number(v), EPS=1e-9;
  const near=(a,b)=>Math.abs(n(a)-n(b))<=1e-6;

  function getModel(){
    return (typeof model!=='undefined'&&model&&Array.isArray(model.supports))?model:null;
  }

  function ensureSupportOptions(){
    const m=getModel(); if(!m)return;
    const byId=new Map(m.supports.map(s=>[String(s.id),s]));
    $$('#supportRows tr').forEach((row,i)=>{
      const sel=row.querySelector('select[data-k="type"]'); if(!sel)return;
      const sup=byId.get(String(sel.dataset.sup)); if(!sup)return;
      let opt=sel.querySelector('option[value="internal-hinge"]');
      if(!opt){
        opt=document.createElement('option');
        opt.value='internal-hinge';
        opt.textContent='Internal Hinge';
        sel.appendChild(opt);
      }
      sel.value=sup.type;
      if(row.children[0])row.children[0].textContent=String(i+1);
    });
  }

  function addHinge(svg,x,y,index,position){
    const g=document.createElementNS(NS,'g');
    g.setAttribute('class','authoritativeInternalHinge');
    g.setAttribute('pointer-events','none');

    const c=document.createElementNS(NS,'circle');
    c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r','8.5');
    c.setAttribute('fill','var(--card,#111519)');
    c.setAttribute('stroke','var(--text,#fff)'); c.setAttribute('stroke-width','2');
    g.appendChild(c);

    const label=document.createElementNS(NS,'text');
    label.setAttribute('x',x); label.setAttribute('y',y+45);
    label.setAttribute('text-anchor','middle'); label.setAttribute('class','supportText');
    label.textContent=`H${index} (Internal Hinge)`;
    g.appendChild(label);

    const pos=document.createElementNS(NS,'text');
    pos.setAttribute('x',x); pos.setAttribute('y',y+62);
    pos.setAttribute('text-anchor','middle'); pos.setAttribute('class','dimText');
    pos.textContent=`@ ${typeof fmt==='function'?fmt(position):position} ${typeof unitText==='function'?unitText('length'):''}`;
    g.appendChild(pos);
    svg.appendChild(g);
  }

  function repair(){
    ensureSupportOptions();
    const m=getModel(), svg=$('#beamCanvas svg'), beam=svg?.querySelector('.beamLine');
    if(!m||!svg||!beam)return;

    svg.querySelectorAll('.authoritativeInternalHinge').forEach(g=>g.remove());

    const x1=n(beam.getAttribute('x1')),x2=n(beam.getAttribute('x2')),y=n(beam.getAttribute('y1'));
    const total=typeof len==='function'?n(len()):0;
    if(!Number.isFinite(x1)||!Number.isFinite(x2)||!Number.isFinite(y)||!(total>0))return;

    const hinges=m.supports.filter(s=>s&&s.type==='internal-hinge'&&Number.isFinite(n(s.position)))
      .sort((a,b)=>n(a.position)-n(b.position));

    hinges.forEach((s,i)=>{
      const x=x1+Math.max(0,Math.min(total,n(s.position)))/total*(x2-x1);

      // Remove every native support group and label at this coordinate. This
      // works even if the base renderer uses a different internal data-id.
      svg.querySelectorAll('g.supportDrag').forEach(g=>{
        const badge=g.querySelector('.supportBadge');
        const gx=badge?n(badge.getAttribute('cx')):NaN;
        const gid=g.getAttribute('data-id');
        if(String(gid)===String(s.id)||(Number.isFinite(gx)&&near(gx,x)))g.remove();
      });
      svg.querySelectorAll('text.supportText').forEach(t=>{
        const tx=n(t.getAttribute('x'));
        if(Number.isFinite(tx)&&near(tx,x))t.remove();
      });
      svg.querySelectorAll('circle.supportBadge').forEach(c=>{
        const cx=n(c.getAttribute('cx'));
        if(Number.isFinite(cx)&&near(cx,x))c.parentElement?.remove();
      });

      addHinge(svg,x,y,i+1,s.position);
    });
  }

  const baseRenderBeam=window.renderBeam;
  if(typeof baseRenderBeam==='function'){
    window.renderBeam=function(){
      baseRenderBeam();
      requestAnimationFrame(()=>requestAnimationFrame(repair));
    };
  }

  const baseRenderInputs=window.renderInputs;
  if(typeof baseRenderInputs==='function'){
    window.renderInputs=function(){
      baseRenderInputs();
      ensureSupportOptions();
      requestAnimationFrame(repair);
    };
  }

  const beamCanvas=$('#beamCanvas');
  if(beamCanvas){
    let raf=0;
    const observer=new MutationObserver(()=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;repair();});
    });
    observer.observe(beamCanvas,{childList:true,subtree:true});
  }

  const supportRows=$('#supportRows');
  if(supportRows){
    let raf=0;
    const observer=new MutationObserver(()=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;ensureSupportOptions();repair();});
    });
    observer.observe(supportRows,{childList:true,subtree:true});
  }

  const style=document.createElement('style');
  style.textContent='.authoritativeInternalHinge{pointer-events:none}.authoritativeInternalHinge circle{vector-effect:non-scaling-stroke}';
  document.head.appendChild(style);
  requestAnimationFrame(repair);
})();

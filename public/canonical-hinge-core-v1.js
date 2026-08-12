/* Beam Analyzer — canonical internal-hinge integration v2.
 * Internal hinge is one model state shared by input, beam graphics and solver.
 * Normal support graphics are removed by rendered position, not support id,
 * so stale/renumbered support rows cannot leave a Pin behind.
 */
(function(){
  'use strict';

  const originalRenderInputs=window.renderInputs;
  const originalRenderBeam=window.renderBeam;
  if(typeof originalRenderInputs!=='function'||typeof originalRenderBeam!=='function')return;

  const $$=s=>[...document.querySelectorAll(s)];
  const $=s=>document.querySelector(s);
  const NS='http://www.w3.org/2000/svg';
  const num=v=>Number(v);
  const finite=v=>Number.isFinite(num(v));
  const EPS=0.75;

  function supportForId(id){
    if(typeof model==='undefined'||!Array.isArray(model.supports))return null;
    return model.supports.find(s=>String(s.id)===String(id))||null;
  }

  function ensureHingeOption(sel,support){
    if(!sel)return;
    let opt=sel.querySelector('option[value="internal-hinge"]');
    if(!opt){
      opt=document.createElement('option');
      opt.value='internal-hinge';
      opt.textContent='Internal Hinge';
      sel.appendChild(opt);
    }
    if(support?.type==='internal-hinge')sel.value='internal-hinge';
  }

  function bindSupportInputs(){
    $$('#supportRows select[data-k="type"],#supportRows input[data-k="position"],#supportRows input[data-k="settlement"]').forEach(el=>{
      const id=el.dataset.sup;
      const support=supportForId(id);
      if(el.dataset.k==='type')ensureHingeOption(el,support);
      el.onchange=()=>{
        if(typeof mutate!=='function')return;
        const live=supportForId(id);
        if(!live)return;
        mutate(()=>{
          if(el.dataset.k==='type')live.type=el.value;
          else live[el.dataset.k]=num(el.value);
        });
      };
    });
  }

  window.renderInputs=function(){
    originalRenderInputs();
    $$('#supportRows select[data-k="type"]').forEach(sel=>ensureHingeOption(sel,supportForId(sel.dataset.sup)));
    bindSupportInputs();
  };

  function getHinges(){
    if(typeof model==='undefined'||!Array.isArray(model.supports))return[];
    return model.supports.filter(s=>s&&s.type==='internal-hinge'&&finite(s.position));
  }

  function removeSupportGraphicsAtX(svg,x){
    svg.querySelectorAll('g.supportDrag').forEach(g=>{
      const badge=g.querySelector('.supportBadge');
      const bx=badge?num(badge.getAttribute('cx')):NaN;
      if(finite(bx)&&Math.abs(bx-x)<=EPS)g.remove();
    });
  }

  function renameDimensionAtX(svg,x,label){
    svg.querySelectorAll('text.dimText').forEach(t=>{
      const tx=num(t.getAttribute('x'));
      if(finite(tx)&&Math.abs(tx-x)<=EPS){
        const text=(t.textContent||'').trim();
        if(/^S\d+\s*:/.test(text))t.textContent=text.replace(/^S\d+\s*:/,label+':');
        else if(/^S\d+$/.test(text))t.textContent=label;
      }
    });
  }

  function patchHingeGraphics(){
    const svg=$('#beamCanvas svg');
    if(!svg)return;
    svg.querySelectorAll('.canonicalInternalHinge').forEach(g=>g.remove());
    const beam=svg.querySelector('.beamLine');
    if(!beam)return;
    const bx1=num(beam.getAttribute('x1')),bx2=num(beam.getAttribute('x2')),by=num(beam.getAttribute('y1'));
    const total=typeof len==='function'?num(len()):0;
    if(!finite(bx1)||!finite(bx2)||!finite(by)||!(total>0))return;

    const hinges=getHinges();
    hinges.forEach((s,hi)=>{
      const x=bx1+Math.max(0,Math.min(total,num(s.position)))/total*(bx2-bx1);

      // Remove the original Pin/Roller/fixed group by rendered coordinate.
      removeSupportGraphicsAtX(svg,x);
      renameDimensionAtX(svg,x,`H${hi+1}`);

      // Remove stale text nodes belonging to the normal support at this x.
      svg.querySelectorAll('text.supportText').forEach(t=>{
        const tx=num(t.getAttribute('x'));
        if(finite(tx)&&Math.abs(tx-x)<=EPS)t.remove();
      });

      const g=document.createElementNS(NS,'g');
      g.setAttribute('class','canonicalInternalHinge');
      g.setAttribute('pointer-events','none');

      const circle=document.createElementNS(NS,'circle');
      circle.setAttribute('cx',String(x));
      circle.setAttribute('cy',String(by));
      circle.setAttribute('r','8.5');
      circle.setAttribute('fill','var(--card,#fff)');
      circle.setAttribute('stroke','var(--text,#20252b)');
      circle.setAttribute('stroke-width','2');
      circle.setAttribute('vector-effect','non-scaling-stroke');
      g.appendChild(circle);

      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',String(x));
      label.setAttribute('y',String(by+45));
      label.setAttribute('text-anchor','middle');
      label.setAttribute('fill','var(--text,#20252b)');
      label.setAttribute('font-size','12');
      label.setAttribute('font-weight','600');
      label.textContent=`H${hi+1} (Internal Hinge)`;
      g.appendChild(label);

      const position=document.createElementNS(NS,'text');
      position.setAttribute('x',String(x));
      position.setAttribute('y',String(by+62));
      position.setAttribute('text-anchor','middle');
      position.setAttribute('fill','var(--muted,#6b7280)');
      position.setAttribute('font-size','10');
      position.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;
      g.appendChild(position);

      svg.appendChild(g);
    });
  }

  window.renderBeam=function(){
    originalRenderBeam();
    requestAnimationFrame(patchHingeGraphics);
  };

  const canvas=$('#beamCanvas');
  if(canvas&&!canvas.__canonicalHingeObserver){
    const observer=new MutationObserver(()=>requestAnimationFrame(patchHingeGraphics));
    observer.observe(canvas,{childList:true,subtree:true});
    canvas.__canonicalHingeObserver=observer;
  }

  requestAnimationFrame(()=>{
    if(typeof window.renderInputs==='function')window.renderInputs();
    if(typeof window.renderBeam==='function')window.renderBeam();
  });
})();

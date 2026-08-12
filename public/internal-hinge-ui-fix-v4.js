/* Beam Analyzer — canonical Internal Hinge support UI.
   This runs LAST and owns only the Internal Hinge option + visual symbol.
*/
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const NS='http://www.w3.org/2000/svg';
  const num=v=>Number(v);

  function ensureOption(){
    $$('#supportRows select[data-k="type"]').forEach(sel=>{
      let opt=sel.querySelector('option[value="internal-hinge"]');
      if(!opt){
        opt=document.createElement('option');
        opt.value='internal-hinge';
        opt.textContent='Internal Hinge';
        sel.appendChild(opt);
      }
    });
  }

  function liveSupports(){
    return $$('#supportRows tr').map((tr,i)=>{
      const sel=tr.querySelector('select[data-k="type"]');
      const pos=tr.querySelector('input[data-k="position"]');
      if(!sel||!pos)return null;
      return {id:String(sel.dataset.sup||i+1),type:sel.value,position:num(pos.value)};
    }).filter(Boolean);
  }

  function renderHinges(){
    const svg=$('#beamCanvas svg');
    if(!svg)return;
    svg.querySelectorAll('.baCanonicalInternalHinge').forEach(g=>g.remove());
    const beam=svg.querySelector('.beamLine');
    if(!beam)return;
    const x1=num(beam.getAttribute('x1')),x2=num(beam.getAttribute('x2')),y=num(beam.getAttribute('y1'));
    const supports=liveSupports();
    const total=Math.max(...supports.map(s=>s.position),0);
    if(!Number.isFinite(total)||total<=0)return;

    supports.forEach((s,index)=>{
      if(s.type!=='internal-hinge')return;
      svg.querySelectorAll('g.supportDrag').forEach(g=>{
        if(String(g.getAttribute('data-id'))===s.id)g.remove();
      });
      const x=x1+(Math.max(0,Math.min(total,s.position))/total)*(x2-x1);
      const g=document.createElementNS(NS,'g');
      g.setAttribute('class','baCanonicalInternalHinge');
      g.setAttribute('pointer-events','none');
      const c=document.createElementNS(NS,'circle');
      c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','9');
      c.setAttribute('fill','var(--card,#fff)');c.setAttribute('stroke','var(--text,#20252b)');c.setAttribute('stroke-width','2');
      g.appendChild(c);
      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',x);label.setAttribute('y',y+45);label.setAttribute('text-anchor','middle');label.setAttribute('class','supportText');
      label.textContent=`H${index+1} (Internal Hinge) · ${s.position} m`;
      g.appendChild(label);
      svg.appendChild(g);
    });
  }

  function fix(){ensureOption();renderHinges();}
  fix();
  const root=document.body;
  if(root&&!root.__canonicalHingeFix){
    new MutationObserver(()=>{ensureOption();requestAnimationFrame(renderHinges)}).observe(root,{childList:true,subtree:true});
    root.__canonicalHingeFix=true;
  }
  setInterval(fix,250);
})();

/* Live bridge for the fresh internal-hinge engine.
 * Keeps the base app's rerenders from replacing a real hinge with a Pin.
 * No solver logic lives here.
 */
(function(){
  'use strict';

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const NS='http://www.w3.org/2000/svg';
  let running=false;

  function getModel(){return (typeof model!=='undefined'&&model&&Array.isArray(model.supports))?model:null;}

  function installSupportOptions(){
    const m=getModel();
    if(!m)return;
    const byId=new Map(m.supports.map(s=>[String(s.id),s]));
    $$('#supportRows tr').forEach((row,index)=>{
      const sel=row.querySelector('select[data-k="type"]');
      if(!sel)return;
      const s=byId.get(String(sel.dataset.sup));
      if(!s)return;
      let opt=sel.querySelector('option[value="internal-hinge"]');
      if(!opt){
        opt=document.createElement('option');
        opt.value='internal-hinge';
        opt.textContent='Internal Hinge';
        sel.appendChild(opt);
      }
      sel.value=s.type;
      if(row.children[0])row.children[0].textContent=String(index+1);
    });
  }

  function repairBeam(){
    if(running)return;
    const m=getModel(),svg=$('#beamCanvas svg'),beam=svg?.querySelector('.beamLine');
    if(!m||!svg||!beam)return;
    running=true;
    try{
      svg.querySelectorAll('.freshInternalHinge').forEach(g=>g.remove());
      const bx1=n(beam.getAttribute('x1')),bx2=n(beam.getAttribute('x2')),by=n(beam.getAttribute('y1'));
      const total=typeof len==='function'?n(len()):0;
      if(!finite(bx1)||!finite(bx2)||!finite(by)||!(total>0))return;

      const hinges=m.supports.filter(s=>s&&s.type==='internal-hinge'&&finite(s.position)).sort((a,b)=>n(a.position)-n(b.position));
      hinges.forEach((s,i)=>{
        const x=bx1+Math.max(0,Math.min(total,n(s.position)))/total*(bx2-bx1);

        svg.querySelectorAll('g.supportDrag').forEach(g=>{
          const badge=g.querySelector('.supportBadge');
          const gid=String(g.getAttribute('data-id')||'');
          const gx=badge?n(badge.getAttribute('cx')):NaN;
          if(gid===String(s.id)||(finite(gx)&&Math.abs(gx-x)<0.5))g.remove();
        });

        svg.querySelectorAll('text.supportText').forEach(t=>{
          const tx=n(t.getAttribute('x'));
          if(finite(tx)&&Math.abs(tx-x)<0.5)t.remove();
        });

        const g=document.createElementNS(NS,'g');
        g.setAttribute('class','freshInternalHinge');
        g.setAttribute('pointer-events','none');
        const c=document.createElementNS(NS,'circle');
        c.setAttribute('cx',String(x));
        c.setAttribute('cy',String(by));
        c.setAttribute('r','8.5');
        c.setAttribute('fill','var(--card,#fff)');
        c.setAttribute('stroke','var(--text,#20252b)');
        c.setAttribute('stroke-width','2');
        g.appendChild(c);
        const label=document.createElementNS(NS,'text');
        label.setAttribute('x',String(x));
        label.setAttribute('y',String(by+45));
        label.setAttribute('text-anchor','middle');
        label.setAttribute('class','supportText');
        label.textContent=`H${i+1} (Internal Hinge)`;
        g.appendChild(label);
        const pos=document.createElementNS(NS,'text');
        pos.setAttribute('x',String(x));
        pos.setAttribute('y',String(by+62));
        pos.setAttribute('text-anchor','middle');
        pos.setAttribute('class','dimText');
        pos.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;
        g.appendChild(pos);
        svg.appendChild(g);
      });
    }finally{
      running=false;
    }
  }

  function refresh(){
    installSupportOptions();
    repairBeam();
  }

  const supportRows=$('#supportRows');
  if(supportRows){
    const observer=new MutationObserver(()=>requestAnimationFrame(refresh));
    observer.observe(supportRows,{childList:true,subtree:true});
  }
  const beamCanvas=$('#beamCanvas');
  if(beamCanvas){
    const observer=new MutationObserver(()=>requestAnimationFrame(refresh));
    observer.observe(beamCanvas,{childList:true,subtree:true});
  }

  requestAnimationFrame(refresh);
})();

/* Beam Analyzer — canonical support renderer.
 * Loaded after app.js. Internal hinges are NOT supports visually:
 * they are only an open circle intersecting the beam.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const isHinge=s=>s&&s.type==='internal-hinge';

  function draw(){
    const canvas=$('#beamCanvas'),svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined'||!Array.isArray(model.supports))return;

    svg.querySelectorAll('.baCanonicalHinge').forEach(e=>e.remove());

    const beam=svg.querySelector('.beamLine');
    if(!beam)return;
    const bx1=n(beam.getAttribute('x1')),bx2=n(beam.getAttribute('x2')),by=n(beam.getAttribute('y1'));
    const total=Math.max(typeof len==='function'?n(len()):1,1);
    const xFor=p=>bx1+Math.max(0,Math.min(total,n(p)))/total*(bx2-bx1);
    const NS='http://www.w3.org/2000/svg';

    model.supports.filter(isHinge).forEach((s,i)=>{
      const id=String(s.id);

      // app.js creates every support as a pin/roller/fixed symbol. Remove
      // that entire group for an internal hinge before drawing anything.
      svg.querySelectorAll('g.supportDrag[data-id]').forEach(g=>{
        if(String(g.getAttribute('data-id'))===id)g.remove();
      });

      const x=xFor(s.position);
      const g=document.createElementNS(NS,'g');
      g.setAttribute('class','baCanonicalHinge');
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

      const name=document.createElementNS(NS,'text');
      name.setAttribute('x',String(x));
      name.setAttribute('y',String(by+45));
      name.setAttribute('text-anchor','middle');
      name.setAttribute('fill','var(--text,#20252b)');
      name.setAttribute('font-size','12');
      name.setAttribute('font-weight','600');
      name.textContent=`H${i+1} (Internal Hinge)`;
      g.appendChild(name);

      const pos=document.createElementNS(NS,'text');
      pos.setAttribute('x',String(x));
      pos.setAttribute('y',String(by+62));
      pos.setAttribute('text-anchor','middle');
      pos.setAttribute('fill','var(--muted,#6b7280)');
      pos.setAttribute('font-size','10');
      pos.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;
      g.appendChild(pos);

      svg.appendChild(g);
    });
  }

  function install(){
    const base=window.renderBeam;
    if(typeof base==='function'&&!base.__canonicalSupportRenderer){
      function wrapped(){base();requestAnimationFrame(draw)}
      wrapped.__canonicalSupportRenderer=true;
      window.renderBeam=wrapped;
    }
    const canvas=$('#beamCanvas');
    if(canvas&&!canvas.__canonicalSupportObserver){
      const observer=new MutationObserver(()=>requestAnimationFrame(draw));
      observer.observe(canvas,{childList:true,subtree:true});
      canvas.__canonicalSupportObserver=observer;
    }
    requestAnimationFrame(draw);
  }

  install();
  setTimeout(install,0);
  setTimeout(install,100);
})();

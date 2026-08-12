/* Internal hinge renderer v5: DOM-driven, independent of app.js globals. */
(function(){
'use strict';
const NS='http://www.w3.org/2000/svg';
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const n=v=>Number(v);
function modelHinges(){
 const rows=q('#supportRows'); if(!rows) return [];
 return qa('#supportRows tr').map((tr,i)=>{
   const type=tr.querySelector('select[data-k="type"]');
   const pos=tr.querySelector('input[data-k="position"]');
   if(!type||!pos||type.value!=='internal-hinge') return null;
   return {index:i+1,position:n(pos.value)};
 }).filter(x=>x&&Number.isFinite(x.position));
}
function repair(){
 const svg=q('#beamCanvas svg'), beam=svg&&svg.querySelector('.beamLine');
 if(!svg||!beam) return;
 const hinges=modelHinges();
 svg.querySelectorAll('.native-hinge-block-v5,.internal-hinge-v5').forEach(e=>e.remove());
 if(!hinges.length) return;
 const x1=n(beam.getAttribute('x1')),x2=n(beam.getAttribute('x2')),y=n(beam.getAttribute('y1'));
 const lengths=qa('#spanRows input[data-k="length"]').map(e=>n(e.value)).filter(Number.isFinite);
 const L=lengths.reduce((a,b)=>a+b,0);
 if(!(L>0)) return;
 hinges.forEach((h,hi)=>{
   const x=x1+(h.position/L)*(x2-x1);
   // Hide the actual native support group. This is intentionally done by
   // geometric position, so it does not depend on app.js/window.model.
   qa('g.supportDrag').forEach(g=>{
     const badge=g.querySelector('.supportBadge');
     if(badge && Math.abs(n(badge.getAttribute('cx'))-x)<3) g.classList.add('native-hinge-block-v5');
   });
   const blocker=document.createElementNS(NS,'g'); blocker.setAttribute('class','native-hinge-block-v5');
   blocker.style.display='none'; svg.appendChild(blocker);
   const g=document.createElementNS(NS,'g'); g.setAttribute('class','internal-hinge-v5'); g.setAttribute('pointer-events','none');
   const c1=document.createElementNS(NS,'circle'); c1.setAttribute('cx',x);c1.setAttribute('cy',y);c1.setAttribute('r',10);c1.setAttribute('fill','#171a1f');c1.setAttribute('stroke','#35d58a');c1.setAttribute('stroke-width','2.8');g.appendChild(c1);
   const c2=document.createElementNS(NS,'circle'); c2.setAttribute('cx',x);c2.setAttribute('cy',y);c2.setAttribute('r',4.5);c2.setAttribute('fill','none');c2.setAttribute('stroke','#35d58a');c2.setAttribute('stroke-width','2');g.appendChild(c2);
   const t=document.createElementNS(NS,'text');t.setAttribute('x',x);t.setAttribute('y',y+39);t.setAttribute('text-anchor','middle');t.setAttribute('fill','#111');t.setAttribute('font-size','13');t.setAttribute('font-weight','700');t.textContent=`H${hi+1} · Internal Hinge`;g.appendChild(t);
   const p=document.createElementNS(NS,'text');p.setAttribute('x',x);p.setAttribute('y',y+55);p.setAttribute('text-anchor','middle');p.setAttribute('fill','#555');p.setAttribute('font-size','11');p.textContent=`@ ${h.position} m`;g.appendChild(p);
   svg.appendChild(g);
   // Replace dimension text at this x.
   qa('text.dimText').forEach(d=>{if(Math.abs(n(d.getAttribute('x'))-x)<3 && /^S\d+\s*:/.test(d.textContent.trim())) d.textContent=d.textContent.trim().replace(/^S\d+\s*:/,`H${hi+1} :`);});
 });
}
const style=document.createElement('style');style.textContent='.beamCanvas g.native-hinge-block-v5{display:none!important}.beamCanvas g.internal-hinge-v5{display:inline!important}';document.head.appendChild(style);
const c=q('#beamCanvas'); if(c)new MutationObserver(()=>requestAnimationFrame(repair)).observe(c,{childList:true,subtree:true});
const r=q('#supportRows'); if(r)new MutationObserver(()=>requestAnimationFrame(repair)).observe(r,{childList:true,subtree:true});
[0,100,300,700,1500,3000].forEach(t=>setTimeout(repair,t));
})();

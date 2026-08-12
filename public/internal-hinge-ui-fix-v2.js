/* Beam Analyzer — internal hinge UI fix v2.
   The base app rebuilds support selects on every mutation and does not know
   the internal-hinge option. Restore the option and the saved model value
   after every rebuild so selecting Internal Hinge actually sticks.
*/
(function(){
  'use strict';
  const $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const NS='http://www.w3.org/2000/svg';
  function savedModel(){try{const m=JSON.parse(localStorage.getItem('ba-model')||'null');return m&&Array.isArray(m.supports)?m:null}catch{return null}}
  function ensure(){
    const m=savedModel();
    $$('#supportRows select[data-k="type"]').forEach(sel=>{
      if(!sel.querySelector('option[value="internal-hinge"]')){const o=document.createElement('option');o.value='internal-hinge';o.textContent='Internal Hinge';sel.appendChild(o)}
      const s=m?.supports?.find(x=>String(x.id)===String(sel.dataset.sup));
      if(s?.type==='internal-hinge')sel.value='internal-hinge';
    });
  }
  function overlay(){
    const svg=document.querySelector('#beamCanvas svg');if(!svg)return;
    svg.querySelectorAll('.baUiInternalHinge').forEach(e=>e.remove());
    const beam=svg.querySelector('.beamLine');if(!beam)return;
    const m=savedModel();if(!m)return;
    const x1=n(beam.getAttribute('x1')),x2=n(beam.getAttribute('x2')),y=n(beam.getAttribute('y1'));
    const L=m.spans?.reduce((a,s)=>a+n(s.length||0),0)||1;
    m.supports.filter(s=>s.type==='internal-hinge').forEach(s=>{
      const x=x1+(n(s.position)/L)*(x2-x1),g=document.createElementNS(NS,'g');g.setAttribute('class','baUiInternalHinge');g.setAttribute('pointer-events','none');
      const c=document.createElementNS(NS,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','9');c.setAttribute('fill','var(--card,#fff)');c.setAttribute('stroke','var(--text,#20252b)');c.setAttribute('stroke-width','2');g.appendChild(c);
      const t=document.createElementNS(NS,'text');t.setAttribute('x',x);t.setAttribute('y',y+45);t.setAttribute('text-anchor','middle');t.setAttribute('fill','var(--text,#20252b)');t.setAttribute('font-size','12');t.setAttribute('font-weight','600');t.textContent='H1 (Internal Hinge)';g.appendChild(t);svg.appendChild(g);
    });
  }
  function fix(){ensure();overlay()}
  function install(){fix();const rows=document.querySelector('#supportRows');if(rows&&!rows.__hingeFixV2){new MutationObserver(()=>requestAnimationFrame(fix)).observe(rows,{childList:true,subtree:true});rows.__hingeFixV2=true}const canvas=document.querySelector('#beamCanvas');if(canvas&&!canvas.__hingeCanvasFixV2){new MutationObserver(()=>requestAnimationFrame(fix)).observe(canvas,{childList:true,subtree:true});canvas.__hingeCanvasFixV2=true}}
  install();setInterval(fix,500);
})();

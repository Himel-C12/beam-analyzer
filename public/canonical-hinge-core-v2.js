/* Beam Analyzer — canonical support/hinge integration v2.
 * This file is loaded as a final guard. It keeps support input, beam graphics,
 * and internal-hinge state synchronized without changing the solver API.
 */
(function(){
  'use strict';
  const $$=s=>[...document.querySelectorAll(s)], $=s=>document.querySelector(s);
  const NS='http://www.w3.org/2000/svg', num=v=>Number(v), finite=v=>Number.isFinite(num(v));
  const near=(a,b)=>Math.abs(num(a)-num(b))<=1e-8*Math.max(1,Math.abs(num(a)),Math.abs(num(b)));
  let originalRenderInputs=window.renderInputs, originalRenderBeam=window.renderBeam, syncing=false;
  if(typeof originalRenderInputs!=='function'||typeof originalRenderBeam!=='function')return;

  function sortModel(){if(typeof model!=='undefined'&&Array.isArray(model.supports))model.supports.sort((a,b)=>num(a.position)-num(b.position));}
  function ensureOption(sel,s){if(!sel)return;let o=sel.querySelector('option[value="internal-hinge"]');if(!o){o=document.createElement('option');o.value='internal-hinge';o.textContent='Internal Hinge';sel.appendChild(o)}if(s)sel.value=s.type}
  function syncRows(){
    if(syncing||typeof model==='undefined'||!Array.isArray(model.supports))return;
    const map=new Map(model.supports.map(s=>[String(s.id),s])); syncing=true;
    try{$$('#supportRows tr').forEach(r=>{const sel=r.querySelector('select[data-k="type"]'),p=r.querySelector('input[data-k="position"]'),set=r.querySelector('input[data-k="settlement"]');if(!sel)return;const s=map.get(String(sel.dataset.sup));if(!s)return;s.type=sel.value;if(p&&finite(p.value))s.position=num(p.value);if(set&&finite(set.value))s.settlement=num(set.value)})}finally{syncing=false}
  }
  function rowsAfterRender(){
    sortModel(); const map=new Map(model.supports.map(s=>[String(s.id),s]));
    $$('#supportRows select[data-k="type"]').forEach(sel=>ensureOption(sel,map.get(String(sel.dataset.sup))));
    const tbody=$('#supportRows'); if(tbody){const rows=$$('#supportRows tr');rows.sort((a,b)=>num(a.querySelector('input[data-k="position"]')?.value)-num(b.querySelector('input[data-k="position"]')?.value)).forEach(r=>tbody.appendChild(r));rows.forEach((r,i)=>{if(r.children[0])r.children[0].textContent=String(i+1)})}
    $$('#supportRows select[data-k="type"],#supportRows input[data-k="position"],#supportRows input[data-k="settlement"]').forEach(el=>{const id=String(el.dataset.sup||'');el.onchange=()=>{if(syncing||typeof mutate!=='function')return;const s=model.supports.find(x=>String(x.id)===id);if(!s)return;mutate(()=>{if(el.dataset.k==='type')s.type=el.value;else if(finite(el.value))s[el.dataset.k]=num(el.value)})}})
  }
  window.renderInputs=function(){originalRenderInputs();rowsAfterRender()};

  function patchHinges(){
    syncRows();sortModel(); const svg=$('#beamCanvas svg'), beam=svg?.querySelector('.beamLine'); if(!svg||!beam)return;
    const x1=num(beam.getAttribute('x1')),x2=num(beam.getAttribute('x2')),y=num(beam.getAttribute('y1')),L=typeof len==='function'?num(len()):0;
    if(!finite(x1)||!finite(x2)||!finite(y)||!(L>0))return;
    svg.querySelectorAll('.canonicalInternalHinge').forEach(e=>e.remove());
    const hinges=model.supports.filter(s=>s.type==='internal-hinge'&&finite(s.position));
    hinges.forEach((s,i)=>{
      const x=x1+Math.max(0,Math.min(L,num(s.position)))/L*(x2-x1);
      svg.querySelectorAll('g.supportDrag').forEach(g=>{const id=String(g.getAttribute('data-id')||'');const badge=g.querySelector('.supportBadge');const bx=badge?num(badge.getAttribute('cx')):NaN;if(id===String(s.id)||(finite(bx)&&near(bx,x)))g.remove()});
      svg.querySelectorAll('text.supportText').forEach(t=>{const tx=num(t.getAttribute('x'));if(finite(tx)&&near(tx,x))t.remove()});
      const g=document.createElementNS(NS,'g');g.setAttribute('class','canonicalInternalHinge');g.setAttribute('pointer-events','none');
      const c=document.createElementNS(NS,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','8.5');c.setAttribute('fill','var(--card,#fff)');c.setAttribute('stroke','var(--text,#20252b)');c.setAttribute('stroke-width','2');g.appendChild(c);
      const t=document.createElementNS(NS,'text');t.setAttribute('x',x);t.setAttribute('y',y+45);t.setAttribute('text-anchor','middle');t.setAttribute('class','supportText');t.textContent=`H${i+1} (Internal Hinge)`;g.appendChild(t);
      const p=document.createElementNS(NS,'text');p.setAttribute('x',x);p.setAttribute('y',y+62);p.setAttribute('text-anchor','middle');p.setAttribute('class','dimText');p.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;g.appendChild(p);svg.appendChild(g);
    });
  }
  window.renderBeam=function(){syncRows();sortModel();originalRenderBeam();patchHinges()};
  requestAnimationFrame(()=>{if(typeof window.renderInputs==='function')window.renderInputs();if(typeof window.renderBeam==='function')window.renderBeam()});
})();

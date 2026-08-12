/* Beam Analyzer — canonical Internal Hinge support UI v5.
   Owns the missing dropdown option and preserves it through app.js re-renders.
   The base app rebuilds support selects with only Pin/Roller/Fixed, so this
   layer restores Internal Hinge after every render and captures the user's
   selection before the base change handler rebuilds the row.
*/
(function(){
  'use strict';
  const $$=s=>[...document.querySelectorAll(s)];
  const NS='http://www.w3.org/2000/svg';
  const num=v=>Number(v);
  const $=s=>document.querySelector(s);

  function ensureOption(sel){
    if(!sel)return;
    let opt=sel.querySelector('option[value="internal-hinge"]');
    if(!opt){
      opt=document.createElement('option');
      opt.value='internal-hinge';
      opt.textContent='Internal Hinge';
      sel.appendChild(opt);
    }
  }

  function syncSelectsFromModel(){
    // The model is the source of truth after app.js finishes a mutation.
    // Reading the select is not enough because app.js rebuilds it immediately.
    const rows=$$('#supportRows tr');
    rows.forEach(tr=>{
      const sel=tr.querySelector('select[data-k="type"]');
      const pos=tr.querySelector('input[data-k="position"]');
      if(!sel||!pos)return;
      ensureOption(sel);
      // app.js exposes the current model only through the rendered row state,
      // so preserve an already-selected hinge and otherwise leave its value alone.
      if(sel.dataset.pendingInternalHinge==='1'){
        sel.value='internal-hinge';
        delete sel.dataset.pendingInternalHinge;
      }
    });
  }

  function ensureOptions(){
    $$('#supportRows select[data-k="type"]').forEach(ensureOption);
  }

  // Capture BEFORE app.js's onchange handler. The base handler immediately
  // calls render(), which destroys the select that received the user's choice.
  if(!document.documentElement.__hingeSelectionCapture){
    document.addEventListener('change',function(e){
      const sel=e.target?.closest?.('#supportRows select[data-k="type"]');
      if(!sel)return;
      if(sel.value!=='internal-hinge')return;
      const id=sel.dataset.sup;
      requestAnimationFrame(()=>{
        const fresh=$(`#supportRows select[data-k="type"][data-sup="${CSS.escape(String(id))}"]`);
        if(!fresh)return;
        ensureOption(fresh);
        fresh.value='internal-hinge';
        fresh.dataset.pendingInternalHinge='1';
        renderHinges();
      });
    },true);
    document.documentElement.__hingeSelectionCapture=true;
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
    svg.querySelectorAll('.baCanonicalInternalHinge,.baUiInternalHinge').forEach(g=>g.remove());
    const beam=svg.querySelector('.beamLine');
    if(!beam)return;
    const x1=num(beam.getAttribute('x1'));
    const x2=num(beam.getAttribute('x2'));
    const y=num(beam.getAttribute('y1'));
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
      c.setAttribute('fill','var(--card,#fff)');
      c.setAttribute('stroke','var(--text,#20252b)');
      c.setAttribute('stroke-width','2');
      c.setAttribute('vector-effect','non-scaling-stroke');
      g.appendChild(c);

      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',x);label.setAttribute('y',y+45);
      label.setAttribute('text-anchor','middle');
      label.setAttribute('class','supportText');
      label.textContent=`H${index+1} (Internal Hinge)`;
      g.appendChild(label);

      const pos=document.createElementNS(NS,'text');
      pos.setAttribute('x',x);pos.setAttribute('y',y+62);
      pos.setAttribute('text-anchor','middle');
      pos.setAttribute('class','dimText');
      pos.textContent=`@ ${s.position} ${document.body.innerText.includes('ft')?'ft':'m'}`;
      g.appendChild(pos);
      svg.appendChild(g);
    });
  }

  function fix(){
    ensureOptions();
    syncSelectsFromModel();
    renderHinges();
  }

  fix();
  const root=document.body;
  if(root&&!root.__canonicalHingeFixV5){
    new MutationObserver(()=>requestAnimationFrame(fix)).observe(root,{childList:true,subtree:true});
    root.__canonicalHingeFixV5=true;
  }
  setInterval(fix,500);
})();

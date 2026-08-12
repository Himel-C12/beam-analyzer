/* Beam Analyzer — final DOM-authoritative internal-hinge renderer. */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v);

  function hingeRows(){
    return qa('#supportRows tr').map((tr,index)=>{
      const sel=tr.querySelector('select[data-k="type"]');
      const pos=tr.querySelector('input[data-k="position"]');
      const label=(sel?.value||'')+' '+(sel?.selectedOptions?.[0]?.textContent||'');
      if(!/hinge/i.test(label)) return null;
      return {index, id:sel?.dataset?.sup, position:num(pos?.value)};
    }).filter(x=>x && Number.isFinite(x.position));
  }

  function repair(){
    const svg=q('#beamCanvas svg');
    const beam=svg?.querySelector('.beamLine');
    if(!svg||!beam)return;

    svg.querySelectorAll('.final-internal-hinge').forEach(e=>e.remove());
    const hinges=hingeRows();
    if(!hinges.length)return;

    const x1=num(beam.getAttribute('x1')), x2=num(beam.getAttribute('x2'));
    const y=num(beam.getAttribute('y1'));
    const lengths=qa('#spanRows input[data-k="length"]').map(e=>num(e.value)).filter(Number.isFinite);
    const L=lengths.reduce((a,b)=>a+b,0);
    if(!(L>0))return;

    hinges.forEach((h,hi)=>{
      const x=x1+(h.position/L)*(x2-x1);
      let group=null;
      if(h.id) group=svg.querySelector(`g.supportDrag[data-id="${CSS.escape(String(h.id))}"]`);
      if(!group){
        const groups=qa('#beamCanvas svg g.supportDrag');
        group=groups[h.index]||null;
      }
      if(group)group.style.display='none';

      const g=document.createElementNS(NS,'g');
      g.setAttribute('class','final-internal-hinge');
      g.setAttribute('pointer-events','none');

      const outer=document.createElementNS(NS,'circle');
      outer.setAttribute('cx',x); outer.setAttribute('cy',y); outer.setAttribute('r','10');
      outer.setAttribute('fill','white'); outer.setAttribute('stroke','#35a873'); outer.setAttribute('stroke-width','2.5');
      g.appendChild(outer);

      const inner=document.createElementNS(NS,'circle');
      inner.setAttribute('cx',x); inner.setAttribute('cy',y); inner.setAttribute('r','4.5');
      inner.setAttribute('fill','none'); inner.setAttribute('stroke','#35a873'); inner.setAttribute('stroke-width','2');
      g.appendChild(inner);

      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',x); label.setAttribute('y',y+40); label.setAttribute('text-anchor','middle');
      label.setAttribute('class','supportText'); label.textContent=`H${hi+1} (Internal Hinge)`; g.appendChild(label);

      const pos=document.createElementNS(NS,'text');
      pos.setAttribute('x',x); pos.setAttribute('y',y+56); pos.setAttribute('text-anchor','middle');
      pos.setAttribute('class','supportText'); pos.textContent=`@ ${h.position} m`; g.appendChild(pos);

      svg.appendChild(g);
    });
  }

  const style=document.createElement('style');
  style.textContent='.beamCanvas g.final-internal-hinge{display:inline!important}.beamCanvas g.supportDrag[style*="display: none"]{display:none!important}';
  document.head.appendChild(style);

  [0,100,250,500,1000,2000,4000].forEach(t=>setTimeout(repair,t));
  setInterval(repair,500);
})();

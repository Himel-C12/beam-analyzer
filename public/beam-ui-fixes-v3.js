/* Beam Analyzer — final visual fixes v3.
 * 1) Internal hinges are drawn as releases, never as support symbols.
 * 2) SFD always has a visible outline/line in addition to the filled area.
 *
 * This file does not alter solver values.
 */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const $=s=>document.querySelector(s);
  const n=v=>Number(v);
  const near=(a,b)=>Math.abs(n(a)-n(b))<=1e-6;

  function modelNow(){return typeof model!=='undefined'&&model&&Array.isArray(model.supports)?model:null;}

  function hingeRepair(){
    const m=modelNow(),svg=$('#beamCanvas svg'),beam=svg?.querySelector('.beamLine');
    if(!m||!svg||!beam)return;
    const x1=n(beam.getAttribute('x1')),x2=n(beam.getAttribute('x2')),y=n(beam.getAttribute('y1'));
    const total=typeof len==='function'?n(len()):0;
    if(!Number.isFinite(x1)||!Number.isFinite(x2)||!Number.isFinite(y)||!(total>0))return;

    const hinges=m.supports.filter(s=>s&&s.type==='internal-hinge'&&Number.isFinite(n(s.position))).sort((a,b)=>n(a.position)-n(b.position));
    if(!hinges.length)return;

    const groups=[...svg.querySelectorAll('g.supportDrag')];
    const texts=[...svg.querySelectorAll('text.supportText')];
    const badges=[...svg.querySelectorAll('circle.supportBadge')];

    hinges.forEach((s,i)=>{
      const x=x1+Math.max(0,Math.min(total,n(s.position)))/total*(x2-x1);
      // The base renderer does not understand the custom hinge type and may
      // leave a pin group behind. Remove only the native graphics at this x.
      groups.forEach(g=>{
        const badge=g.querySelector('.supportBadge');
        const gx=badge?n(badge.getAttribute('cx')):NaN;
        if(String(g.getAttribute('data-id'))===String(s.id)||(Number.isFinite(gx)&&near(gx,x)))g.remove();
      });
      texts.forEach(t=>{const tx=n(t.getAttribute('x'));if(Number.isFinite(tx)&&near(tx,x))t.remove();});
      badges.forEach(c=>{const cx=n(c.getAttribute('cx'));if(Number.isFinite(cx)&&near(cx,x))c.parentElement?.remove();});

      let g=svg.querySelector(`g.finalInternalHinge[data-id="${CSS.escape(String(s.id))}"]`);
      if(g)return;
      g=document.createElementNS(NS,'g');g.setAttribute('class','finalInternalHinge');g.setAttribute('data-id',String(s.id));g.setAttribute('pointer-events','none');
      const circle=document.createElementNS(NS,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','8');circle.setAttribute('fill','var(--card,#111519)');circle.setAttribute('stroke','currentColor');circle.setAttribute('stroke-width','2');g.appendChild(circle);
      const label=document.createElementNS(NS,'text');label.setAttribute('x',x);label.setAttribute('y',y+43);label.setAttribute('text-anchor','middle');label.setAttribute('class','supportText');label.textContent=`H${i+1} · Internal Hinge`;g.appendChild(label);
      const pos=document.createElementNS(NS,'text');pos.setAttribute('x',x);pos.setAttribute('y',y+59);pos.setAttribute('text-anchor','middle');pos.setAttribute('class','dimText');pos.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;g.appendChild(pos);
      svg.appendChild(g);
    });
  }

  function ensureHingeOption(){
    const m=modelNow();if(!m)return;
    document.querySelectorAll('#supportRows tr').forEach(row=>{
      const sel=row.querySelector('select[data-k="type"]');if(!sel)return;
      const id=sel.dataset.sup,s=m.supports.find(x=>String(x.id)===String(id));if(!s)return;
      if(!sel.querySelector('option[value="internal-hinge"]')){const o=document.createElement('option');o.value='internal-hinge';o.textContent='Internal Hinge';sel.appendChild(o);}
      sel.value=s.type;
    });
  }

  function patchBeam(){ensureHingeOption();hingeRepair();}
  const oldBeam=window.renderBeam;
  if(typeof oldBeam==='function'&&!oldBeam.__finalVisualV3){
    const wrapped=function(){oldBeam();requestAnimationFrame(()=>requestAnimationFrame(patchBeam));};
    wrapped.__finalVisualV3=true;window.renderBeam=wrapped;
  }
  const oldInputs=window.renderInputs;
  if(typeof oldInputs==='function'&&!oldInputs.__finalVisualV3){
    const wrapped=function(){oldInputs();requestAnimationFrame(patchBeam);};
    wrapped.__finalVisualV3=true;window.renderInputs=wrapped;
  }
  const beamCanvas=$('#beamCanvas');
  if(beamCanvas){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patchBeam();});}).observe(beamCanvas,{childList:true,subtree:true});}

  function sfdLine(){
    document.querySelectorAll('#charts svg[data-kind="shear"]').forEach(svg=>{
      let raw=[];try{raw=JSON.parse(svg.dataset.series||'[]')}catch{return}
      if(!Array.isArray(raw)||raw.length<2)return;
      const w=1100,h=330,pad=n(svg.dataset.pad)||56,L=n(svg.dataset.len)||1,min=n(svg.dataset.min),max=n(svg.dataset.max);
      if(!Number.isFinite(min)||!Number.isFinite(max)||max===min)return;
      const sx=x=>pad+(x/L)*(w-2*pad),sy=y=>h-pad-(y-min)/(max-min)*(h-2*pad);
      const pts=raw.map(p=>Array.isArray(p)?{x:n(p[0]),y:n(p[1])}:{x:n(p?.x),y:n(p?.y)}).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
      if(pts.length<2)return;
      let d=`M ${sx(pts[0].x).toFixed(2)} ${sy(pts[0].y).toFixed(2)}`;
      for(let i=1;i<pts.length;i++){
        const a=pts[i-1],b=pts[i];
        if(near(a.x,b.x)&&!near(a.y,b.y))d+=` L ${sx(b.x).toFixed(2)} ${sy(b.y).toFixed(2)}`;
        else d+=` L ${sx(b.x).toFixed(2)} ${sy(b.y).toFixed(2)}`;
      }
      let line=svg.querySelector('.finalSfdLine');
      if(!line){line=document.createElementNS(NS,'path');line.setAttribute('class','chartLine finalSfdLine');line.setAttribute('fill','none');line.setAttribute('vector-effect','non-scaling-stroke');line.setAttribute('pointer-events','none');svg.appendChild(line);}
      line.setAttribute('d',d);line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','2.5');line.setAttribute('opacity','0.95');
      line.style.color='var(--accent,#2f80ed)';
    });
  }

  function patchCharts(){sfdLine();}
  const charts=$('#charts');
  if(charts){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patchCharts();});}).observe(charts,{childList:true,subtree:true});}
  requestAnimationFrame(()=>{patchBeam();patchCharts();});
  setTimeout(()=>{patchBeam();patchCharts();},100);
  setTimeout(()=>{patchBeam();patchCharts();},500);
})();

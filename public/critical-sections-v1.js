/* Beam Analyzer — critical sections & contraflexure markers.
   - Marks the maximum absolute shear section on SFD.
   - Marks the maximum absolute bending moment (dangerous) section on BMD.
   - Finds internal BMD zero-crossings and marks points of contraflexure.
   - Uses the plotted series itself, so annotations stay consistent with the diagram.
*/
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const near=(a,b,t=1e-8)=>Math.abs(n(a)-n(b))<=t*Math.max(1,Math.abs(n(a)),Math.abs(n(b)));

  function fmt(v,d=3){
    if(!finite(v))return '—';
    if(Math.abs(n(v))<1e-10)return '0';
    return new Intl.NumberFormat(undefined,{maximumFractionDigits:d}).format(n(v));
  }
  function unitText(kind){
    const si=(typeof unit!=='undefined'?unit:'SI')==='SI';
    return kind==='length'?(si?'m':'ft'):kind==='moment'?(si?'kN·m':'kip·ft'):(si?'kN':'kip');
  }
  function seriesFrom(svg){
    try{return JSON.parse(svg.dataset.series||'[]').map(p=>Array.isArray(p)?{x:+p[0],y:+p[1]}:p).filter(p=>finite(p.x)&&finite(p.y));}
    catch{return[];}
  }
  function scale(svg){
    const w=1100,h=330,pad=+svg.dataset.pad||56,L=+svg.dataset.len||1,min=+svg.dataset.min,max=+svg.dataset.max;
    return {w,h,pad,L,min,max,sx:x=>pad+(x/L)*(w-2*pad),sy:y=>h-pad-(y-min)/(max-min||1)*(h-2*pad)};
  }
  function addText(g,x,y,text,cls,anchor='middle'){
    const el=document.createElementNS('http://www.w3.org/2000/svg','text');
    el.setAttribute('class',`criticalText ${cls||''}`);el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('text-anchor',anchor);el.textContent=text;g.appendChild(el);return el;
  }
  function addLine(g,x,y1,y2,cls){
    const el=document.createElementNS('http://www.w3.org/2000/svg','line');el.setAttribute('class',`criticalLine ${cls||''}`);el.setAttribute('x1',x);el.setAttribute('x2',x);el.setAttribute('y1',y1);el.setAttribute('y2',y2);g.appendChild(el);return el;
  }
  function addDot(g,x,y,cls){
    const el=document.createElementNS('http://www.w3.org/2000/svg','circle');el.setAttribute('class',`criticalDot ${cls||''}`);el.setAttribute('cx',x);el.setAttribute('cy',y);el.setAttribute('r','5');g.appendChild(el);return el;
  }
  function maxAbs(series){return series.reduce((best,p)=>Math.abs(p.y)>Math.abs(best.y)?p:best,series[0]);}
  function contraflexures(series){
    const out=[];
    for(let i=0;i<series.length-1;i++){
      const a=series[i],b=series[i+1];
      if(!finite(a.x)||!finite(b.x)||b.x<=a.x+1e-9)continue;
      if(Math.abs(a.y)<1e-10 && a.x>1e-9 && a.x<(+series.at(-1).x)-1e-9){out.push({x:a.x,y:0});continue;}
      if(a.y*b.y<0){
        const t=-a.y/(b.y-a.y);out.push({x:a.x+t*(b.x-a.x),y:0});
      }
    }
    return out.filter((p,i,a)=>i===0||!near(p.x,a[i-1].x,1e-6));
  }

  function annotate(svg){
    if(svg.querySelector('.criticalAnnotations'))return;
    const kind=svg.dataset.kind, series=seriesFrom(svg);
    if(!series.length || (kind!=='shear' && kind!=='moment'))return;
    const f=scale(svg),g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','criticalAnnotations');
    const toggle=$('#featureToggle');
    if(toggle && !toggle.checked)return;

    if(kind==='shear'){
      const p=maxAbs(series),x=f.sx(p.x),y=f.sy(p.y);
      addLine(g,x,f.pad,x,f.h-f.pad,'criticalShearLine');
      addDot(g,x,y,'criticalShearDot');
      addText(g,x,y-18,`Critical shear · ${fmt(p.x)} ${unitText('length')}`,'criticalShearText');
      addText(g,x,y+34,`|V| = ${fmt(Math.abs(p.y))} ${unitText('force')}`,'criticalValueText');
    }

    if(kind==='moment'){
      const p=maxAbs(series),x=f.sx(p.x),y=f.sy(p.y);
      addLine(g,x,f.pad,x,f.h-f.pad,'criticalMomentLine');
      addDot(g,x,y,'criticalMomentDot');
      const labelY=p.y>=0?Math.max(18,y-18):Math.min(f.h-f.pad-18,y+31);
      addText(g,x,labelY,`Dangerous section · ${fmt(p.x)} ${unitText('length')}`,'criticalMomentText');
      addText(g,x,labelY+(p.y>=0?16:-16),`M = ${fmt(p.y)} ${unitText('moment')}`,'criticalValueText');

      const cf=contraflexures(series);
      cf.forEach((c,i)=>{
        const xx=f.sx(c.x),yy=f.sy(0);
        addLine(g,xx,f.pad+10,f.h-f.pad,'contraflexureLine');
        addDot(g,xx,yy,'contraflexureDot');
        const ly=(i%2===0)?Math.max(18,yy-20):Math.min(f.h-f.pad-18,yy+34);
        addText(g,xx,ly,`C.F. · ${fmt(c.x)} ${unitText('length')}`,'contraflexureText');
      });
    }
    svg.appendChild(g);
  }

  const style=document.createElement('style');
  style.textContent=`
    .criticalAnnotations{pointer-events:none}
    .criticalLine{vector-effect:non-scaling-stroke;stroke-width:1.7;stroke-dasharray:5 4;opacity:.9}
    .criticalMomentLine{stroke:#ef4444}
    .criticalShearLine{stroke:#f59e0b}
    .contraflexureLine{stroke:#a78bfa;stroke-width:1.35;opacity:.8}
    .criticalDot{vector-effect:non-scaling-stroke;stroke:#101214;stroke-width:2}
    .criticalMomentDot{fill:#ef4444}
    .criticalShearDot{fill:#f59e0b}
    .contraflexureDot{fill:#a78bfa}
    .criticalText{font-size:11px;font-weight:700;paint-order:stroke;stroke:var(--card,#101214);stroke-width:4px;stroke-linejoin:round}
    .criticalMomentText{fill:#ef4444}
    .criticalShearText{fill:#f59e0b}
    .contraflexureText{fill:#c4b5fd}
    .criticalValueText{fill:var(--text,#edf2f8);font-size:11px;font-weight:600}
  `;
  document.head.appendChild(style);

  function patch(){ $$('#charts svg[data-kind]').forEach(annotate); }
  const charts=$('#charts');
  if(charts)new MutationObserver(()=>requestAnimationFrame(patch)).observe(charts,{childList:true,subtree:true});
  patch();
})();

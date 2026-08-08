/* Beam Analyzer v7 — clean diagram annotations.
   - Keeps reaction moments labeled CW/CCW.
   - Marks important diagram values without L1/L2 clutter.
   - Shows both sides of SFD jumps at point loads and BMD jumps at applied moments.
   - Uses collision-aware placement.
   - Does not add a second copy of load magnitudes already shown in the beam model.
*/
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v);
  const finite=v=>Number.isFinite(num(v));
  const fmtV=v=>typeof fmt==='function'?fmt(v):String(v);
  const unit=k=>typeof unitText==='function'?unitText(k):k;
  const near=(a,b,t=1e-7)=>Math.abs(num(a)-num(b))<=t*Math.max(1,Math.abs(num(a)),Math.abs(num(b)));

  function reactionMoment(v){
    const x=num(v);
    if(!finite(x)||Math.abs(x)<1e-12)return '0';
    return `${fmtV(Math.abs(x))} ${unit('moment')} ${x>0?'CCW':'CW'}`;
  }

  function patchReactionTable(){
    const wrap=$('#reactions');
    if(!wrap||typeof result==='undefined'||!result)return;
    const rows=result.reactions||[];
    const table=wrap.querySelector('table');
    if(!table)return;
    const body=table.querySelector('tbody');
    if(!body)return;
    body.innerHTML=rows.map(r=>`<tr><td>${r.type||'support'}</td><td>${fmtV(r.position)} ${unit('length')}</td><td>${fmtV(r.vertical??r.v??0)} ${unit('force')}</td><td>${reactionMoment(r.moment??0)}</td></tr>`).join('');
  }

  function seriesFor(svg){
    try{return JSON.parse(svg.dataset.series||'[]').filter(p=>finite(p.x)&&finite(p.y))}catch{return[]}
  }
  function nearest(series,x){
    let best=null;
    for(const p of series)if(!best||Math.abs(p.x-x)<Math.abs(best.x-x))best=p;
    return best;
  }
  function valuesAt(series,x){
    const exact=series.filter(p=>near(p.x,x,1e-6));
    if(exact.length)return exact;
    return [];
  }
  function beforeAfter(series,x){
    const exact=valuesAt(series,x);
    let left=null,right=null;
    for(const p of series){
      if(p.x<x-1e-7 && (!left||p.x>left.x))left=p;
      if(p.x>x+1e-7 && (!right||p.x<right.x))right=p;
    }
    if(exact.length>=2){
      const sorted=[...exact].sort((a,b)=>a.y-b.y);
      return {before:sorted[sorted.length-1],after:sorted[0]};
    }
    return {before:left,after:right};
  }
  function valueUnit(kind){
    if(kind==='shear'||kind==='axial')return 'force';
    if(kind==='moment')return 'moment';
    if(kind==='defl')return 'defl';
    return 'force';
  }
  function valueText(kind,v){return `${fmtV(v)} ${unit(valueUnit(kind))}`}

  function addText(group,text,x,y,cls,anchor='middle'){
    const el=document.createElementNS('http://www.w3.org/2000/svg','text');
    el.setAttribute('class',`cleanDiagramValue ${cls||''}`);
    el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('text-anchor',anchor);
    el.textContent=text;group.appendChild(el);
    return el;
  }

  function labelBox(text,x,y,anchor='middle'){
    const width=Math.max(28,text.length*6.3);
    const left=anchor==='start'?x:anchor==='end'?x-width:x-width/2;
    return {x:left-5,y:y-13,w:width+10,h:18};
  }
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}

  function place(items,W,H,pad){
    const occupied=[];
    const options=[
      [0,-16],[0,20],[-42,-16],[42,-16],[-42,20],[42,20],
      [-65,-38],[65,-38],[-65,38],[65,38],[0,-38],[0,42]
    ];
    items.forEach(item=>{
      const baseX=item.x,baseY=item.y;
      let chosen=null;
      for(const [dx,dy] of options){
        const x=Math.max(pad+4,Math.min(W-pad-4,baseX+dx));
        const y=Math.max(pad+14,Math.min(H-pad-4,baseY+dy));
        const box=labelBox(item.text,x,y,item.anchor);
        if(!occupied.some(o=>overlaps(box,o))){chosen={x,y,box};break}
      }
      if(!chosen){
        const x=Math.max(pad+4,Math.min(W-pad-4,baseX));
        const y=Math.max(pad+14,Math.min(H-pad-4,baseY+28));
        chosen={x,y,box:labelBox(item.text,x,y,item.anchor)};
      }
      item.el.setAttribute('x',chosen.x);item.el.setAttribute('y',chosen.y);item.el.setAttribute('text-anchor',item.anchor);
      occupied.push(chosen.box);
    });
  }

  function addAnnotations(card){
    const svg=card.querySelector('svg');
    if(!svg||typeof model==='undefined')return;
    svg.querySelector('.cleanDiagramAnnotations')?.remove();
    // Remove annotation layers from older minor/chart-fix versions if a cached script is still present.
    svg.querySelector('.importantValues')?.remove();
    svg.querySelector('.chartPointAnnotations')?.remove();

    const series=seriesFor(svg);if(!series.length)return;
    const kind=svg.dataset.kind||'';
    const W=1100,H=330,pad=Number(svg.dataset.pad)||56,L=Math.max(Number(svg.dataset.len)||1,1);
    const min=Number(svg.dataset.min),max=Number(svg.dataset.max);
    const sx=x=>pad+(x/L)*(W-2*pad);
    const sy=y=>H-pad-(y-min)/(max-min||1)*(H-2*pad);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','cleanDiagramAnnotations');
    const items=[];

    const supports=Array.isArray(model.supports)?model.supports:[];
    const loads=Array.isArray(model.loads)?model.loads:[];

    // Support values: one value only, and never duplicate a load annotation at the same x.
    supports.forEach(s=>{
      const p=nearest(series,num(s.position));
      if(!p)return;
      const x=sx(p.x),y=sy(p.y);
      items.push({x,y,text:valueText(kind,p.y),anchor:'middle',cls:'supportValue'});
    });

    loads.forEach(l=>{
      const x0=num(l.from);
      if(!finite(x0))return;

      if(l.type==='point' && kind==='shear'){
        const j=beforeAfter(series,x0);
        if(j.before&&j.after){
          // Explicitly mark the two sides of the SFD jump. This is the important information.
          items.push({x:sx(x0)-10,y:sy(j.before.y)-4,text:valueText(kind,j.before.y),anchor:'end',cls:'jumpValue'});
          items.push({x:sx(x0)+10,y:sy(j.after.y)+4,text:valueText(kind,j.after.y),anchor:'start',cls:'jumpValue'});
        }else{
          const p=nearest(series,x0);if(p)items.push({x:sx(p.x),y:sy(p.y),text:valueText(kind,p.y),anchor:'middle',cls:'loadValue'});
        }
        return;
      }

      if(l.type==='moment' && kind==='moment'){
        const j=beforeAfter(series,x0);
        if(j.before&&j.after){
          items.push({x:sx(x0)-10,y:sy(j.before.y)-4,text:valueText(kind,j.before.y),anchor:'end',cls:'jumpValue'});
          items.push({x:sx(x0)+10,y:sy(j.after.y)+4,text:valueText(kind,j.after.y),anchor:'start',cls:'jumpValue'});
        }else{
          const p=nearest(series,x0);if(p)items.push({x:sx(p.x),y:sy(p.y),text:valueText(kind,p.y),anchor:'middle',cls:'loadValue'});
        }
        return;
      }

      if(l.type==='udl' && (kind==='shear'||kind==='moment')){
        [num(l.from),num(l.to)].forEach((pos,i)=>{
          const p=nearest(series,pos);if(!p)return;
          items.push({x:sx(p.x),y:sy(p.y),text:valueText(kind,p.y),anchor:i?'end':'start',cls:'boundaryValue'});
        });
      }else if(l.type!=='point'&&l.type!=='moment'){
        const p=nearest(series,x0);if(p)items.push({x:sx(p.x),y:sy(p.y),text:valueText(kind,p.y),anchor:'middle',cls:'loadValue'});
      }
    });

    // One max-value annotation. Do not create another label if it coincides with a jump value.
    let extreme=null;
    for(const p of series)if(!extreme||Math.abs(p.y)>Math.abs(extreme.y))extreme=p;
    if(extreme){
      const duplicate=items.some(i=>near((i.x-pad)/(W-2*pad)*L,extreme.x,1e-5)&&i.text===valueText(kind,extreme.y));
      if(!duplicate)items.push({x:sx(extreme.x),y:sy(extreme.y),text:`Max: ${valueText(kind,extreme.y)}`,anchor:'middle',cls:'maxValue'});
    }

    // Materialize after all candidates are known so placement can avoid collisions.
    for(const item of items)item.el=addText(g,item.text,item.x,item.y,item.cls,item.anchor);
    svg.appendChild(g);
    place(items,W,H,pad);
  }

  function annotate(){
    patchReactionTable();
    $$('#charts .chart').forEach(addAnnotations);
  }

  const style=document.createElement('style');
  style.textContent=`
    .cleanDiagramAnnotations{pointer-events:none}
    .cleanDiagramValue{fill:var(--text,#e7edf5);font-size:11px;font-weight:650;paint-order:stroke;stroke:var(--card,#101214);stroke-width:4px;stroke-linejoin:round}
    .cleanDiagramValue.jumpValue{font-size:11px;font-weight:750}
    .cleanDiagramValue.maxValue{font-size:10.5px;font-weight:750}
    .cleanDiagramValue.supportValue{font-size:10px;font-weight:550;opacity:.9}
  `;
  document.head.appendChild(style);

  const baseRenderResults=window.renderResults;
  if(typeof baseRenderResults==='function'){
    window.renderResults=function(){baseRenderResults();requestAnimationFrame(annotate)};
  }
  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(){baseRender();requestAnimationFrame(annotate)};
  }
  const observer=new MutationObserver(()=>annotate());
  const charts=$('#charts');
  if(charts)observer.observe(charts,{childList:true,subtree:true});
  setTimeout(annotate,0);
})();

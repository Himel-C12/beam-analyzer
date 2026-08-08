/* Beam Analyzer v7 — clean diagram annotations + final UI polish. */
(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v), finite=v=>Number.isFinite(num(v));
  const fmtV=v=>typeof fmt==='function'?fmt(v):String(v);
  const unit=k=>typeof unitText==='function'?unitText(k):k;
  const near=(a,b,t=1e-7)=>Math.abs(num(a)-num(b))<=t*Math.max(1,Math.abs(num(a)),Math.abs(num(b)));
  function reactionMoment(v){const x=num(v);if(!finite(x)||Math.abs(x)<1e-12)return '0';return `${fmtV(Math.abs(x))} ${unit('moment')} ${x>0?'CCW':'CW'}`}
  function patchReactionTable(){const wrap=$('#reactions');if(!wrap||typeof result==='undefined'||!result)return;const rows=result.reactions||[],table=wrap.querySelector('table'),body=table?.querySelector('tbody');if(!body)return;body.innerHTML=rows.map(r=>`<tr><td>${r.type||'support'}</td><td>${fmtV(r.position)} ${unit('length')}</td><td>${fmtV(r.vertical??r.v??0)} ${unit('force')}</td><td>${reactionMoment(r.moment??0)}</td></tr>`).join('')}
  function seriesFor(svg){try{return JSON.parse(svg.dataset.series||'[]').filter(p=>finite(p.x)&&finite(p.y))}catch{return[]}}
  function nearest(series,x){let best=null;for(const p of series)if(!best||Math.abs(p.x-x)<Math.abs(best.x-x))best=p;return best}
  function beforeAfter(series,x){const exact=series.filter(p=>near(p.x,x,1e-6));let left=null,right=null;for(const p of series){if(p.x<x-1e-7&&(!left||p.x>left.x))left=p;if(p.x>x+1e-7&&(!right||p.x<right.x))right=p}if(exact.length>=2){const a=[...exact].sort((a,b)=>a.y-b.y);return{before:a[a.length-1],after:a[0]}}return{before:left,after:right}}
  function valueUnit(kind){return kind==='shear'||kind==='axial'?'force':kind==='moment'?'moment':kind==='defl'?'defl':'force'}
  function valueText(kind,v){return `${fmtV(v)} ${unit(valueUnit(kind))}`}
  function addText(group,item){const el=document.createElementNS('http://www.w3.org/2000/svg','text');el.setAttribute('class',`cleanDiagramValue ${item.cls||''}`);el.setAttribute('x',item.x);el.setAttribute('y',item.y);el.setAttribute('text-anchor',item.anchor||'middle');el.textContent=item.text;group.appendChild(el);item.el=el}
  function labelBox(item,x,y){const width=Math.max(28,item.text.length*6.2),anchor=item.anchor||'middle',left=anchor==='start'?x:anchor==='end'?x-width:x-width/2;return{x:left-5,y:y-13,w:width+10,h:18}}
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function place(items,W,H,pad){const occupied=[],opts=[[0,-18],[0,22],[-42,-18],[42,-18],[-42,22],[42,22],[-70,-40],[70,-40],[-70,42],[70,42],[0,-40],[0,44]];for(const item of items){let chosen=null;for(const [dx,dy] of opts){const x=Math.max(pad+4,Math.min(W-pad-4,item.x+dx)),y=Math.max(pad+14,Math.min(H-pad-4,item.y+dy)),box=labelBox(item,x,y);if(!occupied.some(o=>overlaps(box,o))){chosen={x,y,box};break}}if(!chosen){const x=Math.max(pad+4,Math.min(W-pad-4,item.x)),y=Math.max(pad+14,Math.min(H-pad-4,item.y+28));chosen={x,y,box:labelBox(item,x,y)}}item.el.setAttribute('x',chosen.x);item.el.setAttribute('y',chosen.y);occupied.push(chosen.box)}}
  function addAnnotations(card){const svg=card.querySelector('svg');if(!svg||typeof model==='undefined')return;svg.querySelector('.cleanDiagramAnnotations')?.remove();svg.querySelector('.importantValues')?.remove();svg.querySelector('.chartPointAnnotations')?.remove();const series=seriesFor(svg);if(!series.length)return;const kind=svg.dataset.kind||'',W=1100,H=330,pad=Number(svg.dataset.pad)||56,L=Math.max(Number(svg.dataset.len)||1,1),min=Number(svg.dataset.min),max=Number(svg.dataset.max),sx=x=>pad+(x/L)*(W-2*pad),sy=y=>H-pad-(y-min)/(max-min||1)*(H-2*pad),items=[];const supports=Array.isArray(model.supports)?model.supports:[],loads=Array.isArray(model.loads)?model.loads:[];supports.forEach(s=>{const p=nearest(series,num(s.position));if(p)items.push({x:sx(p.x),y:sy(p.y),text:valueText(kind,p.y),anchor:'middle',cls:'supportValue'})});loads.forEach(l=>{const x0=num(l.from);if(!finite(x0))return;if(l.type==='point'&&kind==='shear'){const j=beforeAfter(series,x0);if(j.before&&j.after){items.push({x:sx(x0)-12,y:sy(j.before.y),text:valueText(kind,j.before.y),anchor:'end',cls:'jumpValue'});items.push({x:sx(x0)+12,y:sy(j.after.y)+18,text:valueText(kind,j.after.y),anchor:'start',cls:'jumpValue'})}return}if(l.type==='moment'&&kind==='moment'){const j=beforeAfter(series,x0);if(j.before&&j.after){items.push({x:sx(x0)-12,y:sy(j.before.y),text:valueText(kind,j.before.y),anchor:'end',cls:'jumpValue'});items.push({x:sx(x0)+12,y:sy(j.after.y)+18,text:valueText(kind,j.after.y),anchor:'start',cls:'jumpValue'})}return}if(l.type==='udl'&&(kind==='shear'||kind==='moment'))[num(l.from),num(l.to)].forEach((pos,i)=>{const p=nearest(series,pos);if(p)items.push({x:sx(p.x),y:sy(p.y),text:valueText(kind,p.y),anchor:i?'end':'start',cls:'boundaryValue'})})});let extreme=null;for(const p of series)if(!extreme||Math.abs(p.y)>Math.abs(extreme.y))extreme=p;if(extreme){const ex=sx(extreme.x),ey=sy(extreme.y),dup=items.some(i=>i.cls==='jumpValue'&&near((i.x-pad)/(W-2*pad)*L,extreme.x,1e-5));if(!dup)items.push({x:ex,y:ey,text:`Max: ${valueText(kind,extreme.y)}`,anchor:'middle',cls:'maxValue'})}const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','cleanDiagramAnnotations');items.forEach(item=>addText(g,item));svg.appendChild(g);place(items,W,H,pad)}
  function annotate(){patchReactionTable();$$('#charts .chart').forEach(addAnnotations)}
  const style=document.createElement('style');style.textContent=`
    .cleanDiagramAnnotations{pointer-events:none}
    .cleanDiagramValue{fill:var(--text,#e7edf5);font-size:11px;font-weight:650;paint-order:stroke;stroke:var(--card,#101214);stroke-width:4px;stroke-linejoin:round}
    .cleanDiagramValue.jumpValue{font-size:11px;font-weight:750}
    .cleanDiagramValue.maxValue{font-size:10.5px;font-weight:750}
    .cleanDiagramValue.supportValue{font-size:10px;font-weight:550;opacity:.9}
    /* The chart header already names each diagram; remove only the redundant vertical axis title. */
    #charts .chart svg .chartAxisTitle[transform]{display:none!important}
    /* visual-fixes-v5 applies an !important card background, so restore the Grid toggle here. */
    #beamViewport.gridOn{background-color:var(--card)!important;background-image:linear-gradient(rgba(100,116,139,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(100,116,139,.16) 1px,transparent 1px)!important;background-size:24px 24px!important}
    :root.dark #beamViewport.gridOn{background-image:linear-gradient(rgba(148,163,184,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.13) 1px,transparent 1px)!important}
  `;document.head.appendChild(style);
  const baseRenderResults=window.renderResults;if(typeof baseRenderResults==='function')window.renderResults=function(){baseRenderResults();requestAnimationFrame(annotate)};
  const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){baseRender();requestAnimationFrame(annotate)};
  setTimeout(annotate,0);
})();

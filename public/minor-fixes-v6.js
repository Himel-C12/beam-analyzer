/* Beam Analyzer v6 — reaction directions + important diagram values. */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v);
  const finite=v=>Number.isFinite(num(v));
  const fmtV=v=>typeof fmt==='function'?fmt(v):String(v);
  const unit=k=>typeof unitText==='function'?unitText(k):k;

  // Reaction moments use the solver's signed convention:
  // positive = CCW, negative = CW.
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

  function nearest(series,x){
    if(!series?.length)return null;
    return series.reduce((best,p)=>Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,series[0]);
  }

  function importantPoints(){
    const points=[];
    (model.supports||[]).forEach((s,i)=>points.push({x:num(s.position),label:`S${i+1}`}));
    (model.loads||[]).forEach(l=>{
      if(l.type==='udl'){
        points.push({x:num(l.from),label:`L${l.id}`} );
        points.push({x:num(l.to),label:`L${l.id}`} );
      }else points.push({x:num(l.from),label:`L${l.id}`} );
    });
    return points.filter(p=>finite(p.x)).sort((a,b)=>a.x-b.x).filter((p,i,a)=>i===0||Math.abs(p.x-a[i-1].x)>1e-8);
  }

  function valueUnit(kind){
    if(kind==='shear'||kind==='axial')return unit('force');
    if(kind==='moment')return unit('moment');
    if(kind==='defl')return unit('defl');
    return '';
  }

  function addImportantValues(card){
    const svg=card.querySelector('svg');
    if(!svg)return;
    const old=svg.querySelector('.importantValues');
    if(old)old.remove();
    const raw=svg.dataset.series;
    if(!raw)return;
    let series=[];
    try{series=JSON.parse(raw)}catch{return}
    if(!series.length)return;

    const kind=svg.dataset.kind||'';
    const L=num(svg.dataset.len),pad=num(svg.dataset.pad),min=num(svg.dataset.min),max=num(svg.dataset.max);
    const W=1100,H=330;
    const sx=x=>pad+(x/L)*(W-2*pad);
    const sy=y=>H-pad-(y-min)/(max-min||1)*(H-2*pad);
    const pts=importantPoints();
    const g=document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','importantValues');

    pts.forEach((pt,index)=>{
      const p=nearest(series,pt.x);
      if(!p)return;
      const x=sx(p.x), y=sy(p.y);
      const label=`${pt.label}: ${fmtV(p.y)}${valueUnit(kind)?' '+valueUnit(kind):''}`;
      const group=document.createElementNS('http://www.w3.org/2000/svg','g');
      group.setAttribute('class','importantValue');
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','3.5');
      const text=document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x',x);
      text.setAttribute('y',Math.max(pad+12,Math.min(H-pad-8,y+(index%2?24:-10))));
      text.setAttribute('text-anchor',index%3===0?'start':index%3===1?'middle':'end');
      text.textContent=label;
      group.append(circle,text);g.appendChild(group);
    });

    // Also mark the absolute maximum magnitude, a useful design point.
    let extreme=series[0];
    for(const p of series)if(Math.abs(p.y)>Math.abs(extreme.y))extreme=p;
    if(extreme){
      const x=sx(extreme.x),y=sy(extreme.y);
      const group=document.createElementNS('http://www.w3.org/2000/svg','g');
      group.setAttribute('class','importantValue maxValue');
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','5');
      const text=document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x',x);text.setAttribute('y',Math.max(pad+12,Math.min(H-pad-8,y-16)));
      text.setAttribute('text-anchor','middle');
      text.textContent=`Max: ${fmtV(extreme.y)}${valueUnit(kind)?' '+valueUnit(kind):''}`;
      group.append(circle,text);g.appendChild(group);
    }
    svg.appendChild(g);
  }

  function annotateCharts(){
    patchReactionTable();
    $$('#charts .chart').forEach(addImportantValues);
  }

  const style=document.createElement('style');
  style.textContent=`
    .importantValues{pointer-events:none}
    .importantValue circle{fill:var(--card,#fff);stroke:#111827;stroke-width:1.4}
    .importantValue text{fill:var(--text,#172033);font-size:10px;font-weight:700;paint-order:stroke;stroke:var(--card,#fff);stroke-width:3px;stroke-linejoin:round}
    .importantValue.maxValue circle{stroke-width:2}
    .importantValue.maxValue text{font-size:10.5px}
  `;
  document.head.appendChild(style);

  // Wrap the app's renderResults so annotations are applied immediately after each solve.
  const baseRenderResults=window.renderResults;
  if(typeof baseRenderResults==='function'){
    window.renderResults=function(){
      baseRenderResults();
      requestAnimationFrame(annotateCharts);
    };
  }

  // Also cover explicit render calls such as unit switches, load/new, undo and redo.
  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(){
      baseRender();
      requestAnimationFrame(annotateCharts);
    };
  }

  setTimeout(annotateCharts,0);
})();

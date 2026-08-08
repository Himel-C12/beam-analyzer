/* Chart readability fixes
   - Keeps axis labels away from tick labels.
   - Adds explicit values at important structural points.
   - Marks shear-force jumps on point loads with before/after values.
   - Marks bending-moment jumps on applied moments with before/after values.
   - Uses simple collision-aware label placement so annotations don't cover the curve.
*/
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const near=(a,b,t=1e-7)=>Math.abs(n(a)-n(b))<=t*Math.max(1,Math.abs(n(a)),Math.abs(n(b)));

  function fmtLocal(v,d=3){
    if(!finite(v))return '—';
    if(Math.abs(n(v))<1e-12)return '0';
    return new Intl.NumberFormat(undefined,{maximumFractionDigits:d}).format(n(v));
  }
  function unitTextLocal(k){
    const si=(typeof unit!=='undefined'?unit:'SI')==='SI';
    return ({length:si?'m':'ft',force:si?'kN':'kip',moment:si?'kN·m':'kip·ft',load:si?'kN/m':'kip/ft',defl:si?'mm':'in'})[k];
  }
  function seriesFrom(svg){
    try{return JSON.parse(svg.dataset.series||'[]').filter(p=>finite(p.x)&&finite(p.y))}catch{return[]}
  }
  function nearestAll(series,x){return series.filter(p=>near(p.x,x,1e-5))}
  function nearest(series,x){return series.reduce((best,p)=>!best||Math.abs(p.x-x)<Math.abs(best.x-x)?p:best,null)}

  function pointValues(series,x){
    const exact=nearestAll(series,x);
    if(exact.length)return exact;
    const p=nearest(series,x);
    return p?[p]:[];
  }

  function valueUnit(kind){
    if(kind==='shear'||kind==='axial')return 'force';
    if(kind==='moment')return 'moment';
    if(kind==='defl')return 'defl';
    return 'force';
  }

  function labelText(kind,prefix,value){
    return `${prefix}: ${fmtLocal(value)} ${unitTextLocal(valueUnit(kind))}`;
  }

  // Place labels around the chart without allowing annotations to stack on top of each other.
  function placeLabels(svg,labels,w,h,pad){
    const occupied=[];
    const gap=7;
    labels.forEach((item,index)=>{
      const text=item.el;
      const bbox=text.getBBox();
      let x=item.x;
      let y=item.y;
      const half=bbox.width/2;
      x=Math.max(pad+half,Math.min(w-pad-half,x));
      const candidates=[0,-18,18,-36,36,-54,54,72,-72,90,-90];
      let chosen=null;
      for(const dy of candidates){
        const yy=Math.max(14,Math.min(h-pad-8,y+dy));
        const r={x:x-half-gap,y:yy-bbox.height-gap,w:bbox.width+2*gap,h:bbox.height+2*gap};
        if(!occupied.some(o=>r.x<o.x+o.w&&r.x+r.w>o.x&&r.y<o.y+o.h&&r.y+r.h>o.y)){chosen={x,y:yy,r};break}
      }
      if(!chosen){
        const yy=Math.max(14,Math.min(h-pad-8,y+(index%2?-28:28)));
        chosen={x,y:yy,r:{x:x-half-gap,y:yy-bbox.height-gap,w:bbox.width+2*gap,h:bbox.height+2*gap}};
      }
      text.setAttribute('x',chosen.x);
      text.setAttribute('y',chosen.y);
      occupied.push(chosen.r);
    });
  }

  function addLabel(group,items,x,y,text,cls){
    const el=document.createElementNS('http://www.w3.org/2000/svg','text');
    el.setAttribute('class',`chartPointValue ${cls||''}`);
    el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('text-anchor','middle');
    el.textContent=text;group.appendChild(el);items.push({el,x,y});
  }

  function addChartAnnotations(svg){
    if(svg.querySelector('.chartPointAnnotations'))return;
    const series=seriesFrom(svg);
    if(!series.length||typeof model==='undefined')return;
    const kind=svg.dataset.kind;
    const w=1100,h=330,pad=+svg.dataset.pad||56,L=+svg.dataset.len||1,min=+svg.dataset.min,max=+svg.dataset.max;
    const sx=x=>pad+(x/L)*(w-2*pad);
    const sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    const group=document.createElementNS('http://www.w3.org/2000/svg','g');
    group.setAttribute('class','chartPointAnnotations');
    const labels=[];

    const supports=Array.isArray(model.supports)?model.supports:[];
    const loads=Array.isArray(model.loads)?model.loads:[];

    // Supports: show the diagram value at each important support location.
    supports.forEach(s=>{
      const p=nearest(series,s.position); if(!p)return;
      const xx=sx(p.x),yy=sy(p.y);
      addLabel(group,labels,xx,yy-13,`${fmtLocal(p.y)} ${unitTextLocal(valueUnit(kind))}`,'supportValue');
    });

    loads.forEach(l=>{
      if(l.type==='udl'){
        // UDL boundaries are important because the diagram slope/curvature can change there.
        [l.from,l.to].forEach((pos,j)=>{
          const p=nearest(series,pos);if(!p)return;
          const xx=sx(p.x),yy=sy(p.y);
          addLabel(group,labels,xx,yy+(j?26:-13),`${fmtLocal(p.y)} ${unitTextLocal(valueUnit(kind))}`,'loadValue boundaryValue');
        });
        return;
      }

      const xx=sx(l.from);
      const vals=pointValues(series,l.from);
      if(!vals.length)return;

      // A point force creates a jump in SFD. Show both sides explicitly.
      // Applied moment creates a jump in BMD. Show both sides explicitly.
      const discontinuity=(kind==='shear'&&l.type==='point')||(kind==='moment'&&l.type==='moment');
      if(discontinuity && vals.length>=2){
        const sorted=[...vals].sort((a,b)=>a.y-b.y);
        const low=sorted[0],high=sorted[sorted.length-1];
        addLabel(group,labels,xx,sy(high.y)-13,`${fmtLocal(high.y)} ${unitTextLocal(valueUnit(kind))}`,'jumpValue jumpBefore');
        addLabel(group,labels,xx,sy(low.y)+27,`${fmtLocal(low.y)} ${unitTextLocal(valueUnit(kind))}`,'jumpValue jumpAfter');
      }else{
        const p=vals[0];
        addLabel(group,labels,xx,sy(p.y)-15,`${fmtLocal(p.y)} ${unitTextLocal(valueUnit(kind))}`,'loadValue');
      }

      // Always show the applied load itself near its marked x-position.
      const appliedUnit=l.type==='point'?'force':'moment';
      const applied=fmtLocal(Math.abs(l.value));
      const direction=l.type==='point'?(l.value<0?'↓':'↑'):(l.value<0?'CCW':'CW');
      const appliedText=`${applied} ${unitTextLocal(appliedUnit)} ${direction}`;
      const anchor=nearest(series,l.from);
      if(anchor)addLabel(group,labels,xx,sy(anchor.y)+34,appliedText,'appliedLoadValue');
    });

    // Draw the annotations after the curve/features so the important values stay readable.
    svg.appendChild(group);
    placeLabels(svg,labels,w,h,pad);
  }

  function patchCharts(){
    $$('#charts svg[data-kind]').forEach(addChartAnnotations);
  }

  const style=document.createElement('style');
  style.textContent=`
    /* Keep chart annotations compact and readable in both themes. */
    .chartPointValue{font-size:12px;font-weight:600;paint-order:stroke;stroke:var(--card,#101214);stroke-width:4px;stroke-linejoin:round;fill:var(--text,#e7edf5);pointer-events:none}
    .chartPointValue.supportValue{font-size:11px;font-weight:500;opacity:.9}
    .chartPointValue.appliedLoadValue{font-size:11px;font-weight:700}
    .chartPointValue.jumpValue{font-size:11px;font-weight:700}
    .chartPointAnnotations{pointer-events:none}
    .chartAxisTitle{font-size:12px}
    /* The chart title already identifies the quantity; keep the vertical axis title visually secondary. */
    .chartBox svg > text.chartAxisTitle{opacity:.8}
    @media (max-width:700px){.chartPointValue{font-size:10px}.chartPointValue.supportValue,.chartPointValue.appliedLoadValue{font-size:9px}}
  `;
  document.head.appendChild(style);

  // Fix the y-axis title collision without touching the numeric tick positions.
  function fixAxisTitles(){
    $$('#charts svg[data-kind]').forEach(svg=>{
      const titles=[...svg.querySelectorAll('.chartAxisTitle')];
      const yTitle=titles.find(t=>t.getAttribute('transform'));
      if(yTitle){
        yTitle.setAttribute('x','9');
        yTitle.style.fontSize='11px';
        yTitle.style.opacity='.72';
      }
    });
  }

  const observer=new MutationObserver(()=>{patchCharts();fixAxisTitles()});
  function start(){
    const charts=$('#charts');
    if(charts)observer.observe(charts,{childList:true,subtree:true});
    patchCharts();fixAxisTitles();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

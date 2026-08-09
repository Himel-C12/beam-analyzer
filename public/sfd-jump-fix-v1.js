/* SFD discontinuity rendering fix v3.
   The solver can return the two sides of a point-load jump with tiny but
   non-zero x separation. Treat those pairs as one vertical discontinuity.
   Both the line and the shaded area must use the same normalized geometry.
*/
(function(){
  function geometry(svg){
    const w=1100,h=330,pad=Number(svg.dataset.pad)||56;
    const L=Number(svg.dataset.len)||1;
    const min=Number(svg.dataset.min),max=Number(svg.dataset.max);
    const sx=x=>pad+(x/L)*(w-2*pad);
    const sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    return {w,h,pad,L,min,max,sx,sy};
  }

  function normalize(series,c){
    const range=Math.max(Math.abs(c.max-c.min),1e-9);
    // The upstream diagram may place the two sides of a point-load jump a
    // few millimetres apart. A tolerance of 0.2% of the beam length is large
    // enough to catch that rendering artifact while remaining tiny compared
    // with normal span/load intervals.
    const xTol=Math.max(c.L*0.002,0.01);
    const yTol=range*0.02;
    const out=series.map(p=>({x:Number(p.x),y:Number(p.y)}));
    const jumps=[];

    for(let i=1;i<out.length;i++){
      const a=out[i-1],b=out[i];
      const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);
      if(dx<=xTol && dy>=yTol){
        const x=(a.x+b.x)/2;
        a.x=x;
        b.x=x;
        jumps.push(i);
      }
    }
    return {series:out,jumps};
  }

  function pt(p,c){
    return `${c.sx(p.x).toFixed(1)} ${c.sy(p.y).toFixed(1)}`;
  }

  function linePath(series,jumps,c){
    let d='';
    const jumpAt=new Set(jumps);
    for(let i=1;i<series.length;i++){
      const a=series[i-1],b=series[i];
      if(jumpAt.has(i)){
        // Explicit vertical jump; never let SVG interpolate it diagonally.
        d+=`M ${pt(a,c)} L ${pt(b,c)} `;
      }else{
        d+=`${i===1?'M':'L'} ${pt(a,c)} L ${pt(b,c)} `;
      }
    }
    return d.trim();
  }

  function areaPath(series,jumps,c,zero){
    if(!series.length)return'';
    const jumpAt=new Set(jumps);
    const runs=[];
    let run=[series[0]];
    for(let i=1;i<series.length;i++){
      if(jumpAt.has(i)){
        runs.push(run);
        run=[series[i]];
      }else{
        run.push(series[i]);
      }
    }
    if(run.length)runs.push(run);

    return runs.filter(r=>r.length).map(r=>{
      const first=pt({x:r[0].x,y:zero},c);
      const last=pt({x:r[r.length-1].x,y:zero},c);
      return `M ${first} L ${r.map(p=>pt(p,c)).join(' L ')} L ${last} Z`;
    }).join(' ');
  }

  function patch(svg){
    if(svg.dataset.jumpFixed==='3')return;
    let raw=[];
    try{raw=JSON.parse(svg.dataset.series||'[]')}catch{return}
    if(!Array.isArray(raw)||raw.length<2)return;
    const c=geometry(svg);
    if(!Number.isFinite(c.min)||!Number.isFinite(c.max)||!c.L)return;

    const n=normalize(raw,c),series=n.series,jumps=n.jumps;
    const line=svg.querySelector('.chartLine');
    const area=svg.querySelector('.chartArea');
    if(line){
      line.setAttribute('d',linePath(series,jumps,c));
      line.setAttribute('stroke-linejoin','miter');
      line.setAttribute('stroke-linecap','butt');
    }
    if(area){
      area.setAttribute('d',areaPath(series,jumps,c,0));
    }
    // Keep hover/feature calculations on the same normalized coordinates.
    svg.dataset.series=JSON.stringify(series);
    svg.dataset.jumpFixed='3';
  }

  function patchAll(){
    document.querySelectorAll('#charts svg[data-kind="shear"]').forEach(patch);
  }

  function start(){
    patchAll();
    const charts=document.querySelector('#charts');
    if(!charts)return;
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;patchAll()});
    });
    observer.observe(charts,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
  else start();
})();

/* SFD discontinuity rendering fix v2.
   Point-load jumps are true vertical discontinuities. The SFD line and the
   shaded area must both respect those discontinuities. A normal SVG path
   cannot be allowed to connect the two sides of a jump, otherwise the area
   renderer creates a false triangular wedge.
*/
(function(){
  const near=(a,b)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));

  function coords(svg){
    const w=1100,h=330,pad=Number(svg.dataset.pad)||56;
    const L=Number(svg.dataset.len)||1;
    const min=Number(svg.dataset.min),max=Number(svg.dataset.max);
    const sx=x=>pad+(x/L)*(w-2*pad);
    const sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    return {w,h,pad,L,min,max,sx,sy};
  }

  function point(q,c){
    return `${c.sx(Number(q.x)).toFixed(1)} ${c.sy(Number(q.y)).toFixed(1)}`;
  }

  // Build the SFD line as independent pieces. Duplicate-x pairs are the
  // actual vertical jumps and are deliberately kept separate from adjacent
  // horizontal/sloping segments.
  function jumpLine(series,c){
    let d='';
    for(let i=1;i<series.length;i++){
      const a=series[i-1],b=series[i];
      const duplicateX=near(Number(a.x),Number(b.x));
      const startsAfterJump=i>1 && near(Number(series[i-2].x),Number(a.x));
      const starts= i===1 || duplicateX || startsAfterJump;
      d+=`${starts?'M':'L'} ${point(a,c)} L ${point(b,c)} `;
    }
    return d.trim();
  }

  // Build the shaded SFD area one continuous-x run at a time. At a point
  // load, the two sides share the same x but different y; they must NEVER be
  // joined by the fill polygon.
  function jumpArea(series,c,zero){
    if(!series.length) return '';
    const runs=[];
    let run=[series[0]];

    for(let i=1;i<series.length;i++){
      const a=series[i-1],b=series[i];
      if(near(Number(a.x),Number(b.x))){
        // Finish the side before the jump, then begin the side after it.
        runs.push(run);
        run=[b];
      }else{
        run.push(b);
      }
    }
    if(run.length) runs.push(run);

    return runs.filter(r=>r.length).map(r=>{
      const first=point({x:r[0].x,y:zero},c);
      const last=point({x:r[r.length-1].x,y:zero},c);
      const body=r.map(p=>point(p,c)).join(' L ');
      return `M ${first} L ${body} L ${last} Z`;
    }).join(' ');
  }

  function patchSfd(svg){
    if(svg.dataset.jumpFixed==='2') return;
    let series=[];
    try { series=JSON.parse(svg.dataset.series||'[]'); } catch { return; }
    if(!Array.isArray(series) || series.length<2) return;
    const c=coords(svg);
    if(!Number.isFinite(c.min)||!Number.isFinite(c.max)||!c.L) return;

    const line=svg.querySelector('.chartLine');
    const area=svg.querySelector('.chartArea');
    if(line){
      line.setAttribute('d',jumpLine(series,c));
      line.setAttribute('stroke-linejoin','miter');
      line.setAttribute('stroke-linecap','butt');
    }
    if(area){
      area.setAttribute('d',jumpArea(series,c,0));
    }
    svg.dataset.jumpFixed='2';
  }

  function patch(){
    document.querySelectorAll('#charts svg[data-kind="shear"]').forEach(patchSfd);
  }

  function start(){
    patch();
    const charts=document.querySelector('#charts');
    if(!charts) return;
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued) return;
      queued=true;
      requestAnimationFrame(()=>{queued=false;patch();});
    });
    observer.observe(charts,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();

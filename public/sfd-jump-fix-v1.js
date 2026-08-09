/* SFD discontinuity rendering fix.
   Point-load jumps are true vertical discontinuities. The main chart path is
   correct mathematically, but a single SVG path creates a miter join at the
   horizontal/vertical corners, which appears as a small triangular bump.
   Split the segments around duplicate-x jumps so the vertical jump has no
   joined corners and therefore no overshoot/spike.
*/
(function(){
  const near=(a,b)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));

  function patchSfd(svg){
    const line=svg.querySelector('.chartLine');
    if(!line || line.dataset.jumpFixed==='1') return;

    let series=[];
    try { series=JSON.parse(svg.dataset.series||'[]'); } catch { return; }
    if(!Array.isArray(series) || series.length<2) return;

    const w=1100,h=330,pad=Number(svg.dataset.pad)||56;
    const L=Number(svg.dataset.len)||1;
    const min=Number(svg.dataset.min),max=Number(svg.dataset.max);
    if(!Number.isFinite(min)||!Number.isFinite(max)||!L) return;

    const sx=x=>pad+(x/L)*(w-2*pad);
    const sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    const p=p=>`${sx(Number(p.x)).toFixed(1)} ${sy(Number(p.y)).toFixed(1)}`;

    let d='';
    for(let i=1;i<series.length;i++){
      const a=series[i-1],b=series[i];
      const duplicateX=near(Number(a.x),Number(b.x));
      const nextIsJump=i+1<series.length && near(Number(b.x),Number(series[i+1].x));
      const startNew=(i===1)||duplicateX||nextIsJump;
      d+=`${startNew?'M':'L'} ${p(a)} L ${p(b)} `;
    }

    line.setAttribute('d',d.trim());
    line.setAttribute('stroke-linejoin','miter');
    line.setAttribute('stroke-linecap','butt');
    line.dataset.jumpFixed='1';
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

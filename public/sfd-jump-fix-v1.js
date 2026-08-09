/* SFD discontinuity rendering fix v2.
   Render each SFD segment independently. Point-load jumps are drawn as an
   explicit vertical SVG line, never as a joined polyline. This prevents
   SVG joins from producing the visible triangular/diagonal spike.
*/
(function(){
  const near=(a,b,tol)=>Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b));

  function patchSfd(svg){
    if(svg.dataset.jumpFixed==='2') return;

    let series=[];
    try { series=JSON.parse(svg.dataset.series||'[]'); } catch { return; }
    if(!Array.isArray(series) || series.length<2) return;

    const w=1100,h=330,pad=Number(svg.dataset.pad)||56;
    const L=Number(svg.dataset.len)||1;
    const min=Number(svg.dataset.min),max=Number(svg.dataset.max);
    if(!Number.isFinite(min)||!Number.isFinite(max)||!L) return;

    const sx=x=>pad+(x/L)*(w-2*pad);
    const sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    const pt=q=>({x:sx(Number(q.x)),y:sy(Number(q.y))});

    const old=svg.querySelector('.chartLine');
    if(!old) return;

    const group=document.createElementNS('http://www.w3.org/2000/svg','g');
    group.classList.add('chartLineGroup');

    // Use the actual data range for a conservative jump tolerance. A point
    // load should have essentially the same x-coordinate on both sides.
    const xTol=Math.max(L*1e-5,1e-7);

    for(let i=1;i<series.length;i++){
      const a=series[i-1],b=series[i];
      const pa=pt(a),pb=pt(b);
      const dx=Math.abs(Number(b.x)-Number(a.x));
      const dy=Math.abs(Number(b.y)-Number(a.y));

      if(dx<=xTol && dy>0){
        const jump=document.createElementNS('http://www.w3.org/2000/svg','line');
        jump.setAttribute('x1',pa.x.toFixed(1));
        jump.setAttribute('y1',pa.y.toFixed(1));
        jump.setAttribute('x2',pb.x.toFixed(1));
        jump.setAttribute('y2',pb.y.toFixed(1));
        jump.setAttribute('class','chartLine sfdJump');
        jump.setAttribute('stroke-linecap','butt');
        jump.setAttribute('stroke-linejoin','miter');
        group.appendChild(jump);
      }else{
        const seg=document.createElementNS('http://www.w3.org/2000/svg','path');
        seg.setAttribute('d',`M ${pa.x.toFixed(1)} ${pa.y.toFixed(1)} L ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}`);
        seg.setAttribute('class','chartLine sfdSegment');
        seg.setAttribute('stroke-linecap','butt');
        seg.setAttribute('stroke-linejoin','miter');
        group.appendChild(seg);
      }
    }

    old.replaceWith(group);
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

/* Final distributed-load correction.
 * Zero intensity at one end keeps the same visual load direction as the
 * non-zero end instead of flipping the load envelope through the beam.
 */
(function(){
  const $$=s=>[...document.querySelectorAll(s)];

  function fixUdl(){
    const m=window.model;
    if(!m || typeof window.len!=='function') return;

    const L=Math.max(window.len()||1,1), pad=72, W=1200, beamY=100;
    const x=p=>pad+(p/L)*(W-2*pad);
    const h=v=>Math.min(78,Math.abs(v)*3.8+28);

    $$('.distributedLoad[data-load-id]').forEach(g=>{
      const id=+g.dataset.loadId;
      const l=(m.loads||[]).find(v=>+v.id===id);
      if(!l) return;

      const a=x(Number(l.from)||0), b=x(Number(l.to)||0);
      const v1=Number(l.value)||0, v2=Number(l.value2??l.value)||0;

      /* A zero endpoint does NOT mean the load changes from downward to
         upward. It means the triangular/trapezoidal load tapers to zero. */
      let sign=v1<0?-1:v1>0?1:(v2<0?-1:v2>0?1:-1);
      const side=v=>{
        const s=Math.abs(v)<1e-12?sign:Math.sign(v);
        return s<0 ? beamY-h(v) : beamY+h(v);
      };
      const y1=side(v1), y2=side(v2);

      const env=g.querySelector('.finalUdlEnvelope');
      if(env){
        if(env.tagName.toLowerCase()==='line'){
          env.setAttribute('x1',a); env.setAttribute('y1',y1);
          env.setAttribute('x2',b); env.setAttribute('y2',y2);
        }else{
          const midY=sign<0?beamY-18:beamY+18;
          env.setAttribute('points',`${a},${y1} ${(a+b)/2},${midY} ${b},${y2}`);
        }
      }

      const arrows=[...g.querySelectorAll('.finalUdlArrow')];
      const n=arrows.length||1;
      arrows.forEach((line,i)=>{
        const t=n===1?0:i/(n-1);
        const xx=a+(b-a)*t;
        const v=v1+(v2-v1)*t;
        const yy=y1+(y2-y1)*t;
        const loadSign=Math.abs(v)<1e-12?sign:Math.sign(v);
        const down=loadSign<0;
        line.setAttribute('x1',xx);
        line.setAttribute('y1',yy);
        line.setAttribute('x2',xx);
        line.setAttribute('y2',down?beamY-7:beamY+7);
        line.setAttribute('marker-end',`url(#${down?'fcPointArrow':'fcPointArrowUp'})`);
      });
    });
  }

  function install(){
    const oldRender=window.render;
    if(typeof oldRender==='function'){
      window.render=function(){oldRender();setTimeout(fixUdl,0);};
    }
    const oldBeam=window.renderBeam;
    if(typeof oldBeam==='function'){
      window.renderBeam=function(){oldBeam();setTimeout(fixUdl,0);};
    }
    setTimeout(fixUdl,50);
    setTimeout(fixUdl,250);
  }

  install();
})();

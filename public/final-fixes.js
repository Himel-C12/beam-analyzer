/* Final distributed-load and moment-label correction. */
(function(){
  const $$=s=>[...document.querySelectorAll(s)];

  function fixDiagram(){
    const m=window.model;
    if(!m || typeof window.len!=='function') return;

    const L=Math.max(window.len()||1,1), pad=72, W=1200, beamY=100;
    const x=p=>pad+(p/L)*(W-2*pad);
    const h=v=>Math.min(78,Math.abs(v)*3.8+28);

    /* UDL: zero intensity tapers to zero; it never flips from downward to upward. */
    $$('.distributedLoad[data-load-id]').forEach(g=>{
      const id=+g.dataset.loadId;
      const l=(m.loads||[]).find(v=>+v.id===id);
      if(!l) return;

      const a=x(Number(l.from)||0), b=x(Number(l.to)||0);
      const v1=Number(l.value)||0, v2=Number(l.value2??l.value)||0;
      let sign=v1<0?-1:v1>0?1:v2<0?-1:v2>0?1:-1;
      const side=v=>{
        const s=Math.abs(v)<1e-12?sign:Math.sign(v);
        return s<0 ? beamY-h(v) : beamY+h(v);
      };
      const y1=side(v1), y2=side(v2);

      const env=g.querySelector('.finalUdlEnvelope');
      if(env){
        if(env.tagName.toLowerCase()==='line'){
          env.setAttribute('x1',a);env.setAttribute('y1',y1);
          env.setAttribute('x2',b);env.setAttribute('y2',y2);
        }else{
          env.setAttribute('points',`${a},${y1} ${(a+b)/2},${sign<0?beamY-18:beamY+18} ${b},${y2}`);
        }
      }

      const arrows=[...g.querySelectorAll('.finalUdlArrow')];
      const n=arrows.length||1;
      arrows.forEach((line,i)=>{
        const t=n===1?0:i/(n-1),xx=a+(b-a)*t;
        const v=v1+(v2-v1)*t, yy=y1+(y2-y1)*t;
        const s=Math.abs(v)<1e-12?sign:Math.sign(v), down=s<0;
        line.setAttribute('x1',xx);line.setAttribute('y1',yy);
        line.setAttribute('x2',xx);line.setAttribute('y2',down?beamY-7:beamY+7);
        line.setAttribute('marker-end',`url(#${down?'fcPointArrow':'fcPointArrowUp'})`);
      });

      /* Keep the load label clear of a nearby applied moment. */
      const label=g.querySelector('.loadText');
      if(label){
        let labelX=(a+b)/2;
        const momentLoads=(m.loads||[]).filter(q=>q.type==='moment');
        if(momentLoads.some(q=>Math.abs(x(q.from)-labelX)<75)) labelX=a+(b-a)*0.28;
        label.setAttribute('x',labelX);
      }
    });

    /* Applied moment annotation is offset to the right of the arc so it does
       not sit on top of a UDL label or arrow. */
    $$('.momentLoad').forEach(g=>{
      const id=+g.dataset.id;
      const l=(m.loads||[]).find(v=>+v.id===id);
      if(!l) return;
      const xx=x(Number(l.from)||0);
      const shift=xx>W-260?-48:48;
      const label=g.querySelector('.momentLabel');
      const direction=g.querySelector('.momentDirection');
      if(label){label.setAttribute('x',xx+shift);label.setAttribute('y',beamY-54);}
      if(direction){direction.setAttribute('x',xx+shift);direction.setAttribute('y',beamY-38);}
    });
  }

  function install(){
    const oldRender=window.render;
    if(typeof oldRender==='function') window.render=function(){oldRender();setTimeout(fixDiagram,0);};
    const oldBeam=window.renderBeam;
    if(typeof oldBeam==='function') window.renderBeam=function(){oldBeam();setTimeout(fixDiagram,0);};
    setTimeout(fixDiagram,50);
    setTimeout(fixDiagram,250);
  }
  install();
})();

/* Small post-render correction for distributed-load direction. */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  function fixUdl(){
    const m=window.model;if(!m)return;
    const L=Math.max(window.len()||1,1),pad=72,W=1200,beamY=100;
    const x=p=>pad+(p/L)*(W-2*pad);
    $$('.distributedLoad[data-load-id]').forEach(g=>{
      const id=+g.dataset.loadId,l=(m.loads||[]).find(v=>+v.id===id);if(!l)return;
      const a=x(Number(l.from)||0),b=x(Number(l.to)||0),v1=Number(l.value)||0,v2=Number(l.value2??l.value)||0;
      const height=v=>Math.abs(v)*3.8+28;
      const y1=v1<0?beamY-height(v1):beamY+height(v1);
      const y2=v2<0?beamY-height(v2):beamY+height(v2);
      const env=g.querySelector('.finalUdlEnvelope');
      if(env){
        if(env.tagName.toLowerCase()==='line'){
          env.setAttribute('x1',a);env.setAttribute('y1',y1);env.setAttribute('x2',b);env.setAttribute('y2',y2);
        }else{
          env.setAttribute('points',`${a},${y1} ${(a+b)/2},${v1<0&&v2<0?beamY-18:beamY+18} ${b},${y2}`);
        }
      }
      const arrows=[...g.querySelectorAll('.finalUdlArrow')];
      const n=arrows.length||1;
      arrows.forEach((line,i)=>{
        const t=n===1?0:i/(n-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;
        const yy=y1+(y2-y1)*t,up=v>0;
        line.setAttribute('x1',xx);line.setAttribute('y1',yy);line.setAttribute('x2',xx);line.setAttribute('y2',up?beamY+7:beamY-7);
        line.setAttribute('marker-end',`url(#${up?'fcPointArrowUp':'fcPointArrow'})`);
      });
    });
  }
  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){oldRender();fixUdl();};
  const oldBeam=window.renderBeam;
  window.renderBeam=function(){oldBeam();fixUdl();};
  setTimeout(fixUdl,50);
})();

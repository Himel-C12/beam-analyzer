/* Beam Analyzer — chart label fit pass.
   Long numeric tick/annotation labels are scaled to their available SVG space
   instead of being clipped at the chart edge.
*/
(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  function fitTickLabels(svg){
    const ticks=[...svg.querySelectorAll('.chartTick')].filter(t=>t.getAttribute('text-anchor')==='end');
    ticks.forEach(t=>{
      const text=(t.textContent||'').trim();
      const x=Number(t.getAttribute('x'))||56;
      const available=Math.max(26,x-6);
      const estimated=text.length*7.2;
      if(estimated>available){
        t.setAttribute('font-size',String(Math.max(7,12*available/estimated)));
        t.setAttribute('textLength',String(available));
        t.setAttribute('lengthAdjust','spacingAndGlyphs');
      }else{
        t.removeAttribute('textLength');
        t.removeAttribute('lengthAdjust');
        t.removeAttribute('font-size');
      }
    });
  }
  function fitAnnotations(svg){
    const labels=[...svg.querySelectorAll('.cleanDiagramValue,.chartPointValue')];
    labels.forEach(t=>{
      const text=(t.textContent||'').trim();
      const x=Number(t.getAttribute('x'));
      if(!Number.isFinite(x))return;
      const edge=Math.min(x,1100-x);
      const base=Number(t.classList.contains('maxValue')?10.5:11)||11;
      if(text.length>=13 || edge<50){
        const factor=Math.min(1,Math.max(.68,(edge-8)/Math.max(1,text.length*5.7)));
        t.setAttribute('font-size',String(Math.max(7,base*factor)));
      }else t.removeAttribute('font-size');
    });
  }
  function patch(){$$('#charts svg[data-kind]').forEach(svg=>{fitTickLabels(svg);fitAnnotations(svg)})}
  const style=document.createElement('style');style.textContent=`
    #charts .chartTick{white-space:nowrap;dominant-baseline:auto}
    #charts .cleanDiagramValue,#charts .chartPointValue{vector-effect:non-scaling-stroke}
  `;document.head.appendChild(style);
  const charts=$('#charts');
  if(charts)new MutationObserver(()=>requestAnimationFrame(patch)).observe(charts,{childList:true,subtree:true});
  patch();setTimeout(patch,100);setTimeout(patch,500);
})();

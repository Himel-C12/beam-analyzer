/* Beam Analyzer — chart label fit + discontinuity continuity pass.
   Long numeric tick/annotation labels are scaled to their available SVG space.

   IMPORTANT:
   Point-load SFD jumps and applied-moment BMD jumps must be represented as
   two consecutive points at the same x-coordinate: (x,V-) -> (x,V+).
   The local internal-hinge solver previously appended those pairs after its
   sampled points and then sorted equal-x points by ordinate. That caused the
   SVG polyline to connect V+ -> V- -> V+, producing the visible triangular
   "bumps" at point loads.

   This pass repairs the returned series before the chart renderer sees them.
*/
(function(){
  'use strict';

  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v);
  const finite=v=>Number.isFinite(num(v));
  const EPS=1e-7;

  function near(a,b){
    return Math.abs(num(a)-num(b))<=EPS*Math.max(1,Math.abs(num(a)),Math.abs(num(b)));
  }

  /*
   * Repair a discontinuous diagram series.
   *
   * The numerical values are NOT recalculated here. We take the ordinate
   * immediately to the left and immediately to the right of each real load
   * position, remove every existing sample at that x, then insert the pair
   * in physical traversal order: left/pre-jump first, right/post-jump second.
   * This preserves the correct magnitude/sign while fixing only point order.
   */
  function repairDiscontinuities(series,positions){
    if(!Array.isArray(series)||!series.length||!positions.length)return series;

    let out=series.map(p=>Array.isArray(p)?[num(p[0]),num(p[1])]:p)
      .filter(p=>Array.isArray(p)&&finite(p[0])&&finite(p[1]));

    const xs=[...new Set(positions.map(num).filter(finite))].sort((a,b)=>a-b);

    for(const x of xs){
      let left=null,right=null;

      for(const p of out){
        if(p[0]<x-EPS && (!left||p[0]>left[0]))left=p;
        if(p[0]>x+EPS && (!right||p[0]<right[0]))right=p;
      }

      /* If the x-coordinate is at a series boundary, leave it alone. */
      if(!left||!right)continue;

      /* Remove all old samples at the discontinuity coordinate. */
      out=out.filter(p=>!near(p[0],x));

      /* Insert in traversal order. SVG will therefore draw a true vertical
         jump instead of a triangular spike. */
      out.push([x,left[1]],[x,right[1]]);
    }

    /* Stable x-only ordering is intentional. Equal-x pairs must retain the
       pre-jump -> post-jump insertion order. */
    out.sort((a,b)=>a[0]-b[0]);
    return out;
  }

  function repairSolverResponse(result){
    if(!result||!result.diagrams||typeof model==='undefined')return result;

    const loads=Array.isArray(model.loads)?model.loads:[];
    const pointPositions=loads
      .filter(l=>l&&l.type==='point')
      .map(l=>num(l.from))
      .filter(finite);

    const momentPositions=loads
      .filter(l=>l&&l.type==='moment')
      .map(l=>num(l.from))
      .filter(finite);

    /* Point loads create jumps in SFD. Applied moments create jumps in BMD. */
    result.diagrams.shear=repairDiscontinuities(result.diagrams.shear,pointPositions);
    result.diagrams.moment=repairDiscontinuities(result.diagrams.moment,momentPositions);

    return result;
  }

  /* The internal-hinge solver is installed by internal-hinge-v3/v5 before
     this file executes. Intercept its response and repair only the diagram
     point ordering. Normal StructureCalcs responses are also safely handled. */
  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await upstreamFetch(input,init);
    const url=typeof input==='string' ? input : (input&&input.url)||'';
    if(!url.includes('/api/beam/solve'))return response;

    try{
      const cloned=response.clone();
      const data=await cloned.json();
      const repaired=repairSolverResponse(data);
      return new Response(JSON.stringify(repaired),{
        status:response.status,
        statusText:response.statusText,
        headers:new Headers(response.headers)
      });
    }catch(e){
      console.warn('Beam Analyzer diagram continuity pass skipped:',e);
      return response;
    }
  };

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

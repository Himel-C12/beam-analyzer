/* Beam Analyzer — internal hinge API adapter v3.
   The main app's payload() and solveNow() are lexical functions, so they cannot
   be monkey-patched through window.payload/window.solveNow. This adapter works
   at the actual HTTP boundary and rewrites the request sent to StructureCalcs.

   UI model:
     supports: [{ type: 'internal-hinge', position: x }]

   StructureCalcs model:
     - split the beam at each internal hinge
     - the span beginning at the hinge carries connection: 'hinge'
     - remove the UI-only hinge from supports
*/
(function(){
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const EPS=1e-8;

  const near=(a,b)=>Math.abs(Number(a)-Number(b))<=EPS*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b)));

  function transform(payload){
    if(!payload || !Array.isArray(payload.spans) || !Array.isArray(payload.supports)) return payload;

    const hinges=[...new Set(payload.supports
      .filter(s=>s && s.type==='internal-hinge')
      .map(s=>Number(s.position))
      .filter(Number.isFinite))].sort((a,b)=>a-b);

    if(!hinges.length) return payload;

    const total=payload.spans.reduce((sum,s)=>sum+Number(s.length||0),0);
    if(!Number.isFinite(total) || total<=0 || hinges.some(h=>h<=EPS || h>=total-EPS)) return payload;

    const spans=[];
    let start=0;

    for(const original of payload.spans){
      const length=Number(original.length);
      const end=start+length;
      const cuts=[start,...hinges.filter(h=>h>start+EPS && h<end-EPS),end];

      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i], b=cuts[i+1];
        if(b-a<=EPS) continue;
        const segment={length:b-a,E:Number(original.E),I:Number(original.I)};
        // StructureCalcs defines connection on a span as the joint to the
        // PREVIOUS span at this span's left end.
        segment.connection=spans.length>0 && hinges.some(h=>near(h,a)) ? 'hinge' : 'rigid';
        spans.push(segment);
      }
      start=end;
    }

    // Safety pass for hinges that coincide with an existing span boundary.
    let pos=0;
    for(let i=0;i<spans.length;i++){
      if(i>0 && hinges.some(h=>near(h,pos))) spans[i].connection='hinge';
      pos+=Number(spans[i].length);
    }

    const supports=payload.supports
      .filter(s=>s && s.type!=='internal-hinge')
      .map(s=>({type:s.type,position:Number(s.position),...(s.settlement!==undefined?{settlement:Number(s.settlement||0)}:{})}));

    const out={...payload,spans,supports};
    return out;
  }

  window.__beamAnalyzerInternalHingeTransformV3=transform;

  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input && input.url) || '';
    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string'){
      return nativeFetch(input,init);
    }

    try{
      const original=JSON.parse(init.body);
      const transformed=transform(original);
      if(transformed===original) return nativeFetch(input,init);

      // Keep the browser request identical in every respect except the body.
      // This is the actual request boundary used by solveNow().
      return nativeFetch(input,{...init,body:JSON.stringify(transformed)});
    }catch(err){
      console.error('Internal hinge request transform failed:',err);
      return nativeFetch(input,init);
    }
  };
})();

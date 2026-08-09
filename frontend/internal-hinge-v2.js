/* Beam Analyzer — internal hinge solve adapter v2.
   The main app's solveNow() closes over its lexical payload() function, so the
   earlier window.payload wrapper cannot intercept the actual request. This
   adapter intercepts the global fetch call instead, which is the actual boundary
   between the UI model and the StructureCalcs API.
*/
(function(){
  const nativeFetch=window.fetch.bind(window);
  const EPS=1e-8;
  function near(a,b){return Math.abs(Number(a)-Number(b))<=EPS*Math.max(1,Math.abs(Number(a)),Math.abs(Number(b)))}
  function transform(payload){
    if(!payload||!Array.isArray(payload.spans)||!Array.isArray(payload.supports))return payload;
    const hinges=[...new Set(payload.supports.filter(s=>s&&s.type==='internal-hinge').map(s=>Number(s.position)).filter(Number.isFinite))].sort((a,b)=>a-b);
    if(!hinges.length)return payload;
    const total=payload.spans.reduce((sum,s)=>sum+Number(s.length||0),0);
    if(hinges.some(h=>h<=EPS||h>=total-EPS))return payload;
    const spans=[];let start=0;
    for(const original of payload.spans){
      const end=start+Number(original.length);
      const cuts=[start,...hinges.filter(h=>h>start+EPS&&h<end-EPS),end];
      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i],b=cuts[i+1];if(b-a<=EPS)continue;
        const segment={...original,length:b-a};delete segment.id;
        segment.connection=spans.length===0?'rigid':(hinges.some(h=>near(h,a))?'hinge':(original.connection||'rigid'));
        spans.push(segment);
      }
      start=end;
    }
    return {...payload,spans,supports:payload.supports.filter(s=>s&&s.type!=='internal-hinge')};
  }
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve')||!init||typeof init.body!=='string')return nativeFetch(input,init);
    try{
      const original=JSON.parse(init.body),transformed=transform(original);
      return transformed===original?nativeFetch(input,init):nativeFetch(input,{...init,body:JSON.stringify(transformed)});
    }catch(e){console.warn('Internal hinge adapter could not transform the solve request:',e);return nativeFetch(input,init)}
  };
  window.__beamAnalyzerInternalHingeTransform=transform;
})();

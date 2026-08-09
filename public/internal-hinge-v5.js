/* Beam Analyzer — internal-hinge payload fix v5
   v1 rewrites the payload into StructureCalcs span segments and removes the
   internal-hinge support. Restore the native beam model for hinge-containing
   analyses so the local v4 solver can intercept the request.
*/
(function(){
  'use strict';
  const base=window.payload;
  if(typeof base!=='function')return;
  function hasHinge(){
    return Array.isArray(model?.supports) &&
      model.supports.some(s=>s&&s.type==='internal-hinge');
  }
  function wrapped(){
    const p=base();
    if(!hasHinge())return p;
    return {
      units:unit==='imperial'?'imperial':'SI',
      spans:(model.spans||[]).map(s=>({length:+s.length,E:+s.E,I:+s.I})),
      supports:(model.supports||[]).map(s=>({
        type:s.type,position:+s.position,settlement:+(s.settlement||0)
      })),
      loads:(model.loads||[]).map(l=>{
        if(l.type==='point')return {type:'point',magnitude:+l.value,position:+l.from};
        if(l.type==='moment')return {type:'moment',magnitude:+l.value,position:+l.from};
        return {type:'udl',start:+l.value,end:+l.value2,from:+l.from,to:+l.to};
      })
    };
  }
  wrapped.__internalHingePayloadV5=true;
  window.payload=wrapped;
})();

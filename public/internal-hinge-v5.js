/* Beam Analyzer — internal-hinge payload fix v5
   v1 rewrites the payload into StructureCalcs span segments and removes the
   internal-hinge support. That is correct for the old API adapter, but it
   prevents the local v4 solver from ever seeing the hinge. Restore the native
   beam model for hinge-containing analyses so v4 can intercept the request.
*/
(function(){
  'use strict';
  const base=window.payload;
  if(typeof base!=='function')return;
  function hasHinge(){
    return Array.isArray(window.model?.supports) &&
      window.model.supports.some(s=>s&&s.type==='internal-hinge');
  }
  function wrapped(){
    const p=base();
    if(!hasHinge())return p;
    return {
      units:window.unit==='imperial'?'imperial':'SI',
      spans:(window.model.spans||[]).map(s=>({
        length:+s.length,E:+s.E,I:+s.I
      })),
      supports:(window.model.supports||[]).map(s=>({
        type:s.type,position:+s.position,settlement:+(s.settlement||0)
      })),
      loads:(window.model.loads||[]).map(l=>{
        if(l.type==='point')return {type:'point',magnitude:+l.value,position:+l.from};
        if(l.type==='moment')return {type:'moment',magnitude:+l.value,position:+l.from};
        return {type:'udl',start:+l.value,end:+l.value2,from:+l.from,to:+l.to};
      })
    };
  }
  wrapped.__internalHingePayloadV5=true;
  window.payload=wrapped;
})();

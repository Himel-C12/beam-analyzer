/* Beam Analyzer — internal-hinge hard intercept v6
   Do NOT send internal-hinge payloads to StructureCalcs.
   This layer intercepts the solve request itself and calls the deterministic
   local hinge solver directly. This avoids all StructureCalcs schema checks.
*/
(function(){
  'use strict';

  const upstream=window.fetch.bind(window);
  const num=v=>Number(v);

  function getModel(){
    try{
      if(typeof model!=='undefined' && model) return model;
    }catch(e){}
    return window.model||null;
  }

  function hasHinge(m){
    return !!m && Array.isArray(m.supports) &&
      m.supports.some(s=>s && s.type==='internal-hinge');
  }

  function nativePayload(m){
    let units='SI';
    try{ units=(typeof unit!=='undefined' && unit==='imperial')?'imperial':'SI'; }
    catch(e){ units=window.unit==='imperial'?'imperial':'SI'; }

    return {
      units,
      spans:(m.spans||[]).map(s=>({
        length:num(s.length), E:num(s.E), I:num(s.I)
      })),
      supports:(m.supports||[]).map(s=>({
        type:s.type,
        position:num(s.position),
        settlement:num(s.settlement||0)
      })),
      loads:(m.loads||[]).map(l=>{
        if(l.type==='point') return {
          type:'point',
          value:num(l.value),
          from:num(l.from),
          to:num(l.from)
        };
        if(l.type==='moment') return {
          type:'moment',
          value:num(l.value),
          from:num(l.from),
          to:num(l.from)
        };
        return {
          type:'udl',
          value:num(l.value),
          value2:num(l.value2),
          from:num(l.from),
          to:num(l.to)
        };
      })
    };
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input&&input.url)||'';

    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string'){
      return upstream(input,init);
    }

    try{
      const m=getModel();
      if(!hasHinge(m) || typeof window.__beamAnalyzerSolveInternalHinge!=='function'){
        return upstream(input,init);
      }

      const payload=nativePayload(m);
      const result=window.__beamAnalyzerSolveInternalHinge(payload);

      return new Response(JSON.stringify(result),{
        status:200,
        headers:{
          'Content-Type':'application/json',
          'Cache-Control':'no-store',
          'X-Engine-Version':'BeamAnalyzer-HingeSolver-2.0'
        }
      });
    }catch(error){
      console.error('Beam Analyzer internal-hinge solver:',error);
      return new Response(JSON.stringify({
        detail:error && error.message ? error.message : 'Internal hinge analysis failed.'
      }),{
        status:422,
        headers:{
          'Content-Type':'application/json',
          'Cache-Control':'no-store',
          'X-Engine-Version':'BeamAnalyzer-HingeSolver-2.0'
        }
      });
    }
  };
})();

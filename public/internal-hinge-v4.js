/* Beam Analyzer — internal-hinge bridge v4
   The UI payload uses StructureCalcs' public request schema (magnitude/position
   and start/end for UDLs). The local hinge solver uses the app's internal
   load representation (value/from/to). This bridge converts the payload before
   invoking the deterministic local solver from internal-hinge-v3.js.
*/
(function(){
  'use strict';
  const previousFetch=window.fetch.bind(window);
  const finite=v=>Number.isFinite(Number(v))?Number(v):NaN;

  function hasHinge(payload){
    return !!payload && Array.isArray(payload.supports) &&
      payload.supports.some(s=>s && s.type==='internal-hinge');
  }

  function normalize(payload){
    return {
      units:payload.units==='imperial'?'imperial':'SI',
      spans:(payload.spans||[]).map(s=>({
        length:finite(s.length), E:finite(s.E), I:finite(s.I)
      })),
      supports:(payload.supports||[]).map(s=>({
        type:s.type, position:finite(s.position), settlement:finite(s.settlement||0)
      })),
      loads:(payload.loads||[]).map(l=>{
        if(l.type==='point')return {
          type:'point', value:finite(l.magnitude), value2:0,
          from:finite(l.position), to:finite(l.position)
        };
        if(l.type==='moment')return {
          type:'moment', value:finite(l.magnitude), value2:0,
          from:finite(l.position), to:finite(l.position)
        };
        return {
          type:'udl', value:finite(l.start), value2:finite(l.end),
          from:finite(l.from), to:finite(l.to)
        };
      })
    };
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input&&input.url)||'';
    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string')
      return previousFetch(input,init);

    try{
      const payload=JSON.parse(init.body);
      if(!hasHinge(payload) || typeof window.__beamAnalyzerSolveInternalHinge!=='function')
        return previousFetch(input,init);

      const normalized=normalize(payload);
      const result=window.__beamAnalyzerSolveInternalHinge(normalized);
      return new Response(JSON.stringify(result),{
        status:200,
        headers:{
          'Content-Type':'application/json',
          'Cache-Control':'no-store',
          'X-Engine-Version':'BeamAnalyzer-HingeSolver-1.0'
        }
      });
    }catch(error){
      console.error('Internal hinge local solver failed:',error);
      return new Response(JSON.stringify({
        detail:error && error.message ? error.message : 'Internal hinge analysis failed.'
      }),{
        status:422,
        headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
      });
    }
  };
})();

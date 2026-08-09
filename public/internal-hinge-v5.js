/* Beam Analyzer — internal-hinge hard intercept
   Intercept the actual solve payload. Do not depend on the app's lexical `model`
   binding, because that can be unavailable to this adapter across script scopes.
*/
(function(){
  'use strict';

  const upstream=window.fetch.bind(window);

  function hasHinge(payload){
    return !!payload && Array.isArray(payload.supports) &&
      payload.supports.some(s=>s && s.type==='internal-hinge');
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input&&input.url)||'';

    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string'){
      return upstream(input,init);
    }

    try{
      const payload=JSON.parse(init.body);

      if(!hasHinge(payload) || typeof window.__beamAnalyzerSolveInternalHinge!=='function'){
        return upstream(input,init);
      }

      const result=window.__beamAnalyzerSolveInternalHinge(payload);
      return new Response(JSON.stringify(result),{
        status:200,
        headers:{
          'Content-Type':'application/json',
          'Cache-Control':'no-store',
          'X-Engine-Version':'BeamAnalyzer-HingeSolver-2.1'
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
          'X-Engine-Version':'BeamAnalyzer-HingeSolver-2.1'
        }
      });
    }
  };
})();

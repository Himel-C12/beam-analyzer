/* Beam Analyzer — local solver for every beam
 * The deterministic Euler-Bernoulli solver already used for internal hinges
 * is capable of handling ordinary pin/roller/fixed beams too. Route every
 * beam solve through it so analysis never depends on the external worker.
 */
(function(){
  'use strict';
  const upstream=window.fetch.bind(window);

  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input&&input.url)||'';
    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string'){
      return upstream(input,init);
    }

    try{
      const payload=JSON.parse(init.body);
      const solver=window.__beamAnalyzerSolveInternalHinge;
      if(typeof solver!=='function') return upstream(input,init);

      const result=solver(payload);
      return new Response(JSON.stringify(result),{
        status:200,
        headers:{
          'Content-Type':'application/json',
          'Cache-Control':'no-store',
          'X-Engine-Version':'BeamAnalyzer-Local-DirectStiffness-1.0'
        }
      });
    }catch(error){
      console.error('Beam Analyzer local solver:',error);
      return new Response(JSON.stringify({
        detail:error && error.message ? error.message : 'Local beam analysis failed.'
      }),{
        status:422,
        headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
      });
    }
  };
})();

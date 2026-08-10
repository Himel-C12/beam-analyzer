/* Beam Analyzer — final solve payload normalizer
 * The UI model uses value/from/to, while app.js historically emitted
 * StructureCalcs-style magnitude/position (and start/end for UDL).
 * Normalize the outgoing request before it reaches either local or API solver.
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
      const p=JSON.parse(init.body);
      if(Array.isArray(p.loads)){
        p.loads=p.loads.map(l=>{
          const out={...l};
          if(l.type==='point' || l.type==='moment'){
            const x=Number(l.position ?? l.from);
            const v=Number(l.magnitude ?? l.value);
            out.value=v;
            out.from=x;
            out.to=x;
            out.position=x;
            out.magnitude=v;
            out.value2=0;
          }else if(l.type==='udl'){
            const q0=Number(l.start ?? l.value);
            const q1=Number(l.end ?? l.value2 ?? q0);
            out.value=q0;
            out.value2=q1;
            out.from=Number(l.from);
            out.to=Number(l.to);
          }
          return out;
        });
      }
      return upstream(input,{...init,body:JSON.stringify(p)});
    }catch(error){
      return upstream(input,init);
    }
  };
})();

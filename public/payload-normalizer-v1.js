/* Beam Analyzer — final solve payload normalizer
 * Normalize the saved UI model into the solver payload.
 * Angular point loads are reduced to their vertical component here so
 * later payload transforms cannot accidentally restore the original force.
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

          if(l.type==='point'){
            const x=Number(l.position ?? l.from);
            const raw=Number(l.magnitude ?? l.value);
            const angleDeg=Number.isFinite(Number(l.angle)) ? Number(l.angle) : 0;
            const vertical=Math.abs(angleDeg) < 1e-12
              ? raw
              : raw*Math.cos(angleDeg*Math.PI/180);

            out.value=vertical;
            out.value2=0;
            out.from=x;
            out.to=x;
            out.position=x;
            out.magnitude=vertical;
            delete out.angle;
            return out;
          }

          if(l.type==='moment'){
            const x=Number(l.position ?? l.from);
            const v=Number(l.magnitude ?? l.value);
            out.value=v;
            out.from=x;
            out.to=x;
            out.position=x;
            out.magnitude=v;
            out.value2=0;
            return out;
          }

          if(l.type==='udl'){
            const q0=Number(l.start ?? l.value);
            const q1=Number(l.end ?? l.value2 ?? q0);
            out.value=q0;
            out.value2=q1;
            out.from=Number(l.from);
            out.to=Number(l.to);
            return out;
          }

          return out;
        });
      }

      return upstream(input,{...init,body:JSON.stringify(p)});
    }catch(error){
      console.warn('Beam Analyzer payload normalizer:',error);
      return upstream(input,init);
    }
  };
})();

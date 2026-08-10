/* Beam Analyzer — load position normalization
 * Keep point/moment coordinates consistent across all UI/solver adapters.
 * Some UI fixes expose a point/moment coordinate as `position`, while the
 * direct-stiffness solver consumes `from`. Normalize both before solving.
 */
(function(){
  'use strict';
  const base=window.__beamAnalyzerSolveInternalHinge;
  if(typeof base!=='function') return;

  const num=v=>Number(v);
  const finite=v=>Number.isFinite(num(v))?num(v):NaN;

  window.__beamAnalyzerSolveInternalHinge=function(payload){
    if(!payload || !Array.isArray(payload.loads)) return base(payload);

    const p={...payload,
      spans:Array.isArray(payload.spans)?payload.spans.map(s=>({
        ...s,
        length:finite(s.length), E:finite(s.E), I:finite(s.I)
      })):payload.spans,
      supports:Array.isArray(payload.supports)?payload.supports.map(s=>({
        ...s,
        position:finite(s.position), settlement:finite(s.settlement||0)
      })):payload.supports,
      loads:payload.loads.map(l=>{
        const out={...l};
        out.value=finite(l.value);
        if(l.value2!=null) out.value2=finite(l.value2);

        // Point and moment loads have exactly one coordinate.
        // Accept either `from` or `position` and always expose both.
        if(l.type==='point' || l.type==='moment'){
          const x=finite(l.from!=null?l.from:l.position);
          out.from=x;
          out.to=x;
          out.position=x;
          out.value2=0;
        }else if(l.type==='udl'){
          out.from=finite(l.from!=null?l.from:l.position);
          out.to=finite(l.to!=null?l.to:out.from);
        }
        return out;
      })
    };

    return base(p);
  };
})();

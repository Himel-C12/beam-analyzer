/* Beam Analyzer — internal-hinge unit-consistency fix v1
   The deterministic hinge solver uses E/I stiffness units directly. In Imperial
   mode that requires geometry in inches and distributed loads in kip/in.
   The UI, however, stores/displays ft and kip/ft. This adapter converts the
   Imperial payload to a consistent inch/kip system before solving, then converts
   the returned diagrams back to the UI units.
*/
(function(){
  'use strict';
  const base=window.__beamAnalyzerSolveInternalHinge;
  if(typeof base!=='function') return;

  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v))?n(v):0;
  const mapPoint=(p)=>[n(p[0])/12,n(p[1])];
  const mapMoment=(p)=>[n(p[0])/12,n(p[1])/12];
  const mapDisp=(p)=>[n(p[0])/12,n(p[1])/12];
  const mapRot=(p)=>[n(p[0])/12,n(p[1])];

  function convertResult(r){
    if(!r||!r.diagrams) return r;
    const out={...r,diagrams:{...r.diagrams}};
    if(Array.isArray(r.diagrams.shear)) out.diagrams.shear=r.diagrams.shear.map(mapPoint);
    if(Array.isArray(r.diagrams.moment)) out.diagrams.moment=r.diagrams.moment.map(mapMoment);
    if(Array.isArray(r.diagrams.deflection)) out.diagrams.deflection=r.diagrams.deflection.map(mapDisp);
    if(Array.isArray(r.diagrams.rotation)) out.diagrams.rotation=r.diagrams.rotation.map(mapRot);
    if(r.extremes){
      out.extremes=JSON.parse(JSON.stringify(r.extremes));
      for(const key of ['shear','moment','deflection']){
        const e=out.extremes[key];
        if(!e) continue;
        const factor=key==='moment'?1/12:key==='deflection'?1/12:1;
        for(const side of ['max','min','abs']) if(e[side]){
          e[side].position=n(e[side].position)/12;
          e[side].value=n(e[side].value)*factor;
        }
      }
    }
    out.meta={...(r.meta||{}),engineVersion:'BeamAnalyzer-HingeSolver-1.1'};
    return out;
  }

  window.__beamAnalyzerSolveInternalHinge=function(payload){
    if(!payload||payload.units!=='imperial') return base(payload);

    const p={
      units:'imperial',
      spans:(payload.spans||[]).map(s=>({
        length:finite(s.length)*12,
        E:finite(s.E),
        I:finite(s.I)
      })),
      supports:(payload.supports||[]).map(s=>({
        type:s.type,
        position:finite(s.position)*12,
        settlement:finite(s.settlement)*12
      })),
      loads:(payload.loads||[]).map(l=>{
        if(l.type==='point') return {
          type:'point', value:finite(l.value), value2:0,
          from:finite(l.from)*12, to:finite(l.from)*12
        };
        if(l.type==='moment') return {
          type:'moment', value:finite(l.value), value2:0,
          from:finite(l.from)*12, to:finite(l.from)*12
        };
        return {
          type:'udl',
          value:finite(l.value)/12,
          value2:(l.value2==null?finite(l.value):finite(l.value2))/12,
          from:finite(l.from)*12,
          to:finite(l.to)*12
        };
      })
    };

    return convertResult(base(p));
  };
})();

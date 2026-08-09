/* Beam Analyzer — internal-hinge result adapter.
   1) Converts the deterministic local solver's Imperial inch/kip result back
      to the UI's ft/kip/kip-ft/in units.
   2) Densifies diagram samples so SFD/BMD/deflection render cleanly.
*/
(function(){
  'use strict';
  const base=window.__beamAnalyzerSolveInternalHinge;
  if(typeof base!=='function') return;

  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v))?n(v):0;

  function mapResult(r){
    if(!r||!r.diagrams)return r;
    const out={...r,diagrams:{...r.diagrams}};

    if(Array.isArray(r.diagrams.shear)) out.diagrams.shear=r.diagrams.shear.map(p=>[n(p[0])/12,n(p[1])]);
    if(Array.isArray(r.diagrams.moment)) out.diagrams.moment=r.diagrams.moment.map(p=>[n(p[0])/12,n(p[1])/12]);
    if(Array.isArray(r.diagrams.deflection)) out.diagrams.deflection=r.diagrams.deflection.map(p=>[n(p[0])/12,n(p[1])/12]);
    if(Array.isArray(r.diagrams.rotation)) out.diagrams.rotation=r.diagrams.rotation.map(p=>[n(p[0])/12,n(p[1])]);

    if(r.extremes){
      out.extremes=JSON.parse(JSON.stringify(r.extremes));
      for(const key of ['shear','moment','deflection']){
        const e=out.extremes[key];
        if(!e)continue;
        const factor=key==='moment'?1/12:key==='deflection'?1/12:1;
        for(const side of ['max','min','abs'])if(e[side]){
          e[side].position=n(e[side].position)/12;
          e[side].value=n(e[side].value)*factor;
        }
      }
    }
    return out;
  }

  // Add intermediate points without ever interpolating across a true jump.
  // This makes the plotted curves visually smooth while preserving exact
  // point-load discontinuities in the SFD.
  function densify(series,steps=8){
    if(!Array.isArray(series)||series.length<2)return series;
    const out=[];
    for(let i=0;i<series.length-1;i++){
      const a=series[i],b=series[i+1];
      out.push(a);
      const x1=n(a[0]),x2=n(b[0]);
      if(Math.abs(x2-x1)<1e-10)continue;
      for(let k=1;k<steps;k++){
        const t=k/steps;
        out.push([x1+(x2-x1)*t,n(a[1])+(n(b[1])-n(a[1]))*t]);
      }
    }
    out.push(series[series.length-1]);
    return out;
  }

  function polish(r){
    if(!r||!r.diagrams)return r;
    const out={...r,diagrams:{...r.diagrams}};
    for(const key of ['shear','moment','deflection','rotation']){
      if(Array.isArray(out.diagrams[key]))out.diagrams[key]=densify(out.diagrams[key],8);
    }
    out.meta={...(r.meta||{}),engineVersion:'BeamAnalyzer-HingeSolver-2.2'};
    return out;
  }

  window.__beamAnalyzerSolveInternalHinge=function(payload){
    if(!payload||payload.units!=='imperial')return polish(base(payload));

    const p={
      units:'imperial',
      spans:(payload.spans||[]).map(s=>({length:finite(s.length)*12,E:finite(s.E),I:finite(s.I)})),
      supports:(payload.supports||[]).map(s=>({type:s.type,position:finite(s.position)*12,settlement:finite(s.settlement)*12})),
      loads:(payload.loads||[]).map(l=>{
        if(l.type==='point')return {type:'point',value:finite(l.value),value2:0,from:finite(l.from)*12,to:finite(l.from)*12};
        if(l.type==='moment')return {type:'moment',value:finite(l.value),value2:0,from:finite(l.from)*12,to:finite(l.from)*12};
        return {type:'udl',value:finite(l.value)/12,value2:(l.value2==null?finite(l.value):finite(l.value2))/12,from:finite(l.from)*12,to:finite(l.to)*12};
      })
    };
    return polish(mapResult(base(p)));
  };
})();
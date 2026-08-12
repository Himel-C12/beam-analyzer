/* Beam Analyzer — reject numerically unstable internal-hinge results.
 * A pin/roller beam with a free internal hinge can form a mechanism. Do not
 * display enormous pseudo-deflections or non-equilibrated reactions as a
 * valid solution.
 */
(function(){
  'use strict';
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const rel=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(a),Math.abs(b));

  function guard(result,payload){
    if(!result||!Array.isArray(result.reactions))return result;

    const reactions=result.reactions.reduce((s,r)=>s+(finite(r.vertical)?n(r.vertical):0),0);
    const loads=(payload?.loads||[]).reduce((s,l)=>{
      if(l?.type==='point')return s+n(l.value||0);
      if(l?.type==='udl'){
        const a=n(l.from),b=n(l.to),q0=n(l.value),q1=n(l.value2==null?l.value:l.value2);
        if(!(b>a))return s;
        return s+(q0+q1)*(b-a)/2;
      }
      return s;
    },0);

    const all=[];
    for(const key of ['deflection','rotation','shear','moment']){
      const series=result.diagrams?.[key];
      if(Array.isArray(series))for(const p of series){
        if(!Array.isArray(p)||!finite(p[1]))throw new Error(`Analysis produced an invalid ${key} diagram.`);
        all.push(Math.abs(n(p[1])));
      }
    }

    const maxDef=(result.diagrams?.deflection||[]).reduce((m,p)=>Math.max(m,Math.abs(n(p?.[1]))),0);
    const length=(payload?.spans||[]).reduce((s,e)=>s+n(e.length||0),0);

    // Equilibrium is independent of the stiffness scale. A large mismatch
    // means the stiffness result is not a physically valid solution.
    if(Math.abs(loads)>1e-10 && rel(reactions,-loads)>1e-7){
      throw new Error(`The beam model is unstable: vertical reactions do not satisfy equilibrium (ΣR = ${reactions.toPrecision(6)}, ΣP = ${(-loads).toPrecision(6)}). Check the internal hinge and supports.`);
    }

    // A mechanism can slip through a poorly conditioned stiffness solve and
    // return astronomical displacements instead of throwing. Reject those.
    if(maxDef>Math.max(1e8,Math.pow(Math.max(length,1),4)*1e6)){
      throw new Error('The beam model is unstable: the internal hinge creates a mechanism, so no finite deflection solution exists. Add an appropriate restraint or remove the hinge.');
    }

    return result;
  }

  const install=()=>{
    const base=window.__beamAnalyzerSolveInternalHinge;
    if(typeof base!=='function'||base.__stabilityGuard)return false;
    function wrapped(payload){return guard(base(payload),payload)}
    wrapped.__stabilityGuard=true;
    window.__beamAnalyzerSolveInternalHinge=wrapped;
    return true;
  };

  install();
  setTimeout(install,0);
  setTimeout(install,100);
})();

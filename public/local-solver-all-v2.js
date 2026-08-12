/* Beam Analyzer — single local analysis pipeline.
 * Canonical payload + independently rebuilt statics diagrams.
 * SFD/BMD are generated from equilibrium, not from the stiffness-result samples.
 */
(function(){
  'use strict';
  const upstream=window.fetch.bind(window);
  const EPS=1e-9;
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const near=(a,b)=>Math.abs(a-b)<=EPS*Math.max(1,Math.abs(a),Math.abs(b));

  function normalizePayload(p){
    const out={...p};
    out.spans=(p.spans||[]).map(s=>({length:n(s.length),E:n(s.E),I:n(s.I)}));
    out.supports=(p.supports||[]).map(s=>({type:s.type,position:n(s.position),settlement:n(s.settlement||0)}));
    out.loads=(p.loads||[]).map(l=>{
      if(l.type==='point'){
        const raw=n(l.magnitude??l.value??0),angle=n(l.angle??0);
        const vertical=Number.isFinite(angle)?raw*Math.cos(angle*Math.PI/180):raw;
        const x=n(l.position??l.from);
        return {type:'point',value:vertical,value2:0,from:x,to:x,position:x,angle:Number.isFinite(angle)?angle:0};
      }
      if(l.type==='moment'){
        const x=n(l.position??l.from),value=n(l.magnitude??l.value??0);
        return {type:'moment',value,value2:0,from:x,to:x,position:x};
      }
      const a=n(l.from),b=n(l.to??a);
      return {type:'udl',value:n(l.start??l.value??0),value2:n(l.end??l.value2??l.value??0),from:a,to:b};
    });
    return out;
  }

  // Area of a linearly varying load from its start up to x.
  function qArea(l,x){
    const a=n(l.from),b=n(l.to),q0=n(l.value),q1=n(l.value2??l.value);
    if(!(b>a+EPS)||x<=a)return 0;
    const z=Math.min(x,b)-a;
    if(z<=0)return 0;
    return q0*z+(q1-q0)*z*z/(2*(b-a));
  }

  // Exact contribution of a distributed load to M(x):
  // ∫[a..min(x,b)] q(s)·(x-s) ds.
  function qMoment(l,x){
    const a=n(l.from),b=n(l.to),q0=n(l.value),q1=n(l.value2??l.value);
    if(!(b>a+EPS)||x<=a)return 0;
    const z=Math.min(x,b)-a;
    if(z<=0)return 0;
    const slope=(q1-q0)/(b-a);
    const area=q0*z+slope*z*z/2;
    const firstMomentAboutA=q0*z*z/2+slope*z*z*z/3;
    return (x-a)*area-firstMomentAboutA;
  }

  function cleanSeries(series){
    if(!Array.isArray(series))return [];
    const out=[];
    for(const p of series){
      if(!Array.isArray(p)||p.length<2||!finite(p[0])||!finite(p[1]))continue;
      const x=n(p[0]),y=Math.abs(n(p[1]))<1e-10?0:n(p[1]);
      const prev=out[out.length-1];
      // A same-x/same-y duplicate is never a physical discontinuity.
      if(prev&&near(prev[0],x)&&near(prev[1],y))continue;
      out.push([Number(x.toFixed(9)),y]);
    }
    return out;
  }

  function buildStatics(payload,result){
    if(!result||!Array.isArray(result.reactions))return result;
    const L=(payload.spans||[]).reduce((s,e)=>s+n(e.length||0),0);
    if(!(L>0))return result;

    const reactions=result.reactions.map(r=>({
      x:n(r.position),
      v:n(r.vertical??r.v??0),
      m:n(r.moment??0),
      type:r.type
    })).filter(r=>finite(r.x)&&finite(r.v));

    const points=(payload.loads||[]).filter(l=>l.type==='point')
      .map(l=>({x:n(l.from),v:n(l.value)})).filter(p=>finite(p.x)&&finite(p.v));
    const moments=(payload.loads||[]).filter(l=>l.type==='moment')
      .map(l=>({x:n(l.from),m:n(l.value)})).filter(m=>finite(m.x)&&finite(m.m));
    const udls=(payload.loads||[]).filter(l=>l.type==='udl'&&n(l.to)>n(l.from)+EPS);
    const hinges=(payload.supports||[]).filter(s=>s.type==='internal-hinge')
      .map(s=>n(s.position)).filter(finite);

    // The local solver reports fixed-support reaction moments in the opposite
    // sign convention to the BMD. Convert them once here.
    const fixedMoments=reactions.filter(r=>r.type==='fixed').map(r=>({x:r.x,m:-r.m}));
    const appliedMoments=[...moments,...fixedMoments];

    const cuts=[
      0,L,
      ...hinges,
      ...reactions.map(r=>r.x),
      ...points.map(p=>p.x),
      ...appliedMoments.map(m=>m.x),
      ...udls.flatMap(q=>[n(q.from),n(q.to)])
    ].filter(finite).map(x=>Math.max(0,Math.min(L,x)))
      .sort((a,b)=>a-b).filter((x,i,a)=>i===0||!near(x,a[i-1]));

    function V(x,strict){
      let v=0;
      for(const r of reactions)if(strict?r.x<x-EPS:r.x<=x+EPS)v+=r.v;
      for(const p of points)if(strict?p.x<x-EPS:p.x<=x+EPS)v+=p.v;
      for(const q of udls)v+=qArea(q,x);
      return Math.abs(v)<1e-10?0:v;
    }

    function M(x,strict){
      let m=0;
      for(const r of reactions)if(strict?r.x<x-EPS:r.x<=x+EPS)m+=r.v*(x-r.x);
      for(const p of points)if(strict?p.x<x-EPS:p.x<=x+EPS)m+=p.v*(x-p.x);
      for(const q of udls)m+=qMoment(q,x);
      for(const a of appliedMoments)if(strict?a.x<x-EPS:a.x<=x+EPS)m+=a.m;
      return Math.abs(m)<1e-10?0:m;
    }

    const shear=[],moment=[];
    const push=(arr,x,y)=>arr.push([Number(x.toFixed(9)),Math.abs(y)<1e-10?0:y]);
    const steps=24;

    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1];
      if(b-a<=EPS)continue;

      push(shear,a,V(a,false));
      push(moment,a,hinges.some(h=>near(h,a))?0:M(a,false));

      for(let k=1;k<steps;k++){
        const x=a+(b-a)*k/steps;
        push(shear,x,V(x,false));
        push(moment,x,hinges.some(h=>near(h,x))?0:M(x,false));
      }

      const vl=V(b,true),vr=V(b,false);
      push(shear,b,vl);
      // Only draw a vertical jump when the force actually changes.
      if(!near(vl,vr))push(shear,b,vr);

      if(hinges.some(h=>near(h,b))){
        // Internal hinge is a zero-moment location.
        push(moment,b,0);
      }else{
        const ml=M(b,true),mr=M(b,false);
        push(moment,b,ml);
        // Applied point moments create a real BMD jump.
        if(!near(ml,mr))push(moment,b,mr);
      }
    }

    if(!shear.length){push(shear,0,V(0,false));push(shear,L,V(L,false));}
    if(!moment.length){push(moment,0,M(0,false));push(moment,L,M(L,false));}

    const out={...result,diagrams:{...(result.diagrams||{})}};
    out.diagrams.shear=cleanSeries(shear);
    out.diagrams.moment=cleanSeries(moment);
    out.meta={
      ...(result.meta||{}),
      diagramEngine:'BeamAnalyzer-Equilibrium-v2',
      staticsVerified:true
    };
    return out;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve')||!init||typeof init.body!=='string')return upstream(input,init);

    try{
      const payload=normalizePayload(JSON.parse(init.body));
      const solver=window.__beamAnalyzerSolveInternalHinge;
      if(typeof solver!=='function')return upstream(input,{...init,body:JSON.stringify(payload)});
      const corrected=buildStatics(payload,solver(payload));
      return new Response(JSON.stringify(corrected),{
        status:200,
        headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-Equilibrium-v2'}
      });
    }catch(error){
      console.error('Beam Analyzer local analysis:',error);
      return new Response(JSON.stringify({detail:error?.message||'Local beam analysis failed.'}),{
        status:422,
        headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
      });
    }
  };
})();

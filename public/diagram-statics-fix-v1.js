/* Beam Analyzer — exact statics diagram correction.
   Rebuild SFD/BMD from the solved support reactions and the actual load payload.
   This fixes the distributed-load moment integration and keeps true SFD jumps
   vertical without creating artificial breaks when both sides have the same value.
*/
(function(){
  'use strict';
  const upstream=window.fetch.bind(window);
  const EPS=1e-9;

  const n=v=>Number(v);
  const near=(a,b)=>Math.abs(a-b)<=EPS*Math.max(1,Math.abs(a),Math.abs(b));
  const finite=v=>Number.isFinite(n(v));

  function uniqueSorted(a){
    return a.filter(finite).map(n).sort((a,b)=>a-b).filter((x,i,s)=>i===0||!near(x,s[i-1]));
  }

  function buildDiagrams(payload,result){
    if(!result||!Array.isArray(result.reactions)||!result.diagrams)return result;
    const spans=Array.isArray(payload.spans)?payload.spans:[];
    const L=spans.reduce((s,x)=>s+n(x.length||0),0);
    if(!(L>0))return result;

    const supports=Array.isArray(payload.supports)?payload.supports:[];
    const reactions=result.reactions.map(r=>({
      x:n(r.position),
      f:n(r.vertical??r.v??0),
      m:n(r.moment??0)
    })).filter(r=>finite(r.x)&&finite(r.f)&&finite(r.m));

    const loads=Array.isArray(payload.loads)?payload.loads:[];
    const points=loads.filter(l=>l.type==='point').map(l=>({x:n(l.from??l.position),f:n(l.value??l.magnitude??0)})).filter(p=>finite(p.x)&&finite(p.f));
    const moments=loads.filter(l=>l.type==='moment').map(l=>({x:n(l.from??l.position),m:n(l.value??l.magnitude??0)})).filter(p=>finite(p.x)&&finite(p.m));
    const udls=loads.filter(l=>l.type==='udl').map(l=>({
      a:n(l.from),b:n(l.to),q0:n(l.value??l.start??0),q1:n(l.value2??l.end??l.value??l.start??0)
    })).filter(l=>finite(l.a)&&finite(l.b)&&finite(l.q0)&&finite(l.q1)&&l.b>l.a+EPS);

    const cuts=uniqueSorted([0,L,
      ...supports.map(s=>n(s.position)),
      ...reactions.map(r=>r.x),
      ...points.map(p=>p.x),
      ...moments.map(p=>p.x),
      ...udls.flatMap(l=>[l.a,l.b])
    ].map(x=>Math.max(0,Math.min(L,x))));

    function qInt(l,x){
      if(x<=l.a+EPS)return 0;
      const z=Math.min(x,l.b)-l.a;
      if(z<=0)return 0;
      const slope=(l.q1-l.q0)/(l.b-l.a);
      return l.q0*z+slope*z*z/2;
    }

    function qMomentAboutX(l,x){
      if(x<=l.a+EPS)return 0;
      const z=Math.min(x,l.b)-l.a;
      if(z<=0)return 0;
      const slope=(l.q1-l.q0)/(l.b-l.a);
      const resultant=l.q0*z+slope*z*z/2;
      const firstAboutA=l.q0*z*z/2+slope*z*z*z/3;
      return (x-l.a)*resultant-firstAboutA;
    }

    function sideLess(pos,x,right){
      return right ? pos<=x+EPS : pos<x-EPS;
    }

    function statAt(x,right){
      let V=0,M=0;
      for(const r of reactions){
        if(sideLess(r.x,x,right)){V+=r.f;M+=r.f*(x-r.x);if(near(r.x,x))M+=r.m;}
      }
      for(const p of points){
        if(sideLess(p.x,x,right)){V+=p.f;M+=p.f*(x-p.x);}
      }
      for(const l of udls){V+=qInt(l,x);M+=qMomentAboutX(l,x);}
      for(const mm of moments){if(sideLess(mm.x,x,right))M+=mm.m;}
      return {V,M};
    }

    function push(arr,x,y){
      if(Math.abs(y)<1e-10)y=0;
      arr.push([Number(x.toFixed(9)),y]);
    }

    const shear=[],moment=[];
    const steps=16;

    // Sample only the open part of each interval. The endpoint is added once
    // below as the left/right value, preventing duplicate equal-valued points.
    for(let c=0;c<cuts.length-1;c++){
      const a=cuts[c],b=cuts[c+1],dx=b-a;
      if(dx<=EPS)continue;
      for(let k=0;k<steps;k++){
        if(c>0&&k===0)continue;
        const x=a+dx*k/steps;
        const s=statAt(x,k===0);
        push(shear,x,s.V);push(moment,x,s.M);
      }
      const left=statAt(b,false),right=statAt(b,true);
      if(!near(left.V,right.V)){
        push(shear,b,left.V);push(shear,b,right.V);
      }else{
        push(shear,b,right.V);
      }
      if(!near(left.M,right.M)){
        push(moment,b,left.M);push(moment,b,right.M);
      }else{
        push(moment,b,right.M);
      }
    }

    const out={...result,diagrams:{...result.diagrams,shear,moment}};
    out.extremes={...(result.extremes||{})};
    function extrema(series){
      if(!series.length)return null;
      let max=series[0],min=series[0];
      for(const p of series){if(p[1]>max[1])max=p;if(p[1]<min[1])min=p;}
      return {max:{value:max[1],position:max[0]},min:{value:min[1],position:min[0]},abs:{value:Math.max(Math.abs(max[1]),Math.abs(min[1])),position:Math.abs(max[1])>=Math.abs(min[1])?max[0]:min[0]}};
    }
    out.extremes.shear=extrema(shear);
    out.extremes.moment=extrema(moment);
    out.meta={...(result.meta||{}),diagramEngine:'BeamAnalyzer-Exact-Statics-1.0'};
    return out;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?(input):(input&&input.url)||'';
    if(!url.includes('/api/beam/solve'))return upstream(input,init);
    const response=await upstream(input,init);
    try{
      if(!response.ok)return response;
      const text=await response.text();
      const result=JSON.parse(text);
      if(!result||!result.diagrams)return new Response(text,{status:response.status,headers:response.headers});
      let payload={};
      try{payload=JSON.parse(init?.body||'{}')}catch{}
      const corrected=buildDiagrams(payload,result);
      return new Response(JSON.stringify(corrected),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-Exact-Statics-1.0'}});
    }catch(error){
      console.error('Beam Analyzer diagram correction:',error);
      return response;
    }
  };
})();

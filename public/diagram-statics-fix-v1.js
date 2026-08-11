/* Beam Analyzer — exact SFD/BMD reconstruction v2
 * Rebuild shear and bending moment directly from solved reactions and loads.
 * Internal hinges force M = 0. Point-load angles are reduced to the vertical
 * component here as a defensive measure so diagram data matches the solver.
 */
(function(){
  'use strict';
  const upstream=window.fetch.bind(window);
  const EPS=1e-9;
  const n=v=>Number(v);
  const near=(a,b)=>Math.abs(a-b)<=EPS*Math.max(1,Math.abs(a),Math.abs(b));
  const finite=v=>Number.isFinite(n(v));
  const uniqueSorted=a=>a.filter(finite).map(n).sort((a,b)=>a-b).filter((x,i,s)=>i===0||!near(x,s[i-1]));

  function pointForce(l){
    const raw=n(l.value??l.magnitude??0), ang=Number.isFinite(n(l.angle))?n(l.angle):0;
    return raw*Math.cos(ang*Math.PI/180);
  }

  function qArea(l,u,v){
    const a=n(l.from),b=n(l.to),lo=Math.max(a,u),hi=Math.min(b,v);
    if(!(hi>lo+EPS))return 0;
    const q0=n(l.value??l.start??0),q1=n(l.value2??l.end??l.value??l.start??0),m=(q1-q0)/(b-a);
    const z1=lo-a,z2=hi-a;
    return q0*(z2-z1)+m*(z2*z2-z1*z1)/2;
  }

  function qMomentToX(l,u,x){
    const a=n(l.from),b=n(l.to),lo=Math.max(a,u),hi=Math.min(b,x);
    if(!(hi>lo+EPS))return 0;
    const q0=n(l.value??l.start??0),q1=n(l.value2??l.end??l.value??l.start??0),m=(q1-q0)/(b-a);
    const Q=q0*(hi-lo)+m*(((hi-a)**2-(lo-a)**2)/2);
    const S=q0*(hi*hi-lo*lo)/2+m*((hi**3-lo**3)/3-a*(hi*hi-lo*lo)/2);
    return x*Q-S;
  }

  function buildDiagrams(payload,result){
    if(!result||!Array.isArray(result.reactions)||!result.diagrams)return result;
    const spans=Array.isArray(payload.spans)?payload.spans:[];
    const total=spans.reduce((s,x)=>s+n(x.length||0),0);
    if(!(total>0))return result;

    const supports=Array.isArray(payload.supports)?payload.supports:[];
    const hinges=uniqueSorted(supports.filter(s=>s?.type==='internal-hinge').map(s=>s.position));
    const reactions=result.reactions.map(r=>({x:n(r.position),f:n(r.vertical??r.v??0),m:n(r.moment??0),type:r.type})).filter(r=>finite(r.x)&&finite(r.f));
    const loads=Array.isArray(payload.loads)?payload.loads:[];
    const points=loads.filter(l=>l?.type==='point').map(l=>({x:n(l.from??l.position),f:pointForce(l)})).filter(p=>finite(p.x)&&finite(p.f));
    // A positive applied moment in the Beam Analyzer sign convention produces
    // a positive BMD jump. Fixed-support reaction moments use the opposite sign
    // because they are reported as external support reactions.
    const moments=loads.filter(l=>l?.type==='moment').map(l=>({x:n(l.from??l.position),jump:n(l.value??l.magnitude??0)})).filter(p=>finite(p.x)&&finite(p.jump));
    const udls=loads.filter(l=>l?.type==='udl').map(l=>({a:n(l.from),b:n(l.to),q0:n(l.value??l.start??0),q1:n(l.value2??l.end??l.value??l.start??0)})).filter(l=>finite(l.a)&&finite(l.b)&&l.b>l.a+EPS);
    const fixedReactionMoments=reactions.filter(r=>r.type==='fixed').map(r=>({x:r.x,jump:-r.m}));
    const allJumps=[...moments,...fixedReactionMoments];

    const cuts=uniqueSorted([0,total,...supports.map(s=>s?.position),...reactions.map(r=>r.x),...points.map(p=>p.x),...allJumps.map(m=>m.x),...udls.flatMap(l=>[l.a,l.b])].map(x=>Math.max(0,Math.min(total,n(x)))));

    function shearRight(x){let v=0;for(const r of reactions)if(r.x<=x+EPS)v+=r.f;for(const p of points)if(p.x<=x+EPS)v+=p.f;for(const l of udls)v+=qArea(l,l.from,x);return v;}
    function shearLeft(x){let v=0;for(const r of reactions)if(r.x<x-EPS)v+=r.f;for(const p of points)if(p.x<x-EPS)v+=p.f;for(const l of udls)v+=qArea(l,l.from,x-EPS);return v;}
    function isHinge(x){return hinges.some(h=>near(h,x));}
    function jumpAt(x){return allJumps.filter(m=>near(m.x,x)).reduce((s,m)=>s+m.jump,0);}
    function extrema(series){
      if(!series.length)return null;
      let max=series[0],min=series[0];
      for(const p of series){if(p[1]>max[1])max=p;if(p[1]<min[1])min=p;}
      return {max:{value:max[1],position:max[0]},min:{value:min[1],position:min[0]},abs:{value:Math.max(Math.abs(max[1]),Math.abs(min[1])),position:Math.abs(max[1])>=Math.abs(min[1])?max[0]:min[0]}};
    }

    const shear=[],moment=[],steps=32,push=(arr,x,y)=>arr.push([Number(x.toFixed(9)),Math.abs(y)<1e-10?0:y]);
    let Mstart=0;
    const leftFixed=reactions.find(r=>near(r.x,0)&&r.type==='fixed');
    if(leftFixed)Mstart=-leftFixed.m;

    for(let c=0;c<cuts.length-1;c++){
      const a=cuts[c],b=cuts[c+1],dx=b-a;if(dx<=EPS)continue;
      const Va=shearRight(a);
      for(let k=0;k<steps;k++){
        if(c>0&&k===0)continue;
        const x=a+dx*k/steps;
        let M=Mstart+Va*(x-a);
        for(const p of points)if(p.x>a+EPS&&p.x<=x+EPS)M+=p.f*(x-p.x);
        for(const l of udls)M+=qMomentToX(l,a,x);
        push(shear,x,shearRight(x));push(moment,x,M);
      }
      const Mleft=Mstart+Va*dx+points.filter(p=>p.x>a+EPS&&p.x<=b+EPS).reduce((s,p)=>s+p.f*(b-p.x),0)+udls.reduce((s,l)=>s+qMomentToX(l,a,b),0);
      const Vleft=shearLeft(b),Vright=shearRight(b);
      if(!near(Vleft,Vright)){push(shear,b,Vleft);push(shear,b,Vright);}else push(shear,b,Vright);

      if(isHinge(b)){
        // A real internal hinge is a zero-moment point, not a BMD jump.
        push(moment,b,Math.abs(Mleft)<1e-6?0:Mleft);
        Mstart=0;
        push(moment,b,0);
      }else{
        const Mright=Mleft+jumpAt(b);
        if(!near(Mleft,Mright)){push(moment,b,Mleft);push(moment,b,Mright);}else push(moment,b,Mright);
        Mstart=Mright;
      }
    }

    shear.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);moment.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    return {...result,diagrams:{...result.diagrams,shear,moment},extremes:{...(result.extremes||{}),shear:extrema(shear),moment:extrema(moment)},meta:{...(result.meta||{}),diagramEngine:'BeamAnalyzer-Exact-Statics-2.0'}};
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve'))return upstream(input,init);
    const response=await upstream(input,init);
    try{
      if(!response.ok)return response;
      const text=await response.text();
      const result=JSON.parse(text);
      if(!result||!result.diagrams)return new Response(text,{status:response.status,headers:response.headers});
      let payload={};try{payload=JSON.parse(init?.body||'{}')}catch{}
      const corrected=buildDiagrams(payload,result);
      return new Response(JSON.stringify(corrected),{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-Exact-Statics-2.0'}});
    }catch(error){
      console.error('Beam Analyzer diagram correction:',error);
      return response;
    }
  };
})();

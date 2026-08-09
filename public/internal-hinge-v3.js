/* Beam Analyzer — deterministic internal-hinge solver.
   Internal hinges are solved locally with a released-rotation Euler-Bernoulli
   beam stiffness model. Normal beams continue through StructureCalcs.
*/
(function(){
  'use strict';
  const upstreamFetch=window.fetch.bind(window);
  const EPS=1e-9;

  const near=(a,b)=>Math.abs(a-b)<=EPS*Math.max(1,Math.abs(a),Math.abs(b));
  const uniqSorted=a=>a.slice().sort((x,y)=>x-y).filter((x,i,s)=>i===0||!near(x,s[i-1]));
  const num=v=>Number(v);

  function gaussian(A,b){
    const n=A.length, M=A.map((r,i)=>r.slice().concat([b[i]]));
    for(let k=0;k<n;k++){
      let p=k, best=Math.abs(M[k][k]);
      for(let i=k+1;i<n;i++){const q=Math.abs(M[i][k]);if(q>best){best=q;p=i;}}
      if(best<1e-12) throw new Error('The internal-hinge stiffness system is singular. Check supports and hinge positions.');
      if(p!==k){const t=M[k];M[k]=M[p];M[p]=t;}
      for(let i=k+1;i<n;i++){
        const f=M[i][k]/M[k][k];
        if(Math.abs(f)<1e-18)continue;
        M[i][k]=0;
        for(let j=k+1;j<=n;j++)M[i][j]-=f*M[k][j];
      }
    }
    const x=new Array(n).fill(0);
    for(let i=n-1;i>=0;i--){let s=M[i][n];for(let j=i+1;j<n;j++)s-=M[i][j]*x[j];x[i]=s/M[i][i];}
    return x;
  }

  function ke(EI,L){
    const L2=L*L,L3=L2*L,c=EI/L3;
    return [[12*c,6*L*c,-12*c,6*L*c],[6*L*c,4*L2*c,-6*L*c,2*L2*c],[-12*c,-6*L*c,12*c,-6*L*c],[6*L*c,2*L2*c,-6*L*c,4*L2*c]];
  }

  function consistentLoad(q0,q1,L){
    return [L*(7*q0+3*q1)/20,L*L*(q0/20+q1/30),L*(3*q0+7*q1)/20,L*L*(-q0/30-q1/20)];
  }

  function lineIntensity(load,x){
    const a=num(load.from),b=num(load.to),q0=num(load.value),q1=load.value2==null?q0:num(load.value2);
    if(b<=a+EPS)return q0;
    const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return q0+(q1-q0)*t;
  }

  function solveInternal(payload){
    const units=payload.units==='imperial'?'imperial':'SI';
    const spans=(payload.spans||[]).map(s=>({length:num(s.length),E:num(s.E),I:num(s.I)}));
    if(!spans.length)throw new Error('At least one beam span is required.');
    const total=spans.reduce((a,s)=>a+s.length,0);
    if(!(total>0))throw new Error('Total beam length must be greater than zero.');

    const rawH=(payload.supports||[]).filter(s=>s&&s.type==='internal-hinge').map(s=>num(s.position)).filter(Number.isFinite);
    const hinges=uniqSorted(rawH);
    if(hinges.some(x=>x<=EPS||x>=total-EPS))throw new Error('Internal hinges must lie strictly inside the beam.');
    if(hinges.length!==rawH.length)throw new Error('Internal hinge positions must be unique.');

    const supports=(payload.supports||[]).filter(s=>s&&s.type!=='internal-hinge').map(s=>({type:s.type,position:num(s.position),settlement:num(s.settlement||0)}));
    for(const s of supports){if(s.position<-EPS||s.position>total+EPS)throw new Error('A support lies outside the beam.');if(!['pin','roller','fixed'].includes(s.type))throw new Error('Unsupported support type.');}
    for(const s of supports)if(hinges.some(h=>near(h,s.position))&&s.type==='fixed')throw new Error('A fixed support cannot share the same position as an internal hinge.');

    const loads=(payload.loads||[]).map(l=>({...l}));
    const cuts=[0,total,...hinges,...supports.map(s=>s.position)];
    for(const l of loads){
      if(l.type==='point'||l.type==='moment')cuts.push(num(l.from));
      else if(l.type==='udl')cuts.push(num(l.from),num(l.to));
    }
    const nodes=uniqSorted(cuts.filter(x=>Number.isFinite(x)&&x>=-EPS&&x<=total+EPS).map(x=>Math.max(0,Math.min(total,x))));
    if(nodes.length<2)throw new Error('Beam geometry is invalid.');

    const nodeDof=nodes.map(()=>({v:-1,r:-1,rl:-1,rr:-1}));
    let ndof=0;
    const isHinge=x=>hinges.some(h=>near(h,x));
    nodes.forEach((x,i)=>{nodeDof[i].v=ndof++;if(isHinge(x)){nodeDof[i].rl=ndof++;nodeDof[i].rr=ndof++;}else nodeDof[i].r=ndof++;});
    const K=Array.from({length:ndof},()=>Array(ndof).fill(0));
    const F=Array(ndof).fill(0);
    const elements=[];
    let spanStart=0;
    for(const s of spans){
      const spanEnd=spanStart+s.length;
      for(let i=0;i<nodes.length-1;i++){
        const a=nodes[i],b=nodes[i+1];
        if(a>=spanStart-EPS&&b<=spanEnd+EPS&&b>a+EPS){
          const mid=(a+b)/2;
          if(mid>=spanStart-EPS&&mid<=spanEnd+EPS)elements.push({i,j:i+1,length:b-a,E:s.E,I:s.I});
        }
      }
      spanStart=spanEnd;
    }
    if(elements.length!==nodes.length-1)throw new Error('Beam spans and internal hinges could not be connected consistently.');

    const EIscale=units==='SI'?1e-6:1/144;
    for(const e of elements){
      const EI=e.E*e.I*EIscale;
      const k=ke(EI,e.length);
      const rL=isHinge(nodes[e.i])?nodeDof[e.i].rr:nodeDof[e.i].r;
      const rR=isHinge(nodes[e.j])?nodeDof[e.j].rl:nodeDof[e.j].r;
      const d=[nodeDof[e.i].v,rL,nodeDof[e.j].v,rR];
      e.dofs=d;e.EI=EI;
      for(let a=0;a<4;a++)for(let b=0;b<4;b++)K[d[a]][d[b]]+=k[a][b];
      for(const l of loads){
        if(l.type!=='udl')continue;
        const la=num(l.from),lb=num(l.to);
        if(lb<=la+EPS||nodes[e.j]<=la+EPS||nodes[e.i]>=lb-EPS)continue;
        const aa=Math.max(nodes[e.i],la),bb=Math.min(nodes[e.j],lb);
        if(bb-aa<=EPS)continue;
        const q0=lineIntensity(l,aa),q1=lineIntensity(l,bb),fe=consistentLoad(q0,q1,bb-aa);
        const scale=(bb-aa)/e.length;
        if(Math.abs(scale-1)<1e-8){for(let a=0;a<4;a++)F[d[a]]+=fe[a];}
        else {for(let a=0;a<4;a++)F[d[a]]+=fe[a]*scale;}
      }
    }

    const nodeAt=x=>nodes.findIndex(p=>near(p,x));
    for(const l of loads){
      if(l.type==='point'){const i=nodeAt(num(l.from));if(i<0)throw new Error('Point load position is invalid.');F[nodeDof[i].v]+=num(l.value);}
      else if(l.type==='moment'){const i=nodeAt(num(l.from));if(i<0)throw new Error('Moment position is invalid.');const d=nodeDof[i].r>=0?nodeDof[i].r:(isHinge(nodes[i])?nodeDof[i].rl:-1);if(d>=0)F[d]+=-num(l.value);}
    }

    const settlementScale=units==='SI'?1/1000:1/12;
    const prescribed=new Map();
    for(const s of supports){
      const i=nodeAt(s.position);if(i<0)throw new Error('Support position is invalid.');
      prescribed.set(nodeDof[i].v,num(s.settlement||0)*settlementScale);
      if(s.type==='fixed')prescribed.set(nodeDof[i].r,0);
    }
    if(!prescribed.size)throw new Error('At least one support is required.');

    const free=[];for(let i=0;i<ndof;i++)if(!prescribed.has(i))free.push(i);
    if(!free.length)throw new Error('No free structural degrees of freedom remain.');
    const Af=free.map(i=>free.map(j=>K[i][j]));
    const bf=free.map(i=>F[i]-[...prescribed].reduce((sum,[d,val])=>sum+K[i][d]*val,0));
    const uf=gaussian(Af,bf);
    const u=Array(ndof).fill(0);for(let i=0;i<free.length;i++)u[free[i]]=uf[i];for(const [d,val] of prescribed)u[d]=val;
    const reactions=Array(ndof).fill(0);for(let i=0;i<ndof;i++){let s=0;for(let j=0;j<ndof;j++)s+=K[i][j]*u[j];reactions[i]=s-F[i];}

    const dispScale=units==='SI'?1000:12;
    const shape=(e,xx)=>{
      const L=e.length,t=xx/L,v1=u[e.dofs[0]],r1=u[e.dofs[1]],v2=u[e.dofs[2]],r2=u[e.dofs[3]];
      const N1=1-3*t*t+2*t*t*t,N2=L*(t-2*t*t+t*t*t),N3=3*t*t-2*t*t*t,N4=L*(-t*t+t*t*t);
      const dN1=(-6*t+6*t*t)/L,dN2=1-4*t+3*t*t,dN3=(6*t-6*t*t)/L,dN4=-2*t+3*t*t;
      return {v:N1*v1+N2*r1+N3*v2+N4*r2,theta:dN1*v1+dN2*r1+dN3*v2+dN4*r2};
    };

    const reactionList=[];
    for(const s of supports){const i=nodeAt(s.position);reactionList.push({type:s.type,position:s.position,vertical:reactions[nodeDof[i].v],moment:s.type==='fixed'?-reactions[nodeDof[i].r]:0});}
    const verticalSources=reactionList.map(r=>({x:r.position,f:r.vertical}));
    const pointLoads=loads.filter(l=>l.type==='point').map(l=>({x:num(l.from),f:num(l.value)}));
    const moments=loads.filter(l=>l.type==='moment').map(l=>({x:num(l.from),m:num(l.value)}));
    const fixedMoments=reactionList.filter(r=>r.type==='fixed').map(r=>({x:r.position,m:r.moment}));
    const allMoments=moments.concat(fixedMoments);
    function qIntegral(l,x){const a=num(l.from),b=num(l.to);if(x<=a)return 0;const z=Math.min(x,b)-a;if(z<=0)return 0;const q0=num(l.value),q1=l.value2==null?q0:num(l.value2),slope=(q1-q0)/(b-a);return q0*z+slope*z*z/2;}
    function qMoment(l,x){const a=num(l.from),b=num(l.to);if(x<=a)return 0;const z=Math.min(x,b)-a;if(z<=0)return 0;const q0=num(l.value),q1=l.value2==null?q0:num(l.value2),slope=(q1-q0)/(b-a);return q0*z*z/2+slope*z*z*z/6;}
    function statAt(x,left=false){let V=0,M=0;const side=p=>left?p<x-EPS:p<x+EPS;for(const r of verticalSources)if(side(r.x)){V+=r.f;M+=r.f*(x-r.x);}for(const p of pointLoads)if(side(p.x)){V+=p.f;M+=p.f*(x-p.x);}for(const l of loads)if(l.type==='udl'){V+=qIntegral(l,x);M+=qMoment(l,x);}for(const mm of allMoments)if(side(mm.x))M+=mm.m;return {V,M};}

    const shear=[],moment=[],rotation=[],deflection=[];
    const addPoint=(arr,x,y)=>arr.push([Number(x.toFixed(9)),Math.abs(y)<1e-10?0:y]);
    for(const e of elements){
      const a=nodes[e.i],b=nodes[e.j],L=e.length,N=12;
      for(let k=0;k<=N;k++){
        if(e.i>0&&k===0)continue;
        const x=a+L*k/N,s=(Math.abs(x-total)<EPS&&k===N)?statAt(x,true):statAt(x),sh=shape(e,x-a);
        addPoint(shear,x,s.V);addPoint(moment,x,s.M);addPoint(rotation,x,sh.theta);addPoint(deflection,x,sh.v*dispScale);
      }
    }
    const discontinuities=pointLoads.map(p=>p.x).concat(moments.map(m=>m.x),fixedMoments.map(m=>m.x)).filter(x=>x>EPS&&x<total-EPS);
    for(const x of discontinuities){const s=statAt(x,true),t=statAt(x,false);addPoint(shear,x,s.V);addPoint(shear,x,t.V);addPoint(moment,x,s.M);addPoint(moment,x,t.M);}
    shear.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);moment.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);

    function extrema(series){let max=series[0],min=series[0];for(const p of series){if(p[1]>max[1])max=p;if(p[1]<min[1])min=p;}return {max:{value:max[1],position:max[0]},min:{value:min[1],position:min[0]},abs:{value:Math.max(Math.abs(max[1]),Math.abs(min[1])),position:Math.abs(max[1])>=Math.abs(min[1])?max[0]:min[0]}};}
    return {reactions:reactionList,diagrams:{shear,moment,rotation,deflection},extremes:{shear:extrema(shear),moment:extrema(moment),deflection:extrema(deflection)},meta:{engineVersion:'BeamAnalyzer-HingeSolver-1.0',units,unitLabels:{length:units==='SI'?'m':'ft',force:units==='SI'?'kN':'kip',moment:units==='SI'?'kN·m':'kip·ft',load:units==='SI'?'kN/m':'kip/ft',deflection:units==='SI'?'mm':'in'},computeMs:0,attribution:'Solved by Beam Analyzer — internal-hinge direct-stiffness solver',warnings:['Internal hinges are solved locally with a released-rotation beam stiffness formulation.']}};
  }

  window.__beamAnalyzerSolveInternalHinge=solveInternal;

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve')||!init||typeof init.body!=='string')return upstreamFetch(input,init);
    try{
      const payload=JSON.parse(init.body);
      if(!(payload.supports||[]).some(s=>s&&s.type==='internal-hinge'))return upstreamFetch(input,init);
      const result=solveInternal(payload);
      return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-HingeSolver-1.0'}});
    }catch(err){
      console.error('Internal hinge solver:',err);
      return new Response(JSON.stringify({type:'about:blank',title:'Internal hinge analysis error',status:422,code:'internal_hinge_error',detail:err.message||'Could not solve the beam.'}),{status:422,headers:{'Content-Type':'application/problem+json','Cache-Control':'no-store'}});
    }
  };
})();

/* Beam Analyzer — fresh internal-hinge engine.
 *
 * This module is the single owner of internal hinges.
 * It owns:
 *   1) support-row option + persistence,
 *   2) beam-model rendering,
 *   3) local direct-stiffness analysis for models containing hinges.
 *
 * It intentionally does not patch or depend on the old internal-hinge files.
 */
(function(){
  'use strict';

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const NS='http://www.w3.org/2000/svg';
  const EPS=1e-9;
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const near=(a,b)=>Math.abs(n(a)-n(b))<=EPS*Math.max(1,Math.abs(n(a)),Math.abs(n(b)));

  function currentModel(){
    return (typeof model!=='undefined' && model && Array.isArray(model.supports)) ? model : null;
  }

  function sortAndNormalizeSupports(){
    const m=currentModel();
    if(!m) return;
    m.supports=m.supports
      .filter(s=>s&&finite(s.position))
      .slice()
      .sort((a,b)=>n(a.position)-n(b.position));
    m.supports.forEach((s,i)=>{s.id=i+1;s.type=s.type||'pin';s.settlement=finite(s.settlement)?n(s.settlement):0});
  }

  function ensureHingeOption(select,support){
    if(!select) return;
    let opt=select.querySelector('option[value="internal-hinge"]');
    if(!opt){
      opt=document.createElement('option');
      opt.value='internal-hinge';
      opt.textContent='Internal Hinge';
      select.appendChild(opt);
    }
    if(support) select.value=support.type;
  }

  function bindSupportControls(){
    const m=currentModel();
    if(!m) return;
    const byId=new Map(m.supports.map(s=>[String(s.id),s]));
    $$('#supportRows select[data-k="type"],#supportRows input[data-k="position"],#supportRows input[data-k="settlement"]').forEach(el=>{
      const support=byId.get(String(el.dataset.sup));
      if(!support) return;
      el.onchange=()=>{
        if(typeof mutate!=='function') return;
        mutate(()=>{
          const live=currentModel()?.supports.find(s=>String(s.id)===String(el.dataset.sup));
          if(!live) return;
          if(el.dataset.k==='type') live.type=el.value;
          else live[el.dataset.k]=n(el.value);
        });
      };
    });
  }

  const baseRenderInputs=window.renderInputs;
  const baseRenderBeam=window.renderBeam;
  if(typeof baseRenderInputs!=='function'||typeof baseRenderBeam!=='function') return;

  window.renderInputs=function(){
    sortAndNormalizeSupports();
    baseRenderInputs();

    const m=currentModel();
    if(m){
      m.supports.forEach((s,i)=>{
        const row=$$('#supportRows tr')[i];
        if(row){
          if(row.children[0]) row.children[0].textContent=String(i+1);
          const select=row.querySelector('select[data-k="type"]');
          if(select) ensureHingeOption(select,s);
        }
      });
    }
    bindSupportControls();
  };

  function makeSvgEl(tag,attrs){
    const el=document.createElementNS(NS,tag);
    Object.entries(attrs||{}).forEach(([k,v])=>el.setAttribute(k,String(v)));
    return el;
  }

  function drawInternalHinge(svg,x,y,index,position){
    const g=makeSvgEl('g',{class:'freshInternalHinge', 'pointer-events':'none'});
    g.appendChild(makeSvgEl('circle',{cx:x,cy:y,r:8.5,fill:'var(--card,#fff)',stroke:'var(--text,#20252b)','stroke-width':2,'vector-effect':'non-scaling-stroke'}));

    const label=makeSvgEl('text',{x,y:y+45,'text-anchor':'middle',class:'supportText'});
    label.textContent=`H${index} (Internal Hinge)`;
    g.appendChild(label);

    const pos=makeSvgEl('text',{x,y:y+62,'text-anchor':'middle',class:'dimText'});
    pos.textContent=`@ ${typeof fmt==='function'?fmt(position):position} ${typeof unitText==='function'?unitText('length'):''}`;
    g.appendChild(pos);
    svg.appendChild(g);
  }

  window.renderBeam=function(){
    sortAndNormalizeSupports();
    baseRenderBeam();

    const m=currentModel();
    const svg=$('#beamCanvas svg');
    const beam=svg?.querySelector('.beamLine');
    if(!m||!svg||!beam) return;

    svg.querySelectorAll('.freshInternalHinge').forEach(e=>e.remove());

    const bx1=n(beam.getAttribute('x1')), bx2=n(beam.getAttribute('x2')), by=n(beam.getAttribute('y1'));
    const total=typeof len==='function'?n(len()):0;
    if(!finite(bx1)||!finite(bx2)||!finite(by)||!(total>0)) return;

    const hinges=m.supports.filter(s=>s.type==='internal-hinge');
    hinges.forEach((s,i)=>{
      const x=bx1+Math.max(0,Math.min(total,n(s.position)))/total*(bx2-bx1);
      // Remove the native support group at this exact support id/coordinate.
      svg.querySelectorAll('g.supportDrag').forEach(g=>{
        const gid=String(g.getAttribute('data-id')||'');
        const badge=g.querySelector('.supportBadge');
        const gx=badge?num(badge.getAttribute('cx')):NaN;
        if(gid===String(s.id)||(finite(gx)&&near(gx,x)))g.remove();
      });
      // Remove native support label and support number at the hinge.
      svg.querySelectorAll('text.supportText').forEach(t=>{
        const tx=n(t.getAttribute('x'));
        if(finite(tx)&&near(tx,x)) t.remove();
      });
      drawInternalHinge(svg,x,by,i+1,s.position);
    });
  };

  // ---------- Fresh local internal-hinge direct-stiffness solver ----------

  function gaussianSolve(A,b){
    const N=A.length;
    const M=A.map((row,i)=>row.slice().concat([b[i]]));
    for(let k=0;k<N;k++){
      let pivot=k,best=Math.abs(M[k][k]);
      for(let i=k+1;i<N;i++){
        const v=Math.abs(M[i][k]);
        if(v>best){best=v;pivot=i;}
      }
      if(!(best>1e-12)) throw new Error('Internal-hinge model is unstable or singular. Check the support arrangement.');
      if(pivot!==k)[M[k],M[pivot]]=[M[pivot],M[k]];
      for(let i=k+1;i<N;i++){
        const f=M[i][k]/M[k][k];
        if(Math.abs(f)<1e-18) continue;
        M[i][k]=0;
        for(let j=k+1;j<=N;j++)M[i][j]-=f*M[k][j];
      }
    }
    const x=new Array(N).fill(0);
    for(let i=N-1;i>=0;i--){
      let s=M[i][N];
      for(let j=i+1;j<N;j++)s-=M[i][j]*x[j];
      x[i]=s/M[i][i];
      if(!finite(x[i])||Math.abs(x[i])>1e12)throw new Error('Internal-hinge model produced a non-finite displacement. Check stability and supports.');
    }
    return x;
  }

  function elementK(EI,L){
    const c=EI/(L*L*L),L2=L*L;
    return [[12*c,6*L*c,-12*c,6*L*c],[6*L*c,4*L2*c,-6*L*c,2*L2*c],[-12*c,-6*L*c,12*c,-6*L*c],[6*L*c,2*L2*c,-6*L*c,4*L2*c]];
  }

  function elementLoad(q0,q1,L){
    return [L*(7*q0+3*q1)/20,L*L*(q0/20+q1/30),L*(3*q0+7*q1)/20,L*L*(-q0/30-q1/20)];
  }

  function loadValue(load,key,defaultValue=0){
    const v=n(load[key]);
    return finite(v)?v:defaultValue;
  }

  function solveInternalHinge(payload){
    const units=payload.units==='imperial'?'imperial':'SI';
    const spans=(payload.spans||[]).map(s=>({length:n(s.length),E:n(s.E),I:n(s.I)}));
    if(!spans.length||spans.some(s=>!(s.length>0)||!(s.E>0)||!(s.I>0)))throw new Error('Beam spans must have positive length, E and I.');
    const total=spans.reduce((sum,s)=>sum+s.length,0);

    const hinges=(payload.supports||[]).filter(s=>s?.type==='internal-hinge').map(s=>n(s.position)).filter(finite).sort((a,b)=>a-b);
    if(hinges.some(h=>h<=EPS||h>=total-EPS))throw new Error('Internal hinges must lie strictly inside the beam.');
    for(let i=1;i<hinges.length;i++)if(near(hinges[i],hinges[i-1]))throw new Error('Internal hinge positions must be unique.');

    const supports=(payload.supports||[]).filter(s=>s?.type!=='internal-hinge').map(s=>({type:s.type,position:n(s.position),settlement:n(s.settlement||0)}));
    for(const s of supports){
      if(!['pin','roller','fixed'].includes(s.type))throw new Error(`Unsupported support type: ${s.type}`);
      if(s.position<-EPS||s.position>total+EPS)throw new Error('A support lies outside the beam.');
      if(hinges.some(h=>near(h,s.position)))throw new Error('An internal hinge cannot share a position with an external support.');
    }

    const loads=(payload.loads||[]).map(l=>{
      if(l.type==='point'){
        const raw=n(l.magnitude??l.value??0),angle=n(l.angle??0);
        return {type:'point',x:n(l.position??l.from),v:finite(angle)?raw*Math.cos(angle*Math.PI/180):raw};
      }
      if(l.type==='moment') return {type:'moment',x:n(l.position??l.from),m:n(l.magnitude??l.value??0)};
      return {type:'udl',a:n(l.from),b:n(l.to),q0:n(l.start??l.value??0),q1:n(l.end??l.value2??l.value??0)};
    });

    for(const l of loads){
      if(l.type==='point'||l.type==='moment'){if(l.x<-EPS||l.x>total+EPS)throw new Error('A load lies outside the beam.');}
      else if(!(l.b>l.a+EPS)||l.a<-EPS||l.b>total+EPS)throw new Error('UDL limits are invalid.');
    }

    const nodes=[0,total,...hinges,...supports.map(s=>s.position),...loads.flatMap(l=>l.type==='udl'?[l.a,l.b]:[l.x])]
      .filter(finite).map(x=>Math.max(0,Math.min(total,x))).sort((a,b)=>a-b)
      .filter((x,i,a)=>i===0||!near(x,a[i-1]));

    const hingeSet=x=>hinges.some(h=>near(h,x));
    const dof=nodes.map(()=>({v:-1,r:-1,leftR:-1,rightR:-1}));
    let NDOF=0;
    nodes.forEach((x,i)=>{
      dof[i].v=NDOF++;
      if(hingeSet(x)){dof[i].leftR=NDOF++;dof[i].rightR=NDOF++;}
      else dof[i].r=NDOF++;
    });

    const K=Array.from({length:NDOF},()=>Array(NDOF).fill(0));
    const F=Array(NDOF).fill(0);
    const elements=[];

    // Build elements in span order.
    let start=0;
    for(const span of spans){
      const end=start+span.length;
      for(let i=0;i<nodes.length-1;i++){
        const a=nodes[i],b=nodes[i+1];
        if(a>=start-EPS&&b<=end+EPS&&b>a+EPS)elements.push({i,j:i+1,L:b-a,E:span.E,I:span.I});
      }
      start=end;
    }
    if(elements.length!==nodes.length-1)throw new Error('Beam spans could not be connected into a continuous mesh.');

    const EIscale=units==='SI'?1e-6:1/144;
    for(const e of elements){
      e.EI=e.E*e.I*EIscale;
      e.k=elementK(e.EI,e.L);
      const rdof=(idx,side)=>{
        const d=dof[idx];
        if(!hingeSet(nodes[idx]))return d.r;
        return side==='left'?d.leftR:d.rightR;
      };
      e.dofs=[dof[e.i].v,rdof(e.i,'right'),dof[e.j].v,rdof(e.j,'left')];
      for(let a=0;a<4;a++)for(let b=0;b<4;b++)K[e.dofs[a]][e.dofs[b]]+=e.k[a][b];

      // Exact consistent nodal load for a linear UDL over the element.
      for(const l of loads.filter(x=>x.type==='udl')){
        if(l.a<=nodes[e.i]+EPS&&l.b>=nodes[e.j]-EPS){
          const fe=elementLoad(l.q0,l.q1,e.L);
          for(let a=0;a<4;a++)F[e.dofs[a]]+=fe[a];
        }
      }
    }

    const nodeIndex=x=>nodes.findIndex(p=>near(p,x));
    for(const l of loads){
      if(l.type==='point'){
        const i=nodeIndex(l.x);if(i<0)throw new Error('Point-load position is invalid.');
        F[dof[i].v]+=l.v;
      }else if(l.type==='moment'){
        const i=nodeIndex(l.x);if(i<0)throw new Error('Moment position is invalid.');
        if(hingeSet(nodes[i])){
          // A pure couple at an internal hinge is not a support reaction; apply it
          // to the left rotational DOF so the released joint remains moment-free.
          F[dof[i].leftR]+=-l.m;
        }else F[dof[i].r]+=-l.m;
      }
    }

    const prescribed=new Map();
    const settleScale=units==='SI'?1/1000:1/12;
    for(const s of supports){
      const i=nodeIndex(s.position);if(i<0)throw new Error('Support position is invalid.');
      prescribed.set(dof[i].v,n(s.settlement||0)*settleScale);
      if(s.type==='fixed')prescribed.set(dof[i].r,0);
    }
    if(!prescribed.size)throw new Error('At least one external support is required.');

    const free=[];for(let i=0;i<NDOF;i++)if(!prescribed.has(i))free.push(i);
    if(!free.length)throw new Error('No free structural degrees of freedom remain.');
    const Af=free.map(i=>free.map(j=>K[i][j]));
    const bf=free.map(i=>{let rhs=F[i];for(const [d,val] of prescribed)rhs-=K[i][d]*val;return rhs});
    const uf=gaussianSolve(Af,bf);
    const u=new Array(NDOF).fill(0);free.forEach((d,i)=>u[d]=uf[i]);for(const [d,val] of prescribed)u[d]=val;

    const internalForce=new Array(NDOF).fill(0);
    for(let i=0;i<NDOF;i++){let s=0;for(let j=0;j<NDOF;j++)s+=K[i][j]*u[j];internalForce[i]=s-F[i];}

    const reactions=supports.map(s=>{
      const i=nodeIndex(s.position);
      return {type:s.type,position:s.position,vertical:internalForce[dof[i].v],moment:s.type==='fixed'?-internalForce[dof[i].r]:0};
    });

    function qResultAt(l,x){
      if(x<=l.a) return 0;
      const z=Math.min(x,l.b)-l.a;
      if(z<=0) return 0;
      const slope=(l.q1-l.q0)/(l.b-l.a);
      return l.q0*z+slope*z*z/2;
    }
    function qMomentAt(l,x){
      if(x<=l.a)return 0;
      const z=Math.min(x,l.b)-l.a;if(z<=0)return 0;
      const slope=(l.q1-l.q0)/(l.b-l.a);
      return l.q0*z*z/2+slope*z*z*z/6;
    }

    function statAt(x,left=false){
      let V=0,M=0;
      const before=(p)=>left?p<x-EPS:p<=x+EPS;
      reactions.forEach(r=>{if(before(r.position)){V+=r.vertical;M+=r.vertical*(x-r.position)+r.moment}});
      loads.forEach(l=>{
        if(l.type==='point'&&before(l.x)){V+=l.v;M+=l.v*(x-l.x)}
        if(l.type==='moment'&&before(l.x))M+=l.m;
        if(l.type==='udl'){V+=qResultAt(l,x);M+=qMomentAt(l,x)}
      });
      return {V,M};
    }

    const shear=[],moment=[],rotation=[],deflection=[];
    const dispScale=units==='SI'?1000:12;
    function shape(e,local){
      const t=local/e.L,L=e.L;
      const v1=u[e.dofs[0]],r1=u[e.dofs[1]],v2=u[e.dofs[2]],r2=u[e.dofs[3]];
      const N1=1-3*t*t+2*t*t*t;
      const N2=L*(t-2*t*t+t*t*t);
      const N3=3*t*t-2*t*t*t;
      const N4=L*(-t*t+t*t*t);
      const dN1=(-6*t+6*t*t)/L,dN2=1-4*t+3*t*t,dN3=(6*t-6*t*t)/L,dN4=-2*t+3*t*t;
      return {v:N1*v1+N2*r1+N3*v2+N4*r2,theta:dN1*v1+dN2*r1+dN3*v2+dN4*r2};
    }
    const add=(arr,x,y)=>arr.push([Number(x.toFixed(9)),Math.abs(y)<1e-10?0:y]);

    for(const e of elements){
      for(let k=0;k<=16;k++){
        if(e.i>0&&k===0)continue;
        const x=nodes[e.i]+e.L*k/16;
        const s=statAt(x,x===total);
        const shp=shape(e,x-nodes[e.i]);
        add(shear,x,s.V);add(moment,x,hinges.some(h=>near(h,x))?0:s.M);add(rotation,x,shp.theta);add(deflection,x,shp.v*dispScale);
      }
    }

    // Explicit jumps at concentrated loads / applied moments.
    loads.forEach(l=>{
      if(l.type!=='point'&&l.type!=='moment')return;
      if(l.x<=EPS||l.x>=total-EPS)return;
      const a=statAt(l.x,true),b=statAt(l.x,false);
      add(shear,l.x,a.V);add(shear,l.x,b.V);add(moment,l.x,a.M);add(moment,l.x,hinges.some(h=>near(h,l.x))?0:b.M);
    });

    const sortSeries=arr=>arr.slice().sort((a,b)=>{const dx=a[0]-b[0];return Math.abs(dx)>EPS?dx:0});
    const extrema=series=>{let max=series[0],min=series[0];for(const p of series){if(p[1]>max[1])max=p;if(p[1]<min[1])min=p}return {max:{value:max[1],position:max[0]},min:{value:min[1],position:min[0]},abs:{value:Math.max(Math.abs(max[1]),Math.abs(min[1])),position:Math.abs(max[1])>=Math.abs(min[1])?max[0]:min[0]}}};

    return {
      reactions,
      diagrams:{shear:sortSeries(shear),moment:sortSeries(moment),rotation:sortSeries(rotation),deflection:sortSeries(deflection)},
      extremes:{shear:extrema(shear),moment:extrema(moment),deflection:extrema(deflection)},
      meta:{engineVersion:'BeamAnalyzer-FreshInternalHinge-1.0',units,unitLabels:{length:units==='SI'?'m':'ft',force:units==='SI'?'kN':'kip',moment:units==='SI'?'kN·m':'kip·ft',load:units==='SI'?'kN/m':'kip/ft',deflection:units==='SI'?'mm':'in'},warnings:['Internal hinges are modelled as released rotational DOFs and therefore carry zero bending moment.']}
    };
  }

  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve')||!init||typeof init.body!=='string') return upstreamFetch(input,init);
    try{
      const payload=JSON.parse(init.body);
      if(!(payload.supports||[]).some(s=>s&&s.type==='internal-hinge')) return upstreamFetch(input,init);
      const result=solveInternalHinge(payload);
      return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-FreshInternalHinge-1.0'}});
    }catch(err){
      return new Response(JSON.stringify({detail:err?.message||'Internal-hinge analysis failed.'}),{status:422,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }
  };

  // One initial canonical pass after app.js has created its DOM.
  requestAnimationFrame(()=>{
    sortAndNormalizeSupports();
    if(typeof window.renderInputs==='function')window.renderInputs();
    if(typeof window.renderBeam==='function')window.renderBeam();
  });
})();

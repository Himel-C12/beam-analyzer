(function(){
  'use strict';

  // Internal hinge = vertical displacement continuity + rotational release.
  // It is NOT a support and must never contribute a reaction.
  const upstreamFetch = window.fetch.bind(window);
  const NS = 'http://www.w3.org/2000/svg';
  const EPS = 1e-9;
  const num = v => Number(v);
  const finite = v => Number.isFinite(num(v));
  const near = (a,b) => Math.abs(num(a)-num(b)) <= EPS*Math.max(1,Math.abs(num(a)),Math.abs(num(b)));

  function modelNow(){
    try { return JSON.parse(localStorage.getItem('ba-model') || 'null'); }
    catch { return null; }
  }

  function addHingeOption(){
    document.querySelectorAll('#supportRows select[data-k="type"]').forEach(sel => {
      if(!sel.querySelector('option[value="internal-hinge"]')){
        const o=document.createElement('option');
        o.value='internal-hinge';
        o.textContent='Internal Hinge';
        sel.appendChild(o);
      }
      const m=modelNow();
      const s=m?.supports?.find(x=>String(x.id)===String(sel.dataset.sup));
      if(s) sel.value=s.type;
    });
  }

  function gaussian(A,b){
    const n=A.length;
    if(!n) throw new Error('The beam has no free degrees of freedom.');
    const a=A.map((r,i)=>r.slice().concat(b[i]));
    for(let k=0;k<n;k++){
      let pivot=k,best=Math.abs(a[k][k]);
      for(let i=k+1;i<n;i++){
        const q=Math.abs(a[i][k]);
        if(q>best){best=q;pivot=i;}
      }
      if(best<1e-12) throw new Error('Beam is unstable or the stiffness matrix is singular. Check supports and internal hinges.');
      if(pivot!==k)[a[k],a[pivot]]=[a[pivot],a[k]];
      for(let i=k+1;i<n;i++){
        const f=a[i][k]/a[k][k];
        if(Math.abs(f)<1e-18) continue;
        a[i][k]=0;
        for(let j=k+1;j<=n;j++) a[i][j]-=f*a[k][j];
      }
    }
    const x=Array(n).fill(0);
    for(let i=n-1;i>=0;i--){
      let s=a[i][n];
      for(let j=i+1;j<n;j++) s-=a[i][j]*x[j];
      x[i]=s/a[i][i];
      if(!finite(x[i])||Math.abs(x[i])>1e12) throw new Error('Beam analysis produced an invalid displacement. Check stability.');
    }
    return x;
  }

  function beamK(EI,L){
    const c=EI/(L*L*L),L2=L*L;
    return [[12*c,6*L*c,-12*c,6*L*c],[6*L*c,4*L2*c,-6*L*c,2*L2*c],[-12*c,-6*L*c,12*c,-6*L*c],[6*L*c,2*L2*c,-6*L*c,4*L2*c]];
  }

  function beamLoad(q0,q1,L){
    return [L*(7*q0+3*q1)/20,L*L*(3*q0+2*q1)/60,L*(3*q0+7*q1)/20,-L*L*(2*q0+3*q1)/60];
  }

  function normalize(raw){
    const units=raw.units==='imperial'?'imperial':'SI';
    const spans=(raw.spans||[]).map(s=>({length:num(s.length),E:num(s.E),I:num(s.I)}));
    const supports=(raw.supports||[]).map(s=>({type:s.type,position:num(s.position),settlement:num(s.settlement||0)}));
    const loads=(raw.loads||[]).map(l=>{
      if(l.type==='point'){
        const mag=num(l.magnitude??l.value??0),angle=num(l.angle??0);
        return {type:'point',x:num(l.position??l.from),v:mag*Math.cos(angle*Math.PI/180)};
      }
      if(l.type==='moment') return {type:'moment',x:num(l.position??l.from),m:num(l.magnitude??l.value??0)};
      return {type:'udl',a:num(l.from),b:num(l.to),q0:num(l.start??l.value??0),q1:num(l.end??l.value2??l.value??0)};
    });
    return {units,spans,supports,loads};
  }

  function solve(raw){
    const {units,spans,supports,loads}=normalize(raw);
    if(!spans.length||spans.some(s=>!(s.length>0)||!(s.E>0)||!(s.I>0))) throw new Error('Each span must have positive length, E, and I.');
    const total=spans.reduce((a,s)=>a+s.length,0);
    if(!(total>0)) throw new Error('Total beam length must be greater than zero.');

    const hinges=supports.filter(s=>s.type==='internal-hinge').map(s=>s.position).sort((a,b)=>a-b);
    for(const h of hinges) if(!(h>EPS&&h<total-EPS)) throw new Error('Internal hinges must lie strictly inside the beam.');
    for(let i=1;i<hinges.length;i++) if(near(hinges[i],hinges[i-1])) throw new Error('Internal hinge positions must be unique.');

    const external=supports.filter(s=>s.type!=='internal-hinge');
    for(const s of external){
      if(!['pin','roller','fixed'].includes(s.type)) throw new Error('Unsupported support type.');
      if(s.position<-EPS||s.position>total+EPS) throw new Error('A support lies outside the beam.');
      if(hinges.some(h=>near(h,s.position))) throw new Error('An external support cannot share a position with an internal hinge.');
    }
    if(!external.length) throw new Error('At least one external support is required.');

    for(const l of loads){
      if(l.type==='udl'){
        if(!(l.b>l.a+EPS)||l.a<-EPS||l.b>total+EPS) throw new Error('A distributed load has invalid limits.');
      }else if(l.x<-EPS||l.x>total+EPS) throw new Error('A concentrated load lies outside the beam.');
    }

    const boundaries=[0,total];
    let acc=0;
    for(const s of spans){ acc+=s.length; boundaries.push(acc); }
    const events=[...boundaries,...hinges,...external.map(s=>s.position),...loads.flatMap(l=>l.type==='udl'?[l.a,l.b]:[l.x])]
      .filter(finite).map(x=>Math.max(0,Math.min(total,x))).sort((a,b)=>a-b)
      .filter((x,i,a)=>i===0||!near(x,a[i-1]));

    const SUB=8,nodes=[];
    for(let i=0;i<events.length-1;i++){
      const a=events[i],b=events[i+1];
      if(i===0) nodes.push(a);
      for(let k=1;k<=SUB;k++) nodes.push(a+(b-a)*k/SUB);
    }

    const isHinge=x=>hinges.some(h=>near(h,x));
    const dof=nodes.map(()=>({v:-1,r:-1,leftR:-1,rightR:-1}));
    let ndof=0;
    nodes.forEach((x,i)=>{
      dof[i].v=ndof++;
      if(isHinge(x)){ dof[i].leftR=ndof++; dof[i].rightR=ndof++; }
      else dof[i].r=ndof++;
    });

    const K=Array.from({length:ndof},()=>Array(ndof).fill(0)),F=Array(ndof).fill(0);
    const starts=[0];for(const s of spans) starts.push(starts.at(-1)+s.length);
    const spanFor=(a,b)=>{
      for(let i=0;i<spans.length;i++) if(a>=starts[i]-EPS&&b<=starts[i+1]+EPS) return spans[i];
      throw new Error('Beam spans are not connected correctly.');
    };
    const qAt=(l,x)=>{
      if(x<=l.a) return l.q0;
      if(x>=l.b) return l.q1;
      const t=(x-l.a)/(l.b-l.a);
      return l.q0+(l.q1-l.q0)*t;
    };

    const elements=[];
    for(let i=0;i<nodes.length-1;i++){
      const a=nodes[i],b=nodes[i+1],L=b-a,s=spanFor(a,b);
      // SI: E is kN/mm², I is mm⁴, beam coordinates are m -> EI becomes kN·m².
      // Imperial: E is kip/in², I is in⁴, beam coordinates are ft -> EI becomes kip·ft².
      const EI=s.E*s.I*(units==='SI'?1e-9:1/144);
      const leftRot=isHinge(a)?dof[i].rightR:dof[i].r;
      const rightRot=isHinge(b)?dof[i+1].leftR:dof[i+1].r;
      const map=[dof[i].v,leftRot,dof[i+1].v,rightRot];
      const k=beamK(EI,L);
      for(let r=0;r<4;r++) for(let c=0;c<4;c++) K[map[r]][map[c]]+=k[r][c];
      for(const l of loads) if(l.type==='udl'&&l.a<=a+EPS&&l.b>=b-EPS){
        const fe=beamLoad(qAt(l,a),qAt(l,b),L);
        for(let r=0;r<4;r++) F[map[r]]+=fe[r];
      }
      elements.push({i,j:i+1,L,map});
    }

    const nodeAt=x=>nodes.findIndex(q=>near(q,x));
    for(const l of loads){
      if(l.type==='udl') continue;
      const i=nodeAt(l.x);if(i<0) throw new Error('Load position is invalid.');
      if(l.type==='point') F[dof[i].v]+=l.v;
      else {
        if(isHinge(l.x)) throw new Error('A concentrated moment cannot be applied directly at an internal hinge.');
        F[dof[i].r]+=-l.m;
      }
    }

    const prescribed=new Map();
    const defScale=units==='SI'?1/1000:1/12;
    for(const s of external){
      const i=nodeAt(s.position);if(i<0) throw new Error('Support position is invalid.');
      prescribed.set(dof[i].v,s.settlement*defScale);
      if(s.type==='fixed') prescribed.set(dof[i].r,0);
    }
    const free=[];for(let i=0;i<ndof;i++) if(!prescribed.has(i)) free.push(i);
    const rhs=free.map(i=>F[i]-[...prescribed].reduce((sum,[d,v])=>sum+K[i][d]*v,0));
    const uf=gaussian(free.map(i=>free.map(j=>K[i][j])),rhs);
    const u=Array(ndof).fill(0);free.forEach((d,i)=>u[d]=uf[i]);for(const [d,v] of prescribed)u[d]=v;

    const residual=Array(ndof).fill(0);
    for(let i=0;i<ndof;i++){let z=0;for(let j=0;j<ndof;j++)z+=K[i][j]*u[j];residual[i]=z-F[i];}
    const reactions=external.map(s=>{
      const i=nodeAt(s.position);
      return {type:s.type,position:s.position,vertical:residual[dof[i].v],moment:s.type==='fixed'?residual[dof[i].r]:0};
    });

    function udlArea(l,x){
      if(x<=l.a) return 0;
      const z=Math.min(x,l.b)-l.a;if(z<=0)return 0;
      const slope=(l.q1-l.q0)/(l.b-l.a);
      return l.q0*z+slope*z*z/2;
    }
    function udlMoment(l,x){
      if(x<=l.a) return 0;
      const z=Math.min(x,l.b)-l.a;if(z<=0)return 0;
      const slope=(l.q1-l.q0)/(l.b-l.a);
      const area=l.q0*z+slope*z*z/2;
      const first=l.q0*z*z/2+slope*z*z*z/3;
      return (x-l.a)*area-first;
    }
    function stat(x,left=false){
      const include=q=>left?q<x-EPS:q<=x+EPS;
      let V=0,M=0;
      for(const r of reactions) if(include(r.position)){V+=r.vertical;M+=r.vertical*(x-r.position)+r.moment;}
      for(const l of loads){
        if(l.type==='point'&&include(l.x)){V+=l.v;M+=l.v*(x-l.x);}
        else if(l.type==='moment'&&include(l.x)) M+=l.m;
        else if(l.type==='udl'){V+=udlArea(l,x);M+=udlMoment(l,x);}
      }
      return {V,M};
    }

    function shape(e,z){
      const t=z/e.L,L=e.L;
      const v1=u[e.map[0]],r1=u[e.map[1]],v2=u[e.map[2]],r2=u[e.map[3]];
      const N1=1-3*t*t+2*t*t*t,N2=L*(t-2*t*t+t*t*t),N3=3*t*t-2*t*t*t,N4=L*(-t*t+t*t*t);
      const dN1=(-6*t+6*t*t)/L,dN2=1-4*t+3*t*t,dN3=(6*t-6*t*t)/L,dN4=-2*t+3*t*t;
      return {v:N1*v1+N2*r1+N3*v2+N4*r2,theta:dN1*v1+dN2*r1+dN3*v2+dN4*r2};
    }

    const S=[],M=[],R=[],D=[];
    const add=(a,x,y)=>a.push([Number(x.toFixed(9)),Math.abs(y)<1e-11?0:y]);
    const SAMPLE=24,defOut=units==='SI'?1000:12;
    for(const e of elements){
      for(let k=0;k<=SAMPLE;k++){
        if(e.i>0&&k===0) continue;
        const x=nodes[e.i]+e.L*k/SAMPLE,st=stat(x,false),sh=shape(e,x-nodes[e.i]);
        add(S,x,st.V);add(M,x,isHinge(x)?0:st.M);add(R,x,sh.theta);add(D,x,sh.v*defOut);
      }
    }

    function restoreJump(series,x,kind){
      const a=stat(x,true),b=stat(x,false);
      for(let i=series.length-1;i>=0;i--) if(near(series[i][0],x)) series.splice(i,1);
      add(series,x,kind==='shear'?a.V:(isHinge(x)?0:a.M));
      const av=kind==='shear'?a.V:a.M,bv=kind==='shear'?b.V:b.M;
      if(!near(av,bv)) add(series,x,kind==='shear'?bv:(isHinge(x)?0:bv));
    }
    const shearX=[...reactions.map(r=>r.position),...loads.filter(l=>l.type==='point').map(l=>l.x)].filter(x=>x>EPS&&x<total-EPS);
    [...new Set(shearX.map(x=>x.toFixed(9)))].forEach(k=>restoreJump(S,Number(k),'shear'));
    const momentX=[...loads.filter(l=>l.type==='moment').map(l=>l.x),...reactions.filter(r=>Math.abs(r.moment)>1e-10).map(r=>r.position)].filter(x=>x>EPS&&x<total-EPS);
    [...new Set(momentX.map(x=>x.toFixed(9)))].forEach(k=>restoreJump(M,Number(k),'moment'));

    // At a hinge, vertical displacement is shared but the left/right rotations are independent.
    for(const h of hinges){
      const i=nodeAt(h),left=elements.find(e=>e.j===i),right=elements.find(e=>e.i===i);
      if(left&&right){
        const sl=shape(left,left.L),sr=shape(right,0);
        for(let k=R.length-1;k>=0;k--) if(near(R[k][0],h)) R.splice(k,1);
        add(R,h,sl.theta);add(R,h,sr.theta);
        for(let k=D.length-1;k>=0;k--) if(near(D[k][0],h)) D.splice(k,1);
        add(D,h,sl.v*defOut);
      }
    }

    const clean=a=>a.slice().sort((p,q)=>p[0]-q[0]).filter((p,i)=>i===0||!(near(p[0],a[i-1]?.[0])&&near(p[1],a[i-1]?.[1])));
    const shear=clean(S),moment=clean(M),rotation=clean(R),deflection=clean(D);

    const totalApplied=loads.reduce((sum,l)=>sum+(l.type==='point'?l.v:l.type==='udl'?(l.q0+l.q1)*(l.b-l.a)/2:0),0);
    const reactionV=reactions.reduce((sum,r)=>sum+r.vertical,0);
    const forceTol=1e-7*Math.max(1,Math.abs(totalApplied),Math.abs(reactionV));
    if(Math.abs(totalApplied+reactionV)>forceTol) throw new Error('Statics verification failed: vertical forces do not balance.');
    const endM=stat(total,false).M;
    if(Math.abs(endM)>1e-7*Math.max(1,Math.abs(endM))) throw new Error('Statics verification failed: global moment equilibrium does not close.');
    for(const h of hinges){
      const a=stat(h,true).M,b=stat(h,false).M,tol=1e-7*Math.max(1,Math.abs(a),Math.abs(b));
      if(Math.abs(a)>tol||Math.abs(b)>tol) throw new Error(`Statics verification failed: internal hinge at ${h} does not have zero moment.`);
    }
    for(const s of external){
      const i=nodeAt(s.position);
      if(Math.abs(u[dof[i].v]*defOut-s.settlement)>1e-7*Math.max(1,Math.abs(s.settlement))) throw new Error(`Deflection verification failed at support ${s.position}.`);
      if(s.type==='fixed'&&Math.abs(u[dof[i].r])>1e-8) throw new Error(`Rotation verification failed at fixed support ${s.position}.`);
    }

    return {reactions,diagrams:{shear,moment,rotation,deflection},extremes:{},meta:{engineVersion:'BeamAnalyzer-InternalHinge-3.0',staticsVerified:true,deflectionVerified:true,internalHinges:hinges.length,units}};
  }

  window.__beamAnalyzerSolveInternalHingeV3=solve;
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve')||!init||typeof init.body!=='string') return upstreamFetch(input,init);
    try{
      const result=solve(JSON.parse(init.body));
      return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-InternalHinge-3.0'}});
    }catch(err){
      console.error('Beam Analyzer internal-hinge solver:',err);
      return new Response(JSON.stringify({detail:err?.message||'Beam analysis failed.'}),{status:422,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-InternalHinge-3.0'}});
    }
  };

  // ---------- Visualization ----------
  const baseRenderBeam=window.renderBeam;
  function drawHingeSymbol(){
    addHingeOption();
    if(typeof baseRenderBeam!=='function'||typeof model==='undefined') return;
    const svg=document.querySelector('#beamCanvas svg');
    const beam=svg?.querySelector('.beamLine');
    if(!svg||!beam) return;
    const x1=num(beam.getAttribute('x1')),x2=num(beam.getAttribute('x2')),y=num(beam.getAttribute('y1'));
    const L=typeof len==='function'?num(len()):0;
    if(!(L>0)||!finite(x1)||!finite(x2)||!finite(y)) return;

    svg.querySelectorAll('.internal-hinge-v3').forEach(e=>e.remove());
    model.supports.filter(s=>s.type==='internal-hinge').forEach((s,index)=>{
      const x=x1+(Math.max(0,Math.min(L,num(s.position)))/L)*(x2-x1);
      const g=[...svg.querySelectorAll('g.supportDrag')].find(q=>String(q.dataset.id)===String(s.id));
      if(!g) return;

      g.innerHTML='';
      g.classList.add('internal-hinge-v3');
      g.setAttribute('data-internal-hinge','true');
      g.style.cursor='grab';

      const c=document.createElementNS(NS,'circle');
      c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','10');
      c.setAttribute('fill','var(--card,#17191d)');c.setAttribute('stroke','var(--text,#f2f4f7)');c.setAttribute('stroke-width','2.5');
      c.setAttribute('vector-effect','non-scaling-stroke');c.setAttribute('class','internal-hinge-circle');
      g.appendChild(c);

      const n=document.createElementNS(NS,'text');
      n.setAttribute('x',x);n.setAttribute('y',y-18);n.setAttribute('text-anchor','middle');n.setAttribute('class','internal-hinge-index');n.textContent=`H${index+1}`;g.appendChild(n);

      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',x);label.setAttribute('y',y+46);label.setAttribute('text-anchor','middle');label.setAttribute('class','internal-hinge-label');
      const unit=typeof unitText==='function'?unitText('length'):'m';
      const pos=typeof fmt==='function'?fmt(s.position):s.position;
      label.textContent=`Internal Hinge · ${pos} ${unit}`;g.appendChild(label);
    });
  }

  if(typeof window.renderInputs==='function'){
    const base=window.renderInputs;
    window.renderInputs=function(){base();addHingeOption();};
  }
  if(typeof baseRenderBeam==='function') window.renderBeam=function(){baseRenderBeam();drawHingeSymbol();};

  const style=document.createElement('style');
  style.textContent=`
    #supportRows select[data-k="type"]{min-width:145px}
    #beamCanvas g.internal-hinge-v3{cursor:grab}
    #beamCanvas g.internal-hinge-v3:active{cursor:grabbing}
    #beamCanvas .internal-hinge-circle{pointer-events:none}
    #beamCanvas .internal-hinge-index{fill:var(--muted,#9aa2b1);font:700 10px Inter,system-ui,sans-serif;pointer-events:none}
    #beamCanvas .internal-hinge-label{fill:var(--text,#f2f4f7);font:600 12px Inter,system-ui,sans-serif;pointer-events:none}
  `;
  document.head.appendChild(style);

  let queued=false;
  const schedule=()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;if(typeof window.renderBeam==='function')window.renderBeam();});
  };
  new MutationObserver(()=>addHingeOption()).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target.matches?.('#supportRows select[data-k="type"],#supportRows input[data-k="position"]')) schedule();});
  [0,100,300,700,1200].forEach(t=>setTimeout(()=>{addHingeOption();if(typeof window.renderBeam==='function')window.renderBeam();},t));
})();

/* Beam Analyzer — verified beam engine v2.
 *
 * One local analysis path for ordinary beams and beams with internal hinges.
 *
 * Guarantees before a result reaches the UI:
 *   - internal hinges are rotational releases, never supports;
 *   - reactions satisfy vertical equilibrium;
 *   - global end-moment equilibrium is satisfied;
 *   - BMD is reconstructed from equilibrium, so ordinary supports do not
 *     incorrectly force M = 0;
 *   - internal hinges are explicitly checked for M = 0;
 *   - support settlements and fixed-end rotations are checked;
 *   - deflection/rotation use a refined Euler-Bernoulli stiffness mesh;
 *   - concentrated-force/moment discontinuities retain physical point order.
 */
(function(){
  'use strict';
  const upstream=window.fetch.bind(window);
  const EPS=1e-9;
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const near=(a,b)=>Math.abs(n(a)-n(b))<=EPS*Math.max(1,Math.abs(n(a)),Math.abs(n(b)));

  function gaussian(A,b){
    const N=A.length,M=A.map((r,i)=>r.slice().concat([b[i]]));
    for(let k=0;k<N;k++){
      let p=k,best=Math.abs(M[k][k]);
      for(let i=k+1;i<N;i++){const v=Math.abs(M[i][k]);if(v>best){best=v;p=i;}}
      if(!(best>1e-12))throw new Error('Beam is unstable or the stiffness matrix is singular. Check supports, hinges, and geometry.');
      if(p!==k)[M[k],M[p]]=[M[p],M[k]];
      for(let i=k+1;i<N;i++){
        const f=M[i][k]/M[k][k];
        if(Math.abs(f)<1e-18)continue;
        M[i][k]=0;
        for(let j=k+1;j<=N;j++)M[i][j]-=f*M[k][j];
      }
    }
    const x=Array(N).fill(0);
    for(let i=N-1;i>=0;i--){
      let s=M[i][N];
      for(let j=i+1;j<N;j++)s-=M[i][j]*x[j];
      x[i]=s/M[i][i];
      if(!finite(x[i])||Math.abs(x[i])>1e12)throw new Error('Beam analysis produced an invalid displacement. Check stability and support conditions.');
    }
    return x;
  }

  function ke(EI,L){
    const c=EI/(L*L*L),L2=L*L;
    return [[12*c,6*L*c,-12*c,6*L*c],[6*L*c,4*L2*c,-6*L*c,2*L2*c],[-12*c,-6*L*c,12*c,-6*L*c],[6*L*c,2*L2*c,-6*L*c,4*L2*c]];
  }
  function fe(q0,q1,L){
    return [L*(7*q0+3*q1)/20,L*L*(3*q0+2*q1)/60,L*(3*q0+7*q1)/20,-L*L*(2*q0+3*q1)/60];
  }

  function normalize(payload){
    const units=payload.units==='imperial'?'imperial':'SI';
    const spans=(payload.spans||[]).map(s=>({length:n(s.length),E:n(s.E),I:n(s.I)}));
    const supports=(payload.supports||[]).map(s=>({type:s.type,position:n(s.position),settlement:n(s.settlement||0)}));
    const loads=(payload.loads||[]).map(l=>{
      if(l.type==='point'){
        const raw=n(l.magnitude??l.value??0),angle=n(l.angle??0);
        return {type:'point',x:n(l.position??l.from),v:finite(angle)?raw*Math.cos(angle*Math.PI/180):raw,angle};
      }
      if(l.type==='moment')return {type:'moment',x:n(l.position??l.from),m:n(l.magnitude??l.value??0)};
      return {type:'udl',a:n(l.from),b:n(l.to),q0:n(l.start??l.value??0),q1:n(l.end??l.value2??l.value??0)};
    });
    return {units,spans,supports,loads};
  }

  function solve(raw){
    const p=normalize(raw),{units,spans,supports,loads}=p;
    if(!spans.length||spans.some(s=>!(s.length>0)||!(s.E>0)||!(s.I>0)))throw new Error('Each beam span must have positive length, E, and I.');
    const total=spans.reduce((s,e)=>s+e.length,0);
    const hinges=supports.filter(s=>s.type==='internal-hinge').map(s=>s.position).sort((a,b)=>a-b);
    if(hinges.some(h=>h<=EPS||h>=total-EPS))throw new Error('Internal hinges must lie strictly inside the beam.');
    for(let i=1;i<hinges.length;i++)if(near(hinges[i],hinges[i-1]))throw new Error('Internal hinge positions must be unique.');
    const ext=supports.filter(s=>s.type!=='internal-hinge');
    for(const s of ext){
      if(!['pin','roller','fixed'].includes(s.type))throw new Error('Unsupported support type.');
      if(s.position<-EPS||s.position>total+EPS)throw new Error('A support lies outside the beam.');
      if(hinges.some(h=>near(h,s.position)))throw new Error('An external support cannot share a position with an internal hinge.');
    }
    for(const l of loads){
      if(l.type==='point'||l.type==='moment'){if(l.x<-EPS||l.x>total+EPS)throw new Error('A concentrated load lies outside the beam.');}
      else if(!(l.b>l.a+EPS)||l.a<-EPS||l.b>total+EPS)throw new Error('A distributed load has invalid limits.');
    }

    const eventNodes=[0,total,...hinges,...ext.map(s=>s.position),...loads.flatMap(l=>l.type==='udl'?[l.a,l.b]:[l.x])]
      .filter(finite).map(x=>Math.max(0,Math.min(total,x))).sort((a,b)=>a-b)
      .filter((x,i,a)=>i===0||!near(x,a[i-1]));
    const MESH=8;
    const nodes=[];
    for(let i=0;i<eventNodes.length-1;i++){
      const a=eventNodes[i],b=eventNodes[i+1];
      if(i===0)nodes.push(a);
      for(let k=1;k<=MESH;k++)nodes.push(a+(b-a)*k/MESH);
    }

    const isHinge=x=>hinges.some(h=>near(h,x));
    const dof=nodes.map(()=>({v:-1,r:-1,rl:-1,rr:-1}));
    let ndof=0;
    nodes.forEach((x,i)=>{dof[i].v=ndof++;if(isHinge(x)){dof[i].rl=ndof++;dof[i].rr=ndof++;}else dof[i].r=ndof++;});
    const K=Array.from({length:ndof},()=>Array(ndof).fill(0)),F=Array(ndof).fill(0),elements=[];
    const starts=[0];for(const s of spans)starts.push(starts[starts.length-1]+s.length);
    const spanIndex=(a,b)=>{for(let i=0;i<spans.length;i++)if(a>=starts[i]-EPS&&b<=starts[i+1]+EPS)return i;throw new Error('Beam spans could not be connected into a continuous mesh.');};
    const qAt=(l,x)=>{if(l.b<=l.a+EPS)return l.q0;const t=Math.max(0,Math.min(1,(x-l.a)/(l.b-l.a)));return l.q0+(l.q1-l.q0)*t;};

    for(let i=0;i<nodes.length-1;i++){
      const a=nodes[i],b=nodes[i+1],s=spans[spanIndex(a,b)],L=b-a,EI=s.E*s.I*(units==='SI'?1e-6:1/144);
      const d=[dof[i].v,isHinge(a)?dof[i].rr:dof[i].r,dof[i+1].v,isHinge(b)?dof[i+1].rl:dof[i+1].r];
      const k=ke(EI,L);for(let r=0;r<4;r++)for(let c=0;c<4;c++)K[d[r]][d[c]]+=k[r][c];
      for(const l of loads)if(l.type==='udl'&&l.a<=a+EPS&&l.b>=b-EPS){const f=fe(qAt(l,a),qAt(l,b),L);for(let r=0;r<4;r++)F[d[r]]+=f[r];}
      elements.push({i,j:i+1,L,EI,d});
    }

    const nodeAt=x=>nodes.findIndex(q=>near(q,x));
    for(const l of loads){
      if(l.type==='udl')continue;
      const i=nodeAt(l.x);if(i<0)throw new Error('Load position is invalid.');
      if(l.type==='point')F[dof[i].v]+=l.v;
      else if(l.type==='moment'){
        const rd=isHinge(l.x)?dof[i].rl:dof[i].r;
        if(rd<0)throw new Error('Moment cannot be applied at this hinge state.');
        F[rd]+=-l.m;
      }
    }

    const prescribed=new Map(),settleScale=units==='SI'?1/1000:1/12;
    for(const s of ext){
      const i=nodeAt(s.position);if(i<0)throw new Error('Support position is invalid.');
      prescribed.set(dof[i].v,s.settlement*settleScale);
      if(s.type==='fixed')prescribed.set(dof[i].r,0);
    }
    if(!prescribed.size)throw new Error('At least one external support is required.');
    const free=[];for(let i=0;i<ndof;i++)if(!prescribed.has(i))free.push(i);
    const pk=[...prescribed.keys()],rhs=free.map(i=>F[i]-pk.reduce((z,d)=>z+K[i][d]*prescribed.get(d),0));
    const uf=gaussian(free.map(i=>free.map(j=>K[i][j])),rhs);
    const u=Array(ndof).fill(0);free.forEach((d,i)=>u[d]=uf[i]);for(const [d,v] of prescribed)u[d]=v;
    const rvec=Array(ndof).fill(0);for(let i=0;i<ndof;i++){let z=0;for(let j=0;j<ndof;j++)z+=K[i][j]*u[j];rvec[i]=z-F[i];}
    const reactions=ext.map(s=>{const i=nodeAt(s.position);return {type:s.type,position:s.position,vertical:rvec[dof[i].v],moment:s.type==='fixed'?-rvec[dof[i].r]:0};});

    function qArea(l,x){if(x<=l.a)return 0;const z=Math.min(x,l.b)-l.a;if(z<=0)return 0;const sl=(l.q1-l.q0)/(l.b-l.a);return l.q0*z+sl*z*z/2;}
    function qMoment(l,x){if(x<=l.a)return 0;const z=Math.min(x,l.b)-l.a;if(z<=0)return 0;const sl=(l.q1-l.q0)/(l.b-l.a);const area=l.q0*z+sl*z*z/2;const first=l.q0*z*z/2+sl*z*z*z/3;return (x-l.a)*area-first;}
    const sourcePoints=loads.filter(l=>l.type==='point'),sourceMoments=loads.filter(l=>l.type==='moment');
    function statAt(x,left=false){
      const include=q=>left?q<x-EPS:q<=x+EPS;let V=0,M=0;
      for(const r of reactions)if(include(r.position)){V+=r.vertical;M+=r.vertical*(x-r.position)+r.moment;}
      for(const l of sourcePoints)if(include(l.x)){V+=l.v;M+=l.v*(x-l.x);}
      for(const l of loads)if(l.type==='udl'){V+=qArea(l,x);M+=qMoment(l,x);}
      for(const l of sourceMoments)if(include(l.x))M+=l.m;
      return {V,M};
    }

    const scaleDef=units==='SI'?1000:12,shear=[],moment=[],rotation=[],deflection=[],add=(a,x,y)=>a.push([Number(x.toFixed(9)),Math.abs(y)<1e-10?0:y]);
    function shape(e,x){
      const t=x/e.L,L=e.L,v1=u[e.d[0]],r1=u[e.d[1]],v2=u[e.d[2]],r2=u[e.d[3]];
      const N1=1-3*t*t+2*t*t*t,N2=L*(t-2*t*t+t*t*t),N3=3*t*t-2*t*t*t,N4=L*(-t*t+t*t*t);
      const dN1=(-6*t+6*t*t)/L,dN2=1-4*t+3*t*t,dN3=(6*t-6*t*t)/L,dN4=-2*t+3*t*t;
      return {v:N1*v1+N2*r1+N3*v2+N4*r2,theta:dN1*v1+dN2*r1+dN3*v2+dN4*r2};
    }
    const SAMPLE=24;
    for(const e of elements){
      for(let k=0;k<=SAMPLE;k++){
        if(e.i>0&&k===0)continue;
        const x=nodes[e.i]+e.L*k/SAMPLE,s=statAt(x),sh=shape(e,x-nodes[e.i]);
        add(shear,x,s.V);add(moment,x,isHinge(x)?0:s.M);add(rotation,x,sh.theta);add(deflection,x,sh.v*scaleDef);
      }
    }

    const shearJumps=[...reactions.map(r=>r.position),...sourcePoints.map(l=>l.x)].filter(x=>x>EPS&&x<total-EPS);
    for(const x of shearJumps){const a=statAt(x,true),b=statAt(x,false);for(let i=shear.length-1;i>=0;i--)if(near(shear[i][0],x))shear.splice(i,1);add(shear,x,a.V);if(!near(a.V,b.V))add(shear,x,b.V);}
    const momentJumps=[...sourceMoments.map(l=>l.x),...reactions.filter(r=>Math.abs(r.moment)>1e-10).map(r=>r.position)].filter(x=>x>EPS&&x<total-EPS);
    for(const x of momentJumps){const a=statAt(x,true),b=statAt(x,false);for(let i=moment.length-1;i>=0;i--)if(near(moment[i][0],x))moment.splice(i,1);add(moment,x,isHinge(x)?0:a.M);if(!near(a.M,b.M))add(moment,x,isHinge(x)?0:b.M);}
    for(const h of hinges){
      const hi=nodes.findIndex(x=>near(x,h));
      if(hi>0&&hi<nodes.length-1){
        const left=elements.find(e=>e.j===hi),right=elements.find(e=>e.i===hi);
        if(left&&right){
          const sl=shape(left,left.L),sr=shape(right,0);
          for(let i=rotation.length-1;i>=0;i--)if(near(rotation[i][0],h))rotation.splice(i,1);
          for(let i=deflection.length-1;i>=0;i--)if(near(deflection[i][0],h))deflection.splice(i,1);
          add(rotation,h,sl.theta);add(rotation,h,sr.theta);add(deflection,h,sl.v*scaleDef);
        }
      }
    }
    const clean=series=>series.slice().sort((a,b)=>a[0]-b[0]).filter((p,i,a)=>i===0||!(near(p[0],a[i-1][0])&&near(p[1],a[i-1][1])));
    const S=clean(shear),M=clean(moment),R=clean(rotation),D=clean(deflection);

    const verticalApplied=sourcePoints.reduce((s,l)=>s+l.v,0)+loads.filter(l=>l.type==='udl').reduce((s,l)=>s+(l.q0+l.q1)*(l.b-l.a)/2,0);
    const verticalReaction=reactions.reduce((s,r)=>s+r.vertical,0);
    const eqTol=1e-7*Math.max(1,Math.abs(verticalApplied),Math.abs(verticalReaction));
    if(Math.abs(verticalApplied+verticalReaction)>eqTol)throw new Error('Statics verification failed: vertical forces do not balance.');
    const endMoment=statAt(total,false).M,endMomentTol=1e-7*Math.max(1,Math.abs(endMoment));
    if(Math.abs(endMoment)>endMomentTol)throw new Error('Statics verification failed: global moment equilibrium does not close at the beam end.');
    for(const h of hinges){
      const a=statAt(h,true).M,b=statAt(h,false).M,sc=Math.max(1,Math.abs(a),Math.abs(b));
      if(Math.abs(a)>1e-7*sc||Math.abs(b)>1e-7*sc)throw new Error(`Statics verification failed: bending moment at internal hinge ${h} is not zero.`);
    }
    for(const s of ext){
      const i=nodeAt(s.position),v=u[dof[i].v]*scaleDef,expected=s.settlement;
      const tol=1e-7*Math.max(1,Math.abs(expected));
      if(Math.abs(v-expected)>tol)throw new Error(`Deflection verification failed at support ${s.position}.`);
      if(s.type==='fixed'&&Math.abs(u[dof[i].r])>1e-8*Math.max(1,Math.abs(u[dof[i].r])))throw new Error(`Rotation verification failed at fixed support ${s.position}.`);
    }

    function extrema(series){
      if(!series.length)return null;
      let max=series[0],min=series[0];for(const p of series){if(p[1]>max[1])max=p;if(p[1]<min[1])min=p;}
      return {max:{value:max[1],position:max[0]},min:{value:min[1],position:min[0]},abs:{value:Math.max(Math.abs(max[1]),Math.abs(min[1])),position:Math.abs(max[1])>=Math.abs(min[1])?max[0]:min[0]}};
    }
    return {reactions,diagrams:{shear:S,moment:M,rotation:R,deflection:D},extremes:{shear:extrema(S),moment:extrema(M),deflection:extrema(D)},meta:{engineVersion:'BeamAnalyzer-Verified-2.0',staticsVerified:true,deflectionVerified:true,rotationVerified:true,units,warnings:['Internal hinges are moment releases, not supports. Results are withheld if equilibrium or boundary-condition checks fail.']}};
  }

  window.__beamAnalyzerSolveInternalHinge=solve;
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('/api/beam/solve')||!init||typeof init.body!=='string')return upstream(input,init);
    try{
      const result=solve(JSON.parse(init.body));
      return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-Verified-2.0'}});
    }catch(err){
      console.error('Beam Analyzer verified solver:',err);
      return new Response(JSON.stringify({detail:err?.message||'Beam analysis failed verification.'}),{status:422,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Engine-Version':'BeamAnalyzer-Verified-2.0'}});
    }
  };

  // Internal hinges are releases, never support symbols.
  const baseInputs=window.renderInputs,baseBeam=window.renderBeam;
  function addHingeOption(){
    document.querySelectorAll('#supportRows select[data-k="type"]').forEach(sel=>{
      if(!sel.querySelector('option[value="internal-hinge"]')){const o=document.createElement('option');o.value='internal-hinge';o.textContent='Internal Hinge';sel.appendChild(o);}
      const m=(typeof model!=='undefined'&&model&&Array.isArray(model.supports))?model:null;
      const s=m?.supports.find(x=>String(x.id)===String(sel.dataset.sup));if(s)sel.value=s.type;
    });
  }
  if(typeof baseInputs==='function')window.renderInputs=function(){baseInputs();addHingeOption();};
  function drawHinges(){
    const svg=document.querySelector('#beamCanvas svg'),beam=svg?.querySelector('.beamLine');
    if(!svg||!beam||typeof model==='undefined')return;
    const x1=n(beam.getAttribute('x1')),x2=n(beam.getAttribute('x2')),y=n(beam.getAttribute('y1')),L=typeof len==='function'?n(len()):0;
    if(!(L>0))return;
    svg.querySelectorAll('.verifiedInternalHinge').forEach(e=>e.remove());
    const hinges=model.supports.filter(s=>s.type==='internal-hinge');
    hinges.forEach((s,i)=>{
      const x=x1+(Math.max(0,Math.min(L,n(s.position)))/L)*(x2-x1);
      svg.querySelectorAll('g.supportDrag').forEach(g=>{const badge=g.querySelector('.supportBadge'),gx=badge?n(badge.getAttribute('cx')):NaN;if(String(g.getAttribute('data-id'))===String(s.id)||(finite(gx)&&Math.abs(gx-x)<0.5))g.remove();});
      svg.querySelectorAll('text.supportText').forEach(t=>{const tx=n(t.getAttribute('x'));if(finite(tx)&&Math.abs(tx-x)<0.5)t.remove();});
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.classList.add('verifiedInternalHinge');g.setAttribute('pointer-events','none');
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','8.5');c.setAttribute('fill','var(--card,#fff)');c.setAttribute('stroke','var(--text,#20252b)');c.setAttribute('stroke-width','2');g.appendChild(c);
      const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',x);t.setAttribute('y',y+45);t.setAttribute('text-anchor','middle');t.setAttribute('class','supportText');t.textContent=`H${i+1} (Internal Hinge)`;g.appendChild(t);
      const p=document.createElementNS('http://www.w3.org/2000/svg','text');p.setAttribute('x',x);p.setAttribute('y',y+62);p.setAttribute('text-anchor','middle');p.setAttribute('class','dimText');p.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;g.appendChild(p);
      svg.appendChild(g);
      const dimTexts=[...svg.querySelectorAll('.dimText')];
      const label=dimTexts.find(t=>new RegExp(`^S${i+1}:`).test((t.textContent||'').trim()));
      if(label)label.textContent=`H${i+1}: ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):''}`;
    });
  }
  if(typeof baseBeam==='function')window.renderBeam=function(){baseBeam();drawHinges();};

  // Final chart pass: equal-x samples are physical discontinuities. Keep the
  // left -> right order and never sort equal-x points by ordinate.
  function repairRenderedDiscontinuities(svg){
    if(!svg||!['shear','moment'].includes(svg.dataset.kind))return;
    let raw=[];try{raw=JSON.parse(svg.dataset.series||'[]')}catch{return}
    if(!Array.isArray(raw)||raw.length<2)return;
    const w=1100,h=330,pad=Number(svg.dataset.pad)||56,L=Number(svg.dataset.len)||1,min=Number(svg.dataset.min),max=Number(svg.dataset.max);
    if(!finite(L)||!finite(min)||!finite(max)||L<=0||max===min)return;
    const sx=x=>pad+(x/L)*(w-2*pad),sy=y=>h-pad-(y-min)/(max-min)*(h-2*pad);
    const pts=raw.map(p=>Array.isArray(p)?[n(p[0]),n(p[1])]:null).filter(p=>p&&finite(p[0])&&finite(p[1]));
    const out=[];for(const p of pts){const prev=out[out.length-1];if(prev&&near(prev[0],p[0])&&near(prev[1],p[1]))continue;out.push(p);}
    const jumps=new Set();for(let i=1;i<out.length;i++)if(near(out[i-1][0],out[i][0])&&!near(out[i-1][1],out[i][1]))jumps.add(i);
    const pt=p=>`${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`;let d='';
    for(let i=1;i<out.length;i++){const a=out[i-1],b=out[i];if(jumps.has(i))d+=`M ${pt(a)} L ${pt(b)} `;else d+=`${i===1?'M':'L'} ${pt(a)} L ${pt(b)} `;}
    const line=svg.querySelector('.chartLine');if(line)line.setAttribute('d',d.trim());
    const area=svg.querySelector('.chartArea');
    if(area){const runs=[];let run=[out[0]];for(let i=1;i<out.length;i++){if(jumps.has(i)){runs.push(run);run=[out[i]];}else run.push(out[i]);}if(run.length)runs.push(run);area.setAttribute('d',runs.map(r=>`M ${sx(r[0][0]).toFixed(1)} ${sy(0).toFixed(1)} L ${r.map(pt).join(' L ')} L ${sx(r[r.length-1][0]).toFixed(1)} ${sy(0).toFixed(1)} Z`).join(' '));}
    svg.dataset.series=JSON.stringify(out);
  }
  function repairCharts(){document.querySelectorAll('#charts svg[data-kind="shear"],#charts svg[data-kind="moment"]').forEach(repairRenderedDiscontinuities);}
  const charts=document.querySelector('#charts');
  if(charts)new MutationObserver(()=>requestAnimationFrame(repairCharts)).observe(charts,{childList:true,subtree:true});

  // Rotation is an angle and is always reported in radians.
  function repairRotationUnits(){
    const root=document.querySelector('#charts');if(!root)return;
    const headings=[...root.querySelectorAll('h2,h3,h4,strong,div')],heading=headings.find(el=>/ROTATION\s*\/\s*SLOPE/i.test((el.textContent||'').trim()));
    if(!heading)return;let card=heading;
    for(let i=0;i<6&&card.parentElement;i++){const p=card.parentElement;if(p.querySelector('svg,canvas')||/ROTATION\s*\/\s*SLOPE/i.test((p.textContent||''))){card=p;if(p.querySelector('svg,canvas'))break;}else break;}
    const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT),nodes=[];let node;while((node=walker.nextNode()))nodes.push(node);
    for(const t of nodes){const old=t.nodeValue||'';if(/kN/.test(old))t.nodeValue=old.replace(/kN(?:·m)?/g,'rad');}
    const title=[...card.querySelectorAll('h2,h3,h4,strong')].find(el=>/ROTATION\s*\/\s*SLOPE/i.test((el.textContent||'')));if(title&&!/\(rad\)/i.test(title.textContent||''))title.textContent=title.textContent.replace(/\s*$/,'')+' (rad)';
  }
  if(charts)new MutationObserver(()=>repairRotationUnits()).observe(charts,{childList:true,subtree:true,characterData:true});

  requestAnimationFrame(()=>{if(typeof renderInputs==='function')renderInputs();if(typeof renderBeam==='function')renderBeam();repairCharts();repairRotationUnits();});
  setTimeout(()=>{repairCharts();repairRotationUnits();},100);
  setTimeout(()=>{repairCharts();repairRotationUnits();},500);
})();

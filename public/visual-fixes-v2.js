(function(){
  const $=s=>document.querySelector(s);
  const unitLabel=k=>typeof unitText==='function'?unitText(k):k;
  const f=v=>typeof fmt==='function'?fmt(v):String(v);
  const L=()=>Math.max(typeof len==='function'?Number(len()):1,1);

  function momentDir(v){
    v=Number(v)||0;
    if(Math.abs(v)<1e-12)return {id:'none',text:'None',symbol:''};
    return v>0?{id:'ccw',text:'Counter-clockwise',symbol:'↺'}:{id:'cw',text:'Clockwise',symbol:'↻'};
  }

  function support(s,x,y){
    if(s.type==='fixed')return `<g>
      <line x1="${x-10}" y1="${y-24}" x2="${x-10}" y2="${y+10}" class="vWall"/>
      <path d="M${x-10} ${y-20}l-8 5m8 1l-8 5m8 1l-8 5m8 1l-8 5" class="vHatch"/>
      <line x1="${x-10}" y1="${y-24}" x2="${x}" y2="${y}" class="vConnector"/>
    </g>`;
    const roller=s.type==='roller';
    let g=`<path d="M${x-15} ${y+10}L${x} ${y-8}L${x+15} ${y+10}Z" class="vTriangle"/>`;
    if(roller)g+=`<circle cx="${x-7}" cy="${y+15}" r="4" class="vWheel"/><circle cx="${x+7}" cy="${y+15}" r="4" class="vWheel"/><line x1="${x-20}" y1="${y+21}" x2="${x+20}" y2="${y+21}" class="vGround"/><path d="M${x-16} ${y+21}l-5 6m12-6l-5 6m12-6l-5 6m12-6l-5 6" class="vHatch"/>`;
    else g+=`<line x1="${x-19}" y1="${y+11}" x2="${x+19}" y2="${y+11}" class="vGround"/><path d="M${x-15} ${y+11}l-5 6m12-6l-5 6m12-6l-5 6m12-6l-5 6" class="vHatch"/>`;
    return `<g>${g}</g>`;
  }

  function renderCleanBeam(){
    const W=1280,H=430,pad=58,by=108,total=L(),x=p=>pad+Math.max(0,Math.min(total,p))/total*(W-2*pad);
    let s=`<svg viewBox="0 0 ${W} ${H}" aria-label="Beam model">
      <defs>
        <marker id="vDown" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto"><path d="M0 0L8 0L4 8Z" fill="#ef4444"/></marker>
        <marker id="vUp" markerWidth="8" markerHeight="8" refX="4" refY="1" orient="auto"><path d="M0 8L8 8L4 0Z" fill="#ef4444"/></marker>
        <marker id="vCW" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#f59e0b"/></marker>
        <marker id="vCCW" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto"><path d="M9 0L0 4.5L9 9Z" fill="#f59e0b"/></marker>
      </defs><line x1="${pad}" y1="${by}" x2="${W-pad}" y2="${by}" class="vBeam"/>`;

    /* UDL / varying load */
    (model.loads||[]).filter(q=>q.type==='udl').forEach(q=>{
      const a=x(q.from),b=x(q.to),v1=Number(q.value)||0,v2=Number(q.value2??q.value)||0;
      const n=Math.max(9,Math.min(30,Math.round((b-a)/32)+1));
      const max=Math.max(Math.abs(v1),Math.abs(v2),1e-9);
      const h=v=>20+Math.min(58,Math.abs(v)/max*50);
      const sign=(v,t)=>{if(Math.abs(v)>1e-10)return Math.sign(v);return v1<0||v2<0?-1:1};
      const y=(v,t)=>sign(v,t)<0?by-h(v):by+h(v);
      const y1=y(v1,0),y2=y(v2,1);
      const arrows=[];
      for(let i=0;i<n;i++){
        const t=i/(n-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;if(Math.abs(v)<1e-10)continue;
        const down=sign(v,t)<0,yy=y(v,t);
        arrows.push(`<line x1="${xx.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${xx.toFixed(1)}" y2="${down?by-5:by+5}" class="vUdlArrow" marker-end="url(#${down?'vDown':'vUp'})"/>`);
      }
      const label=v1===v2?`${v1<0?'−':''}${f(Math.abs(v1))} ${unitLabel('load')}`:`${v1<0?'−':''}${f(Math.abs(v1))} → ${v2<0?'−':''}${f(Math.abs(v2))} ${unitLabel('load')}`;
      s+=`<g><line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="vUdlEnvelope"/>${arrows.join('')}<text x="${(a+b)/2}" y="${Math.min(y1,y2)-10}" text-anchor="middle" class="vUdlLabel">${label}</text></g>`;
    });

    /* Point load */
    (model.loads||[]).filter(q=>q.type==='point').forEach(q=>{
      const xx=x(q.from),v=Number(q.value)||0,down=v<0,top=down?26:190,end=down?by-5:by+5;
      s+=`<line x1="${xx}" y1="${top}" x2="${xx}" y2="${end}" class="vPoint" marker-end="url(#${down?'vDown':'vUp'})"/><text x="${xx}" y="${down?17:210}" text-anchor="middle" class="vPointLabel">${v<0?'−':''}${f(Math.abs(v))} ${unitLabel('force')}</text>`;
    });

    /* Applied moment: positive = CCW, negative = CW. */
    (model.loads||[]).filter(q=>q.type==='moment').forEach(q=>{
      const xx=x(q.from),v=Number(q.value)||0,d=momentDir(v),r=20;
      const path=d.id==='ccw'?`M${xx+16} ${by-20}A${r} ${r} 0 1 0 ${xx-16} ${by-20}`:`M${xx-16} ${by-20}A${r} ${r} 0 1 1 ${xx+16} ${by-20}`;
      s+=`<path d="${path}" class="vMoment" marker-end="url(#${d.id==='ccw'?'vCCW':'vCW'})"/><text x="${xx}" y="${by-45}" text-anchor="middle" class="vMomentValue">${v<0?'−':''}${f(Math.abs(v))} ${unitLabel('moment')}</text><text x="${xx}" y="${by-30}" text-anchor="middle" class="vMomentDir">${d.symbol} ${d.text}</text>`;
    });

    /* Supports: static graphics only. */
    (model.supports||[]).forEach((q,i)=>{
      const xx=x(q.position),name=q.type==='fixed'?'Fixed':q.type==='roller'?'Roller':'Pin';
      s+=`${support(q,xx,by)}<circle cx="${xx}" cy="${by-4}" r="9" class="vBadge"/><text x="${xx}" y="${by-4}" text-anchor="middle" dominant-baseline="middle" class="vBadgeText">${i+1}</text><text x="${xx}" y="${by+42}" text-anchor="middle" class="vSupportName">S${i+1} (${name})</text><text x="${xx}" y="${by+57}" text-anchor="middle" class="vSupportPos">@ ${f(q.position)} ${unitLabel('length')}</text>`;
    });

    /* Clean dimension rail, one row of labels and one row of values. */
    if(showDims!==false){
      const ry=315,vy=342,pts=[];
      (model.supports||[]).forEach((q,i)=>pts.push({p:+q.position,l:`S${i+1}`}));
      (model.loads||[]).forEach(q=>q.type==='udl'?(pts.push({p:+q.from,l:`L${q.id}`}),pts.push({p:+q.to,l:`L${q.id}`})):pts.push({p:+q.from,l:`L${q.id}`}));
      pts.sort((a,b)=>a.p-b.p);
      const u=[];
      pts.forEach(q=>{let z=u.find(v=>Math.abs(v.p-q.p)<1e-8);if(z){if(!z.l.includes(q.l))z.l.push(q.l)}else u.push({p:q.p,l:[q.l]})});
      s+=`<line x1="${pad}" y1="${ry}" x2="${W-pad}" y2="${ry}" class="vDimRail"/>`;
      u.forEach((q,i)=>{const xx=x(q.p),row=i%2;s+=`<line x1="${xx}" y1="${ry-6}" x2="${xx}" y2="${ry+7}" class="vDimTick"/><text x="${xx}" y="${ry-14-row*15}" text-anchor="middle" class="vDimLabel">${q.l.join(' · ')}</text><text x="${xx}" y="${vy+row*15}" text-anchor="middle" class="vDimValue">${f(q.p)} ${unitLabel('length')}</text>`});
      s+=`<line x1="${pad}" y1="377" x2="${W-pad}" y2="377" class="vDimRail"/><line x1="${pad}" y1="370" x2="${pad}" y2="384" class="vDimTick"/><line x1="${W-pad}" y1="370" x2="${W-pad}" y2="384" class="vDimTick"/><text x="${W/2}" y="398" text-anchor="middle" class="vOverall">${f(total)} ${unitLabel('length')}</text>`;
    }else{
      s+=`<text x="${pad}" y="410" class="vAxis">0 ${unitLabel('length')}</text><text x="${W-pad}" y="410" text-anchor="end" class="vAxis">${f(total)} ${unitLabel('length')}</text>`;
    }
    s+='</svg>';
    $('#beamCanvas').innerHTML=s;
    $('#beamCanvas').style.transform=`translate(${panX||0}px,${panY||0}px) scale(${zoom||1})`;
  }

  /* The canvas no longer attaches pointer handlers to loads/supports. */
  function installUnitFix(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-unit]');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      if(b.dataset.unit===unit)return;
      unit=b.dataset.unit;model.units=unit;result=null;saveLocal();render();scheduleSolve(100);
    },true);
  }

  function installResultDirection(){
    const old=renderResults;
    renderResults=function(){
      old();
      const root=$('#reactions');if(!root)return;
      root.querySelectorAll('tbody tr').forEach(row=>{
        const c=row.querySelectorAll('td');if(c.length<4||c[3].dataset.dirDone==='1')return;
        const raw=c[3].textContent.trim(),m=raw.match(/[-+]?\d[\d,]*(?:\.\d+)?/);if(!m)return;
        const d=momentDir(Number(m[0].replace(/,/g,'')));
        c[3].innerHTML=`<span>${raw}</span>${d.id==='none'?'':`<span class="vReactionDir ${d.id}"> · ${d.symbol} ${d.text}</span>`}`;c[3].dataset.dirDone='1';
      });
    };
  }

  function fixLoadHeaders(){
    const h=$('#loadRows')?.closest('table')?.querySelectorAll('thead th');
    if(h?.length>=7){h[2].textContent='Value';h[3].textContent='Value 2 (UDL)';h[4].textContent='Position / From';h[5].textContent='To (UDL)'}
  }

  const st=document.createElement('style');st.textContent=`
    .beamViewport{height:430px;min-height:430px;background:linear-gradient(180deg,rgba(148,163,184,.025),transparent)}
    .vBeam{stroke:#5aa0ff;stroke-width:3;vector-effect:non-scaling-stroke}
    .vUdlEnvelope{stroke:#35b779;stroke-width:1.8;fill:none;vector-effect:non-scaling-stroke}
    .vUdlArrow{stroke:#35b779;stroke-width:1.25;vector-effect:non-scaling-stroke}
    .vUdlLabel{fill:#55c993;font-size:12px;font-weight:700}
    .vPoint{stroke:#ef4444;stroke-width:2;vector-effect:non-scaling-stroke}
    .vPointLabel{fill:#ef4444;font-size:13px;font-weight:700}
    .vMoment{stroke:#f59e0b;stroke-width:2.2;fill:none;vector-effect:non-scaling-stroke}
    .vMomentValue{fill:#f59e0b;font-size:13px;font-weight:700}.vMomentDir{fill:#f59e0b;font-size:10px;font-weight:600}
    .vTriangle{fill:rgba(148,163,184,.05);stroke:#9aa4b2;stroke-width:1.6}.vWheel{fill:var(--card);stroke:#9aa4b2;stroke-width:1.5}.vGround,.vWall,.vConnector{stroke:#9aa4b2;stroke-width:1.5;fill:none}.vHatch{stroke:#7f8997;stroke-width:1.05;fill:none}
    .vBadge{fill:#111827;stroke:#e7edf4;stroke-width:1.2}.vBadgeText{fill:#fff;font-size:9px;font-weight:700}.vSupportName{fill:#8bbcff;font-size:10px;font-weight:700}.vSupportPos{fill:#9aa4b2;font-size:9px}
    .vDimRail{stroke:#697586;stroke-width:1;vector-effect:non-scaling-stroke}.vDimTick{stroke:#8c97a7;stroke-width:1;vector-effect:non-scaling-stroke}.vDimLabel{fill:#9eb8d7;font-size:10px;font-weight:700}.vDimValue{fill:#aab4c1;font-size:10px}.vOverall{fill:#e0e6ed;font-size:12px;font-weight:700}.vAxis{fill:#9aa4b2;font-size:10px}.vReactionDir{font-size:10px;font-weight:600}.vReactionDir.ccw{color:#f59e0b}.vReactionDir.cw{color:#8b5cf6}
    @media(max-width:650px){.beamViewport{height:380px;min-height:380px}.vUdlLabel,.vPointLabel,.vMomentValue{font-size:11px}.vSupportName{font-size:9px}}
  `;document.head.appendChild(st);

  installUnitFix();installResultDirection();
  const baseRender=render;
  render=function(){baseRender();renderCleanBeam();setTimeout(fixLoadHeaders,0)};
  renderBeam=renderCleanBeam;
  setTimeout(()=>{renderCleanBeam();fixLoadHeaders()},0);
})();
/* Beam Analyzer visual fixes: clean StructureCalcs-style beam diagram, no object dragging,
   correct load-direction graphics, compact dimensions, moment direction labels, and unit toggle behavior. */
(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  function fmtV(v,d=3){ return typeof fmt==='function' ? fmt(v,d) : String(v); }
  function unit(k){ return typeof unitText==='function' ? unitText(k) : k; }
  function beamLength(){ return Math.max(typeof len==='function' ? Number(len()) : 1, 1); }

  /* Keep every entered number exactly as entered when switching SI <-> Imperial.
     Only the unit system changes; the solver receives the same numeric model under
     the new unit system. */
  function installUnitBehavior(){
    document.addEventListener('click', function(e){
      const b=e.target.closest('[data-unit]');
      if(!b) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if(b.dataset.unit===unit) return;
      unit=b.dataset.unit;
      model.units=unit;
      result=null;
      saveLocal();
      render();
      scheduleSolve(100);
    }, true);
  }

  function momentDirection(value){
    const v=Number(value)||0;
    if(Math.abs(v)<1e-12) return {name:'None',symbol:'',id:'none'};
    /* StructureCalcs convention: positive applied moment = counter-clockwise. */
    return v>0 ? {name:'Counter-clockwise',symbol:'↺',id:'ccw'} : {name:'Clockwise',symbol:'↻',id:'cw'};
  }

  function supportSvgClean(s,x,y){
    if(s.type==='fixed'){
      return `<g class="scSupport fixedSupport">
        <line x1="${x-10}" y1="${y-24}" x2="${x-10}" y2="${y+10}" class="scWall"/>
        <path d="M${x-10} ${y-20}l-8 5m8 1l-8 5m8 1l-8 5m8 1l-8 5" class="scHatch"/>
        <line x1="${x-10}" y1="${y-24}" x2="${x}" y2="${y}" class="scConnector"/>
      </g>`;
    }
    const roller=s.type==='roller';
    let out=`<g class="scSupport"><path d="M${x-15} ${y+10}L${x} ${y-8}L${x+15} ${y+10}Z" class="scTriangle"/>`;
    if(roller){
      out+=`<circle cx="${x-7}" cy="${y+15}" r="4" class="scWheel"/><circle cx="${x+7}" cy="${y+15}" r="4" class="scWheel"/>
        <line x1="${x-20}" y1="${y+21}" x2="${x+20}" y2="${y+21}" class="scGround"/>
        <path d="M${x-16} ${y+21}l-5 6m12-6l-5 6m12-6l-5 6m12-6l-5 6" class="scHatch"/>`;
    }else{
      out+=`<line x1="${x-19}" y1="${y+11}" x2="${x+19}" y2="${y+11}" class="scGround"/>
        <path d="M${x-15} ${y+11}l-5 6m12-6l-5 6m12-6l-5 6m12-6l-5 6" class="scHatch"/>`;
    }
    return out+'</g>';
  }

  function renderCleanBeam(){
    const W=1280,H=430,pad=68,beamY=108,L=beamLength(),x=p=>pad+(Math.max(0,Math.min(L,p))/L)*(W-2*pad);
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Beam model">
      <defs>
        <marker id="scDown" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto"><path d="M0 0 L8 0 L4 8 Z" fill="#ef4444"/></marker>
        <marker id="scUp" markerWidth="8" markerHeight="8" refX="4" refY="1" orient="auto"><path d="M0 8 L8 8 L4 0 Z" fill="#ef4444"/></marker>
        <marker id="scMomentCW" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" fill="#f59e0b"/></marker>
        <marker id="scMomentCCW" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto"><path d="M9 0 L0 4.5 L9 9 Z" fill="#f59e0b"/></marker>
      </defs>`;

    /* Beam first: long, thin and visually dominant. */
    svg+=`<line x1="${pad}" y1="${beamY}" x2="${W-pad}" y2="${beamY}" class="scBeam"/>`;

    /* Distributed loads: vertical arrows, with the envelope changing with the
       actual load intensity. Negative = downward, positive = upward. */
    (model.loads||[]).forEach(l=>{
      if(l.type!=='udl') return;
      const a=x(l.from),b=x(l.to),v1=Number(l.value)||0,v2=Number(l.value2??l.value)||0;
      const n=Math.max(9,Math.min(28,Math.round((b-a)/34)+1));
      const maxAbs=Math.max(Math.abs(v1),Math.abs(v2),1e-9);
      const height=v=>20+Math.min(55,Math.abs(v)/maxAbs*48);
      const signAt=t=>{const v=v1+(v2-v1)*t; return Math.abs(v)<1e-10 ? (v1<0||v2<0?-1:1) : Math.sign(v);};
      const yAt=(v,sign)=>sign<0?beamY-height(v):beamY+height(v);
      const y1=yAt(v1,signAt(0)),y2=yAt(v2,signAt(1));
      const arrows=[];
      for(let i=0;i<n;i++){
        const t=i/(n-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;
        if(Math.abs(v)<1e-10) continue;
        const sign=signAt(t),yy=yAt(v,sign),end=sign<0?beamY-5:beamY+5;
        arrows.push(`<line x1="${xx.toFixed(2)}" y1="${yy.toFixed(2)}" x2="${xx.toFixed(2)}" y2="${end}" class="scUdlArrow" marker-end="url(#${sign<0?'scDown':'scUp'})"/>`);
      }
      const envelope=`<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="scUdlEnvelope"/>`;
      const label=v1===v2 ? `${v1<0?'−':''}${fmtV(Math.abs(v1))} ${unit('load')}` : `${v1<0?'−':''}${fmtV(Math.abs(v1))} → ${v2<0?'−':''}${fmtV(Math.abs(v2))} ${unit('load')}`;
      svg+=`<g class="scUdl">${envelope}${arrows.join('')}<text x="${(a+b)/2}" y="${Math.min(y1,y2)-10}" text-anchor="middle" class="scUdlLabel">${label}</text></g>`;
    });

    /* Point loads: always a clean vertical arrow. */
    (model.loads||[]).forEach(l=>{
      if(l.type!=='point') return;
      const xx=x(l.from),v=Number(l.value)||0,down=v<0;
      const top=down?28:190,bottom=down?beamY-5:beamY+5;
      svg+=`<g class="scPointLoad">
        <line x1="${xx}" y1="${top}" x2="${xx}" y2="${bottom}" class="scPointArrow" marker-end="url(#${down?'scDown':'scUp'})"/>
        <text x="${xx}" y="${down?18:210}" text-anchor="middle" class="scPointLabel">${v<0?'−':''}${fmtV(Math.abs(v))} ${unit('force')}</text>
      </g>`;
    });

    /* Applied moments: distinct orange couple with direction explicitly shown. */
    (model.loads||[]).forEach(l=>{
      if(l.type!=='moment') return;
      const xx=x(l.from),v=Number(l.value)||0,d=momentDirection(v),r=20;
      let path,marker;
      if(d.id==='ccw'){
        path=`M ${xx+16} ${beamY-20} A ${r} ${r} 0 1 0 ${xx-16} ${beamY-20}`;
        marker='scMomentCCW';
      }else{
        path=`M ${xx-16} ${beamY-20} A ${r} ${r} 0 1 1 ${xx+16} ${beamY-20}`;
        marker='scMomentCW';
      }
      svg+=`<g class="scMoment">
        <path d="${path}" class="scMomentArc" marker-end="url(#${marker})"/>
        <text x="${xx}" y="${beamY-45}" text-anchor="middle" class="scMomentValue">${v<0?'−':''}${fmtV(Math.abs(v))} ${unit('moment')}</text>
        <text x="${xx}" y="${beamY-30}" text-anchor="middle" class="scMomentDir">${d.symbol} ${d.name}</text>
      </g>`;
    });

    /* Supports: compact engineering symbols; no pointer dragging. */
    (model.supports||[]).forEach((s,i)=>{
      const xx=x(s.position),name=s.type==='fixed'?'Fixed':s.type==='roller'?'Roller':'Pin';
      svg+=`<g class="scSupportGroup">
        ${supportSvgClean(s,xx,beamY)}
        <circle cx="${xx}" cy="${beamY-4}" r="9" class="scBadge"/>
        <text x="${xx}" y="${beamY-4}" text-anchor="middle" dominant-baseline="middle" class="scBadgeText">${i+1}</text>
        <text x="${xx}" y="${beamY+42}" text-anchor="middle" class="scSupportName">S${i+1} (${name})</text>
        <text x="${xx}" y="${beamY+57}" text-anchor="middle" class="scSupportPos">@ ${fmtV(s.position)} ${unit('length')}</text>
      </g>`;
    });

    /* One clean dimension rail. Every meaningful location gets a tick; labels
       occupy separate rows when they would collide. */
    if(showDims!==false){
      const railY=315, valueY=342;
      svg+=`<line x1="${pad}" y1="${railY}" x2="${W-pad}" y2="${railY}" class="scDimRail"/>`;
      const points=[];
      (model.supports||[]).forEach((s,i)=>points.push({p:Number(s.position),label:`S${i+1}`,kind:'support'}));
      (model.loads||[]).forEach(l=>{
        if(l.type==='udl'){
          points.push({p:Number(l.from),label:`L${l.id}`,kind:'load'});
          points.push({p:Number(l.to),label:`L${l.id}`,kind:'load'});
        }else points.push({p:Number(l.from),label:`L${l.id}`,kind:'load'});
      });
      const uniq=[];
      points.sort((a,b)=>a.p-b.p).forEach(p=>{
        const existing=uniq.find(q=>Math.abs(q.p-p.p)<1e-7);
        if(existing){ if(!existing.labels.includes(p.label)) existing.labels.push(p.label); }
        else uniq.push({p:p.p,labels:[p.label]});
      });
      uniq.forEach((p,i)=>{
        const xx=x(p.p),row=i%2;
        svg+=`<line x1="${xx}" y1="${railY-6}" x2="${xx}" y2="${railY+7}" class="scDimTick"/>`;
        svg+=`<text x="${xx}" y="${railY-14-row*15}" text-anchor="middle" class="scDimLabel">${p.labels.join(' · ')}</text>`;
        svg+=`<text x="${xx}" y="${valueY+row*15}" text-anchor="middle" class="scDimValue">${fmtV(p.p)} ${unit('length')}</text>`;
      });
      svg+=`<line x1="${pad}" y1="${valueY+35}" x2="${W-pad}" y2="${valueY+35}" class="scOverallLine"/>
        <line x1="${pad}" y1="${valueY+28}" x2="${pad}" y2="${valueY+42}" class="scDimTick"/>
        <line x1="${W-pad}" y1="${valueY+28}" x2="${W-pad}" y2="${valueY+42}" class="scDimTick"/>
        <text x="${W/2}" y="${valueY+57}" text-anchor="middle" class="scOverallValue">${fmtV(L)} ${unit('length')}</text>`;
    }else{
      svg+=`<text x="${pad}" y="${H-16}" class="scAxis">0 ${unit('length')}</text><text x="${W-pad}" y="${H-16}" text-anchor="end" class="scAxis">${fmtV(L)} ${unit('length')}</text>`;
    }

    svg+='</svg>';
    $('#beamCanvas').innerHTML=svg;
    $('#beamCanvas').style.transform=`translate(${panX||0}px,${panY||0}px) scale(${zoom||1})`;
  }

  /* Remove load/support dragging completely. Pan remains available as a view tool. */
  function disableObjectDragging(){
    const oldDrag=typeof dragItem==='function' ? dragItem : null;
    window.dragItem=function(){ return false; };
    if(oldDrag) window.__oldDragItem=oldDrag;
  }

  function installMomentResultClarification(){
    const oldRenderResults=renderResults;
    renderResults=function(){
      oldRenderResults();
      const root=$('#reactions');
      if(!root) return;
      root.querySelectorAll('tbody tr').forEach(row=>{
        const cells=row.querySelectorAll('td');
        if(cells.length<4) return;
        const cell=cells[3];
        const raw=cell.textContent.trim();
        if(!raw || cell.dataset.dirFixed==='1') return;
        const m=raw.match(/[-+]?\d[\d,]*(?:\.\d+)?/);
        if(!m) return;
        const v=Number(m[0].replace(/,/g,''));
        const d=momentDirection(v);
        cell.textContent='';
        const value=document.createElement('span');
        value.textContent=raw;
        const direction=document.createElement('span');
        direction.className=`scReactionDir ${d.id}`;
        direction.textContent=d.id==='none'?'':` · ${d.symbol} ${d.name}`;
        cell.append(value,direction);
        cell.dataset.dirFixed='1';
      });
    };
  }

  function cleanLoadHeaders(){
    const table=$('#loadRows')?.closest('table');
    if(!table) return;
    const th=table.querySelectorAll('thead th');
    if(th.length>=7){
      th[2].textContent='Value';
      th[3].textContent='Value 2 (UDL)';
      th[4].textContent='Position / From';
      th[5].textContent='To (UDL)';
    }
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:430px;min-height:430px;background:linear-gradient(180deg,rgba(148,163,184,.025),transparent)}
    .beamCanvas{width:100%;height:100%}
    .beamCanvas svg{width:100%;height:100%;display:block}
    .scBeam{stroke:#5aa0ff;stroke-width:3;vector-effect:non-scaling-stroke}
    .scUdlEnvelope{stroke:#35b779;stroke-width:1.8;fill:none;vector-effect:non-scaling-stroke}
    .scUdlArrow{stroke:#35b779;stroke-width:1.25;vector-effect:non-scaling-stroke}
    .scUdlLabel{fill:#55c993;font-size:12px;font-weight:700}
    .scPointArrow{stroke:#ef4444;stroke-width:2;vector-effect:non-scaling-stroke}
    .scPointLabel{fill:#ef4444;font-size:13px;font-weight:700}
    .scMomentArc{stroke:#f59e0b;stroke-width:2.2;fill:none;vector-effect:non-scaling-stroke}
    .scMomentValue{fill:#f59e0b;font-size:13px;font-weight:700}
    .scMomentDir{fill:#f59e0b;font-size:10px;font-weight:600}
    .scTriangle{fill:rgba(148,163,184,.06);stroke:#9aa4b2;stroke-width:1.6}
    .scWheel{fill:var(--card);stroke:#9aa4b2;stroke-width:1.5}
    .scGround,.scWall,.scConnector{stroke:#9aa4b2;stroke-width:1.5;fill:none}
    .scHatch{stroke:#7f8997;stroke-width:1.05;fill:none}
    .scBadge{fill:#111827;stroke:#e7edf4;stroke-width:1.2}
    .scBadgeText{fill:#fff;font-size:9px;font-weight:700}
    .scSupportName{fill:#8bbcff;font-size:10px;font-weight:700}
    .scSupportPos{fill:#9aa4b2;font-size:9px;font-weight:500}
    .scDimRail,.scOverallLine{stroke:#697586;stroke-width:1;vector-effect:non-scaling-stroke}
    .scDimTick{stroke:#8c97a7;stroke-width:1;vector-effect:non-scaling-stroke}
    .scDimLabel{fill:#9eb8d7;font-size:10px;font-weight:700}
    .scDimValue{fill:#aab4c1;font-size:10px;font-weight:500}
    .scOverallValue{fill:#e0e6ed;font-size:12px;font-weight:700}
    .scAxis{fill:#9aa4b2;font-size:10px}
    .scReactionDir{font-size:10px;font-weight:600}
    .scReactionDir.ccw{color:#f59e0b}
    .scReactionDir.cw{color:#8b5cf6}
    .scReactionDir.none{color:var(--muted)}
    .drag.supportDrag,.drag.loadDrag{cursor:default!important}
    .supportDrag,.loadDrag{pointer-events:none}
    @media(max-width:650px){.beamViewport{height:380px;min-height:380px}.scUdlLabel,.scPointLabel,.scMomentValue{font-size:11px}.scSupportName{font-size:9px}}
  `;
  document.head.appendChild(style);

  installUnitBehavior();
  disableObjectDragging();
  installMomentResultClarification();

  const oldRender=render;
  render=function(){
    oldRender();
    renderCleanBeam();
    setTimeout(cleanLoadHeaders,0);
  };
  renderBeam=renderCleanBeam;

  /* The load table already uses one position input for point/moment loads in the
     main application. Re-rendering here keeps the header aligned with that UI. */
  setTimeout(()=>{renderCleanBeam();cleanLoadHeaders();},0);
})();
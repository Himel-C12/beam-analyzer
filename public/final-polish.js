/* Final beam-diagram and units polish.
 * Keeps the numerical entries unchanged when switching SI <-> Imperial,
 * while changing the unit interpretation used by the solver.
 */
(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const model = () => window.model;
  const fmt = () => window.fmt;
  const unitText = () => window.unitText;
  const beamLen = () => window.len;
  const supportSvg = () => window.supportSvg;

  function snapshotValues(m){
    return {
      spans: (m.spans||[]).map(s=>({id:s.id,length:s.length,E:s.E,I:s.I})),
      supports: (m.supports||[]).map(s=>({id:s.id,position:s.position,settlement:s.settlement})),
      loads: (m.loads||[]).map(l=>({id:l.id,from:l.from,to:l.to,value:l.value,value2:l.value2}))
    };
  }
  function restoreValues(m,s){
    (m.spans||[]).forEach(x=>{const o=s.spans.find(v=>v.id===x.id);if(o){x.length=o.length;x.E=o.E;x.I=o.I;}});
    (m.supports||[]).forEach(x=>{const o=s.supports.find(v=>v.id===x.id);if(o){x.position=o.position;x.settlement=o.settlement;}});
    (m.loads||[]).forEach(x=>{const o=s.loads.find(v=>v.id===x.id);if(o){x.from=o.from;x.to=o.to;x.value=o.value;x.value2=o.value2;}});
  }

  /* The original app converts the stored numbers when the unit button is clicked.
     Let that handler update the unit system, then restore the original numeric entries. */
  function installUnitFix(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-unit]');
      if(!b) return;
      const m=model();
      if(!m) return;
      const before=snapshotValues(m);
      setTimeout(()=>{
        const current=model();
        if(!current) return;
        restoreValues(current,before);
        try{localStorage.setItem('ba-model',JSON.stringify(current));}catch{}
        if(typeof window.render==='function') window.render();
      },0);
    },true);
  }

  function momentDirection(v){
    const n=Number(v)||0;
    if(Math.abs(n)<1e-10) return {text:'None',symbol:'',cls:'zero'};
    /* Applied moment convention follows StructureCalcs/API: positive = clockwise. */
    return n>0 ? {text:'Clockwise',symbol:'↻',cls:'cw'} : {text:'Counter-clockwise',symbol:'↺',cls:'ccw'};
  }
  function reactionMomentDirection(v){
    const n=Number(v)||0;
    if(Math.abs(n)<1e-10) return {text:'None',symbol:'',cls:'zero'};
    /* Support reactions use positive = counter-clockwise. */
    return n>0 ? {text:'Counter-clockwise',symbol:'↺',cls:'ccw'} : {text:'Clockwise',symbol:'↻',cls:'cw'};
  }

  function renderCleanBeam(){
    const m=model(); if(!m || !$('#beamCanvas')) return;
    const W=1200,H=385,pad=72,beamY=100,L=Math.max(beamLen()(),1),x=p=>pad+(p/L)*(W-2*pad);
    const uf=fmt(), ut=unitText();
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Beam model">
      <defs>
        <marker id="fcPointArrow" markerWidth="10" markerHeight="10" refX="5" refY="8" orient="auto"><path d="M0,0 L10,0 L5,10 z" fill="#ef4444"/></marker>
        <marker id="fcPointArrowUp" markerWidth="10" markerHeight="10" refX="5" refY="2" orient="auto"><path d="M0,10 L10,10 L5,0 z" fill="#ef4444"/></marker>
        <marker id="fcPurpleDown" markerWidth="9" markerHeight="9" refX="4.5" refY="7" orient="auto"><path d="M0,0 L9,0 L4.5,9 z" fill="#8b5cf6"/></marker>
        <marker id="fcPurpleUp" markerWidth="9" markerHeight="9" refX="4.5" refY="2" orient="auto"><path d="M0,9 L9,9 L4.5,0 z" fill="#8b5cf6"/></marker>
        <marker id="fcMomentCW" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f59e0b"/></marker>
        <marker id="fcMomentCCW" markerWidth="10" markerHeight="10" refX="2" refY="5" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="#f59e0b"/></marker>
      </defs>`;

    svg+=`<line x1="${pad}" y1="${beamY}" x2="${W-pad}" y2="${beamY}" class="beamLine finalBeam"/>`;

    /* Loads and reactions first, so labels never collide with dimension text. */
    (m.loads||[]).forEach(l=>{
      if(l.type==='point'){
        const xx=x(l.from),v=Number(l.value)||0,down=v<0;
        const y1=down?30:168,y2=down?beamY-7:beamY+7;
        svg+=`<g class="drag loadDrag" data-drag="load" data-id="${l.id}">
          <line x1="${xx}" y1="${y1}" x2="${xx}" y2="${y2}" class="pointLoad" marker-end="url(#${down?'fcPointArrow':'fcPointArrowUp'})"/>
          <text x="${xx}" y="${down?20:190}" text-anchor="middle" class="loadText redText">${uf(Math.abs(v))} ${ut('force')}</text>
        </g>`;
      }else if(l.type==='moment'){
        const xx=x(l.from),v=Number(l.value)||0,d=momentDirection(v),r=23;
        /* Positive applied moment = clockwise, negative = counter-clockwise. */
        const path=d.cls==='cw'
          ? `M ${xx-17} ${beamY-18} A ${r} ${r} 0 1 1 ${xx+17} ${beamY-18}`
          : `M ${xx+17} ${beamY-18} A ${r} ${r} 0 1 0 ${xx-17} ${beamY-18}`;
        svg+=`<g class="drag loadDrag momentLoad ${d.cls}" data-drag="load" data-id="${l.id}">
          <path d="${path}" class="finalMomentArc" marker-end="url(#${d.cls==='cw'?'fcMomentCW':'fcMomentCCW'})"/>
          <text x="${xx}" y="${beamY-49}" text-anchor="middle" class="momentLabel">${v<0?'−':''}${uf(Math.abs(v))} ${ut('moment')}</text>
          <text x="${xx}" y="${beamY-33}" text-anchor="middle" class="momentDirection">${d.symbol} ${d.text}</text>
        </g>`;
      }else{
        const a=x(l.from),b=x(l.to),v1=Number(l.value)||0,v2=Number(l.value2??l.value)||0;
        const n=Math.max(6,Math.min(18,Math.round((b-a)/45)+1));
        const top=(v,t)=>beamY-(Math.abs(v)*3.8+28);
        const y1=top(v1,0),y2=top(v2,1);
        const arrows=[];
        for(let i=0;i<n;i++){
          const t=n===1?0:i/(n-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;
          if(Math.abs(v)<1e-10) continue;
          const yy=y1+(y2-y1)*t,down=v<0,end=down?beamY-7:beamY+7;
          arrows.push(`<line x1="${xx.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${xx.toFixed(1)}" y2="${end}" class="finalUdlArrow" marker-end="url(#${down?'fcPointArrow':'fcPointArrowUp'})"/>`);
        }
        const same=Math.sign(v1||v2)===Math.sign(v2||v1);
        const env=same
          ? `<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="finalUdlEnvelope"/>`
          : `<polyline points="${a},${y1} ${(a+b)/2},${beamY-18} ${b},${y2}" class="finalUdlEnvelope"/>`;
        const label=v1===v2?`${uf(v1)} ${ut('load')}`:`${uf(v1)} → ${uf(v2)} ${ut('load')}`;
        svg+=`<g class="distributedLoad" data-load-id="${l.id}">${env}${arrows.join('')}
          <text x="${(a+b)/2}" y="${Math.min(y1,y2)-10}" text-anchor="middle" class="loadText redText">${label}</text></g>`;
      }
    });

    (m.supports||[]).forEach((s,i)=>{
      const xx=x(s.position);
      svg+=`<g class="drag supportDrag" data-drag="support" data-id="${s.id}">${supportSvg()(s,xx,beamY)}
        <circle cx="${xx}" cy="${beamY-4}" r="10" class="supportBadge"/>
        <text x="${xx}" y="${beamY}" text-anchor="middle" dominant-baseline="middle" class="supportNumber">${i+1}</text>
      </g>`;
    });

    /* One clean dimension baseline, like the StructureCalcs beam diagram. */
    if(window.showDims!==false){
      const dimY=292;
      svg+=`<line x1="${pad}" y1="${dimY}" x2="${W-pad}" y2="${dimY}" class="finalDimLine"/>`;
      const marks=[];
      (m.spans||[]).reduce((acc,s)=>{acc.push(acc[acc.length-1]+Number(s.length||0));return acc;},[0]).forEach(p=>marks.push({p,label:null,type:'span'}));
      (m.supports||[]).forEach((s,i)=>marks.push({p:Number(s.position),label:`S${i+1}`,type:'support'}));
      (m.loads||[]).forEach(l=>marks.push({p:Number(l.from),label:`L${l.id}`,type:'load'}));
      (m.loads||[]).filter(l=>l.type==='udl').forEach(l=>marks.push({p:Number(l.to),label:`L${l.id}`,type:'load'}));
      const uniq=[];marks.sort((a,b)=>a.p-b.p).forEach(z=>{if(!uniq.some(q=>Math.abs(q.p-z.p)<1e-8))uniq.push(z);});
      uniq.forEach((z,idx)=>{
        const xx=x(z.p);
        svg+=`<line x1="${xx}" y1="${dimY-6}" x2="${xx}" y2="${dimY+7}" class="finalDimTick"/>`;
        if(z.label) svg+=`<text x="${xx}" y="${dimY-15-(idx%2)*15}" text-anchor="middle" class="finalDimLabel">${z.label}</text>`;
        svg+=`<text x="${xx}" y="${dimY+24}" text-anchor="middle" class="finalDimValue">${uf(z.p)} ${ut('length')}</text>`;
      });
      svg+=`<text x="${W/2}" y="${dimY+46}" text-anchor="middle" class="finalOverallDim">${uf(L)} ${ut('length')}</text>`;
    }
    svg+=`<text x="${pad}" y="${H-13}" class="axisText">0 ${ut('length')}</text><text x="${W-pad}" y="${H-13}" text-anchor="end" class="axisText">${uf(L)} ${ut('length')}</text></svg>`;

    $('#beamCanvas').innerHTML=svg;
    $('#beamCanvas').style.transform=`translate(${window.panX||0}px,${window.panY||0}px) scale(${window.zoom||1})`;
    $$('#beamCanvas [data-drag="support"]').forEach(g=>g.onpointerdown=e=>window.dragItem&&window.dragItem(e,'support',+g.dataset.id));
    $$('#beamCanvas [data-drag="load"]').forEach(g=>g.onpointerdown=e=>window.dragItem&&window.dragItem(e,'load',+g.dataset.id));
  }

  function clarifyReactionMoments(){
    const root=$('#reactions'); if(!root) return;
    root.querySelectorAll('tbody tr').forEach(row=>{
      const cells=row.querySelectorAll('td'); if(cells.length<4) return;
      const cell=cells[cells.length-1];
      if(!cell || cell.dataset.directionDone==='1') return;
      const raw=cell.textContent.trim();
      const m=raw.match(/[-+]?\d[\d,]*(?:\.\d+)?/);
      if(!m) return;
      const value=Number(m[0].replace(/,/g,''));
      const d=reactionMomentDirection(value);
      cell.textContent='';
      const valueSpan=document.createElement('span'); valueSpan.textContent=raw;
      const dirSpan=document.createElement('span'); dirSpan.className='reactionMomentDirection '+d.cls; dirSpan.textContent=d.symbol?` ${d.symbol} ${d.text}`:' None';
      cell.append(valueSpan,dirSpan);cell.dataset.directionDone='1';
    });
  }

  function install(){
    installUnitFix();
    const oldRender=window.render;
    if(typeof oldRender==='function'){
      window.render=function(){oldRender();renderCleanBeam();setTimeout(clarifyReactionMoments,0);};
    }
    const oldBeam=window.renderBeam;
    window.renderBeam=renderCleanBeam;
    const observer=new MutationObserver(()=>clarifyReactionMoments());
    const r=$('#reactions');if(r)observer.observe(r,{childList:true,subtree:true});
    setTimeout(()=>{renderCleanBeam();clarifyReactionMoments();},30);
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:385px}
    .finalBeam{stroke-width:3.2}
    .finalDimLine{stroke:#697586;stroke-width:1}
    .finalDimTick{stroke:#8792a1;stroke-width:1.2}
    .finalDimLabel{fill:#c4ccd6;font-size:11px;font-weight:600}
    .finalDimValue{fill:#98a4b4;font-size:11px;font-weight:500}
    .finalOverallDim{fill:#dce2e9;font-size:12px;font-weight:700}
    .finalUdlEnvelope{fill:none;stroke:#ef4444;stroke-width:1.8}
    .finalUdlArrow{stroke:#ef4444;stroke-width:1.35}
    .finalMomentArc{fill:none;stroke:#f59e0b;stroke-width:2.6}
    .momentLabel{fill:#f59e0b;font-size:14px;font-weight:700}
    .momentDirection{fill:#f59e0b;font-size:10px;font-weight:600}
    .reactionMomentDirection{font-size:11px;font-weight:600;margin-left:5px}
    .reactionMomentDirection.ccw{color:#8b5cf6}
    .reactionMomentDirection.cw{color:#f59e0b}
    .reactionMomentDirection.zero{color:var(--muted)}
  `;
  document.head.appendChild(style);
  install();
})();

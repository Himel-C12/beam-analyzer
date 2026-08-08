/* Beam diagram polish: compact, engineering-style symbols and clean dimensions. */
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const model=()=>window.model;
  const fmt=()=>window.fmt;
  const unitText=()=>window.unitText;
  const beamLen=()=>window.len;

  function snapshotValues(m){
    return {
      spans:(m.spans||[]).map(s=>({id:s.id,length:s.length,E:s.E,I:s.I})),
      supports:(m.supports||[]).map(s=>({id:s.id,position:s.position,settlement:s.settlement})),
      loads:(m.loads||[]).map(l=>({id:l.id,from:l.from,to:l.to,value:l.value,value2:l.value2}))
    };
  }
  function restoreValues(m,s){
    (m.spans||[]).forEach(x=>{const o=s.spans.find(v=>v.id===x.id);if(o){x.length=o.length;x.E=o.E;x.I=o.I;}});
    (m.supports||[]).forEach(x=>{const o=s.supports.find(v=>v.id===x.id);if(o){x.position=o.position;x.settlement=o.settlement;}});
    (m.loads||[]).forEach(x=>{const o=s.loads.find(v=>v.id===x.id);if(o){x.from=o.from;x.to=o.to;x.value=o.value;x.value2=o.value2;}});
  }

  /* Keep the entered numbers unchanged when switching SI <-> Imperial. */
  function installUnitFix(){
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-unit]');
      if(!b)return;
      const m=model();if(!m)return;
      const before=snapshotValues(m);
      setTimeout(()=>{
        const current=model();if(!current)return;
        restoreValues(current,before);
        try{localStorage.setItem('ba-model',JSON.stringify(current));}catch{}
        if(typeof window.render==='function')window.render();
      },0);
    },true);
  }

  function momentDirection(v){
    const n=Number(v)||0;
    if(Math.abs(n)<1e-10)return {text:'None',symbol:'',cls:'zero'};
    return n>0?{text:'Clockwise',symbol:'↻',cls:'cw'}:{text:'Counter-clockwise',symbol:'↺',cls:'ccw'};
  }
  function reactionMomentDirection(v){
    const n=Number(v)||0;
    if(Math.abs(n)<1e-10)return {text:'None',symbol:'',cls:'zero'};
    return n>0?{text:'Counter-clockwise',symbol:'↺',cls:'ccw'}:{text:'Clockwise',symbol:'↻',cls:'cw'};
  }

  /* Compact support symbols. These are deliberately smaller than the old symbols. */
  function compactSupport(s,x,y){
    const fixed=s.type==='fixed',roller=s.type==='roller';
    if(fixed){
      return `<g class="compactSupport fixedSupport">
        <line x1="${x-9}" y1="${y-18}" x2="${x-9}" y2="${y+9}" class="supportWall"/>
        <path d="M${x-9} ${y-15}l-7 4m7 2l-7 4m7 2l-7 4m7 2l-7 4" class="supportHatch"/>
        <line x1="${x-9}" y1="${y-18}" x2="${x}" y2="${y}" class="supportConnector"/>
      </g>`;
    }
    let out=`<g class="compactSupport">
      <path d="M${x-13} ${y+8}L${x} ${y-7}L${x+13} ${y+8}Z" class="supportTriangle"/>`;
    if(roller){
      out+=`<circle cx="${x-6}" cy="${y+13}" r="3.5" class="rollerWheel"/><circle cx="${x+6}" cy="${y+13}" r="3.5" class="rollerWheel"/>
      <line x1="${x-17}" y1="${y+19}" x2="${x+17}" y2="${y+19}" class="supportGround"/>
      <path d="M${x-13} ${y+19}l-4 5m10-5l-4 5m10-5l-4 5m10-5l-4 5" class="supportHatch"/>`;
    }else{
      out+=`<line x1="${x-16}" y1="${y+9}" x2="${x+16}" y2="${y+9}" class="supportGround"/>
      <path d="M${x-12} ${y+9}l-4 5m10-5l-4 5m10-5l-4 5m10-5l-4 5" class="supportHatch"/>`;
    }
    return out+'</g>';
  }

  function renderCleanBeam(){
    const m=model();if(!m||!$('#beamCanvas'))return;
    const W=1200,H=385,pad=72,beamY=108,L=Math.max(beamLen()(),1),x=p=>pad+(p/L)*(W-2*pad);
    const uf=fmt(),ut=unitText();
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Beam model">
      <defs>
        <marker id="fpDown" markerWidth="7" markerHeight="7" refX="3.5" refY="6" orient="auto"><path d="M0,0L7,0L3.5,7Z" fill="#ef4444"/></marker>
        <marker id="fpUp" markerWidth="7" markerHeight="7" refX="3.5" refY="1" orient="auto"><path d="M0,7L7,7L3.5,0Z" fill="#ef4444"/></marker>
        <marker id="fpMomentCW" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="#f59e0b"/></marker>
        <marker id="fpMomentCCW" markerWidth="8" markerHeight="8" refX="1.5" refY="4" orient="auto"><path d="M8,0L0,4L8,8Z" fill="#f59e0b"/></marker>
      </defs>`;

    svg+=`<line x1="${pad}" y1="${beamY}" x2="${W-pad}" y2="${beamY}" class="finalBeam"/>`;

    /* Loads: compact symbols, with UDL arrows always vertical. */
    (m.loads||[]).forEach(l=>{
      if(l.type==='point'){
        const xx=x(l.from),v=Number(l.value)||0,down=v<0;
        const top=38,bottom=beamY-5;
        svg+=`<g class="drag loadDrag" data-drag="load" data-id="${l.id}">
          <line x1="${xx}" y1="${top}" x2="${xx}" y2="${bottom}" class="pointLoadCompact" marker-end="url(#${down?'fpDown':'fpUp'})"/>
          <text x="${xx}" y="${top-10}" text-anchor="middle" class="loadLabel">${v<0?'−':''}${uf(Math.abs(v))} ${ut('force')}</text>
        </g>`;
      }else if(l.type==='moment'){
        const xx=x(l.from),v=Number(l.value)||0,d=momentDirection(v),r=18;
        const path=d.cls==='cw'
          ?`M${xx-14} ${beamY-20}A${r} ${r} 0 1 1 ${xx+14} ${beamY-20}`
          :`M${xx+14} ${beamY-20}A${r} ${r} 0 1 0 ${xx-14} ${beamY-20}`;
        svg+=`<g class="drag loadDrag" data-drag="load" data-id="${l.id}">
          <path d="${path}" class="momentArcCompact" marker-end="url(#${d.cls==='cw'?'fpMomentCW':'fpMomentCCW'})"/>
          <text x="${xx}" y="${beamY-43}" text-anchor="middle" class="momentValueCompact">${v<0?'−':''}${uf(Math.abs(v))} ${ut('moment')}</text>
          <text x="${xx}" y="${beamY-29}" text-anchor="middle" class="momentDirCompact">${d.symbol} ${d.text}</text>
        </g>`;
      }else{
        const a=x(l.from),b=x(l.to),v1=Number(l.value)||0,v2=Number(l.value2??l.value)||0;
        const n=Math.max(7,Math.min(22,Math.round((b-a)/32)+1));
        const height=v=>22+Math.min(42,Math.abs(v)*2.2);
        const y1=beamY-height(v1),y2=beamY-height(v2);
        const sameSign=(v1===0||v2===0)?true:Math.sign(v1)===Math.sign(v2);
        const arrows=[];
        for(let i=0;i<n;i++){
          const t=n===1?0:i/(n-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;
          if(Math.abs(v)<1e-10)continue;
          /* Vertical arrow shafts regardless of varying load intensity. */
          const yy=y1+(y2-y1)*t;
          const up=v>0;
          arrows.push(`<line x1="${xx.toFixed(1)}" y1="${yy.toFixed(1)}" x2="${xx.toFixed(1)}" y2="${(up?beamY+4:beamY-4).toFixed(1)}" class="udlArrowCompact" marker-end="url(#${up?'fpUp':'fpDown'})"/>`);
        }
        let env;
        if(sameSign){
          env=`<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="udlEnvelopeCompact"/>`;
        }else{
          /* Only a genuine sign change crosses the beam. */
          env=`<polyline points="${a},${y1} ${(a+b)/2},${beamY} ${b},${y2}" class="udlEnvelopeCompact"/>`;
        }
        const label=v1===v2?`${v1<0?'−':''}${uf(Math.abs(v1))} ${ut('load')}`:`${v1<0?'−':''}${uf(Math.abs(v1))} → ${v2<0?'−':''}${uf(Math.abs(v2))} ${ut('load')}`;
        svg+=`<g class="distributedLoad" data-load-id="${l.id}">${env}${arrows.join('')}
          <text x="${(a+b)/2}" y="${Math.min(y1,y2)-9}" text-anchor="middle" class="udlLabelCompact">${label}</text></g>`;
      }
    });

    /* Compact supports and labels. */
    (m.supports||[]).forEach((s,i)=>{
      const xx=x(Number(s.position)||0),name=s.type==='fixed'?'Fixed':s.type==='roller'?'Roller':'Pin';
      svg+=`<g class="drag supportDrag" data-drag="support" data-id="${s.id}">
        ${compactSupport(s,xx,beamY)}
        <circle cx="${xx}" cy="${beamY-4}" r="8" class="supportBadgeCompact"/>
        <text x="${xx}" y="${beamY-4}" text-anchor="middle" dominant-baseline="middle" class="supportNumberCompact">${i+1}</text>
        <text x="${xx}" y="${beamY+40}" text-anchor="middle" class="supportNameCompact">S${i+1} (${name})</text>
        <text x="${xx}" y="${beamY+54}" text-anchor="middle" class="supportPosCompact">@ ${uf(Number(s.position)||0)} ${ut('length')}</text>
      </g>`;
    });

    if(window.showDims!==false){
      const dimY=285;
      svg+=`<line x1="${pad}" y1="${dimY}" x2="${W-pad}" y2="${dimY}" class="dimMainCompact"/>`;
      const marks=[];
      (m.spans||[]).reduce((acc,s)=>{acc.push(acc[acc.length-1]+Number(s.length||0));return acc;},[0]).forEach(p=>marks.push({p,label:''}));
      (m.supports||[]).forEach((s,i)=>marks.push({p:Number(s.position),label:`S${i+1}`}));
      (m.loads||[]).forEach(l=>{
        if(l.type==='udl'){
          marks.push({p:Number(l.from),label:`L${l.id}`});
          marks.push({p:Number(l.to),label:`L${l.id}`});
        }else marks.push({p:Number(l.from),label:`L${l.id}`});
      });
      const uniq=[];
      marks.sort((a,b)=>a.p-b.p).forEach(z=>{
        const q=uniq.find(u=>Math.abs(u.p-z.p)<1e-8);
        if(q){if(z.label&&q.label.indexOf(z.label)<0)q.label+=' · '+z.label;}
        else uniq.push({...z});
      });
      uniq.forEach(z=>{
        const xx=x(z.p);
        svg+=`<line x1="${xx}" y1="${dimY-5}" x2="${xx}" y2="${dimY+6}" class="dimTickCompact"/>`;
        if(z.label)svg+=`<text x="${xx}" y="${dimY-13}" text-anchor="middle" class="dimLabelCompact">${z.label}</text>`;
        svg+=`<text x="${xx}" y="${dimY+23}" text-anchor="middle" class="dimValueCompact">${uf(z.p)} ${ut('length')}</text>`;
      });
      svg+=`<text x="${W/2}" y="${dimY+45}" text-anchor="middle" class="overallDimCompact">${uf(L)} ${ut('length')}</text>`;
      svg+=`<text x="${pad}" y="${H-12}" class="axisCompact">0 ${ut('length')}</text><text x="${W-pad}" y="${H-12}" text-anchor="end" class="axisCompact">${uf(L)} ${ut('length')}</text>`;
    }
    svg+='</svg>';
    $('#beamCanvas').innerHTML=svg;
    $('#beamCanvas').style.transform=`translate(${window.panX||0}px,${window.panY||0}px) scale(${window.zoom||1})`;
    $$('#beamCanvas [data-drag="support"]').forEach(g=>g.onpointerdown=e=>window.dragItem&&window.dragItem(e,'support',+g.dataset.id));
    $$('#beamCanvas [data-drag="load"]').forEach(g=>g.onpointerdown=e=>window.dragItem&&window.dragItem(e,'load',+g.dataset.id));
  }

  function clarifyReactionMoments(){
    const root=$('#reactions');if(!root)return;
    root.querySelectorAll('tbody tr').forEach(row=>{
      const cells=row.querySelectorAll('td');if(cells.length<4)return;
      const cell=cells[cells.length-1];if(!cell||cell.dataset.directionDone==='1')return;
      const raw=cell.textContent.trim();
      const m=raw.match(/[-+]?\d[\d,]*(?:\.\d+)?/);if(!m)return;
      const value=Number(m[0].replace(/,/g,''));
      const d=reactionMomentDirection(value);
      cell.textContent='';
      const a=document.createElement('span');a.textContent=raw;
      const b=document.createElement('span');b.className='reactionMomentDirection '+d.cls;b.textContent=d.symbol?` ${d.symbol} ${d.text}`:' None';
      cell.append(a,b);cell.dataset.directionDone='1';
    });
  }

  function install(){
    installUnitFix();
    const oldRender=window.render;
    if(typeof oldRender==='function')window.render=function(){oldRender();renderCleanBeam();setTimeout(clarifyReactionMoments,0);};
    window.renderBeam=renderCleanBeam;
    const observer=new MutationObserver(()=>clarifyReactionMoments());
    const r=$('#reactions');if(r)observer.observe(r,{childList:true,subtree:true});
    setTimeout(()=>{renderCleanBeam();clarifyReactionMoments();},30);
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:385px}
    .finalBeam{stroke:var(--accent,#60a5fa);stroke-width:2.5}
    .pointLoadCompact{stroke:#ef4444;stroke-width:1.7}
    .loadLabel{fill:#ef4444;font-size:13px;font-weight:700}
    .udlEnvelopeCompact{fill:none;stroke:#ef4444;stroke-width:1.5}
    .udlArrowCompact{stroke:#ef4444;stroke-width:1.15}
    .udlLabelCompact{fill:#ef4444;font-size:12px;font-weight:700}
    .momentArcCompact{fill:none;stroke:#f59e0b;stroke-width:2.2}
    .momentValueCompact{fill:#f59e0b;font-size:13px;font-weight:700}
    .momentDirCompact{fill:#f59e0b;font-size:10px;font-weight:600}
    .compactSupport .supportTriangle{fill:none;stroke:#9aa4b2;stroke-width:1.5}
    .compactSupport .rollerWheel{fill:none;stroke:#9aa4b2;stroke-width:1.4}
    .supportGround,.supportWall{stroke:#9aa4b2;stroke-width:1.4}
    .supportHatch{fill:none;stroke:#7f8997;stroke-width:1.05}
    .supportConnector{stroke:#9aa4b2;stroke-width:1.4}
    .supportBadgeCompact{fill:#101418;stroke:#e6edf5;stroke-width:1.4}
    .supportNumberCompact{fill:#e6edf5;font-size:9px;font-weight:700}
    .supportNameCompact{fill:#8bbcff;font-size:10px;font-weight:700}
    .supportPosCompact{fill:#9aa4b2;font-size:9px;font-weight:500}
    .dimMainCompact{stroke:#6d7888;stroke-width:1}
    .dimTickCompact{stroke:#8c97a7;stroke-width:1}
    .dimLabelCompact{fill:#9eb8d7;font-size:10px;font-weight:700}
    .dimValueCompact{fill:#aab4c1;font-size:10px;font-weight:500}
    .overallDimCompact{fill:#e0e6ed;font-size:12px;font-weight:700}
    .axisCompact{fill:#9aa4b2;font-size:10px}
    .reactionMomentDirection{font-size:10px;font-weight:600;margin-left:5px}
    .reactionMomentDirection.ccw{color:#8b5cf6}
    .reactionMomentDirection.cw{color:#f59e0b}
    .reactionMomentDirection.zero{color:var(--muted)}
  `;
  document.head.appendChild(style);
  install();
})();
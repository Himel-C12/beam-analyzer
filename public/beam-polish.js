/* Beam Analyzer visual polish: cleaner dimensions + true distributed-load arrows. */
(function(){
  const $q=s=>document.querySelector(s);
  const $$q=s=>[...document.querySelectorAll(s)];
  const beamFmt=window.fmt;
  const beamUnit=window.unitText;
  const beamLen=window.len;
  const beamDrag=window.dragItem;

  function activeSelect(){
    return $q('[data-view="select"]')?.classList.contains('active');
  }

  function loadMagnitudeY(value, beamY, direction){
    const mag=Math.abs(Number(value)||0);
    const h=30+Math.min(55,mag*4.5);
    return direction<0 ? beamY-h : beamY+h;
  }

  function renderDistributedLoad(l,x,beamY,idx){
    const a=x(l.from), b=x(l.to), v1=Number(l.value)||0, v2=Number(l.value2??l.value)||0;
    const n=Math.max(5,Math.min(15,Math.round((b-a)/48)+1));
    const top1=loadMagnitudeY(v1,beamY,v1===0?-1:Math.sign(v1));
    const top2=loadMagnitudeY(v2,beamY,v2===0?(v1===0?-1:Math.sign(v1)):Math.sign(v2));
    const sameSign=(v1===0||v2===0||Math.sign(v1)===Math.sign(v2));
    const minTop=Math.min(top1,top2), maxTop=Math.max(top1,top2);
    const topY=(t)=>top1+(top2-top1)*t;
    const arrows=[];
    for(let i=0;i<n;i++){
      const t=n===1?0:i/(n-1), xx=a+(b-a)*t, ty=topY(t), val=v1+(v2-v1)*t;
      if(Math.abs(val)<1e-10) continue;
      const sign=Math.sign(val), endY=sign<0?beamY-7:beamY+7;
      arrows.push(`<line x1="${xx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${xx.toFixed(1)}" y2="${endY}" class="udlArrow ${sign<0?'down':'up'}" marker-end="url(#udlArrow${sign<0?'Down':'Up'})"/>`);
    }
    let topPath;
    if(sameSign){
      topPath=`<line x1="${a}" y1="${top1}" x2="${b}" y2="${top2}" class="udlEnvelope"/>`;
    }else{
      topPath=`<polyline points="${a},${top1} ${(a+b)/2},${beamY-18} ${b},${top2}" class="udlEnvelope"/>`;
    }
    const mid=(a+b)/2;
    const label=v1===v2?`${beamFmt(v1)} ${beamUnit('load')}`:`${beamFmt(v1)} → ${beamFmt(v2)} ${beamUnit('load')}`;
    return `<g class="distributedLoad" data-load-id="${l.id}">${topPath}${arrows.join('')}<text x="${mid}" y="${Math.min(top1,top2)-10}" text-anchor="middle" class="loadText redText">${label}</text></g>`;
  }

  window.renderBeam=function(){
    const W=1200,H=405,pad=72,beamY=100,L=Math.max(beamLen(),1),x=p=>pad+(p/L)*(W-2*pad);
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Beam model">
      <defs>
        <marker id="arrowRed" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#ef4444"/></marker>
        <marker id="arrowPurple" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#8b5cf6"/></marker>
        <marker id="udlArrowDown" markerWidth="8" markerHeight="8" refX="4" refY="7" orient="auto"><path d="M0,0 L8,0 L4,8 z" fill="#ef4444"/></marker>
        <marker id="udlArrowUp" markerWidth="8" markerHeight="8" refX="4" refY="1" orient="auto"><path d="M0,8 L8,8 L4,0 z" fill="#ef4444"/></marker>
      </defs>`;

    if(window.showDims !== false){
      const supportY=185, loadY=250, overallY=345;
      const supports=[...window.model?.supports||[]];
      const loads=[...window.model?.loads||[]];
      // Position markers are deliberately independent instead of drawing many cumulative
      // dimension lines from x=0. This keeps the drawing readable when features are close.
      supports.forEach((s,i)=>{
        const xx=x(s.position);
        svg+=`<line x1="${xx}" y1="${beamY+9}" x2="${xx}" y2="${supportY}" class="dimExt"/>
          <line x1="${xx-6}" y1="${supportY}" x2="${xx+6}" y2="${supportY}" class="dimTick"/>
          <text x="${xx}" y="${supportY-9-(i%2)*17}" text-anchor="middle" class="dimText">S${i+1} @ ${beamFmt(s.position)} ${beamUnit('length')}</text>`;
      });
      loads.forEach((l,i)=>{
        if(l.type==='point'||l.type==='moment'){
          const xx=x(l.from);
          svg+=`<line x1="${xx}" y1="${beamY+9}" x2="${xx}" y2="${loadY}" class="dimExt"/>
            <line x1="${xx-6}" y1="${loadY}" x2="${xx+6}" y2="${loadY}" class="dimTick"/>
            <text x="${xx}" y="${loadY-9-(i%2)*17}" text-anchor="middle" class="dimText">L${l.id} @ ${beamFmt(l.from)} ${beamUnit('length')}</text>`;
        }else{
          const a=x(l.from),b=x(l.to),mid=(a+b)/2;
          svg+=`<line x1="${a}" y1="${beamY+9}" x2="${a}" y2="${loadY}" class="dimExt"/>
            <line x1="${b}" y1="${beamY+9}" x2="${b}" y2="${loadY}" class="dimExt"/>
            <line x1="${a}" y1="${loadY}" x2="${b}" y2="${loadY}" class="dimLine"/>
            <line x1="${a}" y1="${loadY-6}" x2="${a}" y2="${loadY+6}" class="dimTick"/>
            <line x1="${b}" y1="${loadY-6}" x2="${b}" y2="${loadY+6}" class="dimTick"/>
            <text x="${mid}" y="${loadY-9-(i%2)*17}" text-anchor="middle" class="dimText">L${l.id}: ${beamFmt(l.from)}–${beamFmt(l.to)} ${beamUnit('length')}</text>`;
        }
      });
      svg+=`<line x1="${pad}" y1="${overallY}" x2="${W-pad}" y2="${overallY}" class="dimLine"/>
        <line x1="${pad}" y1="${overallY-7}" x2="${pad}" y2="${overallY+7}" class="dimTick"/>
        <line x1="${W-pad}" y1="${overallY-7}" x2="${W-pad}" y2="${overallY+7}" class="dimTick"/>
        <text x="${W/2}" y="${overallY+20}" text-anchor="middle" class="dimText overallDim">${beamFmt(L)} ${beamUnit('length')}</text>`;
      let start=0;
      for(const s of supports.length?window.model.spans:[]){
        const xx=x(start+s.length/2);
        svg+=`<text x="${xx}" y="${overallY-10}" text-anchor="middle" class="spanText">${beamFmt(s.length)} ${beamUnit('length')}</text>`;
        start+=Number(s.length);
      }
    }

    svg+=`<line x1="${pad}" y1="${beamY}" x2="${W-pad}" y2="${beamY}" class="beamLine"/>`;
    (window.model?.supports||[]).forEach((s,i)=>{
      const xx=x(s.position);
      const type=s.type==='fixed'?'Fixed':s.type==='roller'?'Roller':'Pin';
      svg+=`<g class="drag supportDrag" data-drag="support" data-id="${s.id}">${window.supportSvg(s,xx,beamY)}
        <circle cx="${xx}" cy="${beamY-4}" r="10" class="supportBadge"/>
        <text x="${xx}" y="${beamY}" text-anchor="middle" dominant-baseline="middle" class="supportNumber">${i+1}</text>
        <text x="${xx}" y="${beamY+50}" text-anchor="middle" class="supportText">${type}</text></g>`;
    });

    (window.model?.loads||[]).forEach(l=>{
      if(l.type==='point'){
        const xx=x(l.from), sign=Math.sign(Number(l.value)||-1), top=sign<0?30:170;
        svg+=`<g class="drag loadDrag" data-drag="load" data-id="${l.id}">
          <line x1="${xx}" y1="${top}" x2="${xx}" y2="${sign<0?beamY-7:beamY+7}" class="pointLoad" marker-end="url(#arrowRed)"/>
          <text x="${xx}" y="${sign<0?20:194}" text-anchor="middle" class="loadText redText">${beamFmt(Math.abs(l.value))} ${beamUnit('force')}</text></g>`;
      }else if(l.type==='moment'){
        const xx=x(l.from);
        svg+=`<g class="drag loadDrag" data-drag="load" data-id="${l.id}">
          <path d="M ${xx+14} ${beamY-17} A 22 22 0 1 0 ${xx-14} ${beamY+17}" class="momentArc" marker-end="url(#arrowPurple)"/>
          <text x="${xx}" y="${beamY-34}" text-anchor="middle" class="loadText purpleText">${beamFmt(l.value)} ${beamUnit('moment')}</text></g>`;
      }else{
        svg+=renderDistributedLoad(l,x,beamY,l.id);
      }
    });
    svg+=`<text x="${pad}" y="${H-15}" class="axisText">0 ${beamUnit('length')}</text>
      <text x="${W-pad}" y="${H-15}" text-anchor="end" class="axisText">${beamFmt(L)} ${beamUnit('length')}</text></svg>`;

    $q('#beamCanvas').innerHTML=svg;
    $q('#beamCanvas').style.transform=`translate(${window.panX||0}px,${window.panY||0}px) scale(${window.zoom||1})`;
    $$('#beamCanvas [data-drag="support"]').forEach(g=>g.onpointerdown=e=>activeSelect()&&beamDrag(e,'support',+g.dataset.id));
    $$('#beamCanvas [data-drag="load"]').forEach(g=>g.onpointerdown=e=>activeSelect()&&beamDrag(e,'load',+g.dataset.id));
  };

  // The original state uses lexical bindings, so expose the current model/view values
  // through small accessors that are refreshed by the wrapper below.
  const oldRender=window.render;
  window.render=oldRender;
  const oldInitModel=window.model;

  // Keep the original renderer's state visible to this patch. app.js is a classic script,
  // so its global `model`/`showDims`/`zoom`/`panX` bindings are reflected here after assignment.
  Object.defineProperties(window,{
    model:{configurable:true,get(){return typeof model!=='undefined'?model:null}},
    showDims:{configurable:true,get(){return typeof showDims!=='undefined'?showDims:true}},
    zoom:{configurable:true,get(){return typeof zoom!=='undefined'?zoom:1}},
    panX:{configurable:true,get(){return typeof panX!=='undefined'?panX:0}},
    panY:{configurable:true,get(){return typeof panY!=='undefined'?panY:0}},
    fmt:{configurable:true,get(){return typeof fmt==='function'?fmt:null}},
    unitText:{configurable:true,get(){return typeof unitText==='function'?unitText:null}},
    len:{configurable:true,get(){return typeof len==='function'?len:null}},
    dragItem:{configurable:true,get(){return typeof dragItem==='function'?dragItem:null}},
    supportSvg:{configurable:true,get(){return typeof supportSvg==='function'?supportSvg:null}}
  });

  // Force the new renderer whenever the original app calls render().
  const originalRender=window.render;
  window.render=function(){
    originalRender();
    window.renderBeam();
  };

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:385px}
    .dimExt{stroke:#7d8795;stroke-width:1;stroke-dasharray:3 3;opacity:.7}
    .dimLine{stroke:#8b95a5;stroke-width:1}
    .dimTick{stroke:#8b95a5;stroke-width:1.2}
    .dimText{fill:var(--text);font-size:12px;font-weight:600}
    .overallDim{font-size:13px;font-weight:700}
    .spanText{fill:#98a4b4;font-size:11px;font-weight:600}
    .supportText{font-size:11px}
    .udlEnvelope{fill:none;stroke:#ef4444;stroke-width:2.1}
    .udlArrow{stroke:#ef4444;stroke-width:1.45}
    .udlArrow.up,.udlArrow.down{vector-effect:non-scaling-stroke}
  `;
  document.head.appendChild(style);

  // Initial repaint after the original app has created its state.
  setTimeout(()=>window.renderBeam(),0);
})();

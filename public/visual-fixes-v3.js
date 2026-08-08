/* Beam Analyzer v3: reference-style beam geometry.
   The beam is drawn as a proper member, loads always have explicit arrowheads,
   and support glyphs are deliberately larger and visually distinct. */
(function(){
  const $=s=>document.querySelector(s);
  const num=v=>Number(v)||0;
  const fmtV=v=>typeof fmt==='function'?fmt(v):String(v);
  const unit=k=>typeof unitText==='function'?unitText(k):k;
  const beamLength=()=>Math.max(typeof len==='function'?Number(len()):1,1);

  function arrow(x1,y1,x2,y2,dir,cls){
    const s=dir<0?1:-1;
    const tipY=y2, w=5, h=9;
    const pts=`${x2},${tipY} ${x2-w},${tipY-s*h} ${x2+w},${tipY-s*h}`;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2-s*2}" class="${cls}"/><polygon points="${pts}" class="${cls}Head"/>`;
  }

  function supportSvg(type,x,y){
    if(type==='fixed') return `<g class="rSupport rFixed">
      <line x1="${x-14}" y1="${y-30}" x2="${x-14}" y2="${y+30}" class="rWall"/>
      <path d="M${x-14} ${y-26}l-12 7m12 3l-12 7m12 3l-12 7m12 3l-12 7m12 3l-12 7" class="rHatch"/>
      <line x1="${x-14}" y1="${y}" x2="${x}" y2="${y}" class="rConnector"/>
    </g>`;
    const roller=type==='roller';
    return `<g class="rSupport ${roller?'rRoller':'rPin'}">
      <path d="M${x-19} ${y+14}L${x} ${y-11}L${x+19} ${y+14}Z" class="rTriangle"/>
      ${roller?`<circle cx="${x-9}" cy="${y+22}" r="5.5" class="rWheel"/><circle cx="${x+9}" cy="${y+22}" r="5.5" class="rWheel"/>`:''}
      <line x1="${x-25}" y1="${y+29}" x2="${x+25}" y2="${y+29}" class="rGround"/>
      <path d="M${x-21} ${y+29}l-6 8m13-8l-6 8m13-8l-6 8m13-8l-6 8m13-8l-6 8" class="rHatch"/>
    </g>`;
  }

  function moment(value,x,y){
    const v=num(value), ccw=v>0, r=24;
    const path=ccw?`M${x+18} ${y-24}A${r} ${r} 0 1 0 ${x-18} ${y-24}`:`M${x-18} ${y-24}A${r} ${r} 0 1 1 ${x+18} ${y-24}`;
    const ex=ccw?x-18:x+18, ey=y-24;
    const a=ccw?`<polygon points="${ex},${ey} ${ex+8},${ey-2} ${ex+4},${ey+7}" class="rMomentHead"/>`:`<polygon points="${ex},${ey} ${ex-8},${ey-2} ${ex-4},${ey+7}" class="rMomentHead"/>`;
    return `<path d="${path}" class="rMoment"/>${a}<text x="${x}" y="${y-53}" text-anchor="middle" class="rMomentLabel">${v<0?'−':''}${fmtV(Math.abs(v))} ${unit('moment')}</text>`;
  }

  function renderReferenceBeam(){
    const W=1280,H=430,pad=70,beamY=112,L=beamLength();
    const x=p=>pad+Math.max(0,Math.min(L,p))/L*(W-2*pad);
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Beam model" class="referenceBeam">
      <rect x="0" y="0" width="${W}" height="${H}" class="rCanvas"/>
      <line x1="${pad}" y1="${beamY-4}" x2="${W-pad}" y2="${beamY-4}" class="rBeamTop"/>
      <rect x="${pad}" y="${beamY-4}" width="${W-2*pad}" height="8" class="rBeam"/>`;

    // Distributed loads: green envelope, with explicit arrowhead polygons so the direction cannot rotate sideways.
    (model.loads||[]).filter(l=>l.type==='udl').forEach(l=>{
      const a=x(l.from),b=x(l.to),v1=num(l.value),v2=num(l.value2??l.value);
      const max=Math.max(Math.abs(v1),Math.abs(v2),1e-9);
      const height=v=>20+Math.min(62,Math.abs(v)/max*50);
      const y1=v1<0?beamY-height(v1):beamY+height(v1), y2=v2<0?beamY-height(v2):beamY+height(v2);
      svg+=`<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="rUdlEnvelope"/>`;
      const n=Math.max(9,Math.min(34,Math.round((b-a)/30)+1));
      for(let i=0;i<n;i++){
        const t=i/(n-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;
        if(Math.abs(v)<1e-10)continue;
        const yy=(v<0?beamY-height(v):beamY+height(v));
        svg+=arrow(xx,yy,xx,v<0?beamY-4:beamY+4,v<0,'.rDown','.rUp');
      }
      const label=v1===v2?`${v1<0?'−':''}${fmtV(Math.abs(v1))} ${unit('load')}`:`${v1<0?'−':''}${fmtV(Math.abs(v1))} → ${v2<0?'−':''}${fmtV(Math.abs(v2))} ${unit('load')}`;
      svg+=`<text x="${a}" y="${Math.min(y1,y2)-9}" text-anchor="start" class="rUdlLabel">${label}</text>`;
    });

    // Point loads: explicit vertical arrows, up or down according to the sign.
    (model.loads||[]).filter(l=>l.type==='point').forEach(l=>{
      const xx=x(l.from),v=num(l.value),down=v<0;
      const top=down?24:190,end=down?beamY-5:beamY+5;
      svg+=arrow(xx,top,xx,end,down?-1:1,down?'.rDown':'.rUp');
      svg+=`<text x="${xx}" y="${down?16:210}" text-anchor="middle" class="rPointLabel">${v<0?'−':''}${fmtV(Math.abs(v))} ${unit('force')}</text>`;
    });

    // Applied moments.
    (model.loads||[]).filter(l=>l.type==='moment').forEach(l=>svg+=moment(l.value,x(l.from),beamY));

    // EI inside each beam span.
    let start=0;
    (model.spans||[]).forEach(sp=>{
      const mid=x(start+num(sp.length)/2);
      const EI=num(sp.E)*num(sp.I);
      const text=EI?`EI = ${fmtV(EI)} ${unit('moment')}`:'EI';
      svg+=`<text x="${mid}" y="${beamY+3}" text-anchor="middle" dominant-baseline="middle" class="rEI">${text}</text>`;
      start+=num(sp.length);
    });

    // Large, distinct supports.
    (model.supports||[]).forEach((sp,i)=>{
      const xx=x(sp.position),name=sp.type==='fixed'?'Fixed':sp.type==='roller'?'Roller':'Pin';
      svg+=supportSvg(sp.type,xx,beamY);
      svg+=`<text x="${xx}" y="${beamY+54}" text-anchor="middle" class="rSupportName">${name}</text>`;
    });

    // Reaction arrows, when solver results are available.
    const reactions=result?.support_reactions||result?.reactions||[];
    reactions.forEach((r,i)=>{
      const sp=(model.supports||[])[i]; if(!sp)return;
      const xx=x(sp.position),v=num(r.shear);
      if(Math.abs(v)<1e-9)return;
      const up=v>0;
      const y0=up?beamY+78:beamY+40, y1=up?beamY+40:beamY+78;
      svg+=arrow(xx,y0,xx,y1,up?1:-1,'.rReaction');
      svg+=`<text x="${xx}" y="${up?beamY+94:beamY+105}" text-anchor="middle" class="rReactionLabel">${fmtV(Math.abs(v))} ${unit('force')}</text>`;
    });

    // One restrained dimension rail, matching the reference rather than the old multi-row construction.
    const railY=290;
    svg+=`<line x1="${pad}" y1="${railY}" x2="${W-pad}" y2="${railY}" class="rDim"/>`;
    const points=[];
    (model.supports||[]).forEach(s=>points.push(num(s.position)));
    (model.loads||[]).forEach(l=>{points.push(num(l.from));if(l.type==='udl')points.push(num(l.to));});
    [...new Set(points.map(v=>v.toFixed(7)))].map(Number).sort((a,b)=>a-b).forEach(p=>{
      const xx=x(p); svg+=`<line x1="${xx}" y1="${railY-7}" x2="${xx}" y2="${railY+7}" class="rTick"/><text x="${xx}" y="${railY+23}" text-anchor="middle" class="rDimText">${fmtV(p)} ${unit('length')}</text>`;
    });
    svg+=`<line x1="${pad}" y1="${railY+30}" x2="${W-pad}" y2="${railY+30}" class="rDim"/><line x1="${pad}" y1="${railY+23}" x2="${pad}" y2="${railY+37}" class="rTick"/><line x1="${W-pad}" y1="${railY+23}" x2="${W-pad}" y2="${railY+37}" class="rTick"/><text x="${W/2}" y="${railY+50}" text-anchor="middle" class="rOverall">${fmtV(L)} ${unit('length')}</text>`;
    svg+=`<text x="${pad}" y="${railY-12}" class="rSectionNote">sections ×0.7</text>`;
    svg+='</svg>';
    $('#beamCanvas').innerHTML=svg;
    $('#beamCanvas').style.transform=`translate(${panX||0}px,${panY||0}px) scale(${zoom||1})`;
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:430px!important;min-height:430px!important;overflow:hidden}
    .beamCanvas{overflow:hidden}
    .referenceBeam{display:block;width:100%;height:100%;background:#151719;border-radius:2px}
    .rCanvas{fill:#151719}
    .rBeam{fill:#2d91ff;stroke:#2d91ff;stroke-width:1}
    .rBeamTop{stroke:#7bb8ff;stroke-width:1;opacity:.8}
    .rEI{fill:#59a8ff;font-size:13px;font-weight:700;pointer-events:none}
    .rUdlEnvelope{stroke:#31b978;stroke-width:1.6;fill:none;vector-effect:non-scaling-stroke}
    .rDown,.rDownHead{stroke:#35c985;fill:#35c985;stroke-width:1.2;vector-effect:non-scaling-stroke}
    .rUp,.rUpHead{stroke:#35c985;fill:#35c985;stroke-width:1.2;vector-effect:non-scaling-stroke}
    .rPointLabel{fill:#ef5555;font-size:13px;font-weight:700}
    .rUdlLabel{fill:#55cf91;font-size:13px;font-weight:700}
    .rMoment{stroke:#f3a338;stroke-width:2.1;fill:none;vector-effect:non-scaling-stroke}
    .rMomentHead{fill:#f3a338;stroke:#f3a338}
    .rMomentLabel{fill:#f3a338;font-size:13px;font-weight:700}
    .rTriangle{fill:#151719;stroke:#aab1bb;stroke-width:1.7}.rWheel{fill:#151719;stroke:#aab1bb;stroke-width:1.5}.rGround,.rWall,.rConnector{stroke:#aab1bb;stroke-width:1.5;fill:none}.rHatch{stroke:#8c949f;stroke-width:1.1;fill:none}
    .rSupportName{fill:#aeb6c1;font-size:11px;font-weight:700}
    .rReaction{stroke:#9b6cff;fill:#9b6cff;stroke-width:1.7}.rReactionHead{stroke:#9b6cff;fill:#9b6cff}.rReactionLabel{fill:#9b6cff;font-size:12px;font-weight:700}
    .rDim{stroke:#69717c;stroke-width:1}.rTick{stroke:#7f8791;stroke-width:1}.rDimText{fill:#a5adb7;font-size:11px}.rOverall{fill:#aeb6c1;font-size:12px;font-weight:700}.rSectionNote{fill:#aeb6c1;font-size:11px}
  `;
  document.head.appendChild(style);

  const baseRender=window.render;
  window.render=function(){
    baseRender();
    renderReferenceBeam();
  };
  setTimeout(renderReferenceBeam,0);
})();

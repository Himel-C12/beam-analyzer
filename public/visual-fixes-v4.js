/* Beam Analyzer v4: final reference-style beam renderer.
   Geometry is deliberately simple: proper beam thickness, clear supports,
   vertical load arrows, and correctly converted EI. */
(function(){
  const $=s=>document.querySelector(s);
  const n=v=>Number(v)||0;
  const f=v=>typeof fmt==='function'?fmt(v):String(v);
  const u=k=>typeof unitText==='function'?unitText(k):k;
  const L=()=>Math.max(typeof len==='function'?Number(len()):1,1);

  function arrow(x, y1, y2, down, cls){
    const tip=y2, half=5, h=9;
    const base=down?tip-h:tip+h;
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${down?tip-2:tip+2}" class="${cls}"/>
      <polygon points="${x},${tip} ${x-half},${base} ${x+half},${base}" class="${cls}"/>`;
  }

  function support(type,x,y){
    if(type==='fixed') return `<g>
      <line x1="${x-16}" y1="${y-28}" x2="${x-16}" y2="${y+27}" class="bWall"/>
      <path d="M${x-16} ${y-24}l-13 7m13 3l-13 7m13 3l-13 7m13 3l-13 7m13 3l-13 7" class="bHatch"/>
      <line x1="${x-16}" y1="${y}" x2="${x}" y2="${y}" class="bConnector"/>
    </g>`;
    const roller=type==='roller';
    return `<g>
      <path d="M${x-22} ${y+15}L${x} ${y-12}L${x+22} ${y+15}Z" class="bTriangle"/>
      ${roller?`<circle cx="${x-10}" cy="${y+23}" r="6" class="bWheel"/><circle cx="${x+10}" cy="${y+23}" r="6" class="bWheel"/>`:''}
      <line x1="${x-28}" y1="${y+31}" x2="${x+28}" y2="${y+31}" class="bGround"/>
      <path d="M${x-24} ${y+31}l-6 8m14-8l-6 8m14-8l-6 8m14-8l-6 8m14-8l-6 8" class="bHatch"/>
    </g>`;
  }

  function moment(v,x,y){
    const ccw=n(v)>0,r=25;
    const path=ccw?`M${x+19} ${y-25}A${r} ${r} 0 1 0 ${x-19} ${y-25}`:`M${x-19} ${y-25}A${r} ${r} 0 1 1 ${x+19} ${y-25}`;
    const ex=ccw?x-19:x+19;
    const head=ccw?`<polygon points="${ex},${y-25} ${ex+9},${y-28} ${ex+5},${y-18}" class="bMomentHead"/>`:`<polygon points="${ex},${y-25} ${ex-9},${y-28} ${ex-5},${y-18}" class="bMomentHead"/>`;
    return `<path d="${path}" class="bMoment"/>${head}<text x="${x}" y="${y-54}" text-anchor="middle" class="bMomentLabel">${n(v)<0?'−':''}${f(Math.abs(n(v)))} ${u('moment')}</text>`;
  }

  function renderBeamV4(){
    const W=1280,H=430,pad=70,by=112,total=L();
    const x=p=>pad+Math.max(0,Math.min(total,p))/total*(W-2*pad);
    let s=`<svg viewBox="0 0 ${W} ${H}" class="beamReference" role="img" aria-label="Beam model">
      <rect width="${W}" height="${H}" class="bCanvas"/>
      <rect x="${pad}" y="${by-3}" width="${W-2*pad}" height="6" rx="1" class="bBeam"/>`;

    // Distributed loads. Negative values are downward, positive values upward.
    (model.loads||[]).filter(l=>l.type==='udl').forEach(l=>{
      const a=x(l.from),b=x(l.to),v1=n(l.value),v2=n(l.value2??l.value);
      const max=Math.max(Math.abs(v1),Math.abs(v2),1e-9);
      const h=v=>22+Math.min(58,Math.abs(v)/max*50);
      const y=v=>v<0?by-h(v):by+h(v);
      const y1=y(v1),y2=y(v2);
      s+=`<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="bUdlLine"/>`;
      const count=Math.max(9,Math.min(30,Math.round((b-a)/34)+1));
      for(let i=0;i<count;i++){
        const t=i/(count-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t;
        if(Math.abs(v)<1e-10)continue;
        s+=arrow(xx,y1+(y2-y1)*t,v<0?by-4:by+4,v<0,'bUdlArrow');
      }
      const label=v1===v2?`${v1<0?'−':''}${f(Math.abs(v1))} ${u('load')}`:`${v1<0?'−':''}${f(Math.abs(v1))} → ${v2<0?'−':''}${f(Math.abs(v2))} ${u('load')}`;
      s+=`<text x="${a}" y="${Math.min(y1,y2)-10}" class="bUdlLabel">${label}</text>`;
    });

    // Point loads.
    (model.loads||[]).filter(l=>l.type==='point').forEach(l=>{
      const xx=x(l.from),v=n(l.value),down=v<0;
      s+=arrow(xx,down?25:190,down?by-5:by+5,down,'bPointArrow');
      s+=`<text x="${xx}" y="${down?16:210}" text-anchor="middle" class="bPointLabel">${v<0?'−':''}${f(Math.abs(v))} ${u('force')}</text>`;
    });

    // Applied moments.
    (model.loads||[]).filter(l=>l.type==='moment').forEach(l=>s+=moment(l.value,x(l.from),by));

    // EI: E is GPa and I is mm^4 in the input table. Convert to kN·m² for SI.
    let start=0;
    (model.spans||[]).forEach(sp=>{
      const EI_SI=n(sp.E)*n(sp.I)*1e-9;
      const mid=x(start+n(sp.length)/2);
      const ei=unit==='imperial'?EI_SI*0.7375621493:EI_SI;
      const label=unit==='imperial'?`EI = ${f(ei)} kip·ft²`:`EI = ${f(ei)} kN·m²`;
      s+=`<text x="${mid}" y="${by}" text-anchor="middle" dominant-baseline="middle" class="bEI">${label}</text>`;
      start+=n(sp.length);
    });

    // Supports.
    (model.supports||[]).forEach((sp,i)=>{
      const xx=x(sp.position),name=sp.type==='fixed'?'Fixed':sp.type==='roller'?'Roller':'Pin';
      s+=support(sp.type,xx,by);
      s+=`<circle cx="${xx}" cy="${by-5}" r="9" class="bBadge"/><text x="${xx}" y="${by-5}" text-anchor="middle" dominant-baseline="middle" class="bBadgeText">${i+1}</text>`;
      s+=`<text x="${xx}" y="${by+54}" text-anchor="middle" class="bSupportName">S${i+1} (${name})</text>`;
    });

    // Reaction arrows, if the solver has produced them.
    const reactions=result?.support_reactions||result?.reactions||[];
    reactions.forEach((r,i)=>{
      const sp=(model.supports||[])[i];if(!sp)return;
      const v=n(r.shear);if(Math.abs(v)<1e-9)return;
      const xx=x(sp.position),up=v>0;
      s+=arrow(xx,up?by+82:by+38,up?by+38:by+82,up,'bReaction');
      s+=`<text x="${xx}" y="${by+100}" text-anchor="middle" class="bReactionLabel">${f(Math.abs(v))} ${u('force')}</text>`;
    });

    // Compact dimension rail.
    const ry=292;
    s+=`<line x1="${pad}" y1="${ry}" x2="${W-pad}" y2="${ry}" class="bDim"/>`;
    const pts=[];
    (model.supports||[]).forEach(sp=>pts.push(n(sp.position)));
    (model.loads||[]).forEach(l=>{pts.push(n(l.from));if(l.type==='udl')pts.push(n(l.to));});
    [...new Set(pts.map(v=>v.toFixed(6)))].map(Number).sort((a,b)=>a-b).forEach(p=>{
      const xx=x(p);
      s+=`<line x1="${xx}" y1="${ry-7}" x2="${xx}" y2="${ry+7}" class="bTick"/><text x="${xx}" y="${ry+23}" text-anchor="middle" class="bDimText">${f(p)} ${u('length')}</text>`;
    });
    s+=`<line x1="${pad}" y1="${ry+31}" x2="${W-pad}" y2="${ry+31}" class="bDim"/><line x1="${pad}" y1="${ry+24}" x2="${pad}" y2="${ry+38}" class="bTick"/><line x1="${W-pad}" y1="${ry+24}" x2="${W-pad}" y2="${ry+38}" class="bTick"/><text x="${W/2}" y="${ry+51}" text-anchor="middle" class="bOverall">${f(total)} ${u('length')}</text><text x="${pad}" y="${ry-12}" class="bSection">sections ×0.7</text>`;
    s+='</svg>';
    $('#beamCanvas').innerHTML=s;
    $('#beamCanvas').style.transform=`translate(${panX||0}px,${panY||0}px) scale(${zoom||1})`;
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:430px!important;min-height:430px!important;overflow:hidden}
    .beamCanvas{overflow:hidden}
    .beamReference{display:block;width:100%;height:100%;background:#151719;border-radius:2px}
    .bCanvas{fill:#151719}
    .bBeam{fill:#2d91ff;stroke:#7bb8ff;stroke-width:1}
    .bEI{fill:#67adff;font-size:13px;font-weight:700;pointer-events:none}
    .bUdlLine{stroke:#35c985;stroke-width:1.6;fill:none;vector-effect:non-scaling-stroke}
    .bUdlArrow,.bUdlArrowHead{stroke:#35c985;fill:#35c985;stroke-width:1.15;vector-effect:non-scaling-stroke}
    .bUdlLabel{fill:#55cf91;font-size:13px;font-weight:700}
    .bPointArrow,.bPointArrowHead{stroke:#ef5555;fill:#ef5555;stroke-width:1.8;vector-effect:non-scaling-stroke}
    .bPointLabel{fill:#ef5555;font-size:13px;font-weight:700}
    .bMoment{stroke:#f3a338;stroke-width:2.1;fill:none;vector-effect:non-scaling-stroke}.bMomentHead{fill:#f3a338;stroke:#f3a338}.bMomentLabel{fill:#f3a338;font-size:13px;font-weight:700}
    .bTriangle{fill:#151719;stroke:#aab1bb;stroke-width:1.8}.bWheel{fill:#151719;stroke:#aab1bb;stroke-width:1.5}.bGround,.bWall,.bConnector{stroke:#aab1bb;stroke-width:1.5;fill:none}.bHatch{stroke:#8c949f;stroke-width:1.1;fill:none}
    .bBadge{fill:#151719;stroke:#e7edf4;stroke-width:1.2}.bBadgeText{fill:#fff;font-size:9px;font-weight:700}.bSupportName{fill:#aeb6c1;font-size:11px;font-weight:700}
    .bReaction,.bReactionHead{stroke:#9b6cff;fill:#9b6cff;stroke-width:1.7}.bReactionLabel{fill:#9b6cff;font-size:12px;font-weight:700}
    .bDim{stroke:#69717c;stroke-width:1}.bTick{stroke:#7f8791;stroke-width:1}.bDimText{fill:#a5adb7;font-size:11px}.bOverall{fill:#aeb6c1;font-size:12px;font-weight:700}.bSection{fill:#aeb6c1;font-size:11px}
  `;
  document.head.appendChild(style);

  const baseRender=window.render;
  window.render=function(){baseRender();renderBeamV4();};
  setTimeout(renderBeamV4,0);
})();

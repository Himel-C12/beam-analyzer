/* Beam Analyzer v5: single clean beam renderer.
   Fixes: light/dark canvas follows site theme; UDL envelope terminates at the beam
   for zero intensity; arrows are strictly vertical; no legacy visual layers. */
(function(){
  const $=s=>document.querySelector(s);
  const n=v=>Number(v)||0;
  const f=v=>typeof fmt==='function'?fmt(v):String(v);
  const u=k=>typeof unitText==='function'?unitText(k):k;
  const beamLen=()=>Math.max(typeof len==='function'?Number(len()):1,1);

  function arrow(x, start, tip, down, cls){
    const h=8, base=down?tip-h:tip+h;
    return `<line x1="${x}" y1="${start}" x2="${x}" y2="${tip}" class="${cls}"/>`+
      `<polygon points="${x},${tip} ${x-5},${base} ${x+5},${base}" class="${cls}Head"/>`;
  }

  function support(type,x,y){
    if(type==='fixed') return `<g class="supportFixed">
      <line x1="${x-17}" y1="${y-30}" x2="${x-17}" y2="${y+30}" class="supportStroke"/>
      <path d="M${x-17} ${y-26}l-12 7m12 3l-12 7m12 3l-12 7m12 3l-12 7m12 3l-12 7" class="hatch"/>
      <line x1="${x-17}" y1="${y}" x2="${x}" y2="${y}" class="supportStroke"/>
    </g>`;
    const roller=type==='roller';
    return `<g class="supportSimple">
      <path d="M${x-22} ${y+15}L${x} ${y-13}L${x+22} ${y+15}Z" class="triangle"/>
      ${roller?`<circle cx="${x-10}" cy="${y+23}" r="6" class="wheel"/><circle cx="${x+10}" cy="${y+23}" r="6" class="wheel"/>`:''}
      <line x1="${x-28}" y1="${y+31}" x2="${x+28}" y2="${y+31}" class="supportStroke"/>
      <path d="M${x-24} ${y+31}l-6 8m14-8l-6 8m14-8l-6 8m14-8l-6 8m14-8l-6 8" class="hatch"/>
    </g>`;
  }

  function moment(v,x,y){
    const ccw=n(v)>0,r=25;
    const path=ccw?`M${x+19} ${y-25}A${r} ${r} 0 1 0 ${x-19} ${y-25}`:`M${x-19} ${y-25}A${r} ${r} 0 1 1 ${x+19} ${y-25}`;
    const ex=ccw?x-19:x+19;
    const head=ccw?`<polygon points="${ex},${y-25} ${ex+9},${y-28} ${ex+5},${y-18}" class="momentHead"/>`:`<polygon points="${ex},${y-25} ${ex-9},${y-28} ${ex-5},${y-18}" class="momentHead"/>`;
    return `<path d="${path}" class="momentArc"/>${head}<text x="${x}" y="${y-54}" text-anchor="middle" class="momentLabel">${n(v)<0?'−':''}${f(Math.abs(n(v)))} ${u('moment')}</text>`;
  }

  function render(){
    const W=1280,H=430,pad=70,by=112,total=beamLen();
    const x=p=>pad+Math.max(0,Math.min(total,n(p)))/total*(W-2*pad);
    const bodyBg=getComputedStyle(document.body).backgroundColor;
    const m=bodyBg.match(/rgba?\(([^)]+)\)/);
    let light=true;
    if(m){const q=m[1].split(',').map(v=>parseFloat(v));const lum=(0.2126*q[0]+0.7152*q[1]+0.0722*q[2])/255;light=lum>0.55;}
    let s=`<svg viewBox="0 0 ${W} ${H}" class="beamReference ${light?'themeLight':'themeDark'}" role="img" aria-label="Beam model">
      <rect width="${W}" height="${H}" class="canvas"/>
      <rect x="${pad}" y="${by-3}" width="${W-2*pad}" height="6" rx="1" class="beam"/>`;

    (model.loads||[]).filter(l=>l.type==='udl').forEach(l=>{
      const a=x(l.from),b=x(l.to),v1=n(l.value),v2=n(l.value2??l.value);
      const max=Math.max(Math.abs(v1),Math.abs(v2),1e-9), maxH=64;
      const y=v=>v<0?by-(Math.abs(v)/max)*maxH:by+(Math.abs(v)/max)*maxH;
      const y1=y(v1),y2=y(v2);
      s+=`<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="udlLine"/>`;
      const count=Math.max(7,Math.min(30,Math.round((b-a)/34)+1));
      for(let i=0;i<count;i++){
        const t=i/(count-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t,yy=y(v);
        if(Math.abs(v)<1e-9)continue;
        s+=arrow(xx,yy,v<0?by-4:by+4,v<0,'udlArrow');
      }
      const label=v1===v2?`${v1<0?'−':''}${f(Math.abs(v1))} ${u('load')}`:`${v1<0?'−':''}${f(Math.abs(v1))} → ${v2<0?'−':''}${f(Math.abs(v2))} ${u('load')}`;
      s+=`<text x="${a}" y="${Math.min(y1,y2)-10}" class="udlLabel">${label}</text>`;
    });

    (model.loads||[]).filter(l=>l.type==='point').forEach(l=>{
      const xx=x(l.from),v=n(l.value),down=v<0;
      s+=arrow(xx,down?25:190,down?by-5:by+5,down,'pointArrow');
      s+=`<text x="${xx}" y="${down?16:210}" text-anchor="middle" class="pointLabel">${v<0?'−':''}${f(Math.abs(v))} ${u('force')}</text>`;
    });
    (model.loads||[]).filter(l=>l.type==='moment').forEach(l=>s+=moment(l.value,x(l.from),by));

    let start=0;
    (model.spans||[]).forEach(sp=>{
      const EI=n(sp.E)*n(sp.I)*1e-9,mid=x(start+n(sp.length)/2);
      const text=unit==='imperial'?`EI = ${f(EI*0.7375621493)} kip·ft²`:`EI = ${f(EI)} kN·m²`;
      s+=`<text x="${mid}" y="${by}" text-anchor="middle" dominant-baseline="middle" class="ei">${text}</text>`;
      start+=n(sp.length);
    });

    (model.supports||[]).forEach((sp,i)=>{
      const xx=x(sp.position),name=sp.type==='fixed'?'Fixed':sp.type==='roller'?'Roller':'Pin';
      s+=support(sp.type,xx,by);
      s+=`<circle cx="${xx}" cy="${by-5}" r="10" class="badge"/><text x="${xx}" y="${by-5}" text-anchor="middle" dominant-baseline="middle" class="badgeText">${i+1}</text>`;
      s+=`<text x="${xx}" y="${by+54}" text-anchor="middle" class="supportName">S${i+1} (${name})</text>`;
    });

    const reactions=result?.support_reactions||result?.reactions||[];
    reactions.forEach((r,i)=>{const sp=(model.supports||[])[i];if(!sp)return;const v=n(r.shear);if(!v)return;const xx=x(sp.position),up=v>0;s+=arrow(xx,up?by+82:by+38,up?by+38:by+82,up,'reaction');s+=`<text x="${xx}" y="${by+101}" text-anchor="middle" class="reactionLabel">${f(Math.abs(v))} ${u('force')}</text>`;});

    const ry=292;
    s+=`<line x1="${pad}" y1="${ry}" x2="${W-pad}" y2="${ry}" class="dim"/>`;
    const pts=[];(model.supports||[]).forEach(sp=>pts.push(n(sp.position)));(model.loads||[]).forEach(l=>{pts.push(n(l.from));if(l.type==='udl')pts.push(n(l.to));});
    [...new Set(pts.map(v=>v.toFixed(6)))].map(Number).sort((a,b)=>a-b).forEach(p=>{const xx=x(p);s+=`<line x1="${xx}" y1="${ry-7}" x2="${xx}" y2="${ry+7}" class="tick"/><text x="${xx}" y="${ry+23}" text-anchor="middle" class="dimText">${f(p)} ${u('length')}</text>`;});
    s+=`<line x1="${pad}" y1="${ry+31}" x2="${W-pad}" y2="${ry+31}" class="dim"/><line x1="${pad}" y1="${ry+24}" x2="${pad}" y2="${ry+38}" class="tick"/><line x1="${W-pad}" y1="${ry+24}" x2="${W-pad}" y2="${ry+38}" class="tick"/><text x="${W/2}" y="${ry+51}" text-anchor="middle" class="overall">${f(total)} ${u('length')}</text><text x="${pad}" y="${ry-12}" class="sectionNote">sections ×0.7</text>`;
    s+='</svg>';
    $('#beamCanvas').innerHTML=s;
    $('#beamCanvas').style.transform=`translate(${panX||0}px,${panY||0}px) scale(${zoom||1})`;
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{height:430px!important;min-height:430px!important;overflow:hidden}.beamCanvas{overflow:hidden}.beamReference{display:block;width:100%;height:100%;border-radius:2px}
    .themeLight .canvas{fill:#fff}.themeDark .canvas{fill:#151719}
    .themeLight .beam{fill:#2d91ff;stroke:#4f9fff}.themeDark .beam{fill:#2d91ff;stroke:#7bb8ff}
    .ei{fill:#1682ed;font-size:13px;font-weight:700;pointer-events:none}.udlLine{stroke:#25b975;stroke-width:1.7;fill:none}.udlArrow,.udlArrowHead{stroke:#25b975;fill:#25b975;stroke-width:1.15}.udlLabel{fill:#20a969;font-size:13px;font-weight:700}.pointArrow,.pointArrowHead{stroke:#ed4f4f;fill:#ed4f4f;stroke-width:1.8}.pointLabel{fill:#ed4f4f;font-size:13px;font-weight:700}.momentArc{stroke:#f0a12f;stroke-width:2.1;fill:none}.momentHead{fill:#f0a12f;stroke:#f0a12f}.momentLabel{fill:#f0a12f;font-size:13px;font-weight:700}.supportStroke{stroke:#89939f;stroke-width:1.6;fill:none}.hatch{stroke:#89939f;stroke-width:1.1;fill:none}.triangle{fill:none;stroke:#89939f;stroke-width:1.8}.wheel{fill:none;stroke:#89939f;stroke-width:1.5}.badge{fill:#fff;stroke:#5f6975;stroke-width:1.2}.badgeText{fill:#26313d;font-size:9px;font-weight:700}.supportName{fill:#66717d;font-size:11px;font-weight:700}.reaction,.reactionHead{stroke:#8d63df;fill:#8d63df;stroke-width:1.7}.reactionLabel{fill:#8d63df;font-size:12px;font-weight:700}.dim{stroke:#7b8794;stroke-width:1}.tick{stroke:#7b8794;stroke-width:1}.dimText{fill:#697582;font-size:11px}.overall{fill:#65717d;font-size:12px;font-weight:700}.sectionNote{fill:#65717d;font-size:11px}.themeDark .supportStroke,.themeDark .hatch{stroke:#aab1bb}.themeDark .triangle,.themeDark .wheel{stroke:#aab1bb}.themeDark .badge{fill:#151719;stroke:#e7edf4}.themeDark .badgeText,.themeDark .supportName,.themeDark .dimText,.themeDark .overall,.themeDark .sectionNote{fill:#aeb6c1}
  `;
  document.head.appendChild(style);
  const baseRender=window.render;
  window.render=function(){baseRender();render();};
  setTimeout(render,0);
  new MutationObserver(()=>render()).observe(document.body,{attributes:true,attributeFilter:['class','style','data-theme']});
})();

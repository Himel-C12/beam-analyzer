/* Beam Analyzer v5 — final beam-diagram renderer.
   Visual rules:
   - canvas always follows the site theme
   - no extra white frame inside the diagram
   - no EI text inside the beam
   - supports are larger and distinct
   - point/UDL arrows are strictly vertical
   - zero-intensity end of a UDL has no arrow; only the taper line remains
   - moment arc/value are separated and the arrow follows the arc
   - moment labels show CW/CCW without a redundant negative sign
   - beam/support/load dragging is intentionally disabled
*/
(function(){
  const $=s=>document.querySelector(s);
  const n=v=>Number(v)||0;
  const f=v=>typeof fmt==='function'?fmt(v):String(v);
  const u=k=>typeof unitText==='function'?unitText(k):k;
  const totalLength=()=>Math.max(typeof len==='function'?Number(len()):1,1);

  function isDark(){
    return document.documentElement.classList.contains('dark');
  }

  function markerDefs(){
    /* context-stroke makes marker heads inherit the actual load color,
       so they remain visible in both light and dark themes. */
    return `<defs>
      <marker id="baDown" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" class="arrowHead" fill="context-stroke" stroke="context-stroke"/></marker>
      <marker id="baUp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M10 0L0 5L10 10Z" class="arrowHead" fill="context-stroke" stroke="context-stroke"/></marker>
      <marker id="baMoment" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" class="momentHead" fill="context-stroke" stroke="context-stroke"/></marker>
    </defs>`;
  }

  function support(type,x,y){
    if(type==='fixed'){
      return `<g class="supportFixed">
        <line x1="${x-18}" y1="${y-31}" x2="${x-18}" y2="${y+17}" class="supportStroke"/>
        <path d="M${x-18} ${y-27}l-12 7m12 3l-12 7m12 3l-12 7m12 3l-12 7m12 3l-12 7" class="supportHatch"/>
        <line x1="${x-18}" y1="${y}" x2="${x}" y2="${y}" class="supportStroke"/>
      </g>`;
    }
    const roller=type==='roller';
    return `<g class="supportSimple">
      <path d="M${x-24} ${y+15}L${x} ${y-14}L${x+24} ${y+15}Z" class="supportTriangle"/>
      ${roller?`<circle cx="${x-10}" cy="${y+23}" r="6" class="rollerWheel"/><circle cx="${x+10}" cy="${y+23}" r="6" class="rollerWheel"/>`:''}
      <line x1="${x-29}" y1="${y+31}" x2="${x+29}" y2="${y+31}" class="groundLine"/>
      <path d="M${x-25} ${y+31}l-6 8m15-8l-6 8m15-8l-6 8m15-8l-6 8m15-8l-6 8" class="supportHatch"/>
    </g>`;
  }

  function momentGraphic(v,x,y){
    const clockwise=n(v)>0;
    const r=24;
    const path=clockwise
      ? `M${x-18} ${y-9} A${r} ${r} 0 1 1 ${x+12} ${y-25}`
      : `M${x+18} ${y-9} A${r} ${r} 0 1 1 ${x-12} ${y-25}`;
    const direction=clockwise?'CW':'CCW';
    return `<path d="${path}" class="momentArc" marker-end="url(#baMoment)"/>
      <text x="${x}" y="${y-54}" text-anchor="middle" class="momentLabel">${f(Math.abs(n(v)))} ${u('moment')} ${direction}</text>`;
  }

  function render(){
    const canvas=$('#beamCanvas');
    if(!canvas||typeof model==='undefined')return;

    const W=1280,H=430,pad=70,by=125,total=totalLength();
    const x=p=>pad+Math.max(0,Math.min(total,n(p)))/total*(W-2*pad);
    const dark=isDark();
    const beamHeight=6;

    let s=`<svg viewBox="0 0 ${W} ${H}" class="beamReference ${dark?'themeDark':'themeLight'}" role="img" aria-label="Beam model">
      ${markerDefs()}
      <rect width="${W}" height="${H}" class="diagramCanvas"/>
      <rect x="${pad}" y="${by-3}" width="${W-2*pad}" height="${beamHeight}" rx="1" class="beam"/>`;

    (model.loads||[]).filter(l=>l.type==='udl').forEach(l=>{
      const a=x(l.from),b=x(l.to),v1=n(l.value),v2=n(l.value2??l.value);
      const max=Math.max(Math.abs(v1),Math.abs(v2),1e-9);
      const maxH=66;
      const loadY=v=>v<0?by-(Math.abs(v)/max)*maxH:by+(Math.abs(v)/max)*maxH;
      const y1=loadY(v1),y2=loadY(v2);

      s+=`<line x1="${a}" y1="${y1}" x2="${b}" y2="${y2}" class="udlLine"/>`;

      const count=Math.max(8,Math.min(30,Math.round((b-a)/34)+1));
      const arrowCutoff=max*0.12;
      for(let i=0;i<count;i++){
        const t=i/(count-1),xx=a+(b-a)*t,v=v1+(v2-v1)*t,yy=loadY(v);
        if(Math.abs(v)<=arrowCutoff)continue;
        const down=v<0;
        s+=`<line x1="${xx.toFixed(2)}" y1="${yy.toFixed(2)}" x2="${xx.toFixed(2)}" y2="${(down?by-4:by+4).toFixed(2)}" class="udlArrow" marker-end="url(#${down?'baDown':'baUp'})"/>`;
      }

      const label=v1===v2
        ? `${v1<0?'−':''}${f(Math.abs(v1))} ${u('load')}`
        : `${v1<0?'−':''}${f(Math.abs(v1))} → ${v2<0?'−':''}${f(Math.abs(v2))} ${u('load')}`;
      s+=`<text x="${a}" y="${Math.min(y1,y2)-12}" class="udlLabel">${label}</text>`;
    });

    (model.loads||[]).filter(l=>l.type==='point').forEach(l=>{
      const xx=x(l.from),v=n(l.value),down=v<0;
      const start=down?27:by+76;
      const tip=down?by-5:by+5;
      s+=`<line x1="${xx}" y1="${start}" x2="${xx}" y2="${tip}" class="pointArrow" marker-end="url(#${down?'baDown':'baUp'})"/>`;
      s+=`<text x="${xx}" y="${down?18:by+93}" text-anchor="middle" class="pointLabel">${v<0?'−':''}${f(Math.abs(v))} ${u('force')}</text>`;
    });

    (model.loads||[]).filter(l=>l.type==='moment').forEach(l=>s+=momentGraphic(l.value,x(l.from),by-4));

    (model.supports||[]).forEach((sp,i)=>{
      const xx=x(sp.position),name=sp.type==='fixed'?'Fixed':sp.type==='roller'?'Roller':'Pin';
      s+=support(sp.type,xx,by);
      s+=`<circle cx="${xx}" cy="${by-5}" r="10.5" class="badge"/>
        <text x="${xx}" y="${by-5}" text-anchor="middle" dominant-baseline="middle" class="badgeText">${i+1}</text>
        <text x="${xx}" y="${by+58}" text-anchor="middle" class="supportName">S${i+1} (${name})</text>
        <text x="${xx}" y="${by+73}" text-anchor="middle" class="supportPosition">@ ${f(sp.position)} ${u('length')}</text>`;
    });

    if(showDims){
      const ry=310;
      const points=[];
      (model.supports||[]).forEach((sp,i)=>points.push({p:n(sp.position),label:`S${i+1}`}));
      (model.loads||[]).forEach(l=>{
        if(l.type==='udl')points.push({p:n(l.from),label:`L${l.id}`},{p:n(l.to),label:`L${l.id}`});
        else points.push({p:n(l.from),label:`L${l.id}`});
      });

      const merged=[];
      points.sort((a,b)=>a.p-b.p).forEach(pt=>{
        let q=merged.find(z=>Math.abs(z.p-pt.p)<1e-7);
        if(!q)merged.push({p:pt.p,label:pt.label});
        else if(q.label.indexOf(pt.label)<0)q.label+=` · ${pt.label}`;
      });

      s+=`<line x1="${pad}" y1="${ry}" x2="${W-pad}" y2="${ry}" class="dim"/>`;
      merged.forEach(pt=>{
        const xx=x(pt.p);
        s+=`<line x1="${xx}" y1="${ry-7}" x2="${xx}" y2="${ry+7}" class="tick"/>
          <text x="${xx}" y="${ry-14}" text-anchor="middle" class="dimLabel">${pt.label}</text>
          <text x="${xx}" y="${ry+24}" text-anchor="middle" class="dimText">${f(pt.p)} ${u('length')}</text>`;
      });

      s+=`<line x1="${pad}" y1="${ry+38}" x2="${W-pad}" y2="${ry+38}" class="dim"/>
        <line x1="${pad}" y1="${ry+31}" x2="${pad}" y2="${ry+45}" class="tick"/>
        <line x1="${W-pad}" y1="${ry+31}" x2="${W-pad}" y2="${ry+45}" class="tick"/>
        <text x="${W/2}" y="${ry+59}" text-anchor="middle" class="overall">${f(total)} ${u('length')}</text>
        <text x="${pad}" y="${ry-14}" class="sectionNote">sections ×0.7</text>
        <text x="${pad}" y="${H-15}" class="axis">0 ${u('length')}</text>
        <text x="${W-pad}" y="${H-15}" text-anchor="end" class="axis">${f(total)} ${u('length')}</text>`;
    }

    s+='</svg>';
    canvas.innerHTML=s;
    canvas.style.transform=`translate(${typeof panX!=='undefined'?panX:0}px,${typeof panY!=='undefined'?panY:0}px) scale(${typeof zoom!=='undefined'?zoom:1})`;
  }

  const style=document.createElement('style');
  style.textContent=`
    .beamViewport{background:var(--card)!important;border-color:var(--line)!important;padding:0!important;box-shadow:none!important}
    .beamCanvas{background:var(--card)!important}
    .beamCanvas svg{background:transparent!important}
    .beamReference{display:block;width:100%;height:100%;overflow:hidden}
    .diagramCanvas{fill:var(--card)}
    .beam{fill:#2f8cf5;stroke:#3b93fa;stroke-width:1}
    .themeLight .beam{fill:#2f8cf5}.themeDark .beam{fill:#2f8cf5}
    .supportStroke{stroke:#697586;stroke-width:1.7;fill:none;vector-effect:non-scaling-stroke}
    .supportHatch{stroke:#7c8795;stroke-width:1.25;fill:none;vector-effect:non-scaling-stroke}
    .supportTriangle{fill:var(--card);stroke:#687585;stroke-width:1.8;vector-effect:non-scaling-stroke}
    .rollerWheel{fill:var(--card);stroke:#687585;stroke-width:1.6;vector-effect:non-scaling-stroke}
    .groundLine{stroke:#687585;stroke-width:1.7;vector-effect:non-scaling-stroke}
    .badge{fill:var(--card);stroke:#697586;stroke-width:1.2}
    .badgeText{fill:var(--text);font-size:9px;font-weight:700}
    .supportName,.supportPosition{fill:var(--text);font-weight:600}
    .supportName{font-size:12px}.supportPosition{font-size:10px;fill:var(--muted)}
    .udlLine{stroke:#27b97a;stroke-width:1.6;fill:none;vector-effect:non-scaling-stroke}
    .udlArrow{stroke:#27b97a;stroke-width:1.2;vector-effect:non-scaling-stroke}
    .arrowHead{fill:context-stroke;stroke:context-stroke}
    .udlLabel{fill:#20aa70;font-size:13px;font-weight:700}
    .pointArrow{stroke:#ed4f4f;stroke-width:1.8;vector-effect:non-scaling-stroke}
    .pointLabel{fill:#ed4f4f;font-size:13px;font-weight:700}
    .momentArc{stroke:#f2a329;stroke-width:2.1;fill:none;vector-effect:non-scaling-stroke}
    .momentHead{fill:context-stroke;stroke:context-stroke}
    .momentLabel{fill:#f2a329;font-size:13px;font-weight:700}
    .dim{stroke:#7b8794;stroke-width:1;vector-effect:non-scaling-stroke}.tick{stroke:#7b8794;stroke-width:1;vector-effect:non-scaling-stroke}
    .dimLabel{fill:var(--muted);font-size:10px;font-weight:600}.dimText{fill:var(--muted);font-size:11px}.overall{fill:var(--text);font-size:12px;font-weight:700}.sectionNote,.axis{fill:var(--muted);font-size:10px}
  `;
  document.head.appendChild(style);

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(){baseRender();render();};
  }
  window.renderBeam=render;
  setTimeout(render,0);

  new MutationObserver(muts=>{
    if(muts.some(m=>m.type==='attributes'&&m.attributeName==='class'))render();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
})();

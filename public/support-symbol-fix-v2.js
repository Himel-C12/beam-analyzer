/* Beam Analyzer — canonical beam support renderer v2.
 * Loaded last. Internal hinge = ONLY an open circle on the beam.
 * Pin = triangular pin + ground/hatching. Roller = triangle + rollers + ground.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s),NS='http://www.w3.org/2000/svg';
  const n=v=>Number(v), fmtv=v=>typeof fmt==='function'?fmt(v):String(v), unit=()=>typeof unitText==='function'?unitText('length'):'m';
  const beamLength=()=>typeof len==='function'?Math.max(n(len()),1):1;
  const make=(tag,attrs,cls)=>{const e=document.createElementNS(NS,tag);Object.keys(attrs).forEach(k=>e.setAttribute(k,String(attrs[k])));if(cls)e.setAttribute('class',cls);return e};
  function xFor(svg,p){const W=svg.viewBox.baseVal.width||1200,pad=72,L=beamLength();return pad+(Math.max(0,Math.min(L,n(p)))/L)*(W-2*pad)}
  function groupFor(svg,id){return [...svg.querySelectorAll('g.supportDrag')].find(g=>String(g.getAttribute('data-id'))===String(id))}
  function pin(g,x,y){g.querySelectorAll('.supportTriangle,.groundLine,.hatch,.rollerWheel,.fixedWall,.beamConnector').forEach(e=>e.remove());g.insertBefore(make('path',{d:`M ${x-18} ${y+10} L ${x} ${y+30} L ${x+18} ${y+10} Z`},'supportTriangle'),g.firstChild);g.insertBefore(make('line',{x1:x-25,y1:y+30,x2:x+25,y2:y+30},'groundLine'),g.firstChild);g.insertBefore(make('path',{d:`M ${x-20} ${y+30} l-6 7 m13-7 l-6 7 m13-7 l-6 7 m13-7 l-6 7`},'hatch'),g.firstChild)}
  function roller(g,x,y){g.querySelectorAll('.supportTriangle,.groundLine,.hatch,.rollerWheel,.fixedWall,.beamConnector').forEach(e=>e.remove());g.insertBefore(make('path',{d:`M ${x-18} ${y+10} L ${x} ${y-10} L ${x+18} ${y+10} Z`},'supportTriangle'),g.firstChild);g.insertBefore(make('circle',{cx:x-8,cy:y+18,r:5},'rollerWheel'),g.firstChild);g.insertBefore(make('circle',{cx:x+8,cy:y+18,r:5},'rollerWheel'),g.firstChild);g.insertBefore(make('line',{x1:x-25,y1:y+27,x2:x+25,y2:y+27},'groundLine'),g.firstChild);g.insertBefore(make('path',{d:`M ${x-20} ${y+27} l-6 7 m13-7 l-6 7 m13-7 l-6 7 m13-7 l-6 7`},'hatch'),g.firstChild)}
  function patch(){
    const canvas=$('#beamCanvas'),svg=canvas?.querySelector('svg');if(!svg||typeof model==='undefined'||!Array.isArray(model.supports))return;
    const beamY=112;
    // Remove every hinge graphic made by any previous patch before rebuilding.
    svg.querySelectorAll('.beamAnalyzerHingeV2,.internalHingeGraphic').forEach(e=>e.remove());
    model.supports.forEach((s,i)=>{
      const x=xFor(svg,s.position),g=groupFor(svg,s.id);
      if(s.type==='internal-hinge'){
        if(g)g.remove();
        const h=make('g',{'data-support-id':s.id,'pointer-events':'none'},'beamAnalyzerHingeV2');
        h.appendChild(make('circle',{cx:x,cy:beamY,r:9,fill:'white','stroke':'currentColor','stroke-width':2},'internalHingeCircle'));
        const name=make('text',{x,y:beamY+48,'text-anchor':'middle'},'internalHingeName');name.textContent=`H${i+1} (Internal Hinge)`;h.appendChild(name);
        const pos=make('text',{x,y:beamY+65,'text-anchor':'middle'},'internalHingePosition');pos.textContent=`@ ${fmtv(s.position)} ${unit()}`;h.appendChild(pos);
        svg.appendChild(h);return;
      }
      if(!g)return;
      const badge=g.querySelector('.supportBadge'),numText=g.querySelector('.supportNumber');
      if(badge){badge.setAttribute('cx',x);badge.setAttribute('cy',beamY-4)}
      if(numText){numText.setAttribute('x',x);numText.setAttribute('y',beamY)}
      if(s.type==='pin')pin(g,x,beamY);else if(s.type==='roller')roller(g,x,beamY);
    });
  }
  const run=()=>requestAnimationFrame(patch);patch();
  const canvas=$('#beamCanvas');if(canvas)new MutationObserver(run).observe(canvas,{childList:true,subtree:true});
  [0,50,150,300,600,1000].forEach(ms=>setTimeout(patch,ms));
})();

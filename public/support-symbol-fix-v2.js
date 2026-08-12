/* Beam Analyzer — canonical beam support renderer v2.
 * This file is deliberately loaded last. It owns ONLY the visible support
 * symbols in #beamCanvas.
 *
 * Internal hinge: one open circle directly on the beam. NO triangle, wheels,
 * ground, hatch, or numbered support badge.
 * Pin: triangular pin + ground/hatching.
 * Roller: triangle + two rollers + ground/hatching.
 */
(function(){
  'use strict';

  const $=s=>document.querySelector(s);
  const NS='http://www.w3.org/2000/svg';

  function n(v){return Number(v)}
  function fmtv(v){return typeof fmt==='function'?fmt(v):String(v)}
  function unit(){return typeof unitText==='function'?unitText('length'):'m'}
  function beamLength(){return typeof len==='function'?Math.max(n(len()),1):1}

  function make(tag,attrs,cls){
    const e=document.createElementNS(NS,tag);
    Object.keys(attrs).forEach(k=>e.setAttribute(k,String(attrs[k])));
    if(cls)e.setAttribute('class',cls);
    return e;
  }

  function xFor(svg,p){
    const vb=svg.viewBox.baseVal;
    const W=vb.width||1200;
    const pad=72;
    return pad+(Math.max(0,Math.min(beamLength(),n(p)))/beamLength())*(W-2*pad);
  }

  function findSupportGroup(svg,id){
    return [...svg.querySelectorAll('g.supportDrag')].find(g=>String(g.getAttribute('data-id'))===String(id));
  }

  function drawPin(group,x,y){
    group.querySelectorAll('.supportTriangle,.groundLine,.hatch,.rollerWheel,.fixedWall,.beamConnector').forEach(e=>e.remove());
    group.insertBefore(make('path',{d:`M ${x-18} ${y+10} L ${x} ${y+30} L ${x+18} ${y+10} Z`},'supportTriangle'),group.firstChild);
    group.insertBefore(make('line',{x1:x-25,y1:y+30,x2:x+25,y2:y+30},'groundLine'),group.firstChild);
    group.insertBefore(make('path',{d:`M ${x-20} ${y+30} l-6 7 m13-7 l-6 7 m13-7 l-6 7 m13-7 l-6 7`},'hatch'),group.firstChild);
  }

  function drawRoller(group,x,y){
    group.querySelectorAll('.supportTriangle,.groundLine,.hatch,.rollerWheel,.fixedWall,.beamConnector').forEach(e=>e.remove());
    group.insertBefore(make('path',{d:`M ${x-18} ${y+10} L ${x} ${y-10} L ${x+18} ${y+10} Z`},'supportTriangle'),group.firstChild);
    group.insertBefore(make('circle',{cx:x-8,cy:y+18,r:5},'rollerWheel'),group.firstChild);
    group.insertBefore(make('circle',{cx:x+8,cy:y+18,r:5},'rollerWheel'),group.firstChild);
    group.insertBefore(make('line',{x1:x-25,y1:y+27,x2:x+25,y2:y+27},'groundLine'),group.firstChild);
    group.insertBefore(make('path',{d:`M ${x-20} ${y+27} l-6 7 m13-7 l-6 7 m13-7 l-6 7 m13-7 l-6 7`},'hatch'),group.firstChild);
  }

  function patch(){
    const canvas=$('#beamCanvas');
    const svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined'||!Array.isArray(model.supports))return;

    const vb=svg.viewBox.baseVal;
    const beamY=112;

    // Remove ALL previously generated hinge graphics first.
    svg.querySelectorAll('.beamAnalyzerHingeV2').forEach(e=>e.remove());

    model.supports.forEach((s,index)=>{
      const x=xFor(svg,s.position);
      const group=findSupportGroup(svg,s.id);

      if(s.type==='internal-hinge'){
        // The normal app renderer creates a pin-like support group for any
        // non-fixed/non-roller support. Delete that entire group.
        if(group)group.remove();

        const g=make('g',{'data-support-id':s.id,'pointer-events':'none'},'beamAnalyzerHingeV2');
        g.appendChild(make('circle',{cx:x,cy:beamY,r:9,fill:'white'},'internalHingeCircle'));
        const name=make('text',{x:x,y:beamY+48,'text-anchor':'middle'},'internalHingeName');
        name.textContent=`H${index+1} (Internal Hinge)`;
        g.appendChild(name);
        const pos=make('text',{x:x,y:beamY+65,'text-anchor':'middle'},'internalHingePosition');
        pos.textContent=`@ ${fmtv(s.position)} ${unit()}`;
        g.appendChild(pos);
        svg.appendChild(g);
        return;
      }

      if(!group)return;
      const badge=group.querySelector('.supportBadge');
      const number=group.querySelector('.supportNumber');
      if(badge){badge.setAttribute('cx',x);badge.setAttribute('cy',beamY-4)}
      if(number){number.setAttribute('x',x);number.setAttribute('y',beamY)}

      if(s.type==='pin')drawPin(group,x,beamY);
      else if(s.type==='roller')drawRoller(group,x,beamY);
    });
  }

  function schedule(){requestAnimationFrame(patch)}

  // Run now and after every DOM render. No dependency on an earlier wrapper.
  patch();
  const canvas=$('#beamCanvas');
  if(canvas)new MutationObserver(schedule).observe(canvas,{childList:true,subtree:true});

  // Also catch renders that happen before the DOM observer is attached.
  [0,50,150,300,600,1000].forEach(ms=>setTimeout(patch,ms));
})();

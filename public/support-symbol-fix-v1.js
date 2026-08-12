/* Beam Analyzer — canonical support symbols.
 * Loaded last. This owns only the beam-view support graphics.
 * Internal hinge = open circle on the beam, with NO support triangle/base.
 * Pin = clean triangular pin with a separate ground line/hatching.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));

  function unit(){ return typeof unitText==='function' ? unitText('length') : 'm'; }
  function length(){ return typeof len==='function' ? n(len()) : 1; }
  function fmtv(v){ return typeof fmt==='function' ? fmt(v) : String(v); }

  function patch(){
    const canvas=$('#beamCanvas');
    const svg=canvas?.querySelector('svg');
    if(!svg || typeof model==='undefined' || !Array.isArray(model.supports)) return;

    // Remove every old hinge overlay. We rebuild hinges from scratch so an
    // internal hinge can never inherit a pin/roller/fixed support graphic.
    svg.querySelectorAll('.internalHingeGraphic').forEach(e=>e.remove());

    const vb=svg.viewBox?.baseVal;
    const W=vb?.width || 1200;
    const H=vb?.height || 370;
    const pad=72;
    const beamY=112;
    const L=Math.max(length(),1);
    const x=p=>pad+Math.max(0,Math.min(L,n(p)))/L*(W-2*pad);
    const NS='http://www.w3.org/2000/svg';

    function el(tag,attrs,cls){
      const e=document.createElementNS(NS,tag);
      Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));
      if(cls)e.setAttribute('class',cls);
      return e;
    }

    model.supports.forEach((s,i)=>{
      const xx=x(s.position);
      const old=svg.querySelector(`g.supportDrag[data-drag="support"][data-id="${CSS.escape(String(s.id))}"]`);

      if(s.type==='internal-hinge'){
        // Delete the entire normal support group. This is important: merely
        // covering the triangle still leaves the old support hitbox/graphics.
        if(old) old.remove();

        const g=el('g',{'data-support-id':s.id,'aria-label':`H${i+1} Internal Hinge`},'internalHingeGraphic');
        g.appendChild(el('circle',{cx:xx,cy:beamY,r:9},'internalHingeCircle'));
        const name=el('text',{x:xx,y:beamY+48,'text-anchor':'middle'},'internalHingeName');
        name.textContent=`H${i+1} (Internal Hinge)`;
        g.appendChild(name);
        const pos=el('text',{x:xx,y:beamY+65,'text-anchor':'middle'},'internalHingePosition');
        pos.textContent=`@ ${fmtv(s.position)} ${unit()}`;
        g.appendChild(pos);
        svg.appendChild(g);
        return;
      }

      if(!old) return;

      // Rebuild only pin support geometry. Roller/fixed geometry remains the
      // application's existing geometry, avoiding unrelated visual changes.
      if(s.type==='pin'){
        old.querySelectorAll('.supportTriangle,.groundLine,.hatch').forEach(e=>e.remove());

        old.insertBefore(el('path',{d:`M ${xx-18} ${beamY+10} L ${xx} ${beamY+29} L ${xx+18} ${beamY+10} Z`},'supportTriangle'),old.firstChild);
        old.insertBefore(el('line',{x1:xx-24,y1:beamY+29,x2:xx+24,y2:beamY+29},'groundLine'),old.firstChild);
        old.insertBefore(el('path',{d:`M ${xx-20} ${beamY+29} l-6 7 m13-7 l-6 7 m13-7 l-6 7 m13-7 l-6 7`},'hatch'),old.firstChild);

        // Keep the numbered badge centred on the beam joint rather than on
        // the support triangle. This matches conventional structural icons.
        const badge=old.querySelector('.supportBadge');
        if(badge){badge.setAttribute('cx',String(xx));badge.setAttribute('cy',String(beamY-4));}
        const number=old.querySelector('.supportNumber');
        if(number){number.setAttribute('x',String(xx));number.setAttribute('y',String(beamY));}
      }
    });
  }

  const base=window.renderBeam;
  if(typeof base==='function' && !base.__canonicalSupportSymbols){
    function wrapped(){
      base();
      requestAnimationFrame(patch);
    }
    wrapped.__canonicalSupportSymbols=true;
    window.renderBeam=wrapped;
  }

  // Catch renders caused by drag/zoom/dimension toggles without repeatedly
  // wrapping the renderer.
  const canvas=$('#beamCanvas');
  if(canvas){
    new MutationObserver(()=>requestAnimationFrame(patch)).observe(canvas,{childList:true,subtree:true});
  }

  setTimeout(patch,0);
})();

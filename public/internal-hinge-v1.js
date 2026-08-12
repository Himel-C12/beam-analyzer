/* Beam Analyzer — internal hinge support adapter.
   An internal hinge is ONLY an open circle on the beam.
   It must never inherit the normal pin/roller support graphic.
*/
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const EPS=1e-8;
  const isHinge=s=>s?.type==='internal-hinge';

  function hingePositions(){return [...new Set((model.supports||[]).filter(isHinge).map(s=>n(s.position)).filter(Number.isFinite))].sort((a,b)=>a-b);}

  function installInput(){
    const base=window.renderInputs;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      base();
      $$('#supportRows select[data-k="type"]').forEach(sel=>{
        if(!sel.querySelector('option[value="internal-hinge"]')){
          const opt=document.createElement('option');opt.value='internal-hinge';opt.textContent='Internal Hinge';sel.appendChild(opt);
        }
        const id=sel.dataset.sup,s=(model.supports||[]).find(x=>String(x.id)===String(id));
        if(s)sel.value=s.type;
        const settlement=sel.closest('tr')?.querySelector('input[data-k="settlement"]');
        if(settlement){settlement.disabled=isHinge(s);settlement.title=isHinge(s)?'Internal hinges do not have support settlement':'';if(isHinge(s))settlement.value=0;}
      });
    }
    wrapped.__internalHinge=true;window.renderInputs=wrapped;
  }

  function installPayload(){
    const base=window.payload;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      const p=base();
      p.supports=(model.supports||[]).map(s=>({type:s.type,position:n(s.position),settlement:n(s.settlement||0)}));
      let pointIndex=0;
      p.loads=(p.loads||[]).map(l=>{
        if(l?.type!=='point')return l;
        const src=(model.loads||[]).filter(x=>x.type==='point')[pointIndex++];
        return {...l,angle:n(src?.angle||0)};
      });
      return p;
    }
    wrapped.__internalHinge=true;window.payload=wrapped;
  }

  function installValidate(){
    const base=window.validate;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      const errors=base();
      const L=typeof len==='function'?n(len()):0,hinges=hingePositions();
      hinges.forEach(p=>{if(p<=EPS||p>=L-EPS)errors.push(`Internal hinge at ${p} must be inside the beam, not at an end.`);});
      if(hinges.length!==new Set(hinges.map(p=>p.toFixed(8))).size)errors.push('Internal hinge positions must be unique.');
      return [...new Set(errors)];
    }
    wrapped.__internalHinge=true;window.validate=wrapped;
  }

  function installStyles(){
    if(document.getElementById('internal-hinge-v1-style'))return;
    const style=document.createElement('style');style.id='internal-hinge-v1-style';
    style.textContent=`
      .logo{background:transparent!important;box-shadow:none!important;overflow:hidden}
      .logo img{width:100%;height:100%;object-fit:contain;display:block}
      #supportRows select[data-k="type"]{min-width:138px}
      #supportRows input[data-k="settlement"]:disabled{opacity:.45;cursor:not-allowed}
      #beamCanvas .internalHingeCircle{fill:var(--card);stroke:var(--text);stroke-width:2;vector-effect:non-scaling-stroke}
      #beamCanvas .internalHingeName{fill:var(--text);font-size:12px;font-weight:600}
      #beamCanvas .internalHingePosition{fill:var(--muted);font-size:10px}
    `;document.head.appendChild(style);
  }

  function patchBeam(){
    const canvas=$('#beamCanvas'),svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined')return;
    const hinges=(model.supports||[]).filter(isHinge);
    const hingeIds=new Set(hinges.map(s=>String(s.id)));

    // app.js calls its lexical renderBeam() directly, so a window.renderBeam
    // wrapper cannot guarantee the final SVG. Remove the normal pin/roller
    // group every time the SVG is rebuilt, then draw only the hinge circle.
    svg.querySelectorAll('g.supportDrag[data-drag="support"]').forEach(g=>{
      if(hingeIds.has(String(g.getAttribute('data-id'))))g.remove();
    });

    const existing=svg.querySelectorAll('.internalHingeGraphic');
    if(existing.length===hinges.length)return;
    existing.forEach(e=>e.remove());

    const W=1200,pad=72,by=112,total=Math.max(typeof len==='function'?n(len):1,1);
    const x=p=>pad+Math.max(0,Math.min(total,p))/total*(W-2*pad);
    const NS='http://www.w3.org/2000/svg';

    hinges.forEach((s,index)=>{
      const xx=x(n(s.position));
      const g=document.createElementNS(NS,'g');g.setAttribute('class','internalHingeGraphic');g.setAttribute('pointer-events','none');
      const circle=document.createElementNS(NS,'circle');circle.setAttribute('cx',xx);circle.setAttribute('cy',by);circle.setAttribute('r','9');circle.setAttribute('class','internalHingeCircle');g.appendChild(circle);
      const name=document.createElementNS(NS,'text');name.setAttribute('x',xx);name.setAttribute('y',by+48);name.setAttribute('text-anchor','middle');name.setAttribute('class','internalHingeName');name.textContent=`H${index+1} (Internal Hinge)`;g.appendChild(name);
      const pos=document.createElementNS(NS,'text');pos.setAttribute('x',xx);pos.setAttribute('y',by+65);pos.setAttribute('text-anchor','middle');pos.setAttribute('class','internalHingePosition');pos.textContent=`@ ${fmt(s.position)} ${unitText('length')}`;g.appendChild(pos);
      svg.appendChild(g);
    });
  }

  function installBeamPatch(){
    const base=window.renderBeam;
    if(typeof base==='function'&&!base.__internalHingeVisual){
      function wrapped(){base();requestAnimationFrame(patchBeam)}
      wrapped.__internalHingeVisual=true;window.renderBeam=wrapped;
    }
    const canvas=$('#beamCanvas');
    if(canvas&&!canvas.__internalHingeObserver){
      const observer=new MutationObserver(()=>requestAnimationFrame(patchBeam));
      observer.observe(canvas,{childList:true,subtree:true});
      canvas.__internalHingeObserver=observer;
    }
    setTimeout(patchBeam,0);
  }

  installInput();installPayload();installValidate();installStyles();installBeamPatch();
  setTimeout(()=>{installInput();installPayload();installValidate();installBeamPatch();if(typeof window.renderInputs==='function')window.renderInputs();patchBeam();},0);
})();

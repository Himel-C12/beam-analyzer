/* Beam Analyzer — internal hinge support adapter.
   Internal hinges are solver-native now. Keep them in the payload so the
   released-rotation local stiffness solver can enforce M = 0 at each hinge.
*/
(function(){
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
        if(!sel.querySelector('option[value="internal-hinge"]')){const opt=document.createElement('option');opt.value='internal-hinge';opt.textContent='Internal Hinge';sel.appendChild(opt);}
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
      hinges.forEach(p=>{if(p<=EPS||p>=L-EPS)errors.push(`Internal hinge at ${p} must be inside the beam, not at an end.`)});
      if(hinges.length!==new Set(hinges.map(p=>p.toFixed(8))).size)errors.push('Internal hinge positions must be unique.');
      return [...new Set(errors)];
    }
    wrapped.__internalHinge=true;window.validate=wrapped;
  }

  function installStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .logo{background:transparent!important;box-shadow:none!important;overflow:hidden}
      .logo img{width:100%;height:100%;object-fit:contain;display:block}
      #supportRows select[data-k="type"]{min-width:138px}
      #supportRows input[data-k="settlement"]:disabled{opacity:.45;cursor:not-allowed}
      #beamCanvas .internalHingeCircle{fill:var(--card);stroke:var(--text);stroke-width:2;vector-effect:non-scaling-stroke}
      #beamCanvas .internalHingeLine{stroke:var(--text);stroke-width:1.4;vector-effect:non-scaling-stroke}
      #beamCanvas .internalHingeName{fill:var(--text);font-size:12px;font-weight:600}
      #beamCanvas .internalHingePosition{fill:var(--muted);font-size:10px}
      #beamCanvas .internalHingeDim{pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function patchBeam(){
    const canvas=$('#beamCanvas'),svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined')return;
    svg.querySelectorAll('.internalHingeGraphic').forEach(e=>e.remove());
    const pad=70,by=125,total=Math.max(typeof len==='function'?n(len()):1,1),x=p=>pad+Math.max(0,Math.min(total,p))/total*(1280-2*pad);
    let hingeNo=0;
    (model.supports||[]).forEach(s=>{
      if(!isHinge(s))return;
      const xx=x(n(s.position));hingeNo++;
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','internalHingeGraphic');
      g.innerHTML=`<circle cx="${xx}" cy="${by}" r="8" class="internalHingeCircle"/><line x1="${xx-10}" y1="${by-7}" x2="${xx+10}" y2="${by-7}" class="internalHingeLine"/><text x="${xx}" y="${by+58}" text-anchor="middle" class="internalHingeName">H${hingeNo} (Internal Hinge)</text><text x="${xx}" y="${by+73}" text-anchor="middle" class="internalHingePosition">@ ${fmt(s.position)} ${unitText('length')}</text>`;
      svg.appendChild(g);
    });
  }

  function installBeamPatch(){
    const base=window.renderBeam;if(typeof base!=='function'||base.__internalHingeVisual)return;
    function wrapped(){base();requestAnimationFrame(patchBeam)}wrapped.__internalHingeVisual=true;window.renderBeam=wrapped;setTimeout(patchBeam,0);
  }

  installInput();installPayload();installValidate();installStyles();installBeamPatch();
  setTimeout(()=>{installInput();installPayload();installValidate();if(typeof window.renderInputs==='function')window.renderInputs()},0);
})();

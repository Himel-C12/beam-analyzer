/* Beam Analyzer — internal hinge support adapter.
   Internal hinges are represented in the UI as a support-type row, then mapped
   to StructureCalcs' span connection: "hinge" at the hinge location.
*/
(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const EPS=1e-8;
  const hingeLabel='Internal Hinge';
  const isHinge=s=>s?.type==='internal-hinge';
  const hingePositions=()=>[...new Set((model.supports||[]).filter(isHinge).map(s=>n(s.position)).filter(Number.isFinite))].sort((a,b)=>a-b);
  const at=(a,b)=>Math.abs(a-b)<=EPS*Math.max(1,Math.abs(a),Math.abs(b));

  function apiSpans(){
    const hinges=hingePositions();
    const out=[]; let start=0;
    for(const original of model.spans||[]){
      const end=start+n(original.length);
      const cuts=[start,...hinges.filter(p=>p>start+EPS&&p<end-EPS),end];
      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i],b=cuts[i+1];
        if(b-a<=EPS)continue;
        out.push({length:b-a,E:n(original.E),I:n(original.I),connection:(out.length>0&&hinges.some(h=>at(h,a)))?'hinge':'rigid'});
      }
      start=end;
    }
    for(let i=1;i<out.length;i++){
      let pos=0;
      for(let j=0;j<i;j++)pos+=out[j].length;
      if(hinges.some(h=>at(h,pos)))out[i].connection='hinge';
    }
    return out;
  }

  function installInput(){
    const base=window.renderInputs;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      base();
      $$('#supportRows select[data-k="type"]').forEach(sel=>{
        if(!sel.querySelector('option[value="internal-hinge"]')){
          const opt=document.createElement('option');opt.value='internal-hinge';opt.textContent=hingeLabel;sel.appendChild(opt);
        }
        const id=sel.dataset.sup;
        const s=(model.supports||[]).find(x=>String(x.id)===String(id));
        if(s)sel.value=s.type;
        const row=sel.closest('tr');
        const settlement=row?.querySelector('input[data-k="settlement"]');
        if(settlement){
          const on=isHinge(s);
          settlement.disabled=on;
          settlement.title=on?'Internal hinges do not have support settlement.':'';
          if(on)settlement.value=0;
        }
      });
    }
    wrapped.__internalHinge=true;
    window.renderInputs=wrapped;
  }

  function installPayload(){
    const base=window.payload;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      const p=base();
      p.spans=apiSpans();
      p.supports=(model.supports||[]).filter(s=>!isHinge(s)).map(s=>({type:s.type,position:n(s.position),settlement:n(s.settlement||0)}));
      return p;
    }
    wrapped.__internalHinge=true;
    window.payload=wrapped;
  }

  function installValidate(){
    const base=window.validate;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      const errors=base();
      const L=typeof len==='function'?n(len()):0;
      const hinges=hingePositions();
      hinges.forEach(p=>{if(p<=EPS||p>=L-EPS)errors.push(`Internal hinge at ${p} must be inside the beam, not at an end.`)});
      if(hinges.length!==new Set(hinges.map(p=>p.toFixed(8))).size)errors.push('Internal hinge positions must be unique.');
      if(apiSpans().length>20)errors.push('Too many span segments after adding internal hinges (maximum 20).');
      return [...new Set(errors)];
    }
    wrapped.__internalHinge=true;
    window.validate=wrapped;
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
    const canvas=$('#beamCanvas'), svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined')return;
    svg.querySelectorAll('.internalHingeGraphic').forEach(e=>e.remove());
    const pad=70,by=125,total=Math.max(typeof len==='function'?n(len()):1,1);
    const x=p=>pad+Math.max(0,Math.min(total,p))/total*(1280-2*pad);
    let hingeNo=0;
    (model.supports||[]).forEach((s,idx)=>{
      if(!isHinge(s))return;
      hingeNo++;
      const xx=x(n(s.position));
      const label=[...svg.querySelectorAll('.supportName')].find(t=>(t.textContent||'').startsWith(`S${idx+1} (`));
      if(label){
        label.textContent=`H${hingeNo} (Internal Hinge)`;
        label.previousElementSibling?.style.setProperty('display','none');
        label.previousElementSibling?.previousElementSibling?.style.setProperty('display','none');
      }
      const posLabel=label?.nextElementSibling;
      if(posLabel)posLabel.textContent=`@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):'m'}`;
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');
      g.setAttribute('class','internalHingeGraphic');
      g.innerHTML=`<circle cx="${xx}" cy="${by}" r="8" class="internalHingeCircle"/>
        <line x1="${xx-10}" y1="${by-7}" x2="${xx+10}" y2="${by-7}" class="internalHingeLine"/>
        <text x="${xx}" y="${by+58}" text-anchor="middle" class="internalHingeName">H${hingeNo} (Internal Hinge)</text>
        <text x="${xx}" y="${by+73}" text-anchor="middle" class="internalHingePosition">@ ${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):'m'}</text>`;
      svg.appendChild(g);
    });
  }

  function patchHingeDimensions(){
    const canvas=$('#beamCanvas'),svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined')return;
    const dim=svg.querySelector('.dim');
    if(!dim)return;
    const ry=Number(dim.getAttribute('y1'));
    svg.querySelectorAll('.internalHingeDim').forEach(e=>e.remove());
    let no=0;
    (model.supports||[]).filter(isHinge).forEach(s=>{
      no++;
      const total=Math.max(typeof len==='function'?n(len()):1,1);
      const xx=70+Math.max(0,Math.min(total,n(s.position)))/total*(1280-140);
      const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('class','internalHingeDim');
      g.innerHTML=`<line x1="${xx}" y1="${ry-7}" x2="${xx}" y2="${ry+7}" class="tick"/><text x="${xx}" y="${ry-14}" text-anchor="middle" class="dimLabel">H${no}</text><text x="${xx}" y="${ry+24}" text-anchor="middle" class="dimText">${typeof fmt==='function'?fmt(s.position):s.position} ${typeof unitText==='function'?unitText('length'):'m'}</text>`;
      svg.appendChild(g);
    });
  }

  function installBeamPatch(){
    const base=window.renderBeam;
    if(typeof base!=='function'||base.__internalHingeVisual)return;
    function wrapped(){base();requestAnimationFrame(()=>{patchBeam();patchHingeDimensions()});}
    wrapped.__internalHingeVisual=true;window.renderBeam=wrapped;
    setTimeout(()=>{patchBeam();patchHingeDimensions()},0);
  }

  installInput();installPayload();installValidate();installStyles();installBeamPatch();
  setTimeout(()=>{installInput();installPayload();installValidate();if(typeof window.renderInputs==='function')window.renderInputs()},0);
})();

/* Internal hinge visual adapter.
 * An internal hinge is ONLY an open circle intersecting the beam.
 * Never draw a pin/roller/ground/badge for the same support.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v), isHinge=s=>s?.type==='internal-hinge';

  function installInput(){
    const base=window.renderInputs;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      base();
      $$('#supportRows select[data-k="type"]').forEach(sel=>{
        if(!sel.querySelector('option[value="internal-hinge"]')){
          const opt=document.createElement('option'); opt.value='internal-hinge'; opt.textContent='Internal Hinge'; sel.appendChild(opt);
        }
        const s=(model.supports||[]).find(x=>String(x.id)===String(sel.dataset.sup));
        if(s)sel.value=s.type;
        const settlement=sel.closest('tr')?.querySelector('input[data-k="settlement"]');
        if(settlement){ settlement.disabled=isHinge(s); if(isHinge(s))settlement.value=0; }
      });
    }
    wrapped.__internalHinge=true; window.renderInputs=wrapped;
  }

  function installPayload(){
    const base=window.payload;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      const p=base();
      p.supports=(model.supports||[]).map(s=>({type:s.type,position:n(s.position),settlement:n(s.settlement||0)}));
      return p;
    }
    wrapped.__internalHinge=true; window.payload=wrapped;
  }

  function installValidate(){
    const base=window.validate;
    if(typeof base!=='function'||base.__internalHinge)return;
    function wrapped(){
      const errors=base();
      const L=typeof len==='function'?n(len()):0;
      (model.supports||[]).filter(isHinge).forEach(s=>{
        const p=n(s.position);
        if(p<=1e-8||p>=L-1e-8)errors.push(`Internal hinge at ${p} must be inside the beam, not at an end.`);
      });
      return [...new Set(errors)];
    }
    wrapped.__internalHinge=true; window.validate=wrapped;
  }

  function installStyles(){
    if(document.getElementById('internal-hinge-v1-style'))return;
    const style=document.createElement('style'); style.id='internal-hinge-v1-style';
    style.textContent=`
      #supportRows select[data-k="type"]{min-width:138px}
      #supportRows input[data-k="settlement"]:disabled{opacity:.45;cursor:not-allowed}
      #beamCanvas .internalHingeCircle{fill:var(--card);stroke:var(--text);stroke-width:2;vector-effect:non-scaling-stroke}
      #beamCanvas .internalHingeName{fill:var(--text);font-size:12px;font-weight:600}
      #beamCanvas .internalHingePosition{fill:var(--muted);font-size:10px}
    `;
    document.head.appendChild(style);
  }

  function removeNormalHingeSupport(svg,s,index){
    let cx=null;
    const id=String(s.id);
    const groups=$$('g.supportDrag[data-drag="support"]');
    for(const g of groups){
      const gid=g.getAttribute('data-id');
      const text=(g.textContent||'').replace(/\s+/g,' ');
      if(String(gid)===id || text.includes(`S${index+1} (Pin)`) || text.includes(`S${index+1} (Roller)`) || text.includes(`S${index+1} (Fixed)`)){
        const badge=g.querySelector('.supportBadge');
        if(badge)cx=n(badge.getAttribute('cx'));
        g.remove();
      }
    }
    return cx;
  }

  function patchBeam(){
    const canvas=$('#beamCanvas'), svg=canvas?.querySelector('svg');
    if(!svg||typeof model==='undefined')return;

    const hinges=(model.supports||[]).filter(isHinge);
    svg.querySelectorAll('.internalHingeGraphic').forEach(e=>e.remove());

    // Use the beam's actual rendered geometry, not a second hard-coded
    // coordinate system. This keeps the hinge exactly on the beam at every
    // zoom/size/model length.
    const beam=svg.querySelector('.beamLine');
    const bx1=beam?n(beam.getAttribute('x1')):72;
    const bx2=beam?n(beam.getAttribute('x2')):1128;
    const by=beam?n(beam.getAttribute('y1')):112;
    const total=Math.max(typeof len==='function'?n(len()):1,1);
    const modelX=p=>bx1+Math.max(0,Math.min(total,p))/total*(bx2-bx1);
    const NS='http://www.w3.org/2000/svg';

    hinges.forEach((s,index)=>{
      // Capture the exact support position from the support group before
      // deleting it. This also handles any future renderer coordinate changes.
      const renderedX=removeNormalHingeSupport(svg,s,index);
      const xx=Number.isFinite(renderedX)?renderedX:modelX(n(s.position));

      const g=document.createElementNS(NS,'g');
      g.setAttribute('class','internalHingeGraphic');
      g.setAttribute('pointer-events','none');

      const circle=document.createElementNS(NS,'circle');
      circle.setAttribute('cx',xx); circle.setAttribute('cy',by); circle.setAttribute('r','9');
      circle.setAttribute('class','internalHingeCircle');
      g.appendChild(circle);

      const name=document.createElementNS(NS,'text');
      name.setAttribute('x',xx); name.setAttribute('y',by+48); name.setAttribute('text-anchor','middle');
      name.setAttribute('class','internalHingeName'); name.textContent=`H${index+1} (Internal Hinge)`; g.appendChild(name);

      const pos=document.createElementNS(NS,'text');
      pos.setAttribute('x',xx); pos.setAttribute('y',by+65); pos.setAttribute('text-anchor','middle');
      pos.setAttribute('class','internalHingePosition'); pos.textContent=`@ ${fmt(s.position)} ${unitText('length')}`; g.appendChild(pos);

      svg.appendChild(g);
    });
  }

  function installBeamPatch(){
    const base=window.renderBeam;
    if(typeof base==='function'&&!base.__internalHingeVisual){
      function wrapped(){base();requestAnimationFrame(patchBeam)}
      wrapped.__internalHingeVisual=true; window.renderBeam=wrapped;
    }
    const canvas=$('#beamCanvas');
    if(canvas&&!canvas.__internalHingeObserver){
      const observer=new MutationObserver(()=>requestAnimationFrame(patchBeam));
      observer.observe(canvas,{childList:true,subtree:true});
      canvas.__internalHingeObserver=observer;
    }
    setTimeout(patchBeam,0);
  }

  installInput(); installPayload(); installValidate(); installStyles(); installBeamPatch();
  setTimeout(()=>{installInput();installPayload();installValidate();installBeamPatch();if(typeof window.renderInputs==='function')window.renderInputs();patchBeam();},0);
})();
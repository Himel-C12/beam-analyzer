/* Beam Analyzer — authoritative internal-hinge renderer.
 * Fixes the root renderer, rather than drawing over the native Pin symbol.
 * Loaded last so the app's own renderBeam() uses this supportSvg().
 */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const originalSupportSvg=window.supportSvg;

  window.supportSvg=function(s,x,y){
    if(s && s.type==='internal-hinge'){
      return `<g class="internalHingeNative" pointer-events="none">
        <circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="#35a873" stroke-width="2.5"/>
        <circle cx="${x}" cy="${y}" r="4.5" fill="none" stroke="#35a873" stroke-width="2"/>
      </g>`;
    }
    return originalSupportSvg(s,x,y);
  };

  const originalRenderBeam=window.renderBeam;
  window.renderBeam=function(){
    originalRenderBeam();
    const canvas=document.querySelector('#beamCanvas');
    const svg=canvas?.querySelector('svg');
    if(!svg)return;

    const rows=[...document.querySelectorAll('#supportRows select[data-sup][data-k="type"]')]
      .filter(e=>e.value==='internal-hinge');

    rows.forEach((sel,index)=>{
      const id=String(sel.dataset.sup);
      const group=svg.querySelector(`g.supportDrag[data-id="${CSS.escape(id)}"]`);
      if(!group)return;

      // Remove the generic support decorations that renderBeam adds after supportSvg().
      group.querySelectorAll('.supportBadge,.supportNumber,.supportText,.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector').forEach(e=>e.remove());

      const hinge=group.querySelector('.internalHingeNative');
      if(!hinge)return;

      const circle=hinge.querySelector('circle');
      const x=Number(circle?.getAttribute('cx'));
      const y=Number(circle?.getAttribute('cy'));
      if(!Number.isFinite(x)||!Number.isFinite(y))return;

      const label=document.createElementNS(NS,'text');
      label.setAttribute('x',x);label.setAttribute('y',y+40);
      label.setAttribute('text-anchor','middle');
      label.setAttribute('class','supportText');
      label.textContent=`H${index+1} (Internal Hinge)`;
      group.appendChild(label);

      const pos=document.querySelector(`#supportRows select[data-sup="${CSS.escape(id)}"]`)
        ?.closest('tr')?.querySelector('input[data-k="position"]')?.value;
      const p=document.createElementNS(NS,'text');
      p.setAttribute('x',x);p.setAttribute('y',y+56);
      p.setAttribute('text-anchor','middle');
      p.setAttribute('class','supportText');
      p.textContent=`@ ${pos ?? ''} ${typeof unitText==='function'?unitText('length'):''}`.trim();
      group.appendChild(p);
    });
  };
})();

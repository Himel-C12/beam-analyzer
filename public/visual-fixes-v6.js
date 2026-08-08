/* Beam Analyzer v6 — targeted beam-diagram cleanup.
   - Removes the "sections ×0.7" annotation.
   - Gives CW moment values more clearance from their arrow.
   - Leaves CCW spacing unchanged.
*/
(function(){
  const $=s=>document.querySelector(s);
  const n=v=>Number(v)||0;
  const f=v=>typeof fmt==='function'?fmt(v):String(v);
  const u=k=>typeof unitText==='function'?unitText(k):k;

  function patch(){
    const canvas=$('#beamCanvas');
    if(!canvas||typeof model==='undefined')return;

    // Remove the old annotation if an older renderer still produced it.
    canvas.querySelectorAll('.sectionNote').forEach(el=>el.remove());

    // The renderer places CW and CCW labels using the same baseline.
    // CW's arrow head reaches higher, so move only its label farther upward.
    canvas.querySelectorAll('.momentLabel').forEach(label=>{
      const text=(label.textContent||'').trim();
      if(/\bCW\b/.test(text)&&!/\bCCW\b/.test(text)){
        label.setAttribute('dy','-18');
        label.classList.add('cwMomentValue');
      }else{
        label.removeAttribute('dy');
        label.classList.remove('cwMomentValue');
      }
    });
  }

  const base=window.renderBeam;
  if(typeof base==='function'&&!base.__v6BeamCleanup){
    function wrapped(){
      base();
      requestAnimationFrame(patch);
    }
    wrapped.__v6BeamCleanup=true;
    window.renderBeam=wrapped;
  }

  const style=document.createElement('style');
  style.textContent=`
    #beamCanvas .sectionNote{display:none!important}
    #beamCanvas .momentLabel.cwMomentValue{dy:-18}
  `;
  document.head.appendChild(style);

  setTimeout(patch,0);
  setTimeout(patch,100);
  setTimeout(patch,300);
})();

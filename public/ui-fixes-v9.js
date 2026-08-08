/* Beam Analyzer v9 — complete diagram value toggle + CW moment label spacing. */
(function(){
  const $=s=>document.querySelector(s);

  function setValueVisibility(show){
    const root=document.documentElement;
    root.classList.toggle('hideDiagramValues',!show);
    document.body?.classList.toggle('hideDiagramValues',!show);
    const b=$('#valueNotationToggle');
    if(b){
      b.classList.toggle('off',!show);
      b.setAttribute('aria-pressed',String(show));
      b.innerHTML=`<span aria-hidden="true">${show?'◉':'○'}</span> Values`;
    }
    try{localStorage.setItem('ba-show-values',show?'1':'0')}catch{}
  }

  function installValueToggle(){
    const b=$('#valueNotationToggle');
    if(!b)return;
    /* v8 owns the original onclick. Replace it so one click means one state change. */
    b.onclick=null;
    b.addEventListener('click',()=>{
      const hidden=document.documentElement.classList.contains('hideDiagramValues');
      setValueVisibility(hidden);
    });
    let saved='1';
    try{saved=localStorage.getItem('ba-show-values')??'1'}catch{}
    setValueVisibility(saved!=='0');
  }

  function fixCwMomentSpacing(){
    const canvas=$('#beamCanvas');
    if(!canvas)return;
    canvas.querySelectorAll('g.loadDrag').forEach(g=>{
      const label=g.querySelector('.momentLabel');
      if(!label)return;
      const text=(label.textContent||'').trim();
      if(/\bCW\b/.test(text) && !/\bCCW\b/.test(text)){
        label.setAttribute('transform','translate(0,-18)');
        label.classList.add('cwMomentValue');
      }else{
        label.removeAttribute('transform');
        label.classList.remove('cwMomentValue');
      }
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    /* Values toggle: hide numerical/value annotations, while retaining axes,
       diagram geometry, support/load markers and dimensions. */
    :root.hideDiagramValues #charts .cleanDiagramValue,
    :root.hideDiagramValues #charts .cleanDiagramAnnotations,
    :root.hideDiagramValues #charts .chartTooltip,
    :root.hideDiagramValues #charts svg text:not(.chartTick):not(.chartAxisTitle){display:none!important}

    :root.hideDiagramValues #beamCanvas .pointLabel,
    :root.hideDiagramValues #beamCanvas .udlLabel,
    :root.hideDiagramValues #beamCanvas .momentLabel,
    :root.hideDiagramValues #beamCanvas .loadLabel,
    :root.hideDiagramValues #beamCanvas .loadText,
    :root.hideDiagramValues #beamCanvas .redText,
    :root.hideDiagramValues #beamCanvas .purpleText,
    :root.hideDiagramValues #beamCanvas .udlLabelCompact,
    :root.hideDiagramValues #beamCanvas .momentValueCompact,
    :root.hideDiagramValues #beamCanvas .momentDirCompact{display:none!important}

    /* CW arcs pass closer to their label than CCW arcs. Give CW labels an
       extra vertical buffer without moving the arrow or the beam. */
    #beamCanvas .momentLabel.cwMomentValue{transform:translateY(-18px)}
  `;
  document.head.appendChild(style);

  const baseBeam=window.renderBeam;
  if(typeof baseBeam==='function'){
    window.renderBeam=function(){
      baseBeam();
      requestAnimationFrame(fixCwMomentSpacing);
    };
  }

  installValueToggle();
  setTimeout(()=>{installValueToggle();fixCwMomentSpacing()},0);
  setTimeout(()=>{installValueToggle();fixCwMomentSpacing()},150);
  setTimeout(()=>{installValueToggle();fixCwMomentSpacing()},500);
})();

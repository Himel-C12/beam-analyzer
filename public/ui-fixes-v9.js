/* Beam Analyzer v10 — diagram value toggle, feature toggle, and CW spacing. */
(function(){
  const $=s=>document.querySelector(s);
  const root=document.documentElement;

  function setValueVisibility(show){
    root.classList.toggle('hideDiagramValues',!show);
    document.body?.classList.toggle('hideDiagramValues',!show);
    const b=$('#valueNotationToggle');
    if(b){
      b.classList.toggle('off',!show);
      b.setAttribute('aria-pressed',String(show));
      b.innerHTML=`<span aria-hidden="true">${show?'◉':'○'} Values`;
    }
    try{localStorage.setItem('ba-show-values',show?'1':'0')}catch{}
  }

  function savedValueVisibility(){
    try{return (localStorage.getItem('ba-show-values')??'1')!=='0'}catch{return true}
  }

  function applyFeatureVisibility(){
    const feature=$('#featureToggle');
    const on=feature?feature.checked:true;
    root.classList.toggle('hideChartFeatures',!on);
    /* When features are hidden, value annotations are hidden too. When they
       are shown again, restore the user's separate Values-button preference. */
    const showValues=on && savedValueVisibility();
    root.classList.toggle('hideDiagramValues',!showValues);
    document.body?.classList.toggle('hideDiagramValues',!showValues);
    const b=$('#valueNotationToggle');
    if(b){
      b.classList.toggle('off',!showValues);
      b.setAttribute('aria-pressed',String(showValues));
      b.innerHTML=`<span aria-hidden="true">${showValues?'◉':'○'} Values`;
    }
  }

  function installValueToggle(){
    const b=$('#valueNotationToggle');
    if(!b)return;
    if(b.dataset.v10Bound!=='1'){
      b.dataset.v10Bound='1';
      b.onclick=()=>setValueVisibility(!savedValueVisibility());
    }
    applyFeatureVisibility();
  }

  function installFeatureToggle(){
    const b=$('#featureToggle');
    if(!b)return;
    if(b.dataset.v10Bound!=='1'){
      b.dataset.v10Bound='1';
      b.addEventListener('change',()=>{
        applyFeatureVisibility();
        if(typeof window.renderResults==='function')window.renderResults();
      });
    }
    applyFeatureVisibility();
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
    /* Hide chart values injected by chart-fixes-v2, not just the older
       cleanDiagramValue selectors. */
    :root.hideDiagramValues #charts .chartPointAnnotations,
    :root.hideDiagramValues #charts .chartPointValue,
    :root.hideDiagramValues #charts .chartTooltip{display:none!important}

    /* Show features is now the master clean-view switch: guides, markers,
       and numerical chart annotations disappear together when it is off. */
    :root.hideChartFeatures #charts .features,
    :root.hideChartFeatures #charts .chartPointAnnotations,
    :root.hideChartFeatures #charts .chartTooltip{display:none!important}

    /* Keep the original broad selectors for other annotation variants. */
    :root.hideDiagramValues #charts .cleanDiagramValue,
    :root.hideDiagramValues #charts .cleanDiagramAnnotations,
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

    /* CW moment labels get a larger vertical buffer than CCW labels. */
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
  installFeatureToggle();
  fixCwMomentSpacing();
  setTimeout(()=>{installValueToggle();installFeatureToggle();fixCwMomentSpacing()},100);
  setTimeout(()=>{installValueToggle();installFeatureToggle();fixCwMomentSpacing()},400);
})();

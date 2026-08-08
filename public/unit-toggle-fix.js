/* Unit display toggle: preserve every numeric model value exactly.
   Switching SI <-> Imperial changes only the displayed/solver unit system.
   Example: 10 m becomes 10 ft; 10 kN becomes 10 kip.
*/
(function(){
  function updateUnitHeaders(){
    const h=$('#spanRows')?.closest('table')?.querySelectorAll('thead th');
    if(h?.length>=4){
      h[1].textContent='Length';
      h[2].textContent=unit==='SI'?'E (GPa)':'E (ksi)';
      h[3].textContent=unit==='SI'?'I (mm⁴)':'I (in⁴)';
    }
    const s=$('#supportRows')?.closest('table')?.querySelectorAll('thead th');
    if(s?.length>=4)s[3].textContent=unit==='SI'?'Settlement (mm)':'Settlement (in)';
  }

  function switchUnits(next){
    if(next===unit)return;

    // Deliberately DO NOT touch model.spans/supports/loads numeric values.
    // The same entered number is interpreted in the newly selected unit system.
    past.push(clone(model));
    if(past.length>50)past.shift();
    future=[];
    unit=next;
    model.units=next;
    result=null;
    saveLocal();
    render();
    updateUnitHeaders();
    scheduleSolve(100);
  }

  function install(){
    $$('[data-unit]').forEach(b=>{
      b.onclick=()=>switchUnits(b.dataset.unit);
    });
    updateUnitHeaders();
  }

  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=function(){
      originalRender();
      updateUnitHeaders();
    };
  }

  install();
})();

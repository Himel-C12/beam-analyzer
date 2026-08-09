/* Beam Analyzer — input stability fix v1
 * Prevent transient/empty numeric fields from reaching the solver while editing.
 * Keeps the last valid model intact until a complete, finite, in-range value is committed.
 */
(function(){
  const originalRenderInputs = renderInputs;
  const originalScheduleSolve = scheduleSolve;

  function clearTransientError(){
    const e=document.querySelector('#error');
    if(e){e.classList.add('hidden');e.textContent='';}
  }

  function finite(v){return Number.isFinite(Number(v));}
  function inBeam(v){const n=Number(v),L=len();return finite(n)&&L>0&&n>=0&&n<=L;}

  function guardPendingAnalysis(){
    const L=len();
    const invalid=
      model.spans.some(s=>!finite(s.length)||Number(s.length)<=0||!finite(s.E)||Number(s.E)<=0||!finite(s.I)||Number(s.I)<=0)||
      model.supports.some(s=>!finite(s.position)||Number(s.position)<0||Number(s.position)>L||!finite(s.settlement))||
      model.loads.some(l=>{
        if(!finite(l.value)||!finite(l.from))return true;
        if(l.type==='udl')return !finite(l.value2)||!finite(l.to)||Number(l.from)<0||Number(l.to)>L||Number(l.to)<Number(l.from);
        return Number(l.from)<0||Number(l.from)>L;
      });
    if(!invalid)return false;
    clearTimeout(solveTimer);
    solveTimer=null;
    ++solveSeq;
    if(activeController){activeController.abort();activeController=null;}
    setStatus('Editing…','busy');
    return true;
  }

  scheduleSolve=function(delay=420){
    if(guardPendingAnalysis())return;
    return originalScheduleSolve(delay);
  };

  renderInputs=function(){
    originalRenderInputs();
    $$('#loadRows input').forEach(e=>{
      e.onchange=()=>{
        const l=model.loads.find(x=>x.id==e.dataset.load);
        if(!l)return;
        if(e.dataset.k==='from'||e.dataset.k==='to'){
          const n=Number(e.value);
          if(!inBeam(n)){
            e.setCustomValidity('Enter a position within the beam.');
            e.reportValidity?.();
            e.setCustomValidity('');
            clearTransientError();
            guardPendingAnalysis();
            return;
          }
        }else if(!finite(e.value)){
          clearTransientError();
          guardPendingAnalysis();
          return;
        }
        mutate(()=>{
          const target=model.loads.find(x=>x.id==e.dataset.load);
          if(!target)return;
          const n=Number(e.value);
          target[e.dataset.k]=n;
          if(target.type==='point'||target.type==='moment'){
            if(e.dataset.k==='from')target.to=n;
            target.value2=0;
          }
        });
        clearTransientError();
      };
    });
  };
})();

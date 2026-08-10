/* Beam Analyzer — input stability fix v2
 * Keep numeric edits transactional so empty/intermediate values never reach the solver.
 * Applies to span, support, point load, UDL and moment fields.
 */
(function(){
  const originalRenderInputs=renderInputs;
  const originalScheduleSolve=scheduleSolve;

  const clearError=()=>{
    const e=$('#error');
    if(e){e.classList.add('hidden');e.textContent='';}
  };
  const finite=v=>v!==''&&v!==null&&Number.isFinite(Number(v));
  const L=()=>{const n=len();return Number.isFinite(n)&&n>0?n:0};
  const eps=()=>Math.max(1e-9,L()*1e-10);
  const inBeam=v=>finite(v)&&L()>0&&Number(v)>=-eps()&&Number(v)<=L()+eps();
  const clamp=v=>Math.max(0,Math.min(L(),Number(v)));

  function pauseWhileEditing(){
    clearTimeout(solveTimer);solveTimer=null;++solveSeq;
    if(activeController){activeController.abort();activeController=null;}
    setStatus('Editing…','busy');
  }

  function invalidModel(){
    const total=L();
    if(!total)return true;
    if(model.spans.some(s=>!finite(s.length)||Number(s.length)<=0||!finite(s.E)||Number(s.E)<=0||!finite(s.I)||Number(s.I)<=0))return true;
    if(model.supports.some(s=>!inBeam(s.position)||!finite(s.settlement)))return true;
    if(model.loads.some(l=>{
      if(!finite(l.value)||!inBeam(l.from))return true;
      if(l.type==='udl')return !finite(l.value2)||!inBeam(l.to)||Number(l.to)<Number(l.from)-eps();
      return false;
    }))return true;
    return false;
  }

  scheduleSolve=function(delay=420){
    if(invalidModel()){pauseWhileEditing();return;}
    return originalScheduleSolve(delay);
  };

  function reject(e,msg,oldValue){
    if(oldValue!==undefined)e.value=oldValue;
    e.setCustomValidity(msg);e.reportValidity?.();e.setCustomValidity('');
    clearError();pauseWhileEditing();
  }

  function clampDependents(){
    const total=L();if(!total)return;
    model.supports.forEach(s=>{if(finite(s.position))s.position=Math.max(0,Math.min(total,Number(s.position)))});
    model.loads.forEach(l=>{
      if(finite(l.from))l.from=Math.max(0,Math.min(total,Number(l.from)));
      if(l.type==='udl'){
        if(!finite(l.to))l.to=l.from;
        l.to=Math.max(l.from,Math.min(total,Number(l.to)));
      }else{l.to=l.from;l.value2=0;}
    });
  }

  function commit(e){
    const key=e.dataset.k;
    const span=model.spans.find(x=>x.id==e.dataset.s);
    const sup=model.supports.find(x=>x.id==e.dataset.sup);
    const load=model.loads.find(x=>x.id==e.dataset.load);
    const old=span?.[key]??sup?.[key]??load?.[key];

    if(e.tagName!=='SELECT'&&!finite(e.value)){
      reject(e,'Enter a valid number.',old);return;
    }

    if(span){
      const n=Number(e.value);
      if((key==='length'||key==='E'||key==='I')&&n<=0){reject(e,`${key==='length'?'Span length':key} must be greater than zero.`,old);return;}
      mutate(()=>{span[key]=n;if(key==='length')clampDependents()});
      clearError();return;
    }

    if(sup){
      if(key==='type'){mutate(()=>sup.type=e.value);clearError();return;}
      const n=Number(e.value);
      if(key==='position'&&!inBeam(n)){reject(e,'Support position must be within the beam.',old);return;}
      mutate(()=>sup[key]=key==='position'?clamp(n):n);clearError();return;
    }

    if(load){
      if(key==='type'){
        mutate(()=>{load.type=e.value;if(load.type==='point'||load.type==='moment'){load.to=load.from;load.value2=0}});
        clearError();return;
      }
      const n=Number(e.value);
      if(key==='from'&&!inBeam(n)){reject(e,'Load position must be within the beam.',old);return;}
      if(key==='to'&&(load.type!=='udl'||!inBeam(n)||n<Number(load.from)-eps())){
        reject(e,'UDL end position must be within the beam and not before its start.',old);return;
      }
      mutate(()=>{
        if(key==='from')load.from=clamp(n);
        else if(key==='to')load.to=clamp(n);
        else load[key]=n;
        if(load.type==='point'||load.type==='moment'){load.to=load.from;load.value2=0;}
      });
      clearError();
    }
  }

  renderInputs=function(){
    originalRenderInputs();
    $$('#spanRows input,#supportRows input,#supportRows select,#loadRows input,#loadRows select').forEach(e=>{
      e.onchange=()=>commit(e);
      if(e.tagName!=='SELECT')e.addEventListener('input',()=>pauseWhileEditing());
    });
  };
})();

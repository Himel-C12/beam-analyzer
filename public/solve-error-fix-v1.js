/* Beam Analyzer — solve stability fix v2
 * Prevents duplicate/stale solves, retries only transient upstream failures,
 * and gives a useful error when the upstream worker is resource-limited.
 */
(function(){
  const transient=(status,data)=>{
    if([502,503,504].includes(status)) return true;
    const body=`${data?.detail||''} ${data?.upstreamBody||''}`.toLowerCase();
    return body.includes('worker script') || body.includes('resource limits') ||
           body.includes('temporarily unavailable') || body.includes('service unavailable');
  };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  solveNow=async function(){
    const seq=++solveSeq;
    const errs=validate();
    $('#validation').classList.toggle('hidden',!errs.length);
    $('#validation').innerHTML=errs.length?`<b>Fix these:</b><ul>${errs.map(x=>`<li>${x}</li>`).join('')}</ul>`:'';
    if(errs.length){
      result=null;renderResults();setStatus('Needs input','error');return;
    }

    if(activeController) activeController.abort();
    activeController=new AbortController();
    const controller=activeController;
    $('#error').classList.add('hidden');
    const body=JSON.stringify(payload());

    try{
      setStatus('Solving…','busy');
      let lastError=null;

      for(let attempt=0;attempt<2;attempt++){
        if(seq!==solveSeq) return;
        if(attempt){
          setStatus('Retrying…','busy');
          await sleep(900);
          if(seq!==solveSeq) return;
        }

        const r=await fetch(`${API_BASE_URL}/api/beam/solve`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Accept':'application/json'},
          body,
          signal:controller.signal
        });
        const raw=await r.text();
        let data=null;
        try{data=raw?JSON.parse(raw):null}catch{}
        if(seq!==solveSeq) return;

        if(r.ok && data && typeof data==='object'){
          result=data;
          renderResults();
          saveLocal();
          setStatus('Live · solved','ready');
          return;
        }

        let msg=data?.detail||`Analysis failed (HTTP ${r.status}).`;
        if(Array.isArray(data?.issues)&&data.issues.length)
          msg+=' '+data.issues.map(i=>`${i.path||'request'}: ${i.message||'invalid value'}`).join(' · ');
        if(data?.code==='upstream_non_json'){
          const upstream=data.upstreamBody||'';
          msg=`The solver service returned a temporary non-JSON response (HTTP ${data.upstreamStatus||r.status}).`;
          if(/worker script|resource limits/i.test(upstream))
            msg='The solver service temporarily hit its compute limit.';
        }
        if(r.status===401) msg='StructureCalcs rejected the API key. Check the server environment variable.';
        if(r.status===429){
          const retry=r.headers.get('retry-after');
          msg+=' The solver is rate-limited.'+(retry?` Retry after ${retry} seconds.`:'');
        }
        lastError=Error(msg);
        if(!transient(r.status,data)||attempt===1) break;
      }

      throw lastError||Error('Analysis failed.');
    }catch(e){
      if(e.name==='AbortError') return;
      result=null;
      renderResults();
      $('#error').textContent=e.message||'Analysis failed.';
      $('#error').className='message error';
      $('#error').classList.remove('hidden');
      setStatus('Analysis error','error');
    }finally{
      if(seq===solveSeq && activeController===controller) activeController=null;
    }
  };
})();

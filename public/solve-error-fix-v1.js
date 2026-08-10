/* Beam Analyzer — solve error handling fix v1
 * Never leave stale analysis results visible after a failed solve.
 * Also surfaces structured proxy/upstream errors instead of the vague JSON parse message.
 */
(function(){
  const originalSolveNow=solveNow;
  solveNow=async function(){
    const seq=++solveSeq;
    const errs=validate();
    $('#validation').classList.toggle('hidden',!errs.length);
    $('#validation').innerHTML=errs.length?`<b>Fix these:</b><ul>${errs.map(x=>`<li>${x}</li>`).join('')}</ul>`:'';
    if(errs.length){
      result=null;renderResults();setStatus('Needs input','error');return;
    }

    if(activeController)activeController.abort();
    activeController=new AbortController();
    $('#error').classList.add('hidden');

    try{
      setStatus('Solving…','busy');
      const r=await fetch(`${API_BASE_URL}/api/beam/solve`,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload()),signal:activeController.signal
      });
      const raw=await r.text();
      let data=null;
      try{data=raw?JSON.parse(raw):null}catch{}
      if(seq!==solveSeq)return;

      if(!r.ok){
        let msg=data?.detail||`Analysis failed (HTTP ${r.status}).`;
        if(Array.isArray(data?.issues)&&data.issues.length)
          msg+=' '+data.issues.map(i=>`${i.path||'request'}: ${i.message||'invalid value'}`).join(' · ');
        if(data?.code==='upstream_non_json')
          msg+=' The upstream service did not return JSON.'+(data.upstreamBody?` Response: ${data.upstreamBody}`:'');
        if(r.status===401)msg='StructureCalcs rejected the API key. Check the server environment variable.';
        if(r.status===429){const retry=r.headers.get('retry-after');if(retry)msg+=` Retry after ${retry} seconds.`}
        throw Error(msg);
      }

      if(!data||typeof data!=='object'){
        throw Error('The solver returned an empty or non-JSON response.');
      }

      result=data;renderResults();saveLocal();setStatus('Live · solved','ready');
    }catch(e){
      if(e.name==='AbortError')return;
      result=null;
      renderResults();
      $('#error').textContent=e.message||'Analysis failed.';
      $('#error').className='message error';
      $('#error').classList.remove('hidden');
      setStatus('Analysis error','error');
    }finally{
      if(seq===solveSeq)activeController=null;
    }
  };
})();

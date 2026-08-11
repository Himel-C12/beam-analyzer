/* Beam Analyzer — solve stability fix v4
 * Keep one canonical solve schema while preserving point-load angles.
 */
(function(){
  const transient=(status,data)=>{
    if([502,503,504].includes(status))return true;
    const body=`${data?.detail||''} ${data?.upstreamBody||''}`.toLowerCase();
    return body.includes('worker script')||body.includes('resource limits')||body.includes('temporarily unavailable')||body.includes('service unavailable');
  };
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function normalizeSolvePayload(p){
    const out={...p};
    out.loads=(p?.loads||[]).map(l=>{
      const type=l?.type;
      if(type==='point'){
        const position=Number(l.position??l.from??0);
        const value=Number(l.magnitude??l.value??0);
        const angle=Number.isFinite(Number(l.angle))?Number(l.angle):0;
        return {type:'point',value,value2:0,from:position,to:position,angle};
      }
      if(type==='moment'){
        const position=Number(l.position??l.from??0);
        const value=Number(l.magnitude??l.value??0);
        return {type:'moment',value,value2:0,from:position,to:position};
      }
      const from=Number(l.from??0);
      const to=Number(l.to??from);
      const value=Number(l.start??l.value??0);
      const value2=Number(l.end??l.value2??value);
      return {type:'udl',value,value2,from,to};
    });
    return out;
  }

  solveNow=async function(){
    const seq=++solveSeq;
    const errs=validate();
    $('#validation').classList.toggle('hidden',!errs.length);
    $('#validation').innerHTML=errs.length?`<b>Fix these:</b><ul>${errs.map(x=>`<li>${x}</li>`).join('')}</ul>`:'';
    if(errs.length){result=null;renderResults();setStatus('Needs input','error');return;}

    if(activeController)activeController.abort();
    activeController=new AbortController();
    const controller=activeController;
    $('#error').classList.add('hidden');
    const body=JSON.stringify(normalizeSolvePayload(payload()));

    try{
      setStatus('Solving…','busy');
      let lastError=null;
      for(let attempt=0;attempt<2;attempt++){
        if(seq!==solveSeq)return;
        if(attempt){setStatus('Retrying…','busy');await sleep(900);if(seq!==solveSeq)return;}
        const r=await fetch(`${API_BASE_URL}/api/beam/solve`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body,signal:controller.signal});
        const raw=await r.text();
        let data=null;try{data=raw?JSON.parse(raw):null}catch{}
        if(seq!==solveSeq)return;
        if(r.ok&&data&&typeof data==='object'){
          result=data;renderResults();saveLocal();setStatus('Live · solved','ready');return;
        }
        let msg=data?.detail||`Analysis failed (HTTP ${r.status}).`;
        if(Array.isArray(data?.issues)&&data.issues.length)msg+=' '+data.issues.map(i=>`${i.path||'request'}: ${i.message||'invalid value'}`).join(' · ');
        lastError=Error(msg);
        if(!transient(r.status,data)||attempt===1)break;
      }
      throw lastError||Error('Analysis failed.');
    }catch(e){
      if(e.name==='AbortError')return;
      result=null;renderResults();$('#error').textContent=e.message||'Analysis failed.';$('#error').className='message error';$('#error').classList.remove('hidden');setStatus('Analysis error','error');
    }finally{if(seq===solveSeq&&activeController===controller)activeController=null;}
  };
})();

/* Beam Analyzer — final UI + solve-pipeline stabilization.
 * Loaded last. This layer fixes the boundary between the UI model and the
 * deterministic local solver, then repairs the final rendered diagrams.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v), finite=v=>Number.isFinite(n(v));
  const EPS=1e-9;

  function angle(l){const a=n(l?.angle);return Number.isFinite(a)?a:0}
  function ensureModel(){
    if(typeof model==='undefined')return;
    (model.loads||[]).forEach(l=>{
      if(l.type==='point'){
        if(l.angle==null)l.angle=0;
        if(l.to==null)l.to=l.from;
      }
    });
  }

  /* ------------------------------------------------------------------
   * CRITICAL: app.js sends the UI representation (magnitude/position and
   * start/end). The local stiffness solver expects value/from/to. The old
   * payload-normalizer ran too late because local-solver-all-v1 intercepts
   * fetch first. Normalize HERE, before the whole fetch chain is entered.
   * ------------------------------------------------------------------ */
  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input&&input.url)||'';
    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string'){
      return upstreamFetch(input,init);
    }

    try{
      const p=JSON.parse(init.body);
      if(Array.isArray(p.loads)){
        p.loads=p.loads.map(l=>{
          if(l.type==='point'){
            const raw=n(l.magnitude??l.value??0);
            const a=Number.isFinite(n(l.angle))?n(l.angle):0;
            const vertical=raw*Math.cos(a*Math.PI/180);
            const x=n(l.position??l.from);
            return {
              type:'point',
              value:Number.isFinite(vertical)?vertical:raw,
              value2:0,
              from:x,
              to:x,
              magnitude:Number.isFinite(vertical)?vertical:raw,
              position:x
            };
          }
          if(l.type==='moment'){
            const value=n(l.magnitude??l.value??0),x=n(l.position??l.from);
            return {type:'moment',value,value2:0,from:x,to:x,magnitude:value,position:x};
          }
          if(l.type==='udl'){
            const q0=n(l.start??l.value??0),q1=n(l.end??l.value2??q0);
            return {type:'udl',value:q0,value2:q1,from:n(l.from),to:n(l.to)};
          }
          return l;
        });
      }
      return upstreamFetch(input,{...init,body:JSON.stringify(p)});
    }catch(error){
      console.error('Beam Analyzer final payload normalization:',error);
      return upstreamFetch(input,init);
    }
  };

  /* ------------------------------------------------------------------
   * Load table: exactly eight cells, matching the eight headings.
   * ------------------------------------------------------------------ */
  function renderLoadTable(){
    if(typeof model==='undefined')return;
    const table=$('#loadRows')?.closest('table');
    const body=$('#loadRows');
    if(!table||!body)return;

    table.querySelector('thead').innerHTML=`<tr>
      <th>#</th><th>Type</th><th>Value</th><th>Value 2 (UDL)</th>
      <th>Angle (°)</th><th>Position / From</th><th>To (UDL)</th><th></th>
    </tr>`;

    body.innerHTML=(model.loads||[]).map(l=>{
      const point=l.type==='point', moment=l.type==='moment', range=!point&&!moment;
      return `<tr>
        <td>${l.id}</td>
        <td><select data-final-load="${l.id}" data-k="type">
          <option value="point" ${point?'selected':''}>Point</option>
          <option value="udl" ${l.type==='udl'?'selected':''}>UDL / varying</option>
          <option value="moment" ${moment?'selected':''}>Moment</option>
        </select></td>
        <td><input data-final-load="${l.id}" data-k="value" type="number" step="any" value="${l.value??0}"></td>
        <td>${range?`<input data-final-load="${l.id}" data-k="value2" type="number" step="any" value="${l.value2??0}">`:'<span class="tableDash">—</span>'}</td>
        <td>${point?`<input data-final-load="${l.id}" data-k="angle" type="number" step="any" value="${angle(l)}" title="Angle from vertical">`:'<span class="tableDash">—</span>'}</td>
        <td><input data-final-load="${l.id}" data-k="from" type="number" step="any" value="${l.from??0}" aria-label="${point||moment?'Position':'From'}"></td>
        <td>${range?`<input data-final-load="${l.id}" data-k="to" type="number" step="any" value="${l.to??l.from??0}" aria-label="To">`:'<span class="tableDash">—</span>'}</td>
        <td><button class="remove" data-final-del-load="${l.id}">×</button></td>
      </tr>`;
    }).join('');

    $$('[data-final-load]').forEach(el=>{
      el.onchange=()=>{
        if(typeof mutate!=='function')return;
        const id=el.dataset.finalLoad;
        mutate(()=>{
          const l=model.loads.find(x=>String(x.id)===String(id));
          if(!l)return;
          if(el.dataset.k==='type'){
            l.type=el.value;
            if(l.type==='point'||l.type==='moment'){
              l.to=l.from;
              l.value2=0;
              if(l.type==='point'&&l.angle==null)l.angle=0;
            }
          }else if(el.dataset.k==='angle'){
            l.angle=finite(el.value)?n(el.value):0;
          }else{
            l[el.dataset.k]=n(el.value);
            if((l.type==='point'||l.type==='moment')&&el.dataset.k==='from')l.to=l.from;
          }
        });
      };
    });
    $$('[data-final-del-load]').forEach(b=>b.onclick=()=>mutate(()=>{
      model.loads=model.loads.filter(l=>String(l.id)!==String(b.dataset.finalDelLoad));
    }));
  }

  const baseInputs=window.renderInputs;
  window.renderInputs=function(){
    if(typeof baseInputs==='function')baseInputs();
    ensureModel();
    renderLoadTable();
  };

  /* ------------------------------------------------------------------
   * SFD fallback. If another layer returns no usable shear series, rebuild
   * it from the solved reactions and the UI model. This is a safety net,
   * not the primary solver.
   * ------------------------------------------------------------------ */
  function rebuildShear(){
    if(typeof model==='undefined'||typeof result==='undefined'||!result)return[];
    const L=typeof len==='function'?len():0;
    const reactions=Array.isArray(result.reactions)?result.reactions.map(r=>({x:n(r.position),v:n(r.vertical??r.v??0)})).filter(r=>finite(r.x)&&finite(r.v)):[];
    if(!(L>0)||!reactions.length)return[];

    const loads=model.loads||[];
    const points=loads.filter(l=>l.type==='point').map(l=>({x:n(l.from),v:n(l.value)*Math.cos(angle(l)*Math.PI/180)})).filter(p=>finite(p.x)&&finite(p.v));
    const udls=loads.filter(l=>l.type==='udl').map(l=>({a:n(l.from),b:n(l.to),q0:n(l.value),q1:n(l.value2??l.value)})).filter(l=>finite(l.a)&&finite(l.b)&&l.b>l.a+EPS);
    const cuts=[0,L,...reactions.map(r=>r.x),...points.map(p=>p.x),...udls.flatMap(q=>[q.a,q.b])]
      .filter(finite).map(x=>Math.max(0,Math.min(L,x))).sort((a,b)=>a-b)
      .filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>EPS);

    function qArea(q,x){
      const hi=Math.min(x,q.b);if(hi<=q.a+EPS)return 0;
      const z=hi-q.a,m=(q.q1-q.q0)/(q.b-q.a);
      return q.q0*z+m*z*z/2;
    }
    function V(x,strict){
      let v=0;
      reactions.forEach(r=>{if(strict?r.x<x-EPS:r.x<=x+EPS)v+=r.v});
      points.forEach(p=>{if(strict?p.x<x-EPS:p.x<=x+EPS)v+=p.v});
      udls.forEach(q=>{v+=qArea(q,strict?x-EPS:x)});
      return Math.abs(v)<1e-10?0:v;
    }

    const out=[],push=(x,y)=>out.push([+x.toFixed(9),Math.abs(y)<1e-10?0:y]);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1];if(b-a<=EPS)continue;
      push(a,V(a,false));
      for(let k=1;k<12;k++)push(a+(b-a)*k/12,V(a+(b-a)*k/12,false));
      const vl=V(b,true),vr=V(b,false);push(b,vl);if(Math.abs(vl-vr)>1e-8)push(b,vr);
    }
    if(!out.length)push(0,V(0,false));
    return out;
  }

  function shearValid(series){
    if(!Array.isArray(series)||series.length<2)return false;
    return series.some(p=>finite(Array.isArray(p)?p[1]:p?.y)&&Math.abs(n(Array.isArray(p)?p[1]:p.y))>EPS);
  }

  const baseResults=window.renderResults;
  window.renderResults=function(){
    if(typeof result!=='undefined'&&result){
      result.diagrams=result.diagrams||{};
      if(!shearValid(result.diagrams.shear)){
        const s=rebuildShear();
        if(s.length)result.diagrams.shear=s;
      }
    }
    if(typeof baseResults==='function')baseResults();
    requestAnimationFrame(forceSfdVisible);
  };

  function forceSfdVisible(){
    if(typeof result==='undefined'||!result)return;
    const raw=result.diagrams?.shear;
    if(!shearValid(raw))return;
    const card=$('#charts .chart.kind-shear'),svg=card?.querySelector('svg');
    if(!svg)return;
    const s=raw.map(p=>Array.isArray(p)?{x:n(p[0]),y:n(p[1])}:{x:n(p.x),y:n(p.y)})
      .filter(p=>finite(p.x)&&finite(p.y));
    if(s.length<2)return;

    const w=1100,h=330,pad=56,L=Math.max(typeof len==='function'?len():n(svg.dataset.len),1);
    const ys=s.map(p=>p.y),r=Math.max(Math.abs(Math.min(...ys)),Math.abs(Math.max(...ys)),1e-9);
    const min=Math.min(0,Math.min(...ys)-r*.06),max=Math.max(0,Math.max(...ys)+r*.06);
    const sx=x=>pad+(x/L)*(w-2*pad),sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    let d=`M ${sx(s[0].x).toFixed(1)} ${sy(s[0].y).toFixed(1)}`;
    for(let i=1;i<s.length;i++)d+=` L ${sx(s[i].x).toFixed(1)} ${sy(s[i].y).toFixed(1)}`;
    const area=`M ${sx(s[0].x)} ${sy(0)} L ${s.map(p=>`${sx(p.x)} ${sy(p.y)}`).join(' L ')} L ${sx(s[s.length-1].x)} ${sy(0)} Z`;
    svg.dataset.series=JSON.stringify(s.map(p=>[p.x,p.y]));
    svg.dataset.min=String(min);svg.dataset.max=String(max);svg.dataset.len=String(L);
    const line=svg.querySelector('.chartLine'),fill=svg.querySelector('.chartArea');
    if(line){line.setAttribute('d',d);line.setAttribute('stroke','#3b8cff');line.setAttribute('stroke-width','3');line.setAttribute('opacity','1');line.style.visibility='visible'}
    if(fill){fill.setAttribute('d',area);fill.setAttribute('fill','#3b8cff');fill.setAttribute('opacity','.12')}
  }

  const style=document.createElement('style');
  style.textContent=`
    #loadRows td,#loadRows th{vertical-align:middle}
    #loadRows input,#loadRows select{min-width:0;width:100%}
    #loadRows th:nth-child(1),#loadRows td:nth-child(1){width:42px}
    #loadRows th:nth-child(2),#loadRows td:nth-child(2){width:112px}
    #loadRows th:nth-child(3),#loadRows td:nth-child(3){width:110px}
    #loadRows th:nth-child(4),#loadRows td:nth-child(4){width:125px}
    #loadRows th:nth-child(5),#loadRows td:nth-child(5){width:92px}
    #loadRows th:nth-child(6),#loadRows td:nth-child(6){width:125px}
    #loadRows th:nth-child(7),#loadRows td:nth-child(7){width:105px}
    #loadRows th:nth-child(8),#loadRows td:nth-child(8){width:42px}
    .tableDash{display:block;text-align:center;color:var(--muted)}
    #charts .kind-shear .chartLine{visibility:visible!important;display:block!important;opacity:1!important}
  `;
  document.head.appendChild(style);

  ensureModel();
  setTimeout(()=>{
    renderLoadTable();
    if(typeof result!=='undefined'&&result&&typeof window.renderResults==='function')window.renderResults();
  },0);
})();

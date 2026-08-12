/* Beam Analyzer — final UI/diagram corrections.
 * Loaded last so it owns the final rendered state.
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
   * 1. Load table: always render exactly the same 8 cells as the header.
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
        <td><input data-final-load="${l.id}" data-k="value" type="number" step="any" value="${l.value}"></td>
        <td>${range?`<input data-final-load="${l.id}" data-k="value2" type="number" step="any" value="${l.value2??0}">`:'<span class="tableDash">—</span>'}</td>
        <td>${point?`<input data-final-load="${l.id}" data-k="angle" type="number" step="any" value="${angle(l)}" title="Angle from vertical">`:'<span class="tableDash">—</span>'}</td>
        <td><input data-final-load="${l.id}" data-k="from" type="number" step="any" value="${l.from}" aria-label="${point||moment?'Position':'From'}"></td>
        <td>${range?`<input data-final-load="${l.id}" data-k="to" type="number" step="any" value="${l.to??l.from}" aria-label="To">`:'<span class="tableDash">—</span>'}</td>
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
            l.angle=Number.isFinite(n(el.value))?n(el.value):0;
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
   * 2. SFD: rebuild the shear series from reactions + model loads when
   *    the returned/previously patched series is missing or broken.
   * ------------------------------------------------------------------ */
  function rebuildShear(){
    if(typeof model==='undefined'||typeof result==='undefined'||!result)return[];
    const L=typeof len==='function'?len():0;
    const reactions=Array.isArray(result.reactions)?result.reactions.map(r=>({x:n(r.position),v:n(r.vertical??r.v??0)})).filter(r=>finite(r.x)&&finite(r.v)):[];
    if(!(L>0)||!reactions.length)return[];

    const loads=(model.loads||[]);
    const points=loads.filter(l=>l.type==='point').map(l=>({x:n(l.from),v:n(l.value)*Math.cos(angle(l)*Math.PI/180)})).filter(p=>finite(p.x)&&finite(p.v));
    const udls=loads.filter(l=>l.type==='udl').map(l=>({a:n(l.from),b:n(l.to),q0:n(l.value),q1:n(l.value2??l.value)})).filter(l=>finite(l.a)&&finite(l.b)&&l.b>l.a+EPS);
    const cuts=[0,L,...reactions.map(r=>r.x),...points.map(p=>p.x),...udls.flatMap(q=>[q.a,q.b])]
      .filter(finite).map(x=>Math.max(0,Math.min(L,x))).sort((a,b)=>a-b)
      .filter((x,i,a)=>i===0||Math.abs(x-a[i-1])>EPS);

    function qArea(q,x){
      const lo=q.a,hi=Math.min(x,q.b); if(hi<=lo+EPS)return 0;
      const m=(q.q1-q.q0)/(q.b-q.a);
      const z=hi-lo;
      return q.q0*z+m*z*z/2;
    }
    function leftV(x,strict){
      let v=0;
      reactions.forEach(r=>{if(strict?r.x<x-EPS:r.x<=x+EPS)v+=r.v});
      points.forEach(p=>{if(strict?p.x<x-EPS:p.x<=x+EPS)v+=p.v});
      udls.forEach(q=>{v+=qArea(q,strict?x-EPS:x)});
      return Math.abs(v)<1e-10?0:v;
    }

    const out=[];
    const push=(x,y)=>out.push([+x.toFixed(9),Math.abs(y)<1e-10?0:y]);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1];
      if(b-a<=EPS)continue;
      push(a,leftV(a,false));
      const steps=12;
      for(let k=1;k<steps;k++){
        const x=a+(b-a)*k/steps;
        push(x,leftV(x,false));
      }
      const vl=leftV(b,true),vr=leftV(b,false);
      push(b,vl);
      if(Math.abs(vl-vr)>1e-8)push(b,vr);
    }
    if(!out.length)push(0,leftV(0,false));
    return out;
  }

  function shearLooksValid(series){
    if(!Array.isArray(series)||series.length<2)return false;
    return series.some(p=>finite(Array.isArray(p)?p[1]:p?.y) && Math.abs(n(Array.isArray(p)?p[1]:p.y))>EPS);
  }

  function forceSfdVisible(){
    if(typeof result==='undefined'||!result)return;
    result.diagrams=result.diagrams||{};
    let series=result.diagrams.shear;
    if(!shearLooksValid(series)){
      const rebuilt=rebuildShear();
      if(rebuilt.length)result.diagrams.shear=rebuilt;
    }

    const card=$('#charts .chart.kind-shear');
    const svg=card?.querySelector('svg');
    if(!svg)return;
    const raw=result.diagrams.shear;
    if(!shearLooksValid(raw))return;

    const s=raw.map(p=>Array.isArray(p)?{x:n(p[0]),y:n(p[1])}:{x:n(p.x),y:n(p.y)})
      .filter(p=>finite(p.x)&&finite(p.y));
    if(s.length<2)return;

    const w=1100,h=330,pad=56,L=Math.max(typeof len==='function'?len():n(svg.dataset.len),1);
    const ys=s.map(p=>p.y),r=Math.max(Math.abs(Math.min(...ys)),Math.abs(Math.max(...ys)),1e-9);
    const min=Math.min(0,Math.min(...ys)-r*.06),max=Math.max(0,Math.max(...ys)+r*.06);
    const sx=x=>pad+(x/L)*(w-2*pad), sy=y=>h-pad-(y-min)/(max-min||1)*(h-2*pad);
    let d='M '+sx(s[0].x).toFixed(1)+' '+sy(s[0].y).toFixed(1);
    for(let i=1;i<s.length;i++)d+=' L '+sx(s[i].x).toFixed(1)+' '+sy(s[i].y).toFixed(1);
    let area=`M ${sx(s[0].x)} ${sy(0)} L `+s.map(p=>`${sx(p.x)} ${sy(p.y)}`).join(' L ')+` L ${sx(s[s.length-1].x)} ${sy(0)} Z`;

    svg.dataset.series=JSON.stringify(s.map(p=>[p.x,p.y]));
    svg.dataset.min=String(min);svg.dataset.max=String(max);svg.dataset.len=String(L);
    const line=svg.querySelector('.chartLine'), fill=svg.querySelector('.chartArea');
    if(line){line.setAttribute('d',d);line.setAttribute('stroke','#3b8cff');line.setAttribute('stroke-width','3');line.setAttribute('opacity','1');}
    if(fill){fill.setAttribute('d',area);fill.setAttribute('fill','#3b8cff');fill.setAttribute('opacity','.12');}
  }

  const baseResults=window.renderResults;
  window.renderResults=function(){
    if(typeof result!=='undefined'&&result){
      result.diagrams=result.diagrams||{};
      if(!shearLooksValid(result.diagrams.shear)){
        const s=rebuildShear();
        if(s.length)result.diagrams.shear=s;
      }
    }
    if(typeof baseResults==='function')baseResults();
    requestAnimationFrame(forceSfdVisible);
  };

  /* Make the load table stable even if an older patch re-renders it. */
  const style=document.createElement('style');
  style.textContent=`
    #loadRows td,#loadRows th{vertical-align:middle}
    #loadRows input,#loadRows select{min-width:0;width:100%;}
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
    if(typeof result!=='undefined'&&result){
      if(typeof window.renderResults==='function')window.renderResults();
      else forceSfdVisible();
    }
  },0);
})();

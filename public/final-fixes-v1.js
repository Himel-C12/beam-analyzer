/* Beam Analyzer — final UI/input cleanup.
 * Diagram data is owned by local-solver-all-v2.js.
 * This file must not mutate solve results or chart geometry.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const finite=v=>Number.isFinite(n(v));
  const angle=l=>finite(l?.angle)?n(l.angle):0;

  function ensureModel(){
    if(typeof model==='undefined')return;
    (model.loads||[]).forEach(l=>{
      if(l.type==='point'){
        if(l.angle==null)l.angle=0;
        if(l.to==null)l.to=l.from;
      }
    });
  }

  /* Keep point-load angle in the canonical payload. */
  const basePayload=window.payload;
  if(typeof basePayload==='function'){
    window.payload=function(){
      const p=basePayload();
      if(Array.isArray(p.loads)&&typeof model!=='undefined'){
        let pointIndex=0;
        p.loads=p.loads.map(l=>{
          if(l.type!=='point')return l;
          const src=(model.loads||[]).filter(x=>x.type==='point')[pointIndex++];
          return {...l,angle:angle(src)};
        });
      }
      return p;
    };
  }

  function renderLoadTable(){
    if(typeof model==='undefined')return;
    const table=$('#loadRows')?.closest('table'),body=$('#loadRows');
    if(!table||!body)return;
    const head=table.querySelector('thead');
    if(head)head.innerHTML=`<tr><th>#</th><th>Type</th><th>Value</th><th>Value 2 (UDL)</th><th>Angle (°)</th><th>Position / From</th><th>To (UDL)</th><th></th></tr>`;
    body.innerHTML=(model.loads||[]).map(l=>{
      const point=l.type==='point',moment=l.type==='moment',range=!point&&!moment;
      return `<tr>
        <td>${l.id}</td>
        <td><select data-final-load="${l.id}" data-k="type"><option value="point" ${point?'selected':''}>Point</option><option value="udl" ${l.type==='udl'?'selected':''}>UDL / varying</option><option value="moment" ${moment?'selected':''}>Moment</option></select></td>
        <td><input data-final-load="${l.id}" data-k="value" type="number" step="any" value="${l.value??0}"></td>
        <td>${range?`<input data-final-load="${l.id}" data-k="value2" type="number" step="any" value="${l.value2??0}">`:'<span class="tableDash">—</span>'}</td>
        <td>${point?`<input data-final-load="${l.id}" data-k="angle" type="number" step="any" value="${angle(l)}" title="Angle from vertical">`:'<span class="tableDash">—</span>'}</td>
        <td><input data-final-load="${l.id}" data-k="from" type="number" step="any" value="${l.from??0}" aria-label="${point||moment?'Position':'From'}"></td>
        <td>${range?`<input data-final-load="${l.id}" data-k="to" type="number" step="any" value="${l.to??l.from??0}" aria-label="To">`:'<span class="tableDash">—</span>'}</td>
        <td><button class="remove" data-final-del-load="${l.id}">×</button></td>
      </tr>`;
    }).join('');

    $$('[data-final-load]').forEach(el=>el.onchange=()=>{
      if(typeof mutate!=='function')return;
      const id=el.dataset.finalLoad;
      mutate(()=>{
        const l=model.loads.find(x=>String(x.id)===String(id));
        if(!l)return;
        if(el.dataset.k==='type'){
          l.type=el.value;
          if(l.type==='point'||l.type==='moment'){l.to=l.from;l.value2=0;if(l.type==='point'&&l.angle==null)l.angle=0;}
        }else if(el.dataset.k==='angle')l.angle=finite(el.value)?n(el.value):0;
        else{l[el.dataset.k]=n(el.value);if((l.type==='point'||l.type==='moment')&&el.dataset.k==='from')l.to=l.from;}
      });
    });
    $$('[data-final-del-load]').forEach(b=>b.onclick=()=>mutate(()=>{model.loads=model.loads.filter(l=>String(l.id)!==String(b.dataset.finalDelLoad));}));
  }

  const baseInputs=window.renderInputs;
  if(typeof baseInputs==='function')window.renderInputs=function(){baseInputs();ensureModel();renderLoadTable();};

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
  `;
  document.head.appendChild(style);
  ensureModel();
  setTimeout(renderLoadTable,0);
})();

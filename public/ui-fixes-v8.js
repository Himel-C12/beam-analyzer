/* Beam Analyzer v8 — clean load table + compact diagram value toggle. */
(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  function rebuildLoadTable(){
    const table=$('#loadRows')?.closest('table');
    const head=table?.querySelector('thead tr');
    const body=$('#loadRows');
    if(!table||!head||!body)return;

    const labels=['#','Type','Value','Value 2 (UDL)','Angle (°)','Position / From','To (UDL)',''];
    while(head.children.length<labels.length) head.appendChild(document.createElement('th'));
    while(head.children.length>labels.length) head.lastElementChild.remove();
    [...head.children].forEach((th,i)=>th.textContent=labels[i]);

    [...body.rows].forEach(row=>{
      const type=row.querySelector('select[data-k="type"]')?.value||'point';
      const getCell=(k)=>row.querySelector(`input[data-k="${k}"]`)?.closest('td');
      const value=getCell('value');
      const value2=getCell('value2');
      const angle=getCell('angle') || row.querySelector('input[data-angular-angle]')?.closest('td');
      const from=getCell('from');
      const to=getCell('to');
      const remove=row.querySelector('[data-del-load]')?.closest('td');
      if(!value||!from||!remove)return;

      const angleCell=angle||document.createElement('td');
      if(!angle){
        angleCell.dataset.v8Angle='1';
        if(type==='point'){
          const input=document.createElement('input');
          input.type='number'; input.step='any'; input.value='0'; input.dataset.angularAngle='1';
          const id=row.querySelector('[data-load]')?.dataset.load;
          input.onchange=()=>{
            if(typeof mutate!=='function'||typeof model==='undefined')return;
            mutate(()=>{const l=model.loads.find(x=>String(x.id)===String(id));if(l)l.angle=Number.isFinite(+input.value)?+input.value:0;});
          };
          angleCell.appendChild(input);
        }
      }

      const cells=[value,value2,angleCell,from,to,remove];
      while(row.children.length>2) row.lastElementChild.remove();
      row.append(...cells.map(c=>c||document.createElement('td')));

      if(type!=='udl' && value2) value2.innerHTML='';
      if(type!=='point') angleCell.innerHTML='';
      if(type==='point' || type==='moment'){
        if(to) to.innerHTML='';
      }
      if(type==='udl' && !value2){
        const td=document.createElement('td');
        const l=typeof model!=='undefined'?(model.loads||[]).find(x=>String(x.id)===String(row.querySelector('[data-load]')?.dataset.load)):null;
        const input=document.createElement('input');input.type='number';input.step='any';input.value=l?.value2??0;input.dataset.load=row.querySelector('[data-load]')?.dataset.load||'';input.dataset.k='value2';
        input.onchange=()=>{if(typeof mutate!=='function'||typeof model==='undefined')return;mutate(()=>{const x=model.loads.find(z=>String(z.id)===String(input.dataset.load));if(x)x.value2=+input.value;});};
        td.appendChild(input); row.insertBefore(td,angleCell);
      }
    });
  }

  function installLoadTablePatch(){
    const base=window.renderInputs;
    if(typeof base!=='function'||base.__v8)return;
    function patched(){base();rebuildLoadTable();}
    patched.__v8=true; window.renderInputs=patched;
    setTimeout(rebuildLoadTable,0);
  }

  function installValueToggle(){
    const head=$('.diagramHead .diagramTools');
    if(!head||$('#valueNotationToggle'))return;
    const b=document.createElement('button');
    b.id='valueNotationToggle';
    b.className='valueNotationToggle';
    b.type='button';
    b.setAttribute('aria-pressed','true');
    b.title='Show or hide diagram value notations';
    b.innerHTML='<span aria-hidden="true">◉</span> Values';
    head.insertBefore(b,head.firstChild);
    const key='ba-show-values';
    const saved=localStorage.getItem(key);
    const apply=on=>{
      document.documentElement.classList.toggle('hideDiagramValues',!on);
      b.classList.toggle('off',!on);
      b.setAttribute('aria-pressed',String(on));
      b.innerHTML=`<span aria-hidden="true">${on?'◉':'○'}</span> Values`;
      localStorage.setItem(key,on?'1':'0');
    };
    b.onclick=()=>apply(!document.documentElement.classList.contains('hideDiagramValues'));
    apply(saved!=='0');
  }

  const style=document.createElement('style');
  style.textContent=`
    #loadRows td{vertical-align:middle}
    #loadRows input,#loadRows select{min-width:76px}
    #loadRows td:nth-child(3){min-width:105px}
    #loadRows td:nth-child(4){min-width:125px}
    #loadRows td:nth-child(5){min-width:92px}
    #loadRows td:nth-child(6),#loadRows td:nth-child(7){min-width:112px}
    #loadRows td:empty{min-width:0;width:1px;padding-left:3px;padding-right:3px}
    .diagramTools .valueNotationToggle{padding:5px 9px;font-size:10px;line-height:1;border-radius:7px;min-height:27px}
    .diagramTools .valueNotationToggle.off{opacity:.62}
    .diagramTools .valueNotationToggle span{font-size:9px;margin-right:3px}
    :root.hideDiagramValues #charts .cleanDiagramAnnotations{display:none!important}
    :root.hideDiagramValues #charts .chartTooltip{display:none!important}
  `;
  document.head.appendChild(style);

  installLoadTablePatch();
  installValueToggle();
  setTimeout(()=>{installLoadTablePatch();rebuildLoadTable();installValueToggle();},50);
  setTimeout(()=>{rebuildLoadTable();installValueToggle();},250);
})();

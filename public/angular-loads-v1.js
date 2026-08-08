/* Beam Analyzer — optional angular point loads.
   Angle convention: measured from the existing vertical load direction.
   0° = current behaviour. Positive angles rotate clockwise in the diagram.
   The beam solver is vertical-load based, so the transverse component
   Fv = F cos(theta) is sent to StructureCalcs; the horizontal component
   is not included in the current beam/Axial-force solver.
*/
(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const n=v=>Number(v);
  const safeAngle=v=>Number.isFinite(n(v))?n(v):0;
  const verticalComponent=(value,angle)=>n(value)*Math.cos(safeAngle(angle)*Math.PI/180);

  function ensureAngles(){
    if(typeof model==='undefined'||!Array.isArray(model.loads))return;
    model.loads.forEach(l=>{if(l.type==='point'&&l.angle==null)l.angle=0;});
  }

  // Add the Angle column after the point-load value without disturbing
  // the existing UDL/moment columns or their event handlers.
  const baseRenderInputs=window.renderInputs;
  if(typeof baseRenderInputs==='function'){
    window.renderInputs=function(){
      ensureAngles();
      baseRenderInputs();
      const table=$('#loadRows')?.closest('table');
      const head=table?.querySelector('thead tr');
      if(!head)return;
      if(!head.querySelector('[data-angle-head]')){
        const th=document.createElement('th');
        th.dataset.angleHead='1';
        th.textContent='Angle (°)';
        const valueTh=[...head.children].find(x=>x.textContent.trim()==='Value');
        if(valueTh)valueTh.after(th);else head.appendChild(th);
      }
      $$('#loadRows tr').forEach(row=>{
        const type=row.querySelector('select[data-k="type"]')?.value;
        const valueCell=[...row.children].find(c=>c.querySelector('input[data-k="value"]'));
        if(!valueCell)return;
        const old=row.querySelector('[data-angular-cell]');
        if(old)old.remove();
        const td=document.createElement('td');
        td.dataset.angularCell='1';
        if(type==='point'){
          const loadId=row.querySelector('[data-load]')?.dataset.load;
          const load=(typeof model!=='undefined'&&model.loads||[]).find(l=>String(l.id)===String(loadId));
          const input=document.createElement('input');
          input.type='number';input.step='any';input.value=safeAngle(load?.angle);
          input.title='Angle measured from the existing vertical load direction; 0° keeps the current behaviour.';
          input.setAttribute('aria-label','Point load angle in degrees');
          input.dataset.angularAngle='1';
          input.onchange=()=>{
            if(typeof mutate!=='function'||typeof model==='undefined')return;
            mutate(()=>{
              const l=model.loads.find(x=>String(x.id)===String(loadId));
              if(l)l.angle=safeAngle(input.value);
            });
          };
          td.appendChild(input);
        }
        row.children[valueCell.cellIndex]?.after(td);
      });
      const note=table?.parentElement?.querySelector('.angularLoadNote');
      if(!note&&table){
        const p=document.createElement('div');
        p.className='angularLoadNote';
        p.textContent='Point-load angle: measured from the existing vertical direction. 0° = unchanged; non-zero angles use the vertical component F cos(θ).';
        table.parentElement.appendChild(p);
      }
    };
  }

  // The upstream beam API accepts scalar vertical point loads, not a beam
  // point-force angle. Convert only the outgoing request, never the saved model.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(/\/api\/beam\/(solve|diagram)(?:\?|$)/.test(url)&&init?.body){
        const payload=JSON.parse(init.body);
        if(Array.isArray(payload.loads)){
          payload.loads=payload.loads.map(l=>{
            if(l.type!=='point')return l;
            const angle=safeAngle(l.angle);
            if(Math.abs(angle)<1e-12)return l;
            const out={...l};
            delete out.angle;
            out.value=verticalComponent(l.value,angle);
            out.value2=0;
            return out;
          });
          return nativeFetch(input,{...init,body:JSON.stringify(payload)});
        }
      }
    }catch(e){
      console.warn('Angular point-load adapter:',e);
    }
    return nativeFetch(input,init);
  };

  // Make the setup diagram show the actual direction of an angled point load.
  function patchBeamDiagram(){
    const canvas=$('#beamCanvas');
    if(!canvas||typeof model==='undefined')return;
    const svg=canvas.querySelector('svg');
    if(!svg)return;
    const arrows=$$('.pointArrow');
    const labels=$$('.pointLabel');
    const points=(model.loads||[]).filter(l=>l.type==='point');
    points.forEach((l,i)=>{
      const a=arrows[i],label=labels[i];
      const angle=safeAngle(l.angle);
      if(!a)return;
      if(Math.abs(angle)>1e-9){
        const x=Number(a.getAttribute('x2'));
        const y=Number(a.getAttribute('y2'));
        a.setAttribute('transform',`rotate(${angle} ${x} ${y})`);
        if(label){
          const raw=label.textContent||'';
          if(!raw.includes('°'))label.textContent=`${raw} @ ${Math.abs(angle)}°`;
          label.setAttribute('transform',`rotate(${angle} ${x} ${y})`);
        }
      }else if(label){
        label.removeAttribute('transform');
      }
    });
  }

  const baseBeam=window.renderBeam;
  if(typeof baseBeam==='function'){
    window.renderBeam=function(){baseBeam();requestAnimationFrame(patchBeamDiagram);};
  }

  const style=document.createElement('style');
  style.textContent=`
    .angularLoadNote{margin-top:8px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:11px;line-height:1.4;background:var(--card)}
    #loadRows input[data-angular-angle]{min-width:74px}
  `;
  document.head.appendChild(style);

  ensureAngles();
  setTimeout(()=>{if(typeof window.renderInputs==='function')window.renderInputs();patchBeamDiagram();},0);
})();

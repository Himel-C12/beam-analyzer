/* Beam Analyzer — angular point loads
 * Angle is measured in degrees from the existing vertical load direction.
 * 0° keeps the normal vertical-load behaviour. The solver receives the
 * vertical component F*cos(theta); the UI still shows the requested angle.
 */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v);
  const safeAngle=v=>Number.isFinite(num(v))?num(v):0;

  function ensureAngles(){
    if(typeof model==='undefined'||!Array.isArray(model.loads))return;
    model.loads.forEach(l=>{if(l.type==='point'&&l.angle==null)l.angle=0;});
  }

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
        if(valueTh)valueTh.after(th); else head.appendChild(th);
      }

      $$('#loadRows tr').forEach(row=>{
        const type=row.querySelector('select[data-k="type"]')?.value;
        const valueCell=[...row.children].find(c=>c.querySelector('input[data-k="value"]'));
        if(!valueCell)return;
        row.querySelector('[data-angular-cell]')?.remove();

        const td=document.createElement('td');
        td.dataset.angularCell='1';

        if(type==='point'){
          const loadId=row.querySelector('[data-load]')?.dataset.load;
          const load=(typeof model!=='undefined'&&Array.isArray(model.loads))
            ? model.loads.find(l=>String(l.id)===String(loadId)) : null;

          const input=document.createElement('input');
          input.type='number';
          input.step='any';
          input.value=safeAngle(load?.angle);
          input.title='Angle measured from the existing vertical direction. 0° = unchanged.';
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

      if(table&&!table.parentElement.querySelector('.angularLoadNote')){
        const p=document.createElement('div');
        p.className='angularLoadNote';
        p.textContent='Point-load angle is measured from the existing vertical direction. 0° = unchanged; the solver uses F cos(θ) as the vertical component.';
        table.parentElement.appendChild(p);
      }
    };
  }

  /*
   * Conversion is intentionally NOT done in a fetch wrapper here.
   * public/payload-normalizer-v1.js is the single conversion layer. This
   * prevents multiple wrappers from converting or restoring the force.
   */

  function patchBeamDiagram(){
    const canvas=$('#beamCanvas');
    if(!canvas||typeof model==='undefined')return;
    const svg=canvas.querySelector('svg');
    if(!svg)return;

    const arrows=$$('.pointArrow');
    const labels=$$('.pointLabel');
    const points=(model.loads||[]).filter(l=>l.type==='point');

    points.forEach((l,i)=>{
      const arrow=arrows[i];
      const label=labels[i];
      if(!arrow)return;
      const angle=safeAngle(l.angle);

      if(Math.abs(angle)>1e-9){
        const x=Number(arrow.getAttribute('x2'));
        const y=Number(arrow.getAttribute('y2'));
        if(Number.isFinite(x)&&Number.isFinite(y)){
          arrow.setAttribute('transform',`rotate(${angle} ${x} ${y})`);
        }
        if(label){
          const raw=(label.textContent||'').replace(/\s*@\s*-?\d+(?:\.\d+)?°/g,'');
          label.textContent=`${raw} @ ${Math.abs(angle)}°`;
          label.removeAttribute('transform');
        }
      }else if(label){
        label.removeAttribute('transform');
      }
    });
  }

  const baseBeam=window.renderBeam;
  if(typeof baseBeam==='function'){
    window.renderBeam=function(){
      baseBeam();
      requestAnimationFrame(patchBeamDiagram);
    };
  }

  const style=document.createElement('style');
  style.textContent=`
    .angularLoadNote{margin-top:8px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:11px;line-height:1.4;background:var(--card)}
    #loadRows input[data-angular-angle]{min-width:74px}
  `;
  document.head.appendChild(style);

  ensureAngles();
  setTimeout(()=>{
    if(typeof window.renderInputs==='function')window.renderInputs();
    patchBeamDiagram();
  },0);
})();

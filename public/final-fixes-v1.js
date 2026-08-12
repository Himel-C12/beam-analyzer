/* Beam Analyzer — consolidated final stability/diagram pass.
 *
 * This is intentionally the last browser patch in the page. Older v1/v2/v3
 * fixes are left in place for compatibility, but this layer owns the final
 * payload, input and diagram normalization so later wrappers cannot undo it.
 */
(function(){
  'use strict';

  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const num=v=>Number(v);
  const finite=v=>Number.isFinite(num(v));
  const EPS=1e-7;

  function safeAngle(v){
    const n=num(v);
    return Number.isFinite(n)?n:0;
  }

  function ensureModelShape(){
    if(typeof model==='undefined'||!Array.isArray(model.loads))return;
    model.loads.forEach(l=>{
      if(!l)return;
      if(l.type==='point' && l.angle==null)l.angle=0;
      if(l.type==='point' && l.to==null)l.to=l.from;
    });
  }

  /* Keep point-load angle in the actual model and expose it in the table. */
  const baseRenderInputs=window.renderInputs;
  if(typeof baseRenderInputs==='function'){
    window.renderInputs=function(){
      ensureModelShape();
      baseRenderInputs();

      const table=$('#loadRows')?.closest('table');
      const head=table?.querySelector('thead tr');
      if(head && ![...head.children].some(th=>/angle/i.test(th.textContent||''))){
        const th=document.createElement('th');
        th.textContent='Angle (°)';
        const value2=[...head.children].find(th=>/Value 2/i.test(th.textContent||''));
        if(value2)value2.before(th); else head.appendChild(th);
      }

      $$('#supportRows select[data-k="type"]').forEach(select=>{
        if(![...select.options].some(o=>o.value==='internal-hinge')){
          const opt=document.createElement('option');
          opt.value='internal-hinge';
          opt.textContent='Internal hinge';
          select.appendChild(opt);
        }
        const sid=select.dataset.sup;
        const support=(typeof model!=='undefined'&&Array.isArray(model.supports))
          ?model.supports.find(s=>String(s.id)===String(sid)):null;
        if(support)select.value=support.type;
      });

      $$('#loadRows tr').forEach(row=>{
        const select=row.querySelector('select[data-k="type"]');
        const idEl=row.querySelector('[data-load]');
        const id=idEl?.dataset.load;
        const load=(typeof model!=='undefined'&&Array.isArray(model.loads))
          ?model.loads.find(l=>String(l.id)===String(id)):null;
        if(!load)return;

        let cell=row.querySelector('[data-final-angle-cell]');
        if(!cell){
          cell=document.createElement('td');
          cell.dataset.finalAngleCell='1';
          const valueCell=row.querySelector('input[data-k="value"]')?.closest('td');
          const value2Cell=row.querySelector('input[data-k="value2"]')?.closest('td');
          if(value2Cell)value2Cell.before(cell);
          else if(valueCell)valueCell.after(cell);
          else if(select?.closest('td'))select.closest('td').after(cell);
          else row.appendChild(cell);
        }

        cell.innerHTML='';
        if(load.type==='point'){
          const input=document.createElement('input');
          input.type='number';
          input.step='any';
          input.value=safeAngle(load.angle);
          input.dataset.finalAngle='1';
          input.title='Angle from the vertical load direction. 0° = vertical.';
          input.setAttribute('aria-label','Point load angle in degrees');
          input.style.minWidth='72px';
          input.addEventListener('change',()=>{
            if(typeof mutate!=='function')return;
            mutate(()=>{
              const l=model.loads.find(x=>String(x.id)===String(id));
              if(l)l.angle=safeAngle(input.value);
            });
          });
          cell.appendChild(input);
        }else{
          cell.innerHTML='<span style="color:var(--muted)">—</span>';
        }
      });

      ensureModelShape();
    };
  }

  /* Fix angular point-load graphics using the renderer's real class names. */
  const baseRenderBeam=window.renderBeam;
  if(typeof baseRenderBeam==='function'){
    window.renderBeam=function(){
      baseRenderBeam();
      requestAnimationFrame(()=>{
        const canvas=$('#beamCanvas');
        const svg=canvas?.querySelector('svg');
        if(!svg||typeof model==='undefined')return;

        const pointLoads=(model.loads||[]).filter(l=>l.type==='point');
        const arrows=[...svg.querySelectorAll('.pointLoad')];
        const labels=[...svg.querySelectorAll('.loadText.redText')];

        pointLoads.forEach((l,i)=>{
          const angle=safeAngle(l.angle);
          const arrow=arrows[i];
          const label=labels[i];
          if(!arrow)return;

          const x2=num(arrow.getAttribute('x2'));
          const y2=num(arrow.getAttribute('y2'));
          if(finite(x2)&&finite(y2)){
            arrow.setAttribute('transform',Math.abs(angle)>EPS
              ?`rotate(${angle} ${x2} ${y2})`:'' );
          }

          if(label){
            const raw=String(Math.abs(num(l.value)));
            label.textContent=Math.abs(angle)>EPS
              ?`${raw} ${typeof unitText==='function'?unitText('force'):'kN'} @ ${Math.abs(angle)}°`
              :`${raw} ${typeof unitText==='function'?unitText('force'):'kN'}`;
          }
        });

        /* Internal hinges are releases, not external supports. */
        (model.supports||[]).filter(s=>s.type==='internal-hinge').forEach(s=>{
          const g=svg.querySelector(`g[data-id="${CSS.escape(String(s.id))}"]`);
          if(!g)return;
          g.querySelectorAll('.supportTriangle,.rollerWheel,.groundLine,.hatch,.fixedWall,.beamConnector')
            .forEach(el=>el.remove());

          const badge=g.querySelector('.supportBadge');
          const cx=badge?num(badge.getAttribute('cx')):0;
          const cy=badge?num(badge.getAttribute('cy'))+4:108;
          const ns='http://www.w3.org/2000/svg';

          const circle=document.createElementNS(ns,'circle');
          circle.setAttribute('cx',String(cx));
          circle.setAttribute('cy',String(cy));
          circle.setAttribute('r','10');
          circle.setAttribute('class','internalHingeSymbol');
          g.insertBefore(circle,g.firstChild);

          const line=document.createElementNS(ns,'line');
          line.setAttribute('x1',String(cx-15));
          line.setAttribute('x2',String(cx+15));
          line.setAttribute('y1',String(cy+15));
          line.setAttribute('y2',String(cy+15));
          line.setAttribute('class','groundLine');
          g.insertBefore(line,g.firstChild);

          const text=[...g.querySelectorAll('.supportText')][0];
          if(text)text.textContent=`Internal hinge · ${fmt(s.position)} ${unitText('length')}`;
        });
      });
    };
  }

  /* Preserve angular point-load information before the existing normalizer. */
  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string' ? input : (input&&input.url)||'';
    if(!url.includes('/api/beam/solve') || !init || typeof init.body!=='string'){
      return upstreamFetch(input,init);
    }

    let outgoing=init;
    try{
      const p=JSON.parse(init.body);
      ensureModelShape();
      if(Array.isArray(p.loads) && typeof model!=='undefined'){
        p.loads=p.loads.map((l,i)=>{
          const src=Array.isArray(model.loads)?model.loads[i]:null;
          if(l?.type==='point'){
            return {
              ...l,
              angle:safeAngle(src?.angle),
              position:num(l.position??l.from),
              from:num(l.from??l.position),
              to:num(l.to??l.position),
              magnitude:num(l.magnitude??l.value)
            };
          }
          return l;
        });
      }
      outgoing={...init,body:JSON.stringify(p)};
    }catch(e){
      console.warn('Beam Analyzer final payload pass:',e);
    }

    const response=await upstreamFetch(input,outgoing);

    /* Repair equal-x SFD/BMD jump ordering after all upstream diagram patches. */
    try{
      const data=await response.clone().json();
      const loads=(typeof model!=='undefined'&&Array.isArray(model.loads))?model.loads:[];
      const points=loads.filter(l=>l.type==='point').map(l=>num(l.from)).filter(finite);
      const moments=loads.filter(l=>l.type==='moment').map(l=>num(l.from)).filter(finite);

      const repair=(series,positions)=>{
        if(!Array.isArray(series)||series.length<2||!positions.length)return series;
        let out=series.map(p=>Array.isArray(p)
          ?[num(p[0]),num(p[1])]
          :[num(p?.x??p?.position),num(p?.y??p?.value)])
          .filter(p=>finite(p[0])&&finite(p[1]));

        for(const x of [...new Set(positions)]){
          let left=null,right=null;
          for(const p of out){
            if(p[0]<x-EPS && (!left||p[0]>left[0]))left=p;
            if(p[0]>x+EPS && (!right||p[0]<right[0]))right=p;
          }
          if(!left||!right)continue;
          out=out.filter(p=>Math.abs(p[0]-x)>EPS);
          out.push([x,left[1]],[x,right[1]]);
        }

        return out.map((p,i)=>({p,i})).sort((a,b)=>{
          const dx=a.p[0]-b.p[0];
          return Math.abs(dx)>EPS?dx:a.i-b.i;
        }).map(x=>x.p);
      };

      if(data?.diagrams){
        data.diagrams.shear=repair(data.diagrams.shear,points);
        data.diagrams.moment=repair(data.diagrams.moment,moments);
      }

      return new Response(JSON.stringify(data),{
        status:response.status,
        statusText:response.statusText,
        headers:new Headers(response.headers)
      });
    }catch(e){
      return response;
    }
  };

  function patchCharts(){
    const charts=$('#charts');
    if(!charts)return;
    charts.querySelectorAll('svg[data-kind]').forEach(svg=>{
      const kind=svg.dataset.kind;
      if(kind!=='shear'&&kind!=='moment')return;
      let series;
      try{series=JSON.parse(svg.dataset.series||'[]')}catch{return}
      if(!Array.isArray(series)||series.length<2)return;

      const arr=series.map(p=>({
        x:num(Array.isArray(p)?p[0]:p?.x),
        y:num(Array.isArray(p)?p[1]:p?.y)
      })).filter(p=>finite(p.x)&&finite(p.y));
      const positions=(typeof model!=='undefined'&&Array.isArray(model.loads))
        ?model.loads.filter(l=>kind==='shear'?l.type==='point':l.type==='moment')
          .map(l=>num(l.from)).filter(finite):[];

      for(const x of positions){
        const same=arr.map((p,i)=>({p,i})).filter(o=>Math.abs(o.p.x-x)<=EPS);
        if(same.length<2)continue;
        const left=arr.filter(p=>p.x<x-EPS).sort((a,b)=>b.x-a.x)[0];
        const right=arr.filter(p=>p.x>x+EPS).sort((a,b)=>a.x-b.x)[0];
        if(!left||!right)continue;

        const first=Math.min(...same.map(o=>o.i));
        const cleaned=arr.filter(p=>Math.abs(p.x-x)>EPS);
        const insertAt=Math.min(first,cleaned.length);
        cleaned.splice(insertAt,0,{x,y:left.y},{x,y:right.y});
        arr.splice(0,arr.length,...cleaned);
      }
      svg.dataset.series=JSON.stringify(arr.map(p=>[p.x,p.y]));
    });
  }

  const charts=$('#charts');
  if(charts){
    const observer=new MutationObserver(()=>requestAnimationFrame(patchCharts));
    observer.observe(charts,{childList:true,subtree:true});
  }

  const style=document.createElement('style');
  style.textContent=`
    #loadRows input[data-final-angle]{min-width:72px}
    #beamCanvas .internalHingeSymbol{fill:var(--card,#fff);stroke:currentColor;stroke-width:2}
  `;
  document.head.appendChild(style);

  ensureModelShape();
  setTimeout(()=>{
    if(typeof window.renderInputs==='function')window.renderInputs();
    if(typeof window.renderBeam==='function')window.renderBeam();
  },0);
})();

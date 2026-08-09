/* Critical beam sections.
   Dangerous section = where SFD changes sign (V crosses zero).
   The corresponding BMD value is read at the same x-position.
   Contraflexure points are BMD zero-crossings.
*/
(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const num=v=>Number(v),finite=v=>Number.isFinite(num(v));
function fmt(v,d=3){if(!finite(v))return '—';if(Math.abs(num(v))<1e-10)return '0';return new Intl.NumberFormat(undefined,{maximumFractionDigits:d}).format(num(v));}
function units(k){const si=(typeof unit!=='undefined'?unit:'SI')==='SI';return k==='length'?(si?'m':'ft'):k==='moment'?(si?'kN·m':'kip·ft'):(si?'kN':'kip');}
function series(svg){try{return JSON.parse(svg.dataset.series||'[]').map(p=>Array.isArray(p)?{x:+p[0],y:+p[1]}:{x:+p.x,y:+p.y}).filter(p=>finite(p.x)&&finite(p.y));}catch{return[];}}
function scale(svg){const w=1100,h=330,pad=+svg.dataset.pad||56,L=+svg.dataset.len||1,min=+svg.dataset.min,max=+svg.dataset.max;return{w,h,pad,L,min,max,sx:x=>pad+x/L*(w-2*pad),sy:y=>h-pad-(y-min)/(max-min||1)*(h-2*pad)};}
function nearest(a,x){return a.reduce((b,p)=>Math.abs(p.x-x)<Math.abs(b.x-x)?p:b,a[0]);}
function interp(a,x){if(!a.length)return null;if(x<=a[0].x)return a[0].y;if(x>=a.at(-1).x)return a.at(-1).y;for(let i=0;i<a.length-1;i++){const p=a[i],q=a[i+1];if(x>=p.x&&x<=q.x){if(q.x===p.x)return q.y;const t=(x-p.x)/(q.x-p.x);return p.y+t*(q.y-p.y);}}return nearest(a,x).y;}
function zeroCrossings(a){const out=[];for(let i=0;i<a.length-1;i++){const p=a[i],q=a[i+1];if(q.x<=p.x+1e-9)continue;if(Math.abs(p.y)<1e-10){if(p.x>1e-8&&p.x<a.at(-1).x-1e-8)out.push(p.x);continue;}if(p.y*q.y<0){const t=-p.y/(q.y-p.y);out.push(p.x+t*(q.x-p.x));}}return out.filter((x,i)=>i===0||Math.abs(x-out[i-1])>1e-5);}
function add(g,tag,attrs,text){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!=null)e.textContent=text;g.appendChild(e);return e;}
function annotate(svg){
 if(svg.querySelector('.criticalAnnotations'))return;
 const kind=svg.dataset.kind;
 if(kind!=='shear'&&kind!=='moment')return;
 const s=series(svg);if(!s.length)return;
 const f=scale(svg),g=add(svg,'g',{'class':'criticalAnnotations'});
 const toggle=$('#featureToggle');if(toggle&&!toggle.checked)return;
 if(kind==='shear'){
   const dangerXs=zeroCrossings(s);
   dangerXs.forEach((x,i)=>{
     const xx=f.sx(x),yy=f.sy(0);
     add(g,'line',{x1:xx,x2:xx,y1:f.pad,y2:f.h-f.pad,class:'dangerLine'});
     add(g,'circle',{cx:xx,cy:yy,r:5,class:'dangerDot'});
     const labelY=yy<70?yy+28:yy-20;
     add(g,'text',{x:xx,y:labelY,'text-anchor':'middle',class:'dangerLabel'},`Dangerous section · ${fmt(x)} ${units('length')}`);
     add(g,'text',{x:xx,y:labelY+(yy<70?16:-16),'text-anchor':'middle',class:'dangerValue'},`V = 0 ${units('force')}`);
   });
 }
 if(kind==='moment'){
   // Dangerous section(s) are determined from the SFD, not from max |M|.
   const sv=($$('#charts svg[data-kind="shear"]')[0]);
   const ss=sv?series(sv):[];
   const dangerXs=zeroCrossings(ss);
   dangerXs.forEach((x,i)=>{
     const y=interp(s,x),xx=f.sx(x),yy=f.sy(y);
     add(g,'line',{x1:xx,x2:xx,y1:f.pad,y2:f.h-f.pad,class:'dangerMomentLine'});
     add(g,'circle',{cx:xx,cy:yy,r:5,class:'dangerMomentDot'});
     const above=y>=0;
     const labelY=above?Math.max(18,yy-24):Math.min(f.h-f.pad-28,yy+38);
     add(g,'text',{x:xx,y:labelY,'text-anchor':'middle',class:'dangerMomentLabel'},`Dangerous section · ${fmt(x)} ${units('length')}`);
     add(g,'text',{x:xx,y:labelY+(above?16:-16),'text-anchor':'middle',class:'dangerMomentValue'},`M = ${fmt(y)} ${units('moment')}`);
   });
   // Keep the actual BMD zero-crossings as contraflexure points.
   zeroCrossings(s).forEach((x,i)=>{
     const xx=f.sx(x),yy=f.sy(0),labelY=(i%2===0)?Math.max(18,yy-20):Math.min(f.h-f.pad-18,yy+34);
     add(g,'line',{x1:xx,x2:xx,y1:f.pad+10,y2:f.h-f.pad,class:'cfLine'});
     add(g,'circle',{cx:xx,cy:yy,r:5,class:'cfDot'});
     add(g,'text',{x:xx,y:labelY,'text-anchor':'middle',class:'cfLabel'},`C.F. · ${fmt(x)} ${units('length')}`);
   });
 }
}
const style=document.createElement('style');style.textContent=`
.criticalAnnotations{pointer-events:none}
.dangerLine,.dangerMomentLine{vector-effect:non-scaling-stroke;stroke:#ef4444;stroke-width:1.8;stroke-dasharray:5 4;opacity:.95}
.dangerMomentLine{stroke:#ef4444}
.dangerDot,.dangerMomentDot{vector-effect:non-scaling-stroke;fill:#ef4444;stroke:#101214;stroke-width:2}
.cfLine{vector-effect:non-scaling-stroke;stroke:#a78bfa;stroke-width:1.35;stroke-dasharray:5 4;opacity:.8}
.cfDot{vector-effect:non-scaling-stroke;fill:#a78bfa;stroke:#101214;stroke-width:2}
.dangerLabel,.dangerMomentLabel,.cfLabel,.dangerValue,.dangerMomentValue{font-size:11px;font-weight:700;paint-order:stroke;stroke:var(--card,#101214);stroke-width:4px;stroke-linejoin:round}
.dangerLabel,.dangerMomentLabel{fill:#ef4444}.dangerValue,.dangerMomentValue{fill:var(--text,#edf2f8);font-weight:600}.cfLabel{fill:#c4b5fd}
`;document.head.appendChild(style);
const charts=$('#charts');if(charts)new MutationObserver(()=>requestAnimationFrame(()=>$$('#charts svg[data-kind]').forEach(annotate))).observe(charts,{childList:true,subtree:true});
requestAnimationFrame(()=>$$('#charts svg[data-kind]').forEach(annotate));
})();

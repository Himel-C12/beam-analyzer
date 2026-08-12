/* Beam Analyzer — native Internal Hinge support option.
   Loaded before app.js so the base renderer itself creates the option.
*/
(function(){
  'use strict';
  const proto=Element.prototype;
  const desc=Object.getOwnPropertyDescriptor(proto,'innerHTML');
  if(!desc||!desc.set||document.documentElement.__hingeNativePreload)return;

  function syncSupportSelects(){
    const rows=document.querySelectorAll('#supportRows tr');
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem('ba-model')||'null');}catch{}
    rows.forEach((tr,i)=>{
      const sel=tr.querySelector('select[data-k="type"]');
      if(!sel)return;
      if(!sel.querySelector('option[value="internal-hinge"]')){
        const opt=document.createElement('option');
        opt.value='internal-hinge';
        opt.textContent='Internal Hinge';
        sel.appendChild(opt);
      }
      const id=sel.dataset.sup;
      const modelSupport=saved?.supports?.find(s=>String(s.id)===String(id));
      if(modelSupport?.type==='internal-hinge')sel.value='internal-hinge';
    });
  }

  Object.defineProperty(proto,'innerHTML',{
    ...desc,
    set:function(value){
      desc.set.call(this,value);
      if(this.id==='supportRows'){
        queueMicrotask(syncSupportSelects);
      }
    }
  });

  document.documentElement.__hingeNativePreload=true;
  document.addEventListener('DOMContentLoaded',syncSupportSelects,{once:true});
})();

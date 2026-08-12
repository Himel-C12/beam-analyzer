/* Final UI cleanup: reuse the existing angular-load cell instead of creating a duplicate. */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  function patch(){
    $$('#loadRows tr').forEach(row=>{
      const angular=row.querySelector('[data-angular-cell]');
      const extra=row.querySelector('[data-final-angle-cell]');
      if(angular&&extra&&angular!==extra){
        const input=extra.querySelector('input[data-final-angle]');
        if(input){
          const old=angular.querySelector('input');
          if(old)old.replaceWith(input);
          else angular.appendChild(input);
        }
        extra.remove();
      }
      const cells=[...row.children];
      const angle=cells.find(c=>c.querySelector('input[data-angular-angle],input[data-final-angle]'));
      const value=cells.find(c=>c.querySelector('input[data-k="value"]'));
      if(angle&&value&&angle.cellIndex!==value.cellIndex+1)value.after(angle);
    });
  }
  const rows=$('#loadRows');
  if(rows)new MutationObserver(()=>requestAnimationFrame(patch)).observe(rows,{childList:true,subtree:true});
  patch();setTimeout(patch,50);setTimeout(patch,250);
})();

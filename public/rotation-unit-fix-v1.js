/* Beam Analyzer — rotation/slope unit label fix.
   Rotation/slope is a dimensionless angular quantity and is displayed in radians.
   The solver already returns rotation in radians; this patch only corrects the
   chart labels that were incorrectly inheriting the force unit (kN/kip).
*/
(function(){
  'use strict';

  function patch(){
    const root=document.querySelector('#charts');
    if(!root)return;

    const headings=[...root.querySelectorAll('h2,h3,h4,strong,div')];
    const heading=headings.find(el=>/ROTATION\s*\/\s*SLOPE/i.test((el.textContent||'').trim()));
    if(!heading)return;

    let card=heading;
    for(let i=0;i<6&&card.parentElement;i++){
      const parent=card.parentElement;
      const text=(parent.textContent||'').trim();
      if(parent.querySelector('svg,canvas')||/ROTATION\s*\/\s*SLOPE/i.test(text)){
        card=parent;
        if(parent.querySelector('svg,canvas'))break;
      }else break;
    }

    const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
    const nodes=[];
    let node;
    while((node=walker.nextNode()))nodes.push(node);

    for(const textNode of nodes){
      const old=textNode.nodeValue||'';
      if(!/kN/.test(old))continue;
      textNode.nodeValue=old.replace(/kN(?:·m)?/g,'rad');
    }

    const title=[...card.querySelectorAll('h2,h3,h4,strong')]
      .find(el=>/ROTATION\s*\/\s*SLOPE/i.test((el.textContent||'')));
    if(title&&!/\(rad\)/i.test(title.textContent||'')){
      title.textContent=title.textContent.replace(/\s*$/,'')+' (rad)';
    }
  }

  const start=()=>{
    patch();
    const root=document.querySelector('#charts');
    if(root&&!root.__rotationUnitObserver){
      const observer=new MutationObserver(()=>patch());
      observer.observe(root,{childList:true,subtree:true,characterData:true});
      root.__rotationUnitObserver=true;
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  setTimeout(patch,100);
  setTimeout(patch,500);
})();

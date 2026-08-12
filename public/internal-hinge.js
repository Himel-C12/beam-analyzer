(function(){
  "use strict";
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const STORAGE="ba-model";
  const NS="http://www.w3.org/2000/svg";

  function savedModel(){
    try{return JSON.parse(localStorage.getItem(STORAGE)||"null")}catch{return null}
  }

  function supportType(id){
    const m=savedModel();
    const s=m?.supports?.find(x=>String(x.id)===String(id));
    return s?.type||null;
  }

  function addOptions(){
    $$("#supportRows select[data-k=\"type\"]").forEach(sel=>{
      if(!sel.querySelector("option[value=\"internal-hinge\"]")){
        const o=document.createElement("option");
        o.value="internal-hinge";
        o.textContent="Internal Hinge";
        sel.appendChild(o);
      }
      const type=supportType(sel.dataset.sup);
      if(type==="internal-hinge") sel.value=type;
      const settlement=sel.closest("tr")?.querySelector("input[data-k=\"settlement\"]");
      if(settlement) settlement.disabled=sel.value==="internal-hinge";
    });
  }

  function draw(){
    addOptions();
    const svg=$("#beamCanvas svg");
    const beam=svg?.querySelector(".beamLine");
    if(!svg||!beam)return;
    const by=Number(beam.getAttribute("y1"));
    if(!Number.isFinite(by))return;

    $$("#supportRows select[data-k=\"type\"]").forEach(sel=>{
      const id=sel.dataset.sup;
      if(sel.value!=="internal-hinge")return;
      const g=svg.querySelector(`g.supportDrag[data-id=\"${CSS.escape(String(id))}\"]`);
      if(!g||g.getAttribute("data-internal-hinge")==="true")return;
      const badge=g.querySelector(".supportBadge");
      const x=Number(badge?.getAttribute("cx"));
      if(!Number.isFinite(x))return;
      g.innerHTML="";
      g.classList.add("internal-hinge-native");
      g.setAttribute("data-internal-hinge","true");

      const circle=document.createElementNS(NS,"circle");
      circle.setAttribute("cx",x);
      circle.setAttribute("cy",by);
      circle.setAttribute("r","9");
      circle.setAttribute("fill","var(--card, #fff)");
      circle.setAttribute("stroke","var(--text, #20252b)");
      circle.setAttribute("stroke-width","2");
      circle.setAttribute("vector-effect","non-scaling-stroke");
      g.appendChild(circle);

      const row=sel.closest("tr");
      const pos=row?.querySelector("input[data-k=\"position\"]")?.value||"";
      const name=document.createElementNS(NS,"text");
      name.setAttribute("x",x); name.setAttribute("y",by+45);
      name.setAttribute("text-anchor","middle"); name.setAttribute("class","internal-hinge-label");
      name.textContent="Internal Hinge";
      g.appendChild(name);

      const label=document.createElementNS(NS,"text");
      label.setAttribute("x",x); label.setAttribute("y",by+61);
      label.setAttribute("text-anchor","middle"); label.setAttribute("class","internal-hinge-position");
      label.textContent=`@ ${pos} m`;
      g.appendChild(label);
    });
  }

  const style=document.createElement("style");
  style.textContent=`
    #supportRows select[data-k=\"type\"]{min-width:138px}
    #supportRows input[data-k=\"settlement\"]:disabled{opacity:.45;cursor:not-allowed}
    #beamCanvas .internal-hinge-native{cursor:grab}
    #beamCanvas .internal-hinge-native:active{cursor:grabbing}
    #beamCanvas .internal-hinge-label{fill:var(--text);font:600 12px Inter,system-ui,sans-serif}
    #beamCanvas .internal-hinge-position{fill:var(--muted);font:600 10px Inter,system-ui,sans-serif}
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(()=>requestAnimationFrame(draw));
  observer.observe(document.body,{childList:true,subtree:true});
  [0,100,300,700,1200].forEach(t=>setTimeout(draw,t));
})();

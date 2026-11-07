/* v1.21.1 — Keep native <details> expansion state when HA updates rebuild
   the Shadow DOM. No browser storage, energy writes or model changes.
   Cupra's custom vehicle-details button already uses _cupraDetails, which
   is deliberately left unchanged and checked in the browser regression. */
function eh28DetailEntries(root,view){
 if(!root||typeof root.querySelectorAll!=='function')return [];
 const seen=new Map(),result=[];
 for(const node of root.querySelectorAll('details')){
  const summary=node.querySelector?.(':scope > summary');
  if(!summary)continue;
  // Contract rows have changing computed totals, so identify by contract name.
  const contractName=node.classList?.contains('ehcmp-result')?summary.querySelector('b')?.textContent:'';
  const label=String(contractName||summary.textContent||'').trim().replace(/\s+/g,' ').slice(0,240);
  const base=String(view||'overview')+'|'+String(node.className||'')+'|'+label;
  const nth=seen.get(base)||0;
  seen.set(base,nth+1);
  result.push([base+'|'+nth,node]);
 }
 return result;
}
(function eh28PreserveExpansion(){
 const P=EnergiehuisCard.prototype,previousRender=P._render;
 P._render=function(){
  const root=this.shadowRoot;
  const states=this._eh28Expanded || (this._eh28Expanded=new Map());
  for(const [key,node] of eh28DetailEntries(root,this._eh28RenderedView||this._view)){
   states.set(key,node.open);
  }
  previousRender.call(this);
  // Renderer replaces innerHTML, so restore the state on the new DOM nodes.
  for(const [key,node] of eh28DetailEntries(this.shadowRoot,this._view)){
   if(states.has(key))node.open=states.get(key);
  }
  this._eh28RenderedView=this._view;
 };
})();


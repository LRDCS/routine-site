/* Shared by the local preview and the exported website. No network access. */
window.NightShiftText = function NightShiftText() {
  'use strict';
  const original = new WeakMap();
  let map = window.nightShiftText || {};
  const path = window.nightShiftPage || decodeURIComponent(location.pathname).replace(/^\//, '');
  const pageMap = () => map[path] || {};
  const eligible = node => node.nodeType === 3 && node.textContent.trim() && node.parentElement && !node.parentElement.closest('script,style,noscript,svg,textarea,option,[data-editor-ignore]');
  function base(node) { if (!original.has(node)) original.set(node,node.textContent); return original.get(node); }
  function apply(root = document.body) {
    if (!root) return;
    const nodes = [];
    if (root.nodeType === 3) nodes.push(root);
    else { const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT); while(walker.nextNode()) nodes.push(walker.currentNode); }
    for(const node of nodes) {
      if(!eligible(node)) continue;
      const value = base(node), key = value.trim();
      const replacement = Object.prototype.hasOwnProperty.call(pageMap(),key) ? value.slice(0,value.indexOf(key)) + pageMap()[key] + value.slice(value.indexOf(key)+key.length) : value;
      if(node.textContent !== replacement) node.textContent = replacement;
    }
    if(Object.prototype.hasOwnProperty.call(pageMap(),'__documentTitle')) document.title = pageMap().__documentTitle;
  }
  function scan() {
    const fields = new Map();
    const walker = document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const node = walker.currentNode;
      if(!eligible(node)) continue;
      const key = base(node).trim();
      if(!key || fields.has(key) || /^\d{1,2}:\d{2}$/.test(key)) continue;
      const parent = node.parentElement;
      const area = parent.closest('dialog,section,article,header,footer');
      const label = area?.querySelector('h1,h2')?.textContent || (parent.closest('footer') ? 'Footer' : 'Page text');
      fields.set(key,{key,value:Object.prototype.hasOwnProperty.call(pageMap(),key) ? pageMap()[key] : key,group:label.slice(0,80),tag:parent.tagName.toLowerCase()});
    }
    return Array.from(fields.values());
  }
  window.nightShiftEditorAPI = {scan,apply,base,setMap(value){map=value;apply();}};
  apply();
  new MutationObserver(records => {
    for(const record of records) {
      if(record.type === 'characterData') apply(record.target);
      else record.addedNodes.forEach(node => apply(node));
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
};

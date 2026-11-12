(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const frame = $('#preview');
  const storageKey = 'nightshift-editor-draft-v1';
  let files = new Map(), overrides = {}, page = 'index.html', fields = [], restoreDraft = null;
  let previewUrls = [], dirty = false, savedTimer;
  const status = message => $('#status').textContent = message;
  const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
  const scriptText = text => text.replace(/<\/script/gi,'<\\/script');
  const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
  const cleanMap = value => {
    const result = Object.create(null);
    if(!value || typeof value !== 'object' || Array.isArray(value)) throw Error('This is not a text draft.');
    for(const [path,map] of Object.entries(value)) {
      if(!path.endsWith('.html') || !map || typeof map !== 'object' || Array.isArray(map)) continue;
      result[path]=Object.create(null);
      for(const [key,text] of Object.entries(map)) if(typeof text === 'string') result[path][key]=text;
    }
    return result;
  };
  function saveDraft() {
    dirty=true;
    clearTimeout(savedTimer);
    savedTimer=setTimeout(() => {
      try { localStorage.setItem(storageKey,JSON.stringify({version:1,overrides,updated:new Date().toISOString()})); status('Draft saved in this browser · not published'); }
      catch { status('Draft is in memory only — download a backup before closing.'); }
    },350);
  }
  function download(blob,name) { const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000); }
  function resolvePath(reference,basePage=page) { const url=new URL(reference,`https://portfolio.local/${basePage}`);return decodeURIComponent(url.pathname).replace(/^\//,''); }
  async function content(path) { const file=files.get(path);if(!file)throw Error(`Missing file: ${path}`);return typeof file === 'string' ? file : file.text(); }
  function bridge() {
    const api=window.nightShiftEditorAPI;
    const send = (type,extra={}) => parent.postMessage({nightShiftEditor:true,type,page:window.nightShiftPage,...extra},'*');
    let timer;
    const scan=()=>send('fields',{fields:[{key:'__documentTitle',value:document.title,group:'Browser tab',tag:'title'},...api.scan()]});
    scan();
    new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,120);}).observe(document.body,{childList:true,characterData:true,subtree:true});
    window.addEventListener('message',event=>{if(event.source!==parent || !event.data?.nightShiftEditor)return;if(event.data.type==='update'){api.setMap(event.data.overrides);scan();}});
    document.addEventListener('click',event=>{
      const target=event.target;
      const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()){const key=api.base(walker.currentNode).trim();if(key){send('select',{key});break;}}
      const anchor=target.closest('a');
      if(anchor){const href=anchor.getAttribute('href');if(!href || href.startsWith('#'))return;event.preventDefault();event.stopImmediatePropagation();send('navigate',{href});}
    },true);
    window.addEventListener('error',event=>send('error',{message:event.message}));
    send('ready');
  }
  async function loadPreview() {
    status('Loading preview…');
    previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];
    const doc = new DOMParser().parseFromString(await content(page),'text/html');
    doc.querySelectorAll('base').forEach(node=>node.remove());
    for(const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
      const path=resolvePath(link.getAttribute('href'));
      if(files.has(path)){const style=doc.createElement('style');style.textContent=await content(path);link.replaceWith(style);} else link.remove();
    }
    for(const image of doc.querySelectorAll('img[src]')) {
      const path=resolvePath(image.getAttribute('src'));
      if(files.has(path)){const url=URL.createObjectURL(files.get(path));previewUrls.push(url);image.src=url;}
    }
    // Existing export scripts are replaced with the editor's current draft.
    doc.querySelectorAll('script[data-nightshift-text]').forEach(node=>node.remove());
    const sources=[];
    for(const script of doc.querySelectorAll('script')) {
      const src=script.getAttribute('src');
      if(src){const path=resolvePath(src);if(path.endsWith('site-text.js') || path.endsWith('site-text-runtime.js')){script.remove();continue;}if(files.has(path))sources.push(await content(path));}
      else sources.push(script.textContent);
      script.remove();
    }
    const setup=`window.nightShiftPage=${json(page)};window.nightShiftText=${json(overrides)};`;
    const code=[setup,...sources,`(${window.NightShiftText.toString()})();`,`(${bridge.toString()})();`].join('\n;\n');
    // Appending after HTML guarantees that the homepage script sees its elements.
    const script=doc.createElement('script');script.textContent=scriptText(code);doc.body.append(script);
    frame.srcdoc='<!doctype html>\n'+doc.documentElement.outerHTML;
    frame.hidden=false;$('#preview-empty').hidden=true;
  }
  function renderFields() {
    const query=$('#search').value.trim().toLowerCase();
    const root=$('#fields');root.replaceChildren();
    for(const field of fields) {
      const value=own(overrides[page] || {},field.key) ? overrides[page][field.key] : field.value;
      if(query && !`${field.key} ${value} ${field.group}`.toLowerCase().includes(query))continue;
      const row=document.createElement('div');row.className='field';row.dataset.key=field.key;
      const small=document.createElement('small');small.textContent=field.group;
      const label=document.createElement('label');label.textContent=field.key==='__documentTitle' ? 'Browser tab title' : (field.key.length>85 ? field.key.slice(0,82)+'…' : field.key);
      const input=document.createElement('textarea');input.value=value;input.rows=value.length>160 ? 5 : 2;input.id='text-'+fields.indexOf(field);label.htmlFor=input.id;
      input.addEventListener('input',()=>{
        if(!own(overrides,page))overrides[page]=Object.create(null);
        overrides[page][field.key]=input.value;
        frame.contentWindow.postMessage({nightShiftEditor:true,type:'update',overrides},'*');saveDraft();
      });
      const reset=document.createElement('button');reset.type='button';reset.className='reset';reset.textContent='Restore original text';
      reset.addEventListener('click',()=>{if(overrides[page])delete overrides[page][field.key];input.value=field.key==='__documentTitle' ? field.value : field.key;frame.contentWindow.postMessage({nightShiftEditor:true,type:'update',overrides},'*');saveDraft();});
      row.append(small,label,input,reset);root.append(row);
    }
    if(!root.children.length){const p=document.createElement('p');p.textContent='No matching text. Try another search or open a folder in the preview.';root.append(p);}
  }
  window.addEventListener('message',event=>{
    if(event.source!==frame.contentWindow || !event.data?.nightShiftEditor || event.data.page!==page)return;
    const data=event.data;
    if(data.type==='fields') {
      const changed=JSON.stringify(fields.map(f=>f.key))!==JSON.stringify(data.fields.map(f=>f.key));
      fields=data.fields;
      if(changed)renderFields();
    }
    if(data.type==='ready')status('Preview ready · click text to find its field');
    if(data.type==='error')status('Preview error: '+data.message);
    if(data.type==='select') {
      $('#search').value='';renderFields();
      const row=Array.from($('#fields').children).find(row=>row.dataset.key===data.key);
      if(row){row.classList.add('selected');row.scrollIntoView({block:'nearest',behavior:'smooth'});row.querySelector('textarea').focus({preventScroll:true});}
    }
    if(data.type==='navigate') {
      const path=resolvePath(data.href);
      if(files.has(path) && path.endsWith('.html')) {page=path;$('#page').value=page;fields=[];loadPreview().catch(error=>status(error.message));}
      else status('External/file link kept unchanged. Open it from the actual website.');
    }
  });
  $('#folder').addEventListener('change',async event=>{
    if(!event.target.files.length)return;
    try {
      const selected=new Map();
      for(const file of event.target.files){const path=file.webkitRelativePath.split('/').slice(1).join('/');if(path && !path.split('/').some(p=>p.startsWith('.')))selected.set(path,file);}
      if(!selected.has('index.html'))throw Error('Choose the dist folder itself, not its parent. It must contain index.html.');
      files=selected;page='index.html';fields=[];overrides={};dirty=false;
      if(files.has('site-text.js')){const text=await content('site-text.js');const start=text.indexOf('=');overrides=cleanMap(JSON.parse(text.slice(start+1).trim().replace(/;\s*$/,'')));}
      $('#page').replaceChildren();
      for(const path of Array.from(files.keys()).filter(p=>p.endsWith('.html') && !p.startsWith('editor/')).sort()){const option=document.createElement('option');option.value=path;option.textContent=path==='index.html' ? 'Homepage' : path;$('#page').append(option);}
      $('#page').value=page;$('#welcome').hidden=true;$('#editing').hidden=false;$('#download').disabled=false;
      try {const saved=JSON.parse(localStorage.getItem(storageKey));restoreDraft=saved?.version===1 ? cleanMap(saved.overrides) : null;}catch{restoreDraft=null;}
      $('#draft-banner').hidden=!restoreDraft;
      await loadPreview();
    }catch(error){status(error.message);}
    event.target.value='';
  });
  $('#page').addEventListener('change',()=>{page=$('#page').value;fields=[];$('#search').value='';loadPreview().catch(error=>status(error.message));});
  $('#search').addEventListener('input',renderFields);
  $('#mobile').addEventListener('click',()=>{const on=$('#preview-wrap').classList.toggle('mobile');$('#mobile').setAttribute('aria-pressed',String(on));$('#mobile').textContent=on ? 'Desktop preview' : 'Mobile preview';});
  $('#restore').addEventListener('click',()=>{overrides=restoreDraft;$('#draft-banner').hidden=true;saveDraft();loadPreview().catch(error=>status(error.message));});
  $('#dismiss').addEventListener('click',()=>{$('#draft-banner').hidden=true;restoreDraft=null;});
  $('#backup').addEventListener('click',()=>download(new Blob([JSON.stringify({version:1,overrides},null,2)],{type:'application/json'}),'portfolio-draft.json'));
  $('#import').addEventListener('change',async event=>{try{const value=JSON.parse(await event.target.files[0].text());if(value.version!==1)throw Error('Unknown backup version.');overrides=cleanMap(value.overrides);saveDraft();await loadPreview();}catch(error){status('Backup could not load: '+error.message);}event.target.value='';});
  function exportHTML(text,path) {
    const doc=new DOMParser().parseFromString(text,'text/html');
    doc.querySelectorAll('script[data-nightshift-text]').forEach(node=>node.remove());
    const prefix='../'.repeat(path.split('/').length-1);
    const setup=doc.createElement('script');setup.dataset.nightshiftText='page';setup.textContent=`window.nightShiftPage=${json(path)};`;
    const data=doc.createElement('script');data.dataset.nightshiftText='data';data.src=prefix+'site-text.js';data.defer=true;
    const runtime=doc.createElement('script');runtime.dataset.nightshiftText='runtime';runtime.src=prefix+'site-text-runtime.js';runtime.defer=true;
    doc.head.append(setup,data,runtime);
    // Also update ordinary HTML for readers without JavaScript.
    const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {const node=walker.currentNode;if(node.parentElement.closest('script,style,noscript,svg'))continue;const key=node.textContent.trim();if(own(overrides[path] || {},key))node.textContent=node.textContent.replace(key,()=>overrides[path][key]);}
    if(own(overrides[path] || {},'__documentTitle'))doc.title=overrides[path].__documentTitle;
    return '<!doctype html>\n'+doc.documentElement.outerHTML;
  }
  $('#download').addEventListener('click',async()=>{
    $('#download').disabled=true;status('Packaging all website files…');
    try {
      const output=new Map(files);
      for(const path of files.keys())if(path.endsWith('.html') && !path.startsWith('editor/'))output.set(path,exportHTML(await content(path),path));
      output.set('site-text.js','window.nightShiftText = '+JSON.stringify(overrides,null,2)+';\n');
      output.set('site-text-runtime.js','('+window.NightShiftText.toString()+')();\n');
      output.set('.nojekyll','');
      download(await window.makePortfolioZip(output),'portfolio-updated.zip');
      dirty=false;status('ZIP downloaded · extract it and upload its contents to GitHub');$('#export-help').showModal();
    }catch(error){status('Download failed: '+error.message);}finally{$('#download').disabled=false;}
  });
  $('#close-help').addEventListener('click',()=>$('#export-help').close());
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
})();

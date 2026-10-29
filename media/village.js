'use strict';
const api = acquireVsCodeApi();
window.runegroveApi = api;
const $ = id => document.getElementById(id);
let state;
let children = new Map();
let pending = new Set();
const expanded = new Set();
let saved = api.getState() || {};
let folded = !!saved.folded;
let selectedId = saved.selectedId || '';
const send = (type,id) => api.postMessage({type,id});
function element(tag,className,text) { const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node; }
function button(text,action,className='') {const node=element('button',className,text);node.addEventListener('click',action);return node;}
function notice(message) {$('notice').textContent=message;}
const extension = name => name.includes('.') ? name.split('.').pop().toUpperCase().slice(0,4) : 'FILE';
const fileGlyph = item => item.folder ? '▰' : ({TS:'TS',JS:'JS',JSON:'{}',MD:'▤',PNG:'▧',JPG:'▧',SVG:'◇',CSS:'#',HTML:'<>'}[extension(item.name)] || '▤');
function select(item,persist=true) {
  selectedId=item.id;
  if(persist){saved={...saved,selectedId};api.setState(saved);}
  const copy=$('companion-copy'),task=$('current-task'),step=$('task-select');
  if(copy)copy.textContent=item.folder?`${item.name} is a folder district. Enter it to reveal its files and subdistricts.`:`${item.name} is ready. Open it in the native editor or pin it to your inventory.`;
  if(task)task.textContent=item.folder?`Explore ${item.name}`:`Work with ${item.name}`;
  if(step){step.textContent=item.folder?'Enter the selected district':'Open or pin the selected file';step.classList.add('active');}
  document.querySelectorAll('[data-entry-id]').forEach(node=>node.classList.toggle('selected',node.dataset.entryId===item.id));
}
function render() {
  if(!state)return;
  const query=$('search').value.toLocaleLowerCase();
  const items=state.items.filter(item=>item.name.toLocaleLowerCase().includes(query));
  $('files').replaceChildren();
  function renderRows(rows,depth=0,target=$('files')) {
    for(const item of rows) {
      const row=element('div','file-row');row.style.paddingLeft=(depth*13)+'px';
      const toggle=()=>{if(expanded.has(item.id))expanded.delete(item.id);else expanded.add(item.id);render();};
      const open=button('',()=>{select(item);if(item.folder)toggle();},'file-open');
      open.dataset.entryId=item.id;
      open.addEventListener('dblclick',()=>send(item.folder?'folder':'open',item.id));
      open.addEventListener('keydown',event=>{if(event.key==='Enter' && !item.folder){event.preventDefault();send('open',item.id);}});
      if(item.folder){open.setAttribute('aria-expanded',String(expanded.has(item.id)));open.setAttribute('aria-label',`Select folder ${item.name}. Double click to enter.`);}
      open.append(element('span','chevron',item.folder?(expanded.has(item.id)?'⌄':'›'):''),element('span',item.folder?'file-icon folder-icon':'file-icon',fileGlyph(item)),element('span','filename',item.name));open.title=item.id;
      row.append(open);
      if(!item.folder){const pinned=state.pins.some(p=>p.id===item.id);const pin=button(pinned?'◆':'◇',()=>send('pin',item.id),'pin');pin.setAttribute('aria-label',`${pinned?'Unpin':'Pin'} ${item.name}`);pin.setAttribute('aria-pressed',String(pinned));row.append(pin);}
      target.append(row);
      if(item.folder && expanded.has(item.id)) {
        if(children.has(item.id)){const nested=children.get(item.id);renderRows(nested,depth+1,target);if(!nested.length)target.append(element('p','empty-folder','Empty folder'));}
        else {const loading=element('p','empty-folder','Opening…');target.append(loading);if(!pending.has(item.id)){pending.add(item.id);send('expand',item.id);}}
      }
    }
  }
  renderRows(items);
  if(!items.length)$('files').append(element('p','empty',state.root?(query?'No matching files.':'This district is waiting for its first story.'):'Open a workspace folder to bring Codehaven to life.'));

  $('buildings').replaceChildren();
  const folders=items.filter(item=>item.folder);
  for(const [index,item] of folders.slice(0,6).entries()) {
    const node=button('',()=>send('folder',item.id),'building style-'+index%6);
    node.dataset.entryId=item.id;node.title=`Enter ${item.name}`;
    const art=element('span','building-icon',index===1?'⌘':index===2?'▧':index===3?'△':'▰');art.setAttribute('aria-hidden','true');
    node.append(art,element('span','building-name',item.name),element('span','building-kind','Explore district'));
    $('buildings').append(node);
  }
  if(!folders.length) {
    const empty=element('div','village-empty');empty.append(element('span','empty-rune','◇'),element('h2','',state.root?'A clearing, full of possibility.':'Your village begins here.'),element('p','',state.root?'Files are waiting in the Project Scroll. Folders appear as village districts.':'Open a folder to explore your own workspace.'));
    empty.append(button(state.root?'Open native Explorer':'Open a workspace folder',()=>send('tool',state.root?'files':'openFolder'),'primary'));$('buildings').append(empty);
  }
  if(folders.length>6)$('buildings').append(element('p','district-note',`${folders.length-6} more districts in the scroll`));

  $('pins').replaceChildren();
  for(const item of state.pins) {
    const pin=element('div','inventory-item');const open=button('',()=>send('open',item.id),'inventory-open');open.append(element('span','inventory-glyph',fileGlyph(item)),element('strong','',item.name),element('small','',extension(item.name)));pin.append(open,button('×',()=>send('pin',item.id),'unpin'));pin.lastChild.setAttribute('aria-label','Unpin '+item.name);$('pins').append(pin);
  }
  if(!state.pins.length)$('pins').append(element('span','muted','Select a file in the scroll, then use ◇ to pin it.'));
  const slots=$('inventory-slots');if(slots)slots.hidden=state.pins.length>=4;
  const summary=$('type-summary');if(summary){
    const counts=new Map();for(const item of items.filter(item=>!item.folder)){const key=extension(item.name);counts.set(key,(counts.get(key)||0)+1);}
    summary.replaceChildren(...[...counts].slice(0,4).map(([kind,count])=>{const tile=element('span','type-tile');tile.append(element('strong','',kind),element('small','',String(count)));return tile;}));
  }
  if(selectedId){const selected=items.find(item=>item.id===selectedId);if(selected)select(selected,false);}
}
window.addEventListener('message',event=>{
  const data=event.data;
  if(data.type==='error'){pending.clear();notice(data.message);return;}
  if(data.type==='children'){pending.delete(data.id);children.set(data.id,data.items);render();return;}
  if(data.type!=='state')return;
  if(state?.root!==data.root || state?.path!==data.path){$('search').value='';expanded.clear();selectedId='';}
  children.clear();pending.clear();state=data;
  $('project').textContent=data.project;$('path').textContent=data.path || data.project;$('path').title=data.path || data.project;
  $('host').textContent=data.host==='local'?'LOCAL REALM':data.host+' · REMOTE REALM';
  $('parent').disabled=data.atRoot || !data.root;
  $('roots').replaceChildren(...data.roots.map(root=>{const option=element('option','',root.name);option.value=root.id;return option;}));
  $('roots').value=data.root || '';$('roots').disabled=!data.roots.length;
  $('trust').textContent=data.trusted?'Native editor · Workspace protected':'Restricted Mode · Read-only village';
  document.querySelectorAll('[data-tool]').forEach(node=>{const supported=data.tools.includes(node.dataset.tool);node.disabled=!supported;if(!supported)node.title='Not available in this host; use the native command palette.';});
  notice('');render();
});
document.querySelectorAll('[data-tool]').forEach(node=>node.addEventListener('click',()=>send('tool',node.dataset.tool)));
document.querySelectorAll('[data-station]').forEach(node=>node.addEventListener('click',()=>{const labels={trash:'Trash needs an exact-path review before it can be enabled.',ignore:'Agent Ignore needs a reviewed .cursorignore change before it can be enabled.'};notice(labels[node.dataset.station]||'This station is not available yet.');}));
$('search').addEventListener('input',render);
$('roots').addEventListener('change',()=>send('root',$('roots').value));
$('parent').addEventListener('click',()=>send('parent'));
$('refresh').addEventListener('click',()=>send('refresh'));
function fold(){ $('scroll').classList.toggle('folded',folded);$('fold').setAttribute('aria-expanded',String(!folded));$('fold').textContent=folded?'⌄':'⌃';$('fold').title=folded?'Unroll project scroll':'Roll up project scroll';$('scroll').inert=folded; }
$('fold').addEventListener('click',()=>{folded=!folded;saved={...saved,folded};api.setState(saved);fold();});
document.querySelectorAll('.guild-tool').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)document.querySelectorAll('.guild-tool').forEach(other=>{if(other!==details)other.open=false;});}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelectorAll('details[open]').forEach(details=>{details.open=false;details.querySelector('summary').focus();});notice('');}});
fold();send('ready');

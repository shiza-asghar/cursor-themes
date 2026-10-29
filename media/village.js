'use strict';
const api = acquireVsCodeApi();
const $ = id => document.getElementById(id);
let state;
let children = new Map();
let pending = new Set();
const expanded = new Set();
let saved = api.getState() || {};
let folded = !!saved.folded;
const send = (type,id) => api.postMessage({type,id});
function element(tag,className,text) { const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node; }
function button(text,action,className='') {const node=element('button',className,text);node.addEventListener('click',action);return node;}
function notice(message) {$('notice').textContent=message;}
function render() {
  if(!state)return;
  const query=$('search').value.toLocaleLowerCase();
  const items=state.items.filter(item=>item.name.toLocaleLowerCase().includes(query));
  $('files').replaceChildren();
  function renderRows(rows, depth=0, target=$('files')) {
    for(const item of rows) {
      const row=element('div','file-row');row.style.paddingLeft=(depth*13)+'px';
      const toggle=()=>{if(expanded.has(item.id))expanded.delete(item.id);else expanded.add(item.id);render();};
      const open=button('',item.folder?toggle:()=>send('open',item.id),'file-open');
      if(item.folder) {open.setAttribute('aria-expanded',String(expanded.has(item.id)));open.setAttribute('aria-label',`Toggle folder ${item.name}`);}
      open.append(element('span','chevron',item.folder?(expanded.has(item.id)?'⌄':'›'):''),element('span',item.folder?'file-icon folder-icon':'file-icon',item.folder?'▰':'▤'),element('span','filename',item.name));open.title=item.id;
      row.append(open);
      if(!item.folder) {const pinned=state.pins.some(p=>p.id===item.id);const pin=button(pinned?'◆':'◇',()=>send('pin',item.id),'pin');pin.setAttribute('aria-label',`${pinned?'Unpin':'Pin'} ${item.name}`);pin.setAttribute('aria-pressed',String(pinned));row.append(pin);}
      target.append(row);
      if(item.folder && expanded.has(item.id)) {
        if(children.has(item.id)) {
          const nested=children.get(item.id);renderRows(nested,depth+1,target);
          if(!nested.length)target.append(element('p','empty-folder','Empty folder'));
        } else {
          const loading=element('p','empty-folder','Opening…');target.append(loading);
          if(!pending.has(item.id)){pending.add(item.id);send('expand',item.id);}
        }
      }
    }
  }
  renderRows(items);
  if(!items.length) $('files').append(element('p','empty',state.root?(query?'No matching files.':'This folder is waiting for its first story.'):'Open a workspace folder to bring your village to life.'));
  $('buildings').replaceChildren();
  const folders=items.filter(item=>item.folder);
  for(const [index,item] of folders.slice(0,6).entries()) {
    const node=button('',()=>send('folder',item.id),'building style-'+index%3);
    node.title=item.id;
    const art=element('div','house');art.setAttribute('aria-hidden','true');
    node.append(art,element('span','building-name',item.name),element('span','building-kind','EXPLORE FOLDER  →'));
    $('buildings').append(node);
  }
  if(!folders.length) {
    const empty=element('div','village-empty');empty.append(element('span','empty-rune','◇'),element('h2','',state.root?'A clearing, full of possibility.':'Your village begins here.'),element('p','',state.root?'Files are waiting in the archive. Folders appear here as buildings.':'Open a folder to explore your own woodland workspace.'));
    empty.append(button(state.root?'Open native Explorer ↗':'Open a workspace folder ↗',()=>send('tool',state.root?'files':'openFolder'),'primary'));
    $('buildings').append(empty);
  }
  if(folders.length>6)$('buildings').append(element('p','district-note',`${folders.length-6} more folders in the archive ←`));
  $('pins').replaceChildren();
  for(const item of state.pins) {
    const pin=element('div','inventory-item');pin.append(button('▤ '+item.name,()=>send('open',item.id)),button('×',()=>send('pin',item.id),'unpin'));pin.lastChild.setAttribute('aria-label','Unpin '+item.name);$('pins').append(pin);
  }
  if(!state.pins.length)$('pins').append(element('span','muted','Pin a file from the archive to keep it within reach.'));
}
window.addEventListener('message',event=>{
  const data=event.data;
  if(data.type==='error') {pending.clear();notice(data.message);return;}
  if(data.type==='children') {pending.delete(data.id);children.set(data.id,data.items);render();return;}
  if(data.type!=='state')return;
  if(state?.root!==data.root || state?.path!==data.path) { $('search').value=''; expanded.clear(); }
  children.clear();pending.clear();
  state=data;
  $('project').textContent=data.project;
  $('path').textContent=data.path || data.project;
  $('path').title=data.path || data.project;
  $('host').textContent=`${data.host==='local'?'LOCAL REALM':data.host+' · REMOTE REALM'}`;
  $('parent').disabled=data.atRoot || !data.root;
  $('roots').replaceChildren(...data.roots.map(root=>{const option=element('option','',root.name);option.value=root.id;return option;}));
  $('roots').value=data.root || '';
  $('roots').disabled=!data.roots.length;
  $('trust').textContent=data.trusted?'Native editor · Your workspace stays yours':'Restricted Mode · Read-only village';
  document.querySelectorAll('[data-tool]').forEach(node=>{const supported=data.tools.includes(node.dataset.tool);node.disabled=!supported;node.title=supported?'Open native '+node.dataset.tool:'Not available in this host; use the native command palette.';});
  notice('');render();
});
document.querySelectorAll('[data-tool]').forEach(node=>node.addEventListener('click',()=>send('tool',node.dataset.tool)));
$('search').addEventListener('input',render);
$('roots').addEventListener('change',()=>send('root',$('roots').value));
$('parent').addEventListener('click',()=>send('parent'));
$('refresh').addEventListener('click',()=>send('refresh'));
function fold() { $('scroll').classList.toggle('folded',folded);$('fold').setAttribute('aria-expanded',String(!folded));$('fold').textContent=folded?'Unroll ⌄':'Roll up ⌃';$('scroll').inert=folded; }
$('fold').addEventListener('click',()=>{folded=!folded;saved={...saved,folded};api.setState(saved);fold();});
document.querySelectorAll('.guild-tool').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)document.querySelectorAll('.guild-tool').forEach(other=>{if(other!==details)other.open=false;});}));
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelectorAll('details[open]').forEach(details=>{details.open=false;details.querySelector('summary').focus();});}});
fold();send('ready');

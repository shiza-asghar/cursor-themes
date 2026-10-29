'use strict';
const api = acquireVsCodeApi();
const $ = id => document.getElementById(id);
let state;
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
  for(const item of items) {
    const row=element('div','file-row');
    const open=button('',()=>send(item.folder?'folder':'open',item.id),'file-open');
    open.append(element('span',item.folder?'file-icon folder-icon':'file-icon',item.folder?'▱':'▤'),element('span','filename',item.name));open.title=item.id;
    row.append(open);
    if(!item.folder) {const pinned=state.pins.some(p=>p.id===item.id);const pin=button(pinned?'◆':'◇',()=>send('pin',item.id),'pin');pin.setAttribute('aria-label',`${pinned?'Unpin':'Pin'} ${item.name}`);pin.setAttribute('aria-pressed',String(pinned));row.append(pin);}
    $('files').append(row);
  }
  if(!items.length) $('files').append(element('p','empty',state.root?(query?'No matching files.':'This folder is waiting for its first story.'):'Open a workspace folder to bring your village to life.'));
  $('buildings').replaceChildren();
  const folders=items.filter(item=>item.folder);
  for(const [index,item] of folders.slice(0,6).entries()) {
    const node=button('',()=>send('folder',item.id),'building style-'+index%3);
    node.title=item.id;
    const art=element('div','house');art.setAttribute('aria-hidden','true');
    art.innerHTML='<div class="chimney"></div><div class="roof"></div><div class="house-body"><div class="window left"></div><div class="door"></div><div class="window right"></div><div class="house-rune">◇</div></div><div class="house-step"></div><div class="shrub one"></div><div class="shrub two"></div>';
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
  if(data.type==='error') {notice(data.message);return;}
  if(data.type!=='state')return;
  if(state?.root!==data.root || state?.path!==data.path) $('search').value='';
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
fold();send('ready');

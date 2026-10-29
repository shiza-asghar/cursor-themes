'use strict';
const vscode = require('vscode');
const {escapeHtml,nonce,validMessage,tools} = require('./domain');
function activate(context) {
  let panel;
  function setupView(view,document) {
    let root, current, entries = new Map(), generation = 0, dead = false;
    const pins = new Map();
    const treeEntries = new Map();
    const available = new Set();
    const subscriptions = [];
    let timer;
    const send = data => !dead && view.webview.postMessage(data);
    async function refresh() {
      const version = ++generation;
      const roots = vscode.workspace.workspaceFolders || [];
      if (!root || !roots.some(r => r.uri.toString() === root.uri.toString())) { root = roots[0]; current = root?.uri; }
      try {
        const items = root ? await vscode.workspace.fs.readDirectory(current) : [];
        if (dead || version !== generation) return;
        treeEntries.clear();
        entries = new Map(items.filter(([name])=> name!=='.git').sort((a,b)=> (b[1]&vscode.FileType.Directory)-(a[1]&vscode.FileType.Directory)||a[0].localeCompare(b[0])).map(([name,type])=>{
          const uri=vscode.Uri.joinPath(current,name);return [uri.toString(),{id:uri.toString(),name,folder:!!(type & vscode.FileType.Directory),uri}];
        }));
        send({type:'state',roots:roots.map(r=>({id:r.uri.toString(),name:r.name})),root:root?.uri.toString(),project:root?.name || 'Your next adventure',path:root?vscode.workspace.asRelativePath(current,false):'',atRoot:current?.toString()===root?.uri.toString(),host:vscode.env.remoteName || 'local',trusted:vscode.workspace.isTrusted,items:[...entries.values()].map(({uri,...item})=>item),pins:[...pins.values()].map(({uri,...item})=>item),tools:Object.keys(tools).filter(key=>available.has(tools[key]))});
      } catch(error) { if(version===generation) send({type:'error',message:'Could not read this folder: '+error.message}); }
    }
    view.webview.html = html(view.webview,context.extensionUri,vscode.workspace.getConfiguration('runegrove').get('reduceMotion',false),!!document);
    if(document) subscriptions.push(require('./workshop').connectDocument(vscode,view,document));
    subscriptions.push(view.webview.onDidReceiveMessage(async message => {
      if (!validMessage(message)) return;
      try {
        if(message.type==='ready') { for(const command of await vscode.commands.getCommands(true)) available.add(command); await refresh(); }
        else if(message.type==='refresh') await refresh();
        else if(message.type==='expand') {
          const item=entries.get(message.id) || treeEntries.get(message.id);
          if (!item?.folder) return;
          const snapshot=generation;
          const children=await vscode.workspace.fs.readDirectory(item.uri);
          if(dead || snapshot!==generation) return;
          const rows=children.filter(([name])=>name!=='.git').sort((a,b)=>(b[1]&vscode.FileType.Directory)-(a[1]&vscode.FileType.Directory)||a[0].localeCompare(b[0])).map(([name,type])=>{
            const uri=vscode.Uri.joinPath(item.uri,name);
            const row={id:uri.toString(),name,folder:!!(type&vscode.FileType.Directory),uri};
            treeEntries.set(row.id,row);const {uri:unused,...publicRow}=row;return publicRow;
          });
          send({type:'children',id:item.id,items:rows});
        }
        else if(message.type==='tool') {
          if (!Object.hasOwn(tools,message.id) || !available.has(tools[message.id])) throw Error('This native command is unavailable in this host. Use Cursor’s command palette.');
          await vscode.commands.executeCommand(tools[message.id]);
        } else if(message.type==='root') {
          const chosen=vscode.workspace.workspaceFolders?.find(r=>r.uri.toString()===message.id);
          if(chosen) {root=chosen;current=root.uri;await refresh();}
        } else if(message.type==='parent' && root && current.toString()!==root.uri.toString()) {
          current=current.with({path:current.path.slice(0,current.path.lastIndexOf('/')) || '/'}); await refresh();
        } else if(message.type==='pin') {
          if(pins.has(message.id)) pins.delete(message.id);
          else {const item=entries.get(message.id)||treeEntries.get(message.id);if(item && !item.folder)pins.set(message.id,item);}
          await refresh();
        } else {
          const item=entries.get(message.id) || treeEntries.get(message.id) || (message.type==='open' && pins.get(message.id));
          if(!item) return;
          if(message.type==='folder' && item.folder && entries.has(message.id)) {current=item.uri;await refresh();}
          if(message.type==='open' && !item.folder) await vscode.commands.executeCommand(document?'vscode.openWith':'vscode.open',item.uri,...(document?['runegrove.workshop']:[]));
        }
      } catch(error) { send({type:'error',message:error.message}); }
    }));
    const watcher=vscode.workspace.createFileSystemWatcher('**/*');
    const changed=()=>{clearTimeout(timer);timer=setTimeout(refresh,180);};
    subscriptions.push(watcher,watcher.onDidCreate(changed),watcher.onDidDelete(changed),watcher.onDidChange(changed),vscode.workspace.onDidChangeWorkspaceFolders(changed));
    view.onDidDispose(()=>{dead=true;clearTimeout(timer);for(const subscription of subscriptions)subscription.dispose();if(panel===view)panel=undefined;});
  }
  context.subscriptions.push(vscode.commands.registerCommand('runegrove.openVillage',()=>{
    if(panel){panel.reveal();return;}
    panel=vscode.window.createWebviewPanel('runegrove.village','Codehaven · Village Map',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]});
    setupView(panel);
  }));
  context.subscriptions.push(vscode.window.registerCustomEditorProvider('runegrove.workshop',{
    resolveCustomTextEditor(document,view){
      view.webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]};
      setupView(view,document);
    }
  },{webviewOptions:{retainContextWhenHidden:true}}));
  context.subscriptions.push(vscode.commands.registerCommand('runegrove.openWorkshop',async()=>{
    const uri=vscode.window.activeTextEditor?.document.uri || (await vscode.window.showOpenDialog({canSelectMany:false,openLabel:'Open in Workshop'}))?.[0];
    if(uri)await vscode.commands.executeCommand('vscode.openWith',uri,'runegrove.workshop');
  }));
}
function html(webview,uri,reduced,workshop=false) {
  const token=nonce();
  const asset=name=>escapeHtml(webview.asWebviewUri(vscode.Uri.joinPath(uri,'media',name)).toString());
  const header = `<header class="topbar"><div class="brand"><span class="sigil" aria-hidden="true">⌂</span><strong>CODEHAVEN</strong></div><span class="view-name">${workshop?'The Guild Workshop':'Village Map'}</span><details class="project-menu"><summary><span aria-hidden="true">⑂</span> <span id="project">Opening…</span> <span aria-hidden="true">⌄</span></summary><div class="dropdown"><label for="roots">Workspace realm</label><select id="roots"></select><button data-tool="openFolder">Open another folder</button></div></details><div class="search"><span aria-hidden="true">⌕</span><input id="search" placeholder="Search files, symbols, buildings…" aria-label="Filter current folder"><kbd>Ctrl K</kbd></div><button class="topbar-action" data-tool="files" title="Native Explorer" aria-label="Open native Explorer">▤</button><button class="topbar-action" data-tool="settings" title="Settings" aria-label="Open settings">⚙</button></header>`;
  const projectScroll = `<aside class="project-scroll"><div class="aside-title"><h1>Project Scroll</h1><button id="fold" class="icon-button" aria-expanded="true" aria-controls="scroll" title="Roll up project scroll">⌃</button></div><div id="scroll" class="scroll"><div class="roller top"></div><div class="paper"><div class="pathbar"><button id="parent" aria-label="Parent folder" title="Parent folder">↑</button><span id="path">Reading your workspace…</span><button id="refresh" aria-label="Refresh files" title="Refresh files">↻</button></div><div id="files" class="files" aria-label="Workspace files"></div></div><div class="roller bottom"></div></div><div class="scroll-footer"><span id="host">CONNECTING</span><span id="trust">Your workspace stays yours</span></div></aside>`;
  const workshopMain = `<main class="workshop-main"><section class="manuscript" aria-label="Workshop code editor"><div class="manuscript-tab"><span id="document-name">Opening manuscript…</span><span id="document-status" role="status"></span><button id="save-document">Save</button><button id="native-document">Native editor</button></div><div id="editor" aria-label="Code editor"></div><div class="editor-status"><span id="language">Text</span><span>Codehaven Guild Workshop · Real workspace file</span></div><div id="editor-conflict" hidden role="alert"><span id="conflict-text"></span><button id="reload-document">Reload from host</button></div></section><div class="mage-figure" aria-hidden="true"></div><div id="buildings" hidden></div><section class="tool-roster" aria-label="Guild tools"><div class="roster-title">Guild Roster</div><div class="mage-card"><div class="mage-portrait"></div><strong>The Mage</strong><small>Knowledge & Skills · Online</small><p>Turn ideas into power.</p></div><details class="guild-tool"><summary><span>⚒</span><strong>The Git Smith</strong><small>Version & Forging</small></summary><div class="tool-menu"><p>Review changes, branches, and history in native Source Control.</p><button data-tool="git">Open Source Control</button></div></details><details class="guild-tool"><summary><span>◈</span><strong>Portal Keeper</strong><small>Environments & Realms</small></summary><div class="tool-menu"><p>Use Cursor's command palette to inspect your configured tools.</p><button data-tool="commands">Open Command Palette</button></div></details></section><section class="inventory workshop-inventory"><div class="inventory-title"><span>Inventory</span><small>1–8</small></div><div id="pins" class="pins"></div></section><div id="notice" role="status" aria-live="polite"></div></main>`;
  const villageMain = `<main class="village-main"><div class="map-heading"><span>YOUR PROJECT IS THE WORLD</span><strong>Explore by district</strong></div><div id="buildings" class="buildings" aria-label="Folder districts"></div><aside class="companion-panel" aria-label="Companion"><div class="companion-title"><strong>Companion</strong><span aria-hidden="true">⌃</span></div><div class="companion-portrait" role="img" aria-label="The Codehaven mage"></div><div class="companion-copy"><p id="companion-copy">Choose a folder district or file from the Project Scroll.</p></div><div class="current-task"><span>Current Task</span><strong id="current-task">Explore your workspace</strong><ol><li class="complete">Open the village</li><li id="task-select">Select a file or district</li><li>Choose a guild action</li></ol></div></aside><section class="stations" aria-label="Guild action stations"><button class="station station-trash" data-station="trash"><span class="station-icon">♜</span><strong>Trash</strong><small>Delete files</small></button><button class="station station-ignore" data-station="ignore"><span class="station-icon">▣</span><strong>Agent Ignore</strong><small>Exclude from Agent context</small></button><button class="station station-skills" data-tool="extensions"><span class="station-icon">✧</span><strong>Skills</strong><small>Learn and improve</small></button><button class="station station-git" data-tool="git"><span class="station-icon">⚒</span><strong>Git</strong><small>Commit changes</small></button><button class="station station-mcp" data-tool="commands"><span class="station-icon">◉</span><strong>MCP</strong><small>Connect tools</small></button></section><section class="inventory"><div class="inventory-title"><span>▣ &nbsp; Inventory</span><small>Pin files from the scroll</small></div><div id="pins" class="pins"></div><div id="inventory-slots" class="inventory-slots" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div id="type-summary" class="type-summary"></div></section><div id="notice" role="status" aria-live="polite"></div></main>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${token}';"><link rel="stylesheet" href="${asset('village.css')}"><title>Codehaven · ${workshop?'Guild Workshop':'Village Map'}</title></head><body class="${reduced?'reduce-motion':''} ${workshop?'workshop-mode':'village-mode'}"><div class="realm-shell">${header}<div class="workspace"><div class="world" aria-hidden="true"></div>${projectScroll}${workshop?workshopMain:villageMain}</div></div><script nonce="${token}" src="${asset('village.js')}"></script>${workshop?`<script nonce="${token}" src="${asset('workshop-editor.js')}"></script>`:''}</body></html>`;
}
module.exports={activate,html};

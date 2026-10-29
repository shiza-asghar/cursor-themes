'use strict';
const vscode = require('vscode');
const {escapeHtml,nonce,validMessage,tools} = require('./domain');
function activate(context) {
  let panel;
  context.subscriptions.push(vscode.commands.registerCommand('runegrove.openVillage', () => {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel('runegrove.village','Runegrove · Village',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]});
    const view = panel;
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
    view.webview.html = html(view.webview,context.extensionUri,vscode.workspace.getConfiguration('runegrove').get('reduceMotion',false));
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
          if(message.type==='open' && !item.folder) await vscode.commands.executeCommand('vscode.open',item.uri);
        }
      } catch(error) { send({type:'error',message:error.message}); }
    }));
    const watcher=vscode.workspace.createFileSystemWatcher('**/*');
    const changed=()=>{clearTimeout(timer);timer=setTimeout(refresh,180);};
    subscriptions.push(watcher,watcher.onDidCreate(changed),watcher.onDidDelete(changed),watcher.onDidChange(changed),vscode.workspace.onDidChangeWorkspaceFolders(changed));
    view.onDidDispose(()=>{dead=true;clearTimeout(timer);for(const subscription of subscriptions)subscription.dispose();if(panel===view)panel=undefined;});
  }));
}
function html(webview,uri,reduced) {
  const token=nonce();
  const asset=name=>escapeHtml(webview.asWebviewUri(vscode.Uri.joinPath(uri,'media',name)).toString());
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${token}';"><link rel="stylesheet" href="${asset('village.css')}"><title>Runegrove Village</title></head><body class="${reduced?'reduce-motion':''}">
  <div class="realm-shell"><header><div class="brand"><span class="sigil">◇</span>RUNEGROVE</div><details class="project-menu"><summary>Project <span id="project">Opening…</span> ▾</summary><div class="dropdown"><label for="roots">Choose a workspace realm</label><select id="roots"></select><button data-tool="openFolder">Open another folder ↗</button></div></details><div class="mode-tabs"><span class="active">Village</span><button data-tool="files">Editor ↗</button></div><div class="search"><span>⌕</span><input id="search" placeholder="Search the archive…" aria-label="Filter current folder"></div><details id="global-menu" class="global-menu"><summary>Workspace ▾</summary><div class="dropdown"><button data-tool="commands">All commands ↗</button><button data-tool="settings">Settings ↗</button><button data-tool="search">Search workspace ↗</button></div></details></header>
  <div class="workspace"><div class="world" aria-hidden="true"></div>
  <aside class="project-scroll"><div class="aside-title"><h1>Project</h1><button id="fold" aria-expanded="true" aria-controls="scroll">Roll up ⌃</button></div><div id="scroll" class="scroll"><div class="roller top"></div><div class="paper"><div class="pathbar"><button id="parent" aria-label="Parent folder">↑</button><span id="path">Reading your workspace…</span><button id="refresh" aria-label="Refresh files">↻</button></div><div id="files" class="files" aria-label="Workspace files"></div></div><div class="roller bottom"></div></div><div class="scroll-footer">◇ Your project archive</div></aside>
  <main><div class="world-title"><span class="eyebrow">THE WHISPERING WOODS</span><h2>Your workspace, a living village.</h2><span id="host" class="badge">Connecting to host</span></div><div id="buildings" class="buildings" aria-label="Folder districts"></div>
  <section class="tool-roster" aria-label="Village tools"><details class="guild-tool"><summary><span>⚒</span><strong>The Smithy</strong><small>Source control ▾</small></summary><div class="tool-menu"><p>Review changes, branches, and history in native Source Control.</p><button data-tool="git">Open Source Control ↗</button></div></details><details class="guild-tool"><summary><span>›_</span><strong>Command chamber</strong><small>Execution ▾</small></summary><div class="tool-menu"><p>Use your real terminal and its existing workspace permissions.</p><button data-tool="terminal">Open terminal ↗</button></div></details><details class="guild-tool"><summary><span>✧</span><strong>The Merchant</strong><small>Extensions ▾</small></summary><div class="tool-menu"><p>Browse and manage extensions through the native catalog.</p><button data-tool="extensions">Open extensions ↗</button></div></details></section>
  <section class="inventory"><div><span class="eyebrow">WORKTABLE</span><h2>Pinned files</h2></div><div id="pins" class="pins"></div></section><div id="notice" role="status" aria-live="polite"></div><div class="scene-status"><span id="trust">Native editor · Your workspace stays yours</span></div></main></div></div><script nonce="${token}" src="${asset('village.js')}"></script></body></html>`;
}
module.exports={activate,html};

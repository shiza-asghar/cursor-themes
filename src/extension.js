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
          else if(entries.has(message.id) && !entries.get(message.id).folder) pins.set(message.id,entries.get(message.id));
          await refresh();
        } else {
          const item=entries.get(message.id) || (message.type==='open' && pins.get(message.id));
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
  <header><div class="brand"><span class="sigil">◇</span><div>RUNEGROVE<small>A LITTLE MAGIC IN YOUR WORKSPACE</small></div></div><div class="header-actions"><span id="host" class="badge">Connecting to host</span><button data-tool="commands">⌘ <span>All commands</span></button><button data-tool="settings" aria-label="Open native settings">⚙</button></div></header>
  <div class="workspace"><aside><div class="aside-title"><span>THE ARCHIVE</span><button id="fold" aria-expanded="true" aria-controls="scroll">Roll up <span>⌃</span></button></div><div id="scroll" class="scroll"><div class="roller top"></div><div class="paper"><label for="roots">Workspace realm</label><select id="roots" aria-label="Workspace root"></select><div class="search"><span>⌕</span><input id="search" placeholder="Find in this folder…" aria-label="Filter current folder"></div><div class="pathbar"><button id="parent" aria-label="Parent folder">↑</button><span id="path">Reading your workspace…</span><button id="refresh" aria-label="Refresh files">↻</button></div><div id="files" class="files" aria-label="Workspace files"></div></div><div class="roller bottom"></div></div><div class="aside-note"><span>◇</span><p>Real files. Familiar tools.<br>A different kind of workspace.</p></div></aside>
  <main><section class="intro"><div><div class="eyebrow">YOUR WORKSPACE, REIMAGINED</div><h1>A place for your craft.</h1><p>Every folder a home. Every file a story.</p></div><span class="chapter">VILLAGE / 01</span></section>
  <section class="village" aria-label="Workspace folder village"><div class="world" aria-hidden="true"><div class="moon"></div><div class="mountains back"></div><div class="mountains front"></div><div class="forest"></div><div class="river"></div><div class="trail"></div><div class="world-caption">THE WHISPERING WOODS <span>✦</span></div></div><div class="village-top"><span class="realm"><i></i><span id="project">Opening the gates</span></span><span class="map-note">YOUR FOLDERS, A LITTLE CLOSER TO HOME</span></div><div id="buildings" class="buildings"></div><div class="village-bottom"><span>◇ Click a building to explore its folder</span><button data-tool="files">Open native Explorer ↗</button></div></section>
  <section class="stations-section"><div class="section-heading"><h2>The village square</h2><span>FAMILIAR TOOLS. OPENED NATIVELY.</span></div><div class="stations"><button class="station" data-tool="git"><span class="station-icon smith">⚒</span><span><strong>The Smithy</strong><small>Source control</small></span><span class="arrow">↗</span></button><button class="station" data-tool="terminal"><span class="station-icon chamber">›_</span><span><strong>Command chamber</strong><small>Terminal & execution</small></span><span class="arrow">↗</span></button><button class="station" data-tool="extensions"><span class="station-icon merchant">✧</span><span><strong>The Merchant</strong><small>Extensions</small></span><span class="arrow">↗</span></button><button class="station" data-tool="search"><span class="station-icon scout">⌕</span><span><strong>The Scout</strong><small>Search the workspace</small></span><span class="arrow">↗</span></button></div></section>
  <section class="inventory"><div><span class="eyebrow">YOUR WORKTABLE</span><h2>Pinned manuscripts</h2></div><div id="pins" class="pins"><span class="muted">Pin a file from the archive to keep it within reach.</span></div></section><div id="notice" role="status" aria-live="polite"></div><footer><span>RUNEGROVE <span class="muted">/</span> FANTASY THEME FOR CURSOR</span><span id="trust">Native editor · Your workspace stays yours</span></footer></main></div><script nonce="${token}" src="${asset('village.js')}"></script></body></html>`;
}
module.exports={activate,html};

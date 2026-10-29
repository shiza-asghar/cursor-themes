'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {escapeHtml,validMessage,tools}=require('../src/domain');
test('untrusted names escape HTML and bridge rejects malformed requests',()=>{
 assert.equal(escapeHtml('<img src="x">'), '&lt;img src=&quot;x&quot;&gt;');
 for(const input of [null,{}, {type:'delete'},{type:'open',id:123},{type:'open',id:'x'.repeat(2048)}])assert.equal(validMessage(input),false);
 assert.equal(validMessage({type:'open',id:'file:///workspace/a'}),true);
});
test('themes and icon contributions point to valid assets',()=>{
 const root=path.join(__dirname,'..');const pkg=require('../package.json');
 for(const theme of pkg.contributes.themes){const data=JSON.parse(fs.readFileSync(path.join(root,theme.path)));assert.ok(Object.keys(data.colors).length>80);for(const color of Object.values(data.colors))assert.match(color,/^#[a-f\d]{6}([a-f\d]{2})?$/i);}
 for(const definition of Object.values(require('../icons/file-icons.json').iconDefinitions))assert.ok(fs.existsSync(path.join(root,'icons',definition.iconPath)));
});
function harness(){
 const uri=p=>({path:p,toString:()=>`file://${p}`,with:({path:p})=>uri(p)});
 let receive,dispose,command;const messages=[],calls=[];let contents=[['src',2],['<unsafe>.js',1],['.git',2]];
 const noop={dispose(){}};const event=()=>noop;
 const webview={cspSource:'https://local.test',asWebviewUri:u=>u,onDidReceiveMessage(fn){receive=fn;return noop;},postMessage(data){messages.push(data);}};
 const panel={webview,onDidDispose(fn){dispose=fn;},reveal(){}};
 const vscode={Uri:{joinPath:(u,...parts)=>uri(path.posix.join(u.path,...parts))},ViewColumn:{Active:1},FileType:{Directory:2},env:{remoteName:undefined},window:{createWebviewPanel:()=>panel,registerCustomEditorProvider:()=>noop},commands:{registerCommand(id,fn){if(id==='runegrove.openVillage')command=fn;return noop;},async getCommands(){return Object.values(tools);},async executeCommand(...args){calls.push(args);}},workspace:{workspaceFolders:[{name:'real-project',uri:uri('/project')}],fs:{async readDirectory(){return contents;}},asRelativePath:u=>path.posix.relative('/project',u.path),isTrusted:true,getConfiguration:()=>({get:()=>false}),createFileSystemWatcher:()=>({...noop,onDidCreate:event,onDidDelete:event,onDidChange:event}),onDidChangeWorkspaceFolders:event}};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/extension.js'),'utf8'),{require:name=>name==='vscode'?vscode:require('../src/domain'),module,setTimeout,clearTimeout});
 module.exports.activate({subscriptions:[],extensionUri:uri('/extension')});command();
 return {messages,calls,webview,receive:m=>receive(m),dispose:()=>dispose(),contents:items=>{contents=items;}};
}
test('village lists actual provider files, navigates, pins, and refuses forged paths or commands',async()=>{
 const h=harness();await h.receive({type:'ready'});
 let state=h.messages.at(-1);assert.equal(state.project,'real-project');assert.deepEqual(Array.from(state.items,x=>x.name),['src','<unsafe>.js']);
 assert.ok(!state.items.some(x=>x.name==='.git'));
 await h.receive({type:'open',id:'file:///etc/passwd'});assert.equal(h.calls.length,0);
 await h.receive({type:'open',id:'file:///project/<unsafe>.js'});assert.equal(h.calls[0][0],'vscode.open');
 await h.receive({type:'pin',id:'file:///project/<unsafe>.js'});assert.equal(h.messages.at(-1).pins.length,1);
 await h.receive({type:'pin',id:'file:///project/<unsafe>.js'});assert.equal(h.messages.at(-1).pins.length,0);
 await h.receive({type:'folder',id:'file:///project/src'});assert.equal(h.messages.at(-1).path,'src');
 await h.receive({type:'parent'});assert.equal(h.messages.at(-1).atRoot,true);
 await h.receive({type:'tool',id:'constructor'});assert.equal(h.messages.at(-1).type,'error');
 await h.receive({type:'tool',id:'git'});assert.equal(h.calls.at(-1)[0],tools.git);
 assert.match(h.webview.html,/default-src 'none'/);assert.ok(!h.webview.html.includes('unsafe-eval'));
 h.dispose();
});
test('filesystem read failures surface as errors instead of reporting success',async()=>{
 const h=harness();h.contents(null);await h.receive({type:'ready'});assert.equal(h.messages.at(-1).type,'error');h.dispose();
});
test('lazy tree expansion uses provider entries and rejects unknown directory URIs',async()=>{
 const h=harness();await h.receive({type:'ready'});
 const before=h.messages.length;
 await h.receive({type:'expand',id:'file:///etc'});assert.equal(h.messages.length,before);
 h.contents([['nested',2],['leaf.ts',1]]);
 await h.receive({type:'expand',id:'file:///project/src'});
 const children=h.messages.at(-1);assert.equal(children.type,'children');assert.equal(children.id,'file:///project/src');
 assert.deepEqual(Array.from(children.items,x=>x.id),['file:///project/src/nested','file:///project/src/leaf.ts']);
 await h.receive({type:'open',id:'file:///project/src/leaf.ts'});assert.equal(h.calls.at(-1)[1].toString(),'file:///project/src/leaf.ts');
 await h.receive({type:'expand',id:'file:///project/src/nested'});assert.equal(h.messages.at(-1).type,'children');
 await h.receive({type:'refresh'});const calls=h.calls.length;
 await h.receive({type:'open',id:'file:///project/src/leaf.ts'});assert.equal(h.calls.length,calls);
 h.dispose();
});
function documentHarness(){
 let receive,changed,saved;const messages=[];const calls=[];let text='const value = 1;';
 const noop={dispose(){}};const doc={uri:{path:'/project/value.ts',toString:()=> 'file:///project/value.ts'},version:1,lineCount:1,isDirty:false,languageId:'typescript',getText:()=>text,async save(){this.isDirty=false;return true;}};
 class Edit{replace(uri,range,value){this.value=value;}}
 const workspace={isTrusted:true,onDidChangeTextDocument(fn){changed=fn;return noop;},onDidSaveTextDocument(fn){saved=fn;return noop;},async applyEdit(edit){text=edit.value;doc.version++;doc.isDirty=true;changed({document:doc});return true;}};
 const vscode={workspace,WorkspaceEdit:Edit,Range:class{},commands:{executeCommand(...args){calls.push(args);}},window:{async showWarningMessage(){return 'Reload';}}};
 const view={webview:{postMessage:m=>messages.push(m),onDidReceiveMessage(fn){receive=fn;return noop;}}};
 const connection=require('../src/workshop').connectDocument(vscode,view,doc);
 return {doc,workspace,messages,calls,connection,async send(message){receive(message);await new Promise(resolve=>setImmediate(resolve));}};
}
test('Workshop edits host document, preserves stale buffer, saves, and opens native editor',async()=>{
 const h=documentHarness();await h.send({type:'editorReady'});assert.equal(h.messages.at(-1).text,'const value = 1;');
 await h.send({type:'edit',version:1,text:'const value = 2;',requestId:'1'});assert.equal(h.doc.getText(),'const value = 2;');assert.equal(h.messages.at(-1).ack,'1');assert.equal(h.doc.isDirty,true);
 await h.send({type:'edit',version:1,text:'stale text',requestId:'2'});assert.equal(h.messages.at(-1).type,'editRejected');assert.equal(h.doc.getText(),'const value = 2;');
 await h.send({type:'saveDocument'});assert.equal(h.doc.isDirty,false);assert.equal(h.messages.at(-1).type,'documentSaved');
 await h.send({type:'nativeDocument'});assert.deepEqual(h.calls.at(-1),['vscode.openWith',h.doc.uri,'default']);
 await h.send({type:'reloadDocument'});assert.equal(h.messages.at(-1).force,true);h.connection.dispose();
});
test('Workshop rejects edits in Restricted Mode and malformed text requests',async()=>{
 const h=documentHarness();h.workspace.isTrusted=false;await h.send({type:'edit',version:1,text:'blocked',requestId:'1'});assert.equal(h.doc.version,1);assert.equal(h.messages.at(-1).type,'editRejected');
 h.workspace.isTrusted=true;await h.send({type:'edit',version:1,text:{bad:true},requestId:'2'});assert.equal(h.doc.version,1);assert.equal(h.messages.at(-1).type,'editRejected');h.connection.dispose();
});

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
 const vscode={Uri:{joinPath:(u,...parts)=>uri(path.posix.join(u.path,...parts))},ViewColumn:{Active:1},FileType:{Directory:2},env:{remoteName:undefined},window:{createWebviewPanel:()=>panel},commands:{registerCommand(id,fn){command=fn;return noop;},async getCommands(){return Object.values(tools);},async executeCommand(...args){calls.push(args);}},workspace:{workspaceFolders:[{name:'real-project',uri:uri('/project')}],fs:{async readDirectory(){return contents;}},asRelativePath:u=>path.posix.relative('/project',u.path),isTrusted:true,getConfiguration:()=>({get:()=>false}),createFileSystemWatcher:()=>({...noop,onDidCreate:event,onDidDelete:event,onDidChange:event}),onDidChangeWorkspaceFolders:event}};
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

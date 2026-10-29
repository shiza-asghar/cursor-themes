'use strict';
// Custom text editor edits the host TextDocument, so native dirty buffers and Save remain authoritative.
function connectDocument(vscode,view,document){
  const subscriptions=[];let disposed=false;let queue=Promise.resolve();
  const post=data=>{if(!disposed)view.webview.postMessage(data);};
  const snapshot=(extra={})=>post({type:'document',uri:document.uri.toString(),name:document.uri.path.split('/').pop(),text:document.getText(),version:document.version,dirty:document.isDirty,language:document.languageId,readOnly:!vscode.workspace.isTrusted,...extra});
  const conflict=message=>post({type:'editRejected',message});
  subscriptions.push(view.webview.onDidReceiveMessage(message=>{
    if(!message || typeof message!=='object')return;
    if(message.type==='editorReady'){if(document.getText().length>2_000_000)conflict('This document is too large for Workshop. Open it in the native editor.');else snapshot();}
    if(message.type==='edit'){
      queue=queue.then(async()=>{
        if(disposed)return;
        if(!vscode.workspace.isTrusted)return conflict('Restricted Mode: edit this file in the native editor.');
        if(typeof message.text!=='string'||message.text.length>2_000_000||!Number.isInteger(message.version)||(typeof message.requestId!=='string'||message.requestId.length>128))return conflict('Invalid or oversized editor request.');
        if(message.version!==document.version)return conflict('The file changed in another editor. Your Workshop buffer is preserved; reload before continuing.');
        if(message.text!==document.getText()){
          const edit=new vscode.WorkspaceEdit();
          edit.replace(document.uri,new vscode.Range(0,0,document.lineCount,0),message.text);
          if(!await vscode.workspace.applyEdit(edit))return conflict('The host could not apply this edit. Your text is preserved in Workshop.');
        }
        if(document.getText()!==message.text)return conflict('The document changed during the edit. Your Workshop text is preserved.');
        snapshot({ack:message.requestId});
      }).catch(error=>conflict(error.message));
    }
    if(message.type==='saveDocument')queue=queue.then(async()=>{if(!await document.save())conflict('Save was cancelled or failed.');else post({type:'documentSaved',dirty:document.isDirty});}).catch(error=>conflict(error.message));
    if(message.type==='nativeDocument')vscode.commands.executeCommand('vscode.openWith',document.uri,'default');
    if(message.type==='reloadDocument')queue=queue.then(async()=>{const answer=await vscode.window.showWarningMessage('Reload the Workshop buffer from the host? Any text not accepted by the host will be discarded.',{modal:true},'Reload');if(answer==='Reload')snapshot({force:true});}).catch(error=>conflict(error.message));
  }));
  subscriptions.push(vscode.workspace.onDidChangeTextDocument(event=>{if(event.document.uri.toString()===document.uri.toString())post({type:'documentChanged',version:document.version});}));
  subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc=>{if(doc.uri.toString()===document.uri.toString())post({type:'documentSaved',dirty:doc.isDirty});}));
  return {dispose(){disposed=true;for(const subscription of subscriptions)subscription.dispose();}};
}
module.exports={connectDocument};

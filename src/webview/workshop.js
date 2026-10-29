import {EditorState,Compartment} from '@codemirror/state';
import {EditorView,keymap,lineNumbers,highlightActiveLine,highlightActiveLineGutter,drawSelection} from '@codemirror/view';
import {defaultKeymap,history,historyKeymap,indentWithTab} from '@codemirror/commands';
import {syntaxHighlighting,HighlightStyle,bracketMatching} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {javascript} from '@codemirror/lang-javascript';
import {json} from '@codemirror/lang-json';
import {css} from '@codemirror/lang-css';
import {html} from '@codemirror/lang-html';
import {markdown} from '@codemirror/lang-markdown';
import {python} from '@codemirror/lang-python';
const api=window.runegroveApi;
const language=new Compartment(),editable=new Compartment();
let editor,version=0,inFlight=null,queued=false,conflicted=false,applying=false,sequence=0,sentText='';
const $=id=>document.getElementById(id);
const post=(type,args={})=>api.postMessage({type,...args});
const languages={javascript:()=>javascript(),javascriptreact:()=>javascript({jsx:true}),typescript:()=>javascript({typescript:true}),typescriptreact:()=>javascript({typescript:true,jsx:true}),json,jsonc:json,css,html,markdown,python};
function transmit(){if(!editor||inFlight||conflicted)return;inFlight=String(++sequence);queued=false;sentText=editor.state.doc.toString();post('edit',{text:sentText,version,requestId:inFlight});$('document-status').textContent='Syncing…';}
function reject(message){conflicted=true;$('editor-conflict').hidden=false;$('conflict-text').textContent=message;$('document-status').textContent='Review required';}
const theme=EditorView.theme({'&':{height:'100%',color:'#29332b',backgroundColor:'transparent',fontSize:'14px'},'.cm-content':{fontFamily:'monospace',padding:'18px 0',caretColor:'#64491f'},'.cm-scroller':{overflow:'auto'},'.cm-gutters':{color:'#827252',backgroundColor:'#b9a07718',borderRight:'1px solid #997a4044',minWidth:'46px'},'.cm-activeLine':{backgroundColor:'#aa925521'},'.cm-activeLineGutter':{backgroundColor:'#aa925533',color:'#48391e'},'&.cm-focused .cm-selectionBackground, .cm-selectionBackground':{backgroundColor:'#b9c1a588'},'&.cm-focused':{outline:'none'},'.cm-cursor':{borderLeftColor:'#64491f'} });
const colors=HighlightStyle.define([{tag:tags.keyword,color:'#805c94'},{tag:tags.string,color:'#456a3e'},{tag:tags.number,color:'#9a612a'},{tag:tags.bool,color:'#9a612a'},{tag:tags.comment,color:'#687259',fontStyle:'italic'},{tag:tags.typeName,color:'#2d6c75'},{tag:tags.function(tags.variableName),color:'#85602d'}]);
window.addEventListener('message',event=>{
 const data=event.data;
 if(data.type==='editRejected'){reject(data.message);return;}
 if(data.type==='documentSaved'){$('document-status').textContent=data.dirty?'Unsaved':'Saved';return;}
 if(data.type==='documentChanged'){
   if(!inFlight&&!queued&&!conflicted)post('editorReady');
   return;
 }
 if(data.type!=='document')return;
 if(!editor){editor=new EditorView({parent:$('editor'),state:EditorState.create({doc:data.text,extensions:[lineNumbers(),history(),drawSelection(),highlightActiveLine(),highlightActiveLineGutter(),bracketMatching(),syntaxHighlighting(colors),theme,language.of(languages[data.language]?.()||[]),editable.of(EditorState.readOnly.of(data.readOnly)),keymap.of([{key:'Mod-s',run:()=>{post('saveDocument');return true;}},...defaultKeymap,...historyKeymap,indentWithTab]),EditorView.updateListener.of(update=>{if(update.docChanged&&!applying){queued=true;transmit();}})]})});}
 else if(data.force){applying=true;editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:data.text}});applying=false;inFlight=null;queued=false;conflicted=false;$('editor-conflict').hidden=true;}
 else if(data.ack===inFlight){if(data.text!==sentText){reject('The host document differs from the text submitted. Your buffer is preserved.');return;}inFlight=null;}
 else if(inFlight||queued||conflicted){reject('The document changed outside this Workshop buffer. Your text is preserved. Reload from host to reconcile.');return;}
 else if(editor.state.doc.toString()!==data.text){applying=true;editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:data.text}});applying=false;}
 editor.dispatch({effects:editable.reconfigure(EditorState.readOnly.of(data.readOnly))});
 version=data.version;$('document-name').textContent=data.name;$('language').textContent=data.language;$('document-status').textContent=data.readOnly?'Restricted Mode · read only':data.dirty?'Unsaved':'Saved';
 if(queued&&!conflicted)transmit();
});
$('save-document').onclick=()=>post('saveDocument');$('native-document').onclick=()=>post('nativeDocument');$('reload-document').onclick=()=>post('reloadDocument');
post('editorReady');

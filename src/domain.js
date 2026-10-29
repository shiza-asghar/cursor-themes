'use strict';
const crypto = require('node:crypto');
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function nonce() { return crypto.randomBytes(24).toString('base64'); }
function validMessage(message) {
  return !!message && typeof message === 'object' && ['ready','open','folder','parent','root','pin','tool','refresh'].includes(message.type) && (message.id === undefined || (typeof message.id === 'string' && message.id.length < 2048));
}
const tools = Object.freeze({commands:'workbench.action.showCommands',search:'workbench.action.findInFiles',git:'workbench.view.scm',extensions:'workbench.view.extensions',terminal:'workbench.action.terminal.toggleTerminal',settings:'workbench.action.openSettings',openFolder:'workbench.action.files.openFolder',files:'workbench.view.explorer'});
module.exports = {escapeHtml, nonce, validMessage, tools};

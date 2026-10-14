/* Per-tab, local-only drafts. No save contents leave the browser. */
(function(root){
  'use strict';
  const key=name=>'probably-stolen:'+name+':v1';
  function read(name){try{return JSON.parse(root.sessionStorage.getItem(key(name)));}catch{return null;}}
  function write(name,value){
    try{root.sessionStorage.setItem(key(name),JSON.stringify(value));return true;}
    catch{try{root.sessionStorage.removeItem(key(name));}catch{}return false;}
  }
  function bind(name,capture){
    const save=()=>{if(!write(name,capture())&&!root.document.getElementById('session-warning')){
      const warning=root.document.createElement('p');warning.id='session-warning';warning.className='notice';warning.setAttribute('role','status');
      warning.textContent='浏览器未能保留本页数据；切换回来后可能需要重新输入或导入。';root.document.querySelector('main').prepend(warning);
    }};
    root.addEventListener('pagehide',save);
    root.document.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='hidden')save();});
    root.document.addEventListener('click',e=>{if(e.target.closest('a[href]'))save();},true);
    return save;
  }
  root.ToolSession={read,write,bind};
})(typeof window==='object'?window:globalThis);

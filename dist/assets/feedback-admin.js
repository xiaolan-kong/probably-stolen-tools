'use strict';
const adminEl=id=>document.getElementById(id),adminStatus=adminEl('admin-status');
let adminToken='',listPage=0,selectedTicket='';
function logout(){adminToken='';selectedTicket='';adminEl('admin-login').hidden=false;adminEl('admin-workspace').hidden=true;adminEl('ticket-list').replaceChildren();adminEl('ticket-detail').replaceChildren();adminEl('reply-form').hidden=true;adminEl('admin-password').value='';}
async function adminRequest(path,options={}){
  try{return await feedbackRequest('/admin'+path,{...options,headers:{Authorization:'Bearer '+adminToken,...options.headers}});}
  catch(error){if(error.status===401||error.status===403)logout();throw error;}
}
async function openTicket(id){
  selectedTicket=id;adminEl('reply-form').hidden=true;adminStatus.textContent='正在读取反馈…';
  try{const ticket=await adminRequest('/tickets/'+id);if(selectedTicket!==id)return;showFeedbackDetail(adminEl('ticket-detail'),ticket);adminEl('ticket-state').value=ticket.status;adminEl('ticket-reply').value=ticket.reply;adminEl('reply-form').hidden=false;adminStatus.textContent='';}
  catch(error){adminStatus.textContent=error.message;}
}
async function loadTickets(){
  adminStatus.textContent='正在读取…';
  try{const rows=await adminRequest('/tickets?page='+listPage);adminEl('ticket-list').replaceChildren();
    for(const row of rows){const button=document.createElement('button');button.className='ticket-row';const label=document.createElement('strong'),excerpt=document.createElement('span');label.textContent=`${row.status} · ${row.category}`;excerpt.textContent=row.message.slice(0,90);button.append(label,excerpt);button.addEventListener('click',()=>openTicket(row.id));adminEl('ticket-list').append(button);}
    adminEl('previous').disabled=listPage===0;adminEl('next').disabled=rows.length<50;adminStatus.textContent=rows.length?`第 ${listPage+1} 页 · ${rows.length} 条反馈`:'暂无反馈。';
  }catch(error){adminStatus.textContent=error.message;}
}
async function loadAnalytics(){
  const status=adminEl('analytics-status');status.textContent='正在读取访问统计…';
  try {
    const rows=await adminRequest('/analytics');
    const days=new Map();let total=0;
    for(const row of rows){const value=Number(row.views);total+=value;const counts=days.get(row.day)||{calculator:0,assembler:0,feedback:0};counts[row.page]=value;days.set(row.day,counts);}
    adminEl('analytics-rows').replaceChildren();
    for(const [day,counts] of days){
      const tr=document.createElement('tr');
      for(const value of [day,counts.calculator+counts.assembler+counts.feedback,counts.calculator,counts.assembler,counts.feedback]){const td=document.createElement('td');td.textContent=typeof value==='number'?value.toLocaleString('zh-CN'):value;tr.append(td);}
      adminEl('analytics-rows').append(tr);
    }
    status.textContent=`近30天共 ${total.toLocaleString('zh-CN')} 次页面访问。${rows.length?'':'接入后开始统计。'}`;
  } catch(error){status.textContent=error.message;}
}
adminEl('admin-login').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget;form.inert=true;adminStatus.textContent='正在登录…';
  try{const result=await feedbackRequest('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:adminEl('admin-email').value,password:adminEl('admin-password').value})});adminToken=result.accessToken;adminEl('admin-password').value='';form.hidden=true;adminEl('admin-workspace').hidden=false;listPage=0;await Promise.all([loadTickets(),loadAnalytics()]);}
  catch(error){adminStatus.textContent=error.message;}finally{form.inert=false;}
});
adminEl('reply-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,id=selectedTicket;form.inert=true;
  try{await adminRequest('/tickets/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:adminEl('ticket-state').value,reply:adminEl('ticket-reply').value})});await loadTickets();if(selectedTicket===id)await openTicket(id);adminStatus.textContent='状态和回复已保存，玩家可以在查询页看到。';}
  catch(error){adminStatus.textContent=error.message;}finally{form.inert=false;}
});
adminEl('admin-logout').addEventListener('click',()=>{logout();adminStatus.textContent='已退出登录。';});
adminEl('reload-list').addEventListener('click',loadTickets);
adminEl('reload-analytics').addEventListener('click',loadAnalytics);
adminEl('previous').addEventListener('click',()=>{listPage=Math.max(0,listPage-1);loadTickets();});
adminEl('next').addEventListener('click',()=>{listPage++;loadTickets();});
if(!feedbackBase)adminStatus.textContent='反馈后台尚未完成配置。';

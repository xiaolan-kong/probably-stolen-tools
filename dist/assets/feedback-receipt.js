'use strict';
const receiptStatus=document.getElementById('receipt-status');
async function loadReceipt(){
  const [id,token]=location.hash.slice(1).split('.');
  if(!/^[\da-f-]{36}$/.test(id||'')||!/^[\da-f]{64}$/.test(token||'')){receiptStatus.textContent='查询链接不完整，请使用提交成功后提供的链接。';return;}
  document.getElementById('refresh').disabled=true;receiptStatus.textContent='正在读取…';
  try{const result=await feedbackRequest('/tickets/'+id,{headers:{'X-Feedback-Token':token}});showFeedbackDetail(document.getElementById('ticket-detail'),result);receiptStatus.textContent='已更新。图片链接短期有效，打不开时请刷新。';}
  catch(error){receiptStatus.textContent=error.message;}
  finally{document.getElementById('refresh').disabled=false;}
}
document.getElementById('refresh').addEventListener('click',loadReceipt);
document.getElementById('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);receiptStatus.textContent='查询链接已复制。';}catch{receiptStatus.textContent='无法自动复制，请复制浏览器地址栏中的完整链接。';}});
loadReceipt();

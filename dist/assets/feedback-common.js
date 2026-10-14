'use strict';
const feedbackBase = (window.PS_FEEDBACK?.apiBase || '').replace(/\/$/,'');
async function feedbackRequest(route, options={}) {
  if(!feedbackBase)throw Error('反馈后台尚未接通。');
  const address=new URL(feedbackBase);
  if(address.protocol!=='https:' && !['localhost','127.0.0.1'].includes(address.hostname))throw Error('反馈地址需要使用 HTTPS。');
  let response;
  try{response=await fetch(feedbackBase+route,{...options,referrerPolicy:'no-referrer',signal:AbortSignal.timeout(100000)});}catch{throw Error('连接失败，内容仍保留，请稍后重试。');}
  let result;try{result=await response.json();}catch{throw Error('后台返回异常，请稍后重试。');}
  if(!response.ok)throw Object.assign(new Error(result.error||'请求失败，请重试。'),{status:response.status});
  return result;
}
function showFeedbackDetail(container,ticket) {
  container.replaceChildren();
  for(const [title,value] of [['状态',ticket.status],['问题',ticket.message],['附带信息',ticket.context],['管理员回复',ticket.reply||'暂无回复']]){
    if(!value)continue;
    const heading=document.createElement('h3'),text=document.createElement('p');heading.textContent=title;text.textContent=value;container.append(heading,text);
  }
  const images=document.createElement('div');images.className='ticket-images';
  for(const picture of ticket.attachments||[]){
    const link=document.createElement('a'),img=document.createElement('img');
    const url=new URL(picture.url);
    if(url.protocol!=='https:'||url.hostname!==new URL(feedbackBase).hostname)continue;
    link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';img.src=url.href;img.alt=picture.name;img.referrerPolicy='no-referrer';link.append(img);images.append(link);
  }
  container.append(images);
}

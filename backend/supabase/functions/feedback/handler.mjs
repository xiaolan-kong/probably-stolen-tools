const MAX_BODY = 16 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const categories = ['计算结果不符','页面使用问题','功能建议','其他'];
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(x=>x.toString(16).padStart(2,'0')).join('');
const fail = (status,message) => {throw Object.assign(new Error(message),{status});};
async function bodyBytes(request,limit=MAX_BODY) {
  if (Number(request.headers.get('content-length')) > limit) fail(413,'内容过大。');
  const reader=request.body?.getReader(), chunks=[];let size=0;
  if(!reader)fail(400,'没有提交内容。');
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(413,'内容过大。');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}return bytes;
}
async function jsonBody(request) {
  try{return JSON.parse(new TextDecoder().decode(await bodyBytes(request,20000)));}catch(e){if(e.status)throw e;fail(400,'请求格式错误。');}
}
function imageType(bytes) {
  const prefix=Array.from(bytes.slice(0,12));
  if([137,80,78,71,13,10,26,10].every((x,i)=>prefix[i]===x))return ['image/png','png'];
  if(prefix[0]===255&&prefix[1]===216&&prefix[2]===255)return ['image/jpeg','jpg'];
  if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return ['image/webp','webp'];
  fail(400,'图片格式不正确，请使用 JPG、PNG 或 WebP。');
}
export function createHandler(config,fetcher=fetch) {
  const {url,key,origins=[],adminIds=[]}=config;
  async function api(route,{method='GET',body,token=key,headers={}}={}) {
    const response=await fetcher(url+route,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
    const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{fail(502,'后台暂时不可用，请稍后重试。');}
    if(!response.ok){
      if(route.startsWith('/auth/v1/token') && response.status===400)fail(401,'账号或密码不正确。');
      if(response.status===429)fail(429,'请求过于频繁，请稍后再试。');
      if(data?.message?.includes('feedback_conflict'))fail(409,'此提交编号已被使用，请重新打开反馈。');
      if(data?.message?.includes('feedback_daily_limit'))fail(429,'今天的反馈接收量已满，请明天再试。');
      if(data?.message?.includes('feedback_storage_limit'))fail(503,'反馈存储暂满，请稍后再试。');
      if(response.status===401||response.status===403)fail(401,'登录失效或无权访问。');
      fail(502,'后台暂时不可用，内容已保留，请重试。');
    }return data;
  }
  async function admin(request) {
    const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if(!token)fail(401,'请先登录管理后台。');
    const user=await api('/auth/v1/user',{token});
    if(!adminIds.includes(user.id))fail(403,'此账号不是反馈管理员。');
  }
  async function ticket(id,request,isAdmin) {
    if(!UUID.test(id))fail(404,'找不到这条反馈。');
    const rows=await api(`/rest/v1/feedback_tickets?id=eq.${id}&upload_state=eq.ready&select=*`);
    const row=rows?.[0];
    const token=request.headers.get('x-feedback-token')||'';
    if(!row || (!isAdmin&&(!TOKEN.test(token)||await sha(token)!==row.token_hash)))fail(404,'反馈不存在或查看凭证不正确。');
    const attachments=[];
    for(const image of row.attachments){
      const result=await api(`/storage/v1/object/sign/feedback-images/${image.path}`,{method:'POST',body:{expiresIn:60}});
      const signed=result.signedURL||result.signedUrl;
      if(typeof signed!=='string'||!signed.startsWith('/object/sign/'))fail(502,'图片暂时无法加载。');
      attachments.push({url:url+'/storage/v1'+signed,name:image.name});
    }
    return {id:row.id,category:row.category,message:row.message,context:row.context,status:row.status,reply:row.reply,createdAt:row.created_at,attachments};
  }
  return async request => {
    const origin=request.headers.get('origin')||'';
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    if(origins.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-Feedback-Token','Access-Control-Max-Age':'600'});
    const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    try {
      if(!url||!key||!origins.length||!adminIds.length)fail(503,'反馈后台尚未完成配置。');
      if(!origins.includes(origin))fail(403,'请求来源未获允许。');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      const pathname=new URL(request.url).pathname.replace(/^.*\/feedback(?=\/|$)/,'').replace(/\/$/,'')||'/';
      if(pathname==='/page-view'&&request.method==='POST'){
        const body=await jsonBody(request);
        if(!body||Object.keys(body).length!==1||!['calculator','assembler','feedback'].includes(body.page))fail(400,'页面类型无效。');
        await api('/rest/v1/rpc/record_page_view',{method:'POST',body:{p_page:body.page}});
        return respond({ok:true});
      }
      if(pathname==='/tickets'&&request.method==='POST'){
        let form;try{form=await new Request('https://local.invalid',{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:await bodyBytes(request)}).formData();}catch(e){if(e.status)throw e;fail(400,'提交格式错误。');}
        const id=form.get('id'),token=form.get('token'),category=form.get('category'),message=form.get('message'),context=form.get('context')||'';
        if(form.get('website'))fail(400,'提交未通过检查。');
        if(typeof id!=='string'||!UUID.test(id)||typeof token!=='string'||!TOKEN.test(token))fail(400,'提交编号不正确，请重新打开页面。');
        if(!categories.includes(category)||typeof message!=='string'||!message.trim()||message.length>3000||typeof context!=='string'||context.length>12000)fail(400,'请检查问题类型和文字长度。');
        const files=form.getAll('images');if(files.length>3)fail(400,'最多3张图片。');
        const images=[];
        for(const file of files){
          if(!(file instanceof File)||!file.size||file.size>5*1024*1024)fail(400,'单张图片须在5 MB以内且不能为空。');
          const bytes=new Uint8Array(await file.arrayBuffer()),[type,ext]=imageType(bytes);
          if(file.type!==type)fail(400,'图片内容与格式不一致。');
          images.push({bytes,type,path:`${id}/${images.length}.${ext}`,name:`截图${images.length+1}.${ext}`,hash:await sha(bytes)});
        }
        const tokenHash=await sha(token),payloadHash=await sha(JSON.stringify([category,message.trim(),context,images.map(x=>x.hash)]));
        const reservation=await api('/rest/v1/rpc/reserve_feedback',{method:'POST',body:{p_id:id,p_token_hash:tokenHash,p_payload_hash:payloadHash,p_category:category,p_message:message.trim(),p_context:context,p_image_bytes:images.reduce((n,x)=>n+x.bytes.length,0)}});
        if(reservation.state!=='ready'){
          // A failed/unknown upload retries the same paths and payload; it never creates a second ticket.
          for(const image of images){
            const result=await fetcher(`${url}/storage/v1/object/feedback-images/${image.path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':image.type,'x-upsert':'true'},body:image.bytes,signal:AbortSignal.timeout(25000)});
            if(!result.ok)fail(502,'图片上传未完成，内容已保留，请重试。');
          }
          await api(`/rest/v1/feedback_tickets?id=eq.${id}&payload_hash=eq.${payloadHash}`,{method:'PATCH',body:{upload_state:'ready',attachments:images.map(({path,name})=>({path,name})),updated_at:new Date().toISOString()}});
        }
        return respond({id,status:'已收到'},201);
      }
      if(pathname==='/admin/login'&&request.method==='POST'){
        const body=await jsonBody(request);
        if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>256)fail(400,'请填写登录账号和密码。');
        const session=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:body.email,password:body.password}});
        if(!adminIds.includes(session.user?.id))fail(403,'此账号不是反馈管理员。');
        return respond({accessToken:session.access_token,expiresIn:session.expires_in});
      }
      if(pathname.startsWith('/admin/')){
        await admin(request);
        if(pathname==='/admin/analytics'&&request.method==='GET'){
          const since=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-29*86400000));
          return respond(await api(`/rest/v1/page_views_daily?day=gte.${since}&select=day,page,views&order=day.desc,page.asc&limit=90`));
        }
        if(pathname==='/admin/tickets'&&request.method==='GET'){
          const page=Number(new URL(request.url).searchParams.get('page')||'0');if(!Number.isInteger(page)||page<0||page>10000)fail(400,'页码无效。');
          return respond(await api(`/rest/v1/feedback_tickets?upload_state=eq.ready&select=id,category,message,status,created_at&order=created_at.desc,id.desc&limit=50&offset=${page*50}`));
        }
        const id=pathname.match(/^\/admin\/tickets\/([^/]+)$/)?.[1];
        if(id&&request.method==='GET')return respond(await ticket(id,request,true));
        if(id&&request.method==='PATCH'){
          if(!UUID.test(id))fail(404,'找不到这条反馈。');
          const body=await jsonBody(request);if(!['待处理','处理中','已解决'].includes(body.status)||typeof body.reply!=='string'||body.reply.length>3000)fail(400,'请检查状态和回复文字。');
          const rows=await api(`/rest/v1/feedback_tickets?id=eq.${id}&upload_state=eq.ready`,{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:body.status,reply:body.reply,updated_at:new Date().toISOString()}});
          if(!rows?.length)fail(404,'找不到这条反馈。');return respond({ok:true});
        }
      }
      const id=pathname.match(/^\/tickets\/([^/]+)$/)?.[1];
      if(id&&request.method==='GET')return respond(await ticket(id,request,false));
      fail(404,'接口不存在。');
    }catch(error){return respond({error:error.status?error.message:'反馈服务暂时不可用，内容已保留，请稍后重试。'},error.status||503);}
  };
}

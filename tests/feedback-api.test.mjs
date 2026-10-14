import assert from 'node:assert/strict';
import {createHandler} from '../backend/supabase/functions/feedback/handler.mjs';
const origin='https://player.example',base='https://project.supabase.co',tickets=new Map(),objects=new Map();
let uploadsFail=false,quota=false;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status});
const mock=async(address,options={})=>{
  const u=new URL(address),method=options.method||'GET',body=typeof options.body==='string'?JSON.parse(options.body):options.body;
  if(u.pathname==='/auth/v1/token')return body.password==='correct'?json({access_token:'admin-session',expires_in:3600,user:{id:'owner'}}):json({error:'invalid_grant'},400);
  if(u.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer admin-session'?json({id:'owner'}):json({id:'stranger'});
  if(u.pathname==='/rest/v1/rpc/reserve_feedback'){
    const previous=tickets.get(body.p_id);
    if(previous){if(previous.token_hash!==body.p_token_hash||previous.payload_hash!==body.p_payload_hash)return json({message:'feedback_conflict'},400);return json({state:previous.upload_state});}
    if(quota)return json({message:'feedback_daily_limit'},400);
    tickets.set(body.p_id,{id:body.p_id,token_hash:body.p_token_hash,payload_hash:body.p_payload_hash,category:body.p_category,message:body.p_message,context:body.p_context,upload_state:'pending',attachments:[],status:'待处理',reply:'',created_at:new Date().toISOString()});
    return json({state:'pending'});
  }
  if(u.pathname.startsWith('/storage/v1/object/sign/'))return json({signedURL:'/object/sign/feedback-images/sample.png?token=temporary'});
  if(u.pathname.startsWith('/storage/v1/object/')){if(uploadsFail)return json({},503);objects.set(u.pathname,body);return json({});}
  if(u.pathname==='/rest/v1/feedback_tickets'){
    const id=u.searchParams.get('id')?.replace('eq.','');let rows=id?[tickets.get(id)].filter(Boolean):[...tickets.values()];
    if(u.searchParams.get('upload_state'))rows=rows.filter(x=>x.upload_state==='ready');
    if(method==='PATCH'){for(const row of rows)Object.assign(row,body);return json(rows);}
    return json(rows);
  }
  throw Error('Unexpected backend request: '+address);
};
const handle=createHandler({url:base,key:'server-only-test-key',origins:[origin],adminIds:['owner']},mock);
const request=(path,options={})=>handle(new Request(base+'/functions/v1/feedback'+path,{...options,headers:{Origin:origin,...options.headers}}));
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const id=crypto.randomUUID(),token='a'.repeat(64);
function form({ticketId=id,credential=token,message='图片与报告不一致。',count=1,bytes=png,type='image/png'}={}){
  const f=new FormData();for(const [key,value] of Object.entries({id:ticketId,token:credential,category:'计算结果不符',message,context:'金额100',website:''}))f.set(key,value);
  for(let n=0;n<count;n++)f.append('images',new Blob([bytes],{type}),'screenshot.png');return f;
}
assert.equal((await request('/tickets',{method:'OPTIONS'})).status,204);
assert.equal((await request('/tickets',{headers:{Origin:'https://evil.example'},method:'POST',body:form()})).status,403);
assert.equal((await request('/admin/tickets')).status,401);
assert.equal((await request('/admin/tickets',{headers:{Authorization:'Bearer stranger'}})).status,403);
assert.equal((await request('/admin/login',{method:'POST',body:JSON.stringify({email:'a@b.com',password:'bad'})})).status,401);
assert.equal((await request('/tickets',{method:'POST',body:form({message:'   '})})).status,400);
assert.equal((await request('/tickets',{method:'POST',body:form({count:4})})).status,400);
assert.equal((await request('/tickets',{method:'POST',body:form({bytes:new TextEncoder().encode('<script>bad()</script>')})})).status,400);
assert.equal((await request('/tickets',{method:'POST',body:form({type:'image/jpeg'})})).status,400);
assert.equal((await request('/tickets',{method:'POST',headers:{'content-length':String(17*1024*1024)},body:'x'})).status,413);
uploadsFail=true;
assert.equal((await request('/tickets',{method:'POST',body:form()})).status,502);
assert.equal(tickets.get(id).upload_state,'pending');
assert.equal((await request('/tickets/'+id,{headers:{'X-Feedback-Token':token}})).status,404,'Incomplete upload must not show success');
uploadsFail=false;
assert.equal((await request('/tickets',{method:'POST',body:form()})).status,201);
assert.equal((await request('/tickets',{method:'POST',body:form()})).status,201);
assert.equal(tickets.size,1);assert.equal(objects.size,1);
assert.equal((await request('/tickets',{method:'POST',body:form({message:'different'})})).status,409);
assert.equal((await request('/tickets/'+id,{headers:{'X-Feedback-Token':'b'.repeat(64)}})).status,404);
const detail=await (await request('/tickets/'+id,{headers:{'X-Feedback-Token':token}})).json();
assert.equal(detail.attachments.length,1);assert(!('token_hash' in detail));assert(!('payload_hash' in detail));
const auth={Authorization:'Bearer admin-session'};
assert.equal((await (await request('/admin/tickets',{headers:auth})).json()).length,1);
assert.equal((await request('/admin/tickets/'+id,{method:'PATCH',headers:auth,body:JSON.stringify({status:'已解决',reply:'已核对，谢谢。'})})).status,200);
assert.equal((await (await request('/tickets/'+id,{headers:{'X-Feedback-Token':token}})).json()).reply,'已核对，谢谢。');
quota=true;assert.equal((await request('/tickets',{method:'POST',body:form({ticketId:crypto.randomUUID()})})).status,429);
assert.equal((await createHandler({})(new Request(base))).status,503);
console.log('PASS: API origin/auth/access controls, body and image limits, private receipts, upload failure/retry/idempotency, admin replies, quota handling. Storage/Auth transport mocked; cloud schema and real persistence require deployment.');

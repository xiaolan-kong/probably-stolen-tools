import './assembler-model.js';
import './assembler-joint.js';
let enginePromise;
async function engine() {
  if(!enginePromise)enginePromise=(async()=>{
    const {dotnet}=await import('./planner/_framework/dotnet.js');
    const runtime=await dotnet.withDebugging(0).create();
    runtime.setModuleImports('planner',{publish:json=>postMessage(JSON.parse(json))});
    return runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
  })();
  let timeout;
  try {return await Promise.race([enginePromise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('搜索器加载超时，请检查网络后重试。')),60000);})]);}
  finally {clearTimeout(timeout);}
}
// Keep onmessage unset: .NET uses it to detect its own runtime worker (dotnet/runtime#114918).
self.addEventListener('message', async ({data}) => {
  if(!['parse','search','joint'].includes(data?.type))return;
  try {
    if(data.type==='parse') { postMessage({type:'parsed',snapshot:Assembler.readSave(data.text)}); return; }
    const {snapshot,machines,options}=data;
    for(const machine of machines)Assembler.validateGoal(machine,options.targets[machine.identifier]);
    postMessage({type:'loading',message:'正在准备搜索器，首次加载稍需等待。存档留在本机。'});
    const exports=await engine();
    postMessage({type:'loading',message:'搜索器已就绪，正在寻找方案…'});
    const result=JSON.parse(exports.Program.Search(JSON.stringify(data)));
    if(result.best){
      const candidate=data.type==='joint'?result.best:{machines:{[machines[0].key]:result.best}};
      Assembler.validateJoint(snapshot,machines,options,candidate);
    }
    postMessage(result);
  } catch(error) { postMessage({type:'error',message:error.message||String(error)}); }
});

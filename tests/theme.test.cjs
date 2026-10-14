const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/assets/theme.js'),'utf8');
function setup(saved,{dark=false,blocked=false}={}){
 const events={},button={attrs:{},setAttribute(name,value){this.attrs[name]=value;},addEventListener:(name,fn)=>events[name]=fn},feedback={hidden:true},root={dataset:{}};
 const media={matches:dark,addEventListener:(name,fn)=>events.system=fn};
 let stored=saved;
 const context={window:{matchMedia:()=>media,addEventListener:(name,fn)=>events[name]=fn},document:{documentElement:root,addEventListener:(name,fn)=>events.ready=fn,getElementById:id=>id==='theme'?button:feedback},localStorage:{getItem:()=>{if(blocked)throw Error('denied');return stored;},setItem:(key,value)=>{if(blocked)throw Error('denied');stored=value;}}};
 vm.runInNewContext(source,context);events.ready();
 return {root,button,feedback,media,events,getSaved:()=>stored};
}
const system=setup(null,{dark:true});assert.equal(system.root.dataset.theme,'dark');
system.media.matches=false;system.events.system();assert.equal(system.root.dataset.theme,'light');
system.events.click();assert.equal(system.getSaved(),'dark');
system.events.system();assert.equal(system.root.dataset.theme,'dark');
assert.equal(setup(system.getSaved()).root.dataset.theme,'dark');
const invalid=setup('bad',{dark:true});assert.equal(invalid.root.dataset.themeChoice,'system');assert.equal(invalid.root.dataset.theme,'dark');
const blocked=setup(null,{blocked:true});blocked.events.click();assert.equal(blocked.root.dataset.theme,'dark');assert.equal(blocked.feedback.hidden,false);
system.events.storage({key:'ps-tools-theme',newValue:'light'});assert.equal(system.root.dataset.theme,'light');
system.events.storage({key:null,newValue:null});assert.equal(system.root.dataset.themeChoice,'system');
assert.equal(system.button.attrs['aria-label'],'切换深色模式');system.events.click();assert.equal(system.button.attrs['aria-label'],'切换浅色模式');
console.log('PASS: initial system mode, preference restore, live system changes, explicit override, blocked storage, invalid storage, cross-tab changes.');

'use strict';
// Empty endpoint keeps the local prototype; configured endpoints use real submission.
(() => {
  const dialog = $('feedback-dialog');
  let pictures = [], pending = null;
  const submit=$('feedback-form').querySelector('[type=submit]');
  if(feedbackBase){
    document.querySelector('.feedback-notice').textContent='仅在提交时发送你填写的文字、图片和勾选的附带信息。截图请避开账号、密码等私人内容。';
    submit.textContent='提交反馈';
    document.querySelector('.privacy-note').textContent='计算在本机 · 反馈由你提交';
  } else {
    document.querySelector('.feedback-notice').textContent='接收后台尚未配置，填写内容和图片不会发送。';
    submit.textContent='检查反馈内容';
  }
  function changed(){pending=null;$('feedback-status').replaceChildren();}
  function context() {
    return ['深空当铺工具站 · 适用游戏 Demo 049-Rev5-L', '当前填写（未必已生成）：', describeDraft(draft()),
      generated ? `方案状态：${isStale() ? '已过期，输入已修改' : '与输入一致'}\n生成方案时的输入：\n${describeDraft(generated.draft)}\n当前查看：${$('result-title').textContent}\n${$('actions').innerText}` : '方案状态：尚未生成'
    ].join('\n');
  }
  function showPictures() {
    $('feedback-previews').replaceChildren(...pictures.map((p, i) => {
      const card = document.createElement('div'); card.className = 'feedback-picture';
      const img = document.createElement('img'); img.src = p.url; img.alt = `已选截图 ${i + 1}`;
      const label = document.createElement('span'); label.textContent = p.file.name;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除';
      remove.setAttribute('aria-label', `移除截图 ${i + 1}`);
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(p.url); pictures.splice(i, 1); showPictures(); changed();
      });
      card.append(img, label, remove); return card;
    }));
  }
  document.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => {
    $('feedback-context-preview').textContent = $('feedback-context').checked ? context() : '不附带当前输入和方案。';
    dialog.showModal();
  }));
  document.querySelector('[data-close-feedback]').addEventListener('click', () => dialog.close());
  $('feedback-context').addEventListener('change', () => {
    $('feedback-context-preview').textContent = $('feedback-context').checked ? context() : '不附带当前输入和方案。';
  });
  function addPictures(files) {
    if (!files.length) return;
    const error = pictures.length + files.length > 3 ? '最多添加 3 张截图，请先移除不需要的图片。'
      : files.some(f => !['image/png','image/jpeg','image/webp'].includes(f.type)) ? '请使用 JPG、PNG 或 WebP 图片。'
      : files.some(f => f.size > 5 * 1024 * 1024 || !f.size) ? '图片不能为空，单张不能超过 5 MB。' : '';
    $('feedback-file-error').textContent = error; $('feedback-file-error').hidden = !error;
    if (!error) {pictures.push(...files.map(file => ({file, url:URL.createObjectURL(file)}))); showPictures();}
    changed();
  }
  $('feedback-images').addEventListener('change', e => {
    addPictures([...e.target.files]); e.target.value = '';
  });
  dialog.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length) return; // 普通文字仍由输入框正常粘贴。
    e.preventDefault(); addPictures(files);
  });
  const dropzone = $('feedback-dropzone');
  dropzone.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', e => {
    if (!dropzone.contains(e.relatedTarget)) dropzone.classList.remove('dragging');
  });
  // 在弹窗其他位置放下文件也不能让浏览器离开当前页面。
  dialog.addEventListener('dragover', e => {if(e.dataTransfer.types.includes('Files')) e.preventDefault();});
  dialog.addEventListener('drop', e => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); dropzone.classList.remove('dragging'); addPictures([...e.dataTransfer.files]);
  });
  $('feedback-paste').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.read) throw Error('unsupported');
      const items = await navigator.clipboard.read(), files = [];
      for (const item of items) {
        const type = item.types.find(t => ['image/png','image/jpeg','image/webp'].includes(t));
        if (type) files.push(new File([await item.getType(type)], `截图-${files.length + 1}.${type.split('/')[1]}`, {type}));
      }
      if (!dialog.open) return;
      if (files.length) addPictures(files);
      else {$('feedback-file-error').hidden=false;$('feedback-file-error').textContent='剪贴板里没有图片。请先截图，再按 Ctrl+V 粘贴。';}
    } catch {
      if (!dialog.open) return;
      $('feedback-file-error').hidden=false;$('feedback-file-error').textContent='浏览器未允许读取剪贴板。请在问题描述框按 Ctrl+V 粘贴截图。';
    }
  });
  $('feedback-form').addEventListener('input', () => {changed(); $('feedback-message').setCustomValidity('');});
  $('feedback-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('feedback-message').value.trim()) {
      $('feedback-message').setCustomValidity('请写下问题或建议。'); $('feedback-message').reportValidity(); return;
    }
    if(!feedbackBase){$('feedback-status').textContent = `内容已检查，包含 ${pictures.length} 张截图。尚未发送：需要先接通反馈后台。`;return;}
    if(!pending)pending={id:crypto.randomUUID(),token:Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('')};
    const body=new FormData();
    for(const [key,value] of Object.entries({...pending,category:$('feedback-type').value,message:$('feedback-message').value.trim(),context:$('feedback-context').checked?context():'',website:$('feedback-website').value}))body.set(key,value);
    for(const {file} of pictures)body.append('images',file);
    $('feedback-form').inert=true;submit.disabled=true;submit.textContent='正在提交…';$('feedback-status').textContent='正在上传，请稍候。';
    try{
      const result=await feedbackRequest('/tickets',{method:'POST',body});
      if(result.id!==pending.id)throw Error('提交回执不正确，内容仍保留，请重试。');
      const receipt=new URL('feedback.html',location.href);receipt.hash=pending.id+'.'+pending.token;
      const link=document.createElement('a');link.href=receipt.href;link.textContent='查看处理进度';link.target='_blank';link.rel='noopener noreferrer';
      $('feedback-status').replaceChildren(document.createTextNode('已收到。请保存查询链接，不要公开分享。 '),link);
      $('feedback-message').value='';pictures.forEach(p=>URL.revokeObjectURL(p.url));pictures=[];showPictures();pending=null;
    }catch(error){$('feedback-status').textContent=error.message;}
    finally{$('feedback-form').inert=false;submit.disabled=false;submit.textContent='提交反馈';}
  });
})();

'use strict';
// Empty endpoint keeps the local prototype; configured endpoints use real submission.
(() => {
  const $=id=>document.getElementById(id),dialog=$('feedback-dialog');
  const guide = document.body.classList.contains('guide-page');
  dialog.innerHTML = `<button type="button" class="close" data-close-feedback aria-label="关闭反馈">×</button>
<h2 id="feedback-title">反馈问题</h2><p>哪里不对，或希望增加什么？文字和截图一起告诉我们。</p>
<p class="feedback-notice">访问时仅发送页面类别用于累计每日访问量；不设置访客标识，不发送计算输入。反馈仅在提交时发送你填写的文字、图片和勾选的附带信息。截图请避开账号、密码等私人内容。</p>
<form id="feedback-form">
<div hidden aria-hidden="true"><label for="feedback-website">Website</label><input id="feedback-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
<label for="feedback-type">反馈类型</label><select id="feedback-type"><option>计算结果不符</option><option>页面使用问题</option><option>功能建议</option><option>其他</option></select>
<label for="feedback-message">问题描述</label><textarea id="feedback-message" rows="4" maxlength="3000" required placeholder="做了什么？预期怎样？实际出现了什么？"></textarea>
<div id="feedback-dropzone"><strong>粘贴或拖入截图</strong><p>截图后直接按 <kbd>Ctrl</kbd> + <kbd>V</kbd>，不用保存文件</p><div class="feedback-image-actions"><button type="button" id="feedback-paste">粘贴截图</button><label class="feedback-file-button">选择图片<input id="feedback-images" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-describedby="feedback-image-hint" aria-label="选择图片"></label></div></div><p id="feedback-image-hint" class="field-hint">最多 3 张，单张不超过 5 MB，支持 JPG、PNG、WebP。</p><div id="feedback-previews"></div><p id="feedback-file-error" role="alert" hidden></p>

<label class="inline-check"><input id="feedback-context" type="checkbox"> <span id="feedback-context-label"></span></label><details class="feedback-context"><summary>查看附带的信息</summary><pre id="feedback-context-preview"></pre></details>
<button type="submit" class="primary">提交反馈</button><p id="feedback-status" role="status"></p>
</form>`;
  $('feedback-context-label').textContent = dialog.dataset.contextLabel;
  $('feedback-context').checked = dialog.hasAttribute('data-include-context');
  if (guide) $('feedback-type').value = '页面使用问题';
  document.querySelector('.site-header a[aria-current=page]')?.addEventListener('click',event=>event.preventDefault());
  let pictures = [], pending = null;
  const submit=$('feedback-form').querySelector('[type=submit]');
  if(feedbackBase){
    document.querySelector('.feedback-notice').textContent='仅在提交时发送你填写的文字、图片和勾选的附带信息。截图请避开账号、密码等私人内容。';
    submit.textContent='提交反馈';
  } else {
    document.querySelector('.feedback-notice').textContent='接收后台尚未配置，填写内容和图片不会发送。';
    submit.textContent='检查反馈内容';
  }
  function changed(){pending=null;$('feedback-status').replaceChildren();}
  function context() {
    if (guide) return [document.title, location.pathname].join('\n');
    if(window.assemblerFeedbackContext)return window.assemblerFeedbackContext();
    return ['深空当铺工具站 · 犯罪规则：正式版 VERSION 100 / Build 26284217', '当前填写（未必已生成）：', describeDraft(draft()),
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
  function previewContext() {
    const empty = guide ? '不附带攻略页面信息。' : '不附带当前输入和方案。';
    $('feedback-context-preview').textContent = $('feedback-context').checked ? context() : empty;
  }
  document.querySelectorAll('[data-feedback]').forEach(button => button.addEventListener('click', () => {
    previewContext();
    dialog.showModal();
  }));
  document.querySelector('[data-close-feedback]').addEventListener('click', () => dialog.close());
  $('feedback-context').addEventListener('change', previewContext);
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

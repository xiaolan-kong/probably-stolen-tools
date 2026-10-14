# 深空当铺工具站

试用版 `v0.1.0-rc.2`，适用游戏 `Demo 049-Rev5-L`。犯罪金额计算器、服务方案比较、逐日安排、声望范围与最高金额表。无需安装依赖或登录；计算在浏览器完成，主题偏好保存在本机。

文字＋图片反馈已接通 Supabase，玩家免登录提交，用私有查询链接查看处理结果；管理员在 `admin.html` 登录、查看、回复。模块组装器仍在规划中。

[打开工具站](https://xiaolan-kong.github.io/probably-stolen-tools/) · [反馈后台](https://xiaolan-kong.github.io/probably-stolen-tools/admin.html)

## 发布到 GitHub Pages

已于 2026-10-14 发布至 `xiaolan-kong/probably-stolen-tools`。线上版本 `v0.1.0-rc.2`，部署提交 `836f6cc001baebd1e77ef11e23ed4544e50bdcd9`。[首次发布检查与部署均通过](https://github.com/xiaolan-kong/probably-stolen-tools/actions/runs/38506381011)。以下步骤供后续维护参考。

1. 确认公开发布后，将本文件夹内容上传到目标 GitHub 仓库；不要上传整个素材文件夹、本机研究证据、截图、存档或游戏程序。
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。
3. 在 **Settings → Environments → github-pages** 将部署分支限制为 `main`。
4. 在 Supabase 的 Edge Functions → Secrets，将正式网址的 Origin（例如 `https://<账号>.github.io`，不含仓库路径）加入 `FEEDBACK_ALLOWED_ORIGINS`。不要填写通配符。管理员 UUID 保存在 `FEEDBACK_ADMIN_IDS`，不放网页；当前已绑定站主管理员。
5. 在 **Actions → Publish GitHub Pages → Run workflow**，选择 `main` 后手动运行。工作流会检查反馈接口是否允许该 GitHub Pages Origin，配置遗漏时阻止部署。
6. 检查 `check` 和 `deploy` 都成功，再打开部署输出的网址。网址形式为 `https://<账号>.github.io/probably-stolen-tools/`，实际值以 GitHub 返回为准。

工作流只允许手动触发，推送文件不会自动发布。先通过规则与发布文件检查，再上传 `dist` 并部署。网页所有资源使用相对路径，可放在项目子目录，没有外部字体、CDN或统计脚本。

## 检查与更新

在仓库根目录用 Node.js 24 运行：

```text
node tests/model.test.cjs
node tests/ranges.test.cjs
node tests/theme.test.cjs
node tests/additions.test.cjs
node tests/feedback-api.test.mjs
node tests/release.test.cjs
```

`release-manifest.json` 锁定本次审核的网页文件哈希。文件变更后检查会失败；应先重新检查页面和规则，再生成新的候选版本及清单，不要跳过检查来发布。

首次上线后：检查 HTTPS、所有资源、手机布局、满100和冷却输入、方案切换与修改后重新生成。用中国大陆节点测试实际页面及图标；之前第三方测试页可访问不能代替本站验收。正式网址确定前没有添加域名、canonical或sitemap。

回滚：保留前一次已验证版本，恢复其 `dist` 与对应清单，再手动运行工作流；不要只回滚一份脚本造成规则与界面错配。

## 规则与边界

规则核对日期：2026-10-14。依据本机游戏原生程序静态分析和离线边界核算，不代表官方工具或完整游戏实机验收。已核对按罪名减额、调查增长、清除冷却14天、已派警的证据遗失扣20，以及上层区声望≤−60时扣40。声望区间按较不利代表值保守估算。

不预测后续新增、延迟入账、额外搜查、声望变化或特殊救济；隔天报告变化后需重新输入。无可行方案不等于必死。此前玩家观察到的总扣30场景尚未复现，不把它解释为固定扣30。

本站不自动上传计算输入或存档。玩家主动提交反馈时，文字、所选图片及勾选的计算信息发送到 Supabase；截图请避开密码等私人内容。查询链接等同查看凭证，请保存且不要公开分享。表与图片桶保持私有，网页不内置服务密钥。GitHub Pages 和 Supabase 会按各自政策处理访问日志。

反馈初期限额：每条3000字、最多3张图片（每张5 MB），全站滚动24小时最多30条，总图片预留750 MiB。免费项目连续7天低活跃可能暂停，需要站主在 Supabase 恢复；没有付费升级或自动保活。后台会话保留在当前页面内存，刷新后需重新登录。没有邮件通知、追加消息或公开反馈列表。

正式站点已完成：17 个公开资源与发布清单逐项哈希一致；示例计算、修改后重新生成、调查满100与冷却输入、单独善后人方案；剪贴板截图和文字提交、管理员登录与回复、玩家刷新查看回复及图片。未登录管理接口返回401，错误查询凭证404，非法Origin403，图片公开访问被拒绝。本机绕过应用代理访问首页200、反馈预检204；这不构成大陆所有运营商或实际手机的可达保证。Supabase 架构在 `backend/supabase`，这些文件不属于 Pages 上传的 `dist`。

游戏名称、服务名称及两枚服务图标来自 Probably Stolen，相关权利归原权利人；本站为非官方玩家工具。此仓库不包含游戏程序、反汇编或玩家存档，未给游戏素材附加开源授权。

## 部署依据

- [GitHub Pages 静态托管及访问数据说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

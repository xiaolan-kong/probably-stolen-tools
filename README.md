# 深空当铺工具站

试用版 `v0.2.0`，适用游戏 `Demo 049-Rev5-L`。犯罪金额计算器、服务方案比较、逐日安排、准确声望、分类罪行与当天追加额度。无需安装依赖或登录；计算在浏览器完成，主题偏好保存在本机。

文字＋图片反馈已接通 Supabase，玩家免登录提交，用私有查询链接查看处理结果；管理员在 `admin.html` 登录、查看、回复。模块组装器支持真实存档、单机与联合装配、共享锁定、按步骤装配指导和实时最佳方案。

## 发布到 GitHub Pages

正式站点：https://xiaolan-kong.github.io/probably-stolen-tools/ 。仓库 `xiaolan-kong/probably-stolen-tools`，发布分支 `main`；本包为 v0.2.0 更新候选。以 GitHub Actions 成功与公开资源核验为上线依据。

1. 确认公开发布后，将本文件夹内容上传到目标 GitHub 仓库；不要上传整个素材文件夹、本机研究证据、截图、存档或游戏程序。
2. 仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。
3. 在 **Settings → Environments → github-pages** 将部署分支限制为 `main`。
4. 在 Supabase 的 Edge Functions → Secrets，将正式网址的 Origin（例如 `https://<账号>.github.io`，不含仓库路径）加入 `FEEDBACK_ALLOWED_ORIGINS`。不要填写通配符。管理员 UUID 保存在 `FEEDBACK_ADMIN_IDS`，不放网页；当前已绑定站主管理员。
5. 在 **Actions → Publish GitHub Pages → Run workflow**，选择 `main` 后手动运行。工作流会检查反馈接口是否允许该 GitHub Pages Origin，配置遗漏时阻止部署。
6. 检查 `check` 和 `deploy` 都成功，再打开部署输出的网址。网址形式为 `https://<账号>.github.io/probably-stolen-tools/`，实际值以 GitHub 返回为准。

工作流只允许手动触发，推送文件不会自动发布。先通过规则与发布文件检查，再上传 `dist` 并部署。网页所有资源使用相对路径，可放在项目子目录，没有外部字体、CDN或第三方统计服务。

## 检查与更新

在仓库根目录用 Node.js 24 运行：

```text
node tests/model.test.cjs
node tests/ranges.test.cjs
node tests/theme.test.cjs
node tests/additions.test.cjs
node tests/fines.test.cjs
node tests/crime-types.test.cjs
node tests/analytics.test.cjs
node tests/feedback-api.test.mjs
node tests/assembler.test.cjs
node tests/assembler-sprites.test.cjs
node tests/assembler-local-pieces.test.cjs
node tests/assembler-retention.test.cjs
node tests/tool-session.test.cjs
node tests/release.test.cjs
```

`release-manifest.json` 锁定本次审核的网页文件哈希。文件变更后检查会失败；应先重新检查页面和规则，再生成新的候选版本及清单，不要跳过检查来发布。

首次上线后：检查 HTTPS、所有资源、手机布局、满100和冷却输入、方案切换与修改后重新生成。用中国大陆节点测试实际页面及图标；之前第三方测试页可访问不能代替本站验收。正式网址确定前没有添加域名、canonical或sitemap。

回滚：保留前一次已验证版本，恢复其 `dist` 与对应清单，再手动运行工作流；不要只回滚一份脚本造成规则与界面错配。

## 模块组装器

存档在浏览器本机解析，不上传、不改写。单机与联合共享导入数据、锁定和操作进度；切换工具页面保留当前标签页的数据。搜索使用同源 Mod 核心的 WebAssembly 产物，标准约 1 分钟，深度最多 5 分钟；同条件保留历史最佳并实时展示效果，可以随时停止。限时搜索不保证全局最优。

网页不能感知游戏中实际搬移；照图操作后确认装好并锁定，或保存游戏后重新导入。适用 Demo 049-Rev5-L；已完成真实存档离线核验及 Native/WASM 对照，尚未进行游戏内照图装配验收。

## 规则与边界

规则核对日期：2026-10-14。依据本机游戏原生程序静态分析和离线边界核算，不代表官方工具或完整游戏实机验收。已核对按罪名减额、调查增长、清除冷却14天、已派警的证据遗失扣20，以及上层区声望≤−60时扣40。治安声望填写准确数值，支持小数；同罪名先合并再减额。

可勾选并按罪名填写当天预计新增的正式犯罪金额，合并生成方案并逐类计算剩余额度；各类上限不能相加。并非成交额或瓶数，不自动转换假水等隐藏追踪器。其后新增、延迟入账、现场搜查或外部声望变化不纳入；隔天报告变化后需重新输入。罚款按能支付计算，所需现金及服务费须留足；付不起可能被拘捕。无可行方案不等于必死。此前玩家观察到的总扣30场景尚未复现，不把它解释为固定扣30。

本站不自动上传计算输入或存档。玩家主动提交反馈时，文字、所选图片及勾选的计算信息发送到 Supabase；截图请避开密码等私人内容。查询链接等同查看凭证，请保存且不要公开分享。表与图片桶保持私有，网页不内置服务密钥。GitHub Pages 和 Supabase 会按各自政策处理访问日志。

反馈初期限额：每条3000字、最多3张图片（每张5 MB），全站滚动24小时最多30条，总图片预留750 MiB。免费项目连续7天低活跃可能暂停，需要站主在 Supabase 恢复；没有付费升级或自动保活。后台会话保留在当前页面内存，刷新后需重新登录。没有邮件通知、追加消息或公开反馈列表。

已完成本地页面到真实云端的提交、图片读取、管理员回复、刷新查询及权限拒绝检查。v0.1.0-rc.2 已验证正式站点反馈闭环；本次沿用反馈功能并增加访问统计接口。大陆各节点访问／上传不作保证。Supabase 架构在 `backend/supabase`，这些文件不属于 Pages 上传的 `dist`。

## 访问统计

复用 Supabase，按北京时间记录每日及各页面的加载次数（PV），包括刷新。只发送 `calculator` 或 `feedback` 页面类别，不上传计算输入、查询凭证、完整网址、来源网址或访客标识。管理员登录 `admin.html` 后查看最近30天；后台、本地预览不计入，不提供独立访客数，也不回填历史。客户端拦截或网络失败会漏计，自动请求可造成虚增；这是基础趋势统计。

部署后台时先执行 `202610140002_page_views.sql`，再更新现有 `feedback` 函数。计数表和函数仅服务端可读写，管理员查询沿用现有身份校验；并发计数由数据库原子累加。平台自身访问日志依其政策处理。

## 后续方向

本版包含计算器和模块组装器；后续参考 [Probably Stolen Wiki](https://probably-stolen.nicokobo.com/zh) 的攻略组织方式，将现有攻略集中到工具站。本版未迁移或复制对方内容。

游戏名称、服务名称、机器和模组图片来自 Probably Stolen，相关权利归原权利人；本站为非官方玩家工具。此仓库不包含游戏程序、反汇编或玩家存档，未给游戏素材附加开源授权。

## 部署依据

- [GitHub Pages 静态托管及访问数据说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

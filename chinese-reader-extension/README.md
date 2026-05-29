# 中文框选朗读 + 视频字幕跟读 (Chinese Reader Extension)

一个 Microsoft Edge / Chromium 浏览器插件：

1. **框选朗读**：在网页上拖拽出一个矩形，自动提取并朗读其中的中文文本。
2. **视频字幕跟读**：框选视频字幕区域后锁定，边播放边自动朗读每一句新出现的字幕（适合中文学习/无障碍场景）。

## 功能一览

- 🟦 **框选朗读**：开启后按住左键拖出矩形，松开即朗读其中的中文。
- ✋ **选区可调整**：框完之后选区进入"调整阶段"——8 个把手缩放、内部拖动整体平移；满意后按 ✓ 确认或回车，按 ✕ / Esc 取消。
- 🎬 **视频字幕跟读**：把字幕区域作为监听窗口，新字幕一出现就接力朗读，可选「打断模式」让朗读始终贴近视频进度。
- 🔊 **音量增强 (0-200%)**：>100% 时自动接管页面 `<video>/<audio>` 的音频流（Web Audio `GainNode`），整体放大到最高 2 倍。
- 🎭 **10 种音色预设**：内置 Edge 微软在线神经语音（晓晓 / 云希 / 云扬 / 云健 / 晓伊 / 云枫 / 云皓 / 云夏 / 云泽 / 晓辰），按关键词自动匹配系统已安装的对应 voice，未安装会标注。
- 🛠️ **悬浮工具栏**：播放 / 暂停 / 停止 / 复制 / 退出，全部触手可及。
- 🔡 **中文过滤**：可选「仅朗读中文」，自动忽略英文和无关符号。
- ⌨️ **快捷键**：
  - `Alt+Shift+R` 切换框选朗读
  - `Alt+Shift+V` 切换视频字幕跟读
  - `Alt+Shift+S` 停止朗读
  - `Enter` 确认调整中的选区
  - `Esc` 退出当前模式
- 🖱️ **右键菜单**：选中文本一键朗读；视频上右键直接进入字幕跟读。
- 🎨 **个性化**：调节语速、音调、音量、选框颜色。

## 安装（开发者模式加载）

1. 打开 Edge，访问 `edge://extensions/`（或 Chrome 的 `chrome://extensions/`）。
2. 右上角打开「开发人员模式」。
3. 点击「加载解压缩的扩展」，选择本目录 `chinese-reader-extension`。
4. 工具栏会出现"读"字图标，点击即可使用。

## 使用方式

### A. 普通框选朗读

1. 点击工具栏图标，按「开启框选朗读」，或按 `Alt+Shift+R`。
2. 鼠标变成十字光标，按住左键拖出一个矩形覆盖目标文字。
3. 松开后选区进入**调整阶段**——拖 8 个圆点缩放、拖中心平移；位置不满意可点"↺ 重画"。
4. 按 `Enter` 或点 ✓ 确认，自动开始朗读并显示控制条。
5. 按 `Esc` 或再次按 `Alt+Shift+R` 退出。

### B. 视频字幕跟读

1. 在视频网页（YouTube / Bilibili / Netflix 等）打开字幕。
2. 点击工具栏图标，按「视频字幕跟读」，或按 `Alt+Shift+V`。
3. 拖动一个矩形覆盖字幕区域，松开后**调整选框使其精确贴合字幕**（一定要确认这一步：太大可能读到旁边文字，太小漏字）。
4. 按 ✓ 确认 → 区域被锁定，遮罩自动隐藏，**视频继续可点击播放**。
5. 锁定区周围会出现一个橙色的呼吸边框，每当区域内的文字发生变化（即字幕滚动到新一句），插件就会自动朗读新出现的中文。
6. 控制条上：
   - **打断:开/关** — 切换是否让新字幕立即打断上一句（默认开，更贴合视频节奏）。
   - **⏹** — 停止当前朗读但不退出监听。
   - **⏏ 退出** — 完全退出字幕跟读。
7. `Esc` 同样可一键退出。

### C. 音量与音色

- **音量条** 0% ~ 200%：
  - ≤ 100%：仅控制朗读音量。
  - \> 100%：通过 Web Audio `GainNode` 同步放大网页内 `<video>` / `<audio>`，让视频和朗读整体更响（在 popup / 设置页里都可以关闭这个行为）。
- **音色预设**：popup 顶部"音色"下拉里 10 种 Microsoft 中文神经音色，未安装的会标注"· 未安装"。Edge 自带这些在线神经语音，效果最好。如果你在普通 Chrome 上看到全是"未安装"，可以把扩展加载到 Edge 里使用，或者在系统语音设置里安装中文 TTS 包。

## 文件结构

```
chinese-reader-extension/
├─ manifest.json        # 扩展清单（Manifest V3，含字幕跟读快捷键）
├─ background.js        # 后台脚本：快捷键、右键菜单
├─ content.js           # 内容脚本：框选 UI、文本提取、TTS、字幕监听
├─ content.css          # 框选遮罩、锁定边框、工具栏、提示样式
├─ popup.html / .css / .js     # 工具栏弹窗（含字幕跟读入口）
├─ options.html / .css / .js   # 完整设置页 + 试听
└─ icons/               # 16 / 48 / 128 图标
```

## 技术说明

- 基于 **Manifest V3**，使用 `service_worker` 作为后台。
- 朗读使用浏览器原生 [Web Speech API](https://developer.mozilla.org/zh-CN/docs/Web/API/SpeechSynthesis) 的 `speechSynthesis`。
- **文本提取**：`TreeWalker` 遍历 DOM 文本节点，借 `Range.getClientRects()` 与选框矩形求交集，命中即纳入。
- **选区调整**：松开鼠标后保留矩形，注入 8 个 resize 把手（`nw/n/ne/e/se/s/sw/w`），中心区域监听 mousedown 实现整体拖动；最小尺寸 / 视口边界双向 clamp。
- **字幕跟读**：
  - 锁定矩形作为视口监听区，移除遮罩使视频可继续交互。
  - 同时启用 `setInterval`（默认 300ms 轮询）+ `MutationObserver`（订阅锁定区最深公共祖先的子树/字符变化），双保险捕获字幕更新。
  - 维护「最近 N 条」队列对相同/重排字幕去重，避免重复朗读。
  - 默认「打断模式」：新字幕到来立即 `cancel()` 当前 utterance 再朗读新句，朗读节奏不会落后。
- **音量增强 (>100%)**：Web Speech `utterance.volume` 规范上限是 1.0，无法直接超过。本扩展额外为页面所有 `<video>/<audio>` 创建 `MediaElementAudioSourceNode → GainNode → destination` 通路，将 `gain.value` 设为 1.0~2.0；并用 `MutationObserver` 监听新插入的媒体元素自动接管。
- **音色预设**：以 `Xiaoxiao / Yunxi / Yunyang ...` 等关键词在 `speechSynthesis.getVoices()` 里 fuzzy 匹配，命中即作为 utterance 的 voice。未命中（用户系统没装该语音）会回退到「声源」下拉的选择，再回退到默认中文。
- **中文过滤**：保留 CJK 统一汉字范围、中文标点、数字与必要空白。

## 自定义快捷键

访问 `edge://extensions/shortcuts`（Chrome 为 `chrome://extensions/shortcuts`）即可自定义。

## 适用与已知限制

- ✅ 适用：字幕以 **DOM/SVG/Canvas 文本** 形式呈现的视频站点（YouTube CC、Bilibili 弹幕字幕、Netflix Web、各类在线课程平台等）。
- ❌ 不适用：字幕**烧录在画面像素里**的视频（一些影视盗版站、本地视频流的硬字幕），需要 OCR 才能识别，不在本插件范围。
- 🔉 音量增强对**部分网站可能失效**：站点若已对自己的 `<video>` 接入了 `MediaElementAudioSourceNode`（独占源），浏览器会拒绝再次接入，此时 GainNode 接不上去；可关闭「音量同步放大」选项，仅靠系统音量。
- 浏览器内部页（`edge://`、`chrome://`、扩展商店页等）不允许注入内容脚本。
- 跨域 iframe（如部分嵌入式播放器）受同源限制，可能读不到内部字幕节点；如需穿透，可在 `manifest.json` 加入 `"all_frames": true`。
- 音色预设里的 Microsoft 神经语音是 Edge 自带的**在线**语音，离线时朗读会回退到本地中文。
- 字幕跟读需要"在视口里能选到的 DOM 文本"才能工作。如果视频是全屏播放，请先退出全屏再框选；锁定后再进入全屏不影响监听。

## 登录注册 + 留言板（Firebase）

设置页底部新增「Firebase 配置 / 账号 / 留言板」三张卡片。后端使用 Firebase Auth + Firestore，扩展通过 REST API 直接调用，**不需要部署任何服务器**。

### 一次性启用步骤

1. 打开 [Firebase Console](https://console.firebase.google.com/)，新建一个项目（免费 Spark 套餐够用）。
2. 左侧 **Build → Authentication → Get started**，在「Sign-in method」里启用 **Email/Password**。
3. 左侧 **Build → Firestore Database → Create database**，选「Production mode」，地区按需选择。
4. 在 **Firestore → Rules** 粘贴下面这段安全规则并发布：
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /messages/{id} {
         allow read: if true;                          // 任何人可读
         allow create: if request.auth != null
                       && request.resource.data.uid == request.auth.uid
                       && request.resource.data.content is string
                       && request.resource.data.content.size() > 0
                       && request.resource.data.content.size() <= 500;
         allow delete: if request.auth != null
                       && resource.data.uid == request.auth.uid;
         allow update: if false;
       }
     }
   }
   ```
5. 项目设置（齿轮图标 → Project settings）→「General」→「Your apps」→ 添加一个 **Web App**，复制其中的 `apiKey` 与 `projectId`。
6. 打开扩展的 **更多设置** 页，把上面两个值填进「Firebase 配置」卡片，点保存。

### 使用

- **注册 / 登录**：在「账号」卡片输入邮箱密码，点注册或登录。token 自动持久化到 `chrome.storage.local`，后续会用 refresh token 自动续签。
- **发布留言**：登录后在「留言板」填昵称（可选）+ 内容，点发布。
- **删除自己**：自己发的留言右上角会显示「删除」按钮；别人的不显示。安全规则已经在服务端兜底。
- **匿名浏览**：未登录也可以读留言。

### 小提示

- API Key 不是机密，可以放心填到扩展里——它只是一个项目标识符；真正的访问控制由 Firestore 规则负责。
- 如果留言加载失败，先检查 Firestore 是否启用、规则是否粘贴，以及 `projectId` 是否正确（不带 `https://`）。
- 留言列表默认按 `createdAt` 倒序、加载最近 50 条。

## 发布到浏览器商店

> AI 不能替你点"提交"按钮——发布需要本人开发者账号、身份验证、部分平台还要付注册费。但项目已经处于"提交即过"的状态。

### 一键打包

```bash
node build.js
```

会在 `dist/` 下生成两份压缩包：

| 商店 | 用哪个 zip | 注册费 | 审核周期 |
|---|---|---|---|
| Chrome Web Store | `dist/chrome.zip` | $5 一次性 | 1-3 天 |
| Microsoft Edge Add-ons | `dist/chrome.zip`（同一份） | 免费 | 1-7 天 |
| Firefox Add-ons (AMO) | `dist/firefox.zip` | 免费 | 几小时 - 10 天 |

Firefox 版本的 manifest 与 Chrome 版本不同（`background.scripts` + `browser_specific_settings.gecko.id`），脚本会自动从 `manifest_firefox.json` 替换。

### 详细文档

| 文件 | 内容 |
|---|---|
| `publishing/SUBMIT_GUIDE.md` | 三大商店一步步提交流程 + 常见拒绝原因 |
| `publishing/STORE_LISTING.md` | 标题 / 简介 / 详情 / 关键词 / 分类 / 权限说明，复制粘贴即可 |
| `publishing/PRIVACY.md` | 隐私政策（建议 push 到 GitHub Pages 取得公开 URL） |
| `publishing/SAFARI_GUIDE.md` | Safari 扩展原理 + macOS 转换流程（需要 Mac + Apple Developer $99/年） |

### 你需要自备的素材

- [ ] 1280×800 截图至少 1 张（推荐 4-5 张）
- [ ] 大图：Chrome / Edge 1400×560，Firefox 1400×400
- [ ] 隐私政策的 https 公开链接（最简单：把 `publishing/PRIVACY.md` 推到 GitHub Pages 或 Gist）
- [ ] 开发者联系邮箱

### 更新版本

改 `manifest.json` 里的 `version`（必须严格递增）→ `node build.js` → 在三个商店分别上传新 zip + 简短改动说明。

## License

MIT
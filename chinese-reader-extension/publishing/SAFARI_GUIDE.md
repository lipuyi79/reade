# Safari 扩展发布指南

> **重要**：Safari 扩展不像 Chrome / Firefox 那样直接传 zip。它必须先用 Xcode 工具链转换为一个**原生 macOS / iOS App**，再以 App 的形式提交到 Mac App Store / iOS App Store。整个流程**必须在 macOS 上完成**，且需要苹果开发者账号 ($99 / 年)。

---

## 是否值得做？

| 做 / 不做 | 原因 |
|---|---|
| ❌ 暂不做（推荐） | 工作量大、年费 $99、Safari 用户对中文 TTS 扩展需求小、`speechSynthesis` 在 Safari 的中文语音质量有限 |
| ✅ 必须做 | 你有大量 Mac / iPhone Safari 用户群，且已有苹果开发者账号 |

如果你勾选了"先 Chrome / Edge / Firefox"，可以**先发布这三家收集反馈**，再视情况决定是否进 Safari。

---

## 转换原理

Safari 14+ 支持 Web Extensions API（也是基于 manifest），但分发要打成 App。流程：

```
chrome-reader-extension/  (你的源码)
        │
        │  xcrun safari-web-extension-converter
        ▼
ChineseReader.xcodeproj   (生成的 Xcode 项目，包含一个 macOS App + 一个 iOS App)
        │
        │  Xcode → Archive → App Store Connect
        ▼
Mac App Store / iOS App Store
```

---

## 在 Mac 上的步骤

### 1. 准备

- macOS Ventura+
- Xcode 15+（App Store 免费下载）
- Apple Developer Program 会员（$99 / 年）：https://developer.apple.com/programs/

### 2. 转换

把整个 `chinese-reader-extension/` 目录复制到 Mac，在终端执行：

```bash
xcrun safari-web-extension-converter chinese-reader-extension --project-location ./safari-build --bundle-identifier com.yourname.chinesereader --copy-resources
```

参数说明：
- `--bundle-identifier` 必须全局唯一，建议 `com.<你的域名反写>.<项目>` 形式
- `--copy-resources` 把源文件复制进项目，避免转换后改源码不生效
- `--project-location` 输出目录

### 3. 在 Xcode 里测试

1. 打开生成的 `safari-build/ChineseReader/ChineseReader.xcodeproj`
2. 选 **macOS (Build & Run)**，按 ⌘R 启动；会弹出一个空 App 窗口
3. 在 Safari 偏好设置 → 扩展 → 启用 ChineseReader
4. 测试框选朗读 / 字幕跟读 / 留言板是否正常

### 4. 已知兼容点

| 项 | Safari 行为 | 是否要改 |
|---|---|---|
| `chrome.*` API | Safari 同时支持 `chrome.*` 和 `browser.*` 命名空间 | 不改 |
| `service_worker` background | Safari 不支持，需改成 `background.scripts` 或 `background.page` | 转换器一般会自动处理；如果不行，参考 `manifest_firefox.json` 那种写法 |
| `chrome.storage.sync` | Safari 把 sync 当作 local 处理 | 不影响功能 |
| `speechSynthesis` 中文语音 | Safari 自带的中文语音偏少且质量一般；预设可能很多显示「未安装」 | 用户体验下降，但不阻塞发布 |
| Web Audio + GainNode 增强媒体音量 | Safari 的 `MediaElementAudioSourceNode` 跨域限制更严，许多视频站可能接不上 | 提示用户该功能在 Safari 上"尽力而为" |
| Firebase REST | 完全可用 | 不改 |

### 5. 提交到 App Store

1. Xcode 顶部菜单 **Product → Archive**
2. 在 Organizer 里选刚生成的归档，点 **Distribute App → App Store Connect**
3. 在 https://appstoreconnect.apple.com 创建对应 App，填写：
   - 应用名称、副标题、描述（中英文）
   - 截图（macOS 1280×800 / iOS 各机型尺寸）
   - 分类：**工具 (Utilities)** 或 **效率 (Productivity)**
   - 隐私政策 URL（同其他商店）
   - 用 `STORE_LISTING.md` 文案，但需翻译成英文
4. 在 App Store Connect 提交审核。**审核周期 1-7 天**。

### 6. iOS 版本

转换器会同时生成一个 iOS Target。可以一并提交，让 iPhone 用户也能在 Safari 中使用扩展。但在 iPhone 上：
- 框选交互很难（屏幕小，难精确拖动）
- 视频字幕场景较少（多数移动端视频是原生播放器，不是 DOM 字幕）

**建议先只发 macOS 版本**，iOS 版根据反馈再做。

---

## 常见问题

**Q：能不能不进 Mac App Store，直接让用户拖入 Safari 安装？**

不能。Safari 14 起强制要求扩展走 App Store 分发，自分发已被废止（除非企业内部签名）。

**Q：审核会不会因为 Firebase 被拒？**

不会。任何应用都可以调外部 API，只要在隐私政策里如实写明就好。我们的 PRIVACY.md 已写明 Firebase 是用户可选且由用户自管。

**Q：我没有 Mac，能完成吗？**

不能。`safari-web-extension-converter` 只在 macOS 上存在。你可以：
- 用云端 Mac 服务（MacInCloud、AWS EC2 Mac instance）
- 找朋友借 Mac
- 暂时放弃 Safari，先发其他三家

---

## 总结

Safari 是单独的生态，转换可行但成本明显高于 Chrome / Edge / Firefox。优先把前三家发好、有了一定用户基础后，再评估是否进 Safari。

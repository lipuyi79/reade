# 隐私政策（Privacy Policy）

最后更新：2026-05-27

## 我们收集什么

**没有任何浏览数据、点击、阅读内容会被本扩展上传到任何第三方服务器。**

具体行为如下：

| 类别 | 处理方式 | 是否离开你的设备 |
|---|---|---|
| 选区里的中文文本 | 提取后调用浏览器内置 Web Speech API 朗读 | 否 |
| 视频字幕区文本 | 同上，触发 TTS | 否 |
| 设置（语速 / 音色 / 选框颜色 / 是否仅朗读中文） | 保存到 `chrome.storage.sync` | 仅在用户登录浏览器并启用同步时，由浏览器同步到自己的账号；扩展开发者无法访问 |
| Firebase 配置（API Key / Project ID） | 用户**自行**填写，保存到 `chrome.storage.local` | 仅在用户使用留言/登录功能时，发送到用户**自己创建的** Firebase 项目 |
| 登录会话 token | 存到 `chrome.storage.local`，到期自动续签 | 仅在用户主动登录时与 Google Identity Toolkit 通信 |
| 留言内容 | 由用户主动发布到用户自己的 Firestore 实例 | 仅在用户点"发布"时，发往用户**自己**的 Firebase 后端 |

## 第三方

- **浏览器原生 Web Speech API**：调用本地（或浏览器内置的在线神经语音）TTS，由浏览器厂商负责。
- **Microsoft 在线神经语音（Edge 自带）**：当用户在 Edge 上使用相应音色预设时，由 Edge 浏览器自身处理音频请求；本扩展不直接联网。
- **Firebase（可选）**：仅当用户启用登录/留言功能且填入了**自己的** Firebase 项目凭据时才生效。本扩展开发者不运营任何 Firebase 项目，无法访问任何留言。

## 网络访问

扩展唯一会主动发起的外部 HTTPS 请求是：用户启用登录/留言后，与其自己配置的 Firebase 项目通信（`identitytoolkit.googleapis.com` / `securetoken.googleapis.com` / `firestore.googleapis.com`）。除此之外，扩展不发起任何网络请求。

## 不包含

- 本扩展不嵌入任何分析 SDK（Google Analytics、Mixpanel 等）。
- 本扩展不包含任何广告。
- 本扩展不包含远程脚本加载。

## 联系方式

如有疑问或反馈，请通过商店页面的「开发者联系方式」与我们联系。

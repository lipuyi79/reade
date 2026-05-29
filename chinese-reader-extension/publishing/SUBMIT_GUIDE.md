# 提交到浏览器商店：完整流程

> **重要**：发布扩展必须由开发者本人完成，需要：1) 真实身份信息，2) 部分平台收注册费，3) 同意各商店开发者协议。AI 无法代为提交。

---

## 提交前一次性准备

### 必须准备

- [ ] **图标** — 已有 `icons/icon16.png`、`icon48.png`、`icon128.png`。请确认 128 × 128 的图标是清晰的高质量图（商店列表展示用）。
- [ ] **截图** — 至少 1 张 1280×800（推荐 4-5 张）。建议：① 框选朗读 ② 字幕跟读锁定 ③ 弹窗 ④ 设置页音色预设 ⑤ 留言板。
- [ ] **大图 / 推广图** — Chrome 1400×560 / Edge 1400×560 / Firefox 1400×400（可选但强烈推荐，否则商店展示会很丑）。
- [ ] **隐私政策网址** — 各商店都要求公开 URL。最简单的做法是把 `publishing/PRIVACY.md` 推到 GitHub Pages 或 Gist，得到一个 https 链接。
- [ ] **开发者联系邮箱** — 公开展示在商店页面。

### 各平台费用

| 平台 | 注册费 | 备注 |
|---|---|---|
| Chrome Web Store | $5 一次性 | Google 账号即可注册 |
| Microsoft Edge Add-ons | 免费 | 需注册微软合作伙伴中心账号 |
| Firefox Add-ons (AMO) | 免费 | Mozilla 账号即可 |

---

## 1️⃣ Chrome Web Store

提交链接：https://chrome.google.com/webstore/devconsole/

1. 注册 / 登录开发者账号，支付 $5（一次性，永久有效）。
2. 点击「**新建项**」。
3. 上传 `dist/chrome.zip`。
4. 在「商品详情」填：
   - 名称、简短描述、详细描述（从 `STORE_LISTING.md` 复制）
   - 类别：**辅助功能** 或 **效率**
   - 语言：中文（简体）
   - 截图（至少 1 张 1280×800）+ 大图
5. 在「隐私权做法」填：
   - 单一用途：**网页中文朗读和视频字幕跟读**
   - 权限说明（每个权限单独写一句，从 `STORE_LISTING.md` 中权限说明小节复制）
   - 数据使用：勾选"我未收集用户数据"（如实声明）
   - 隐私政策 URL：填你的 PRIVACY.md 公开链接
6. 在「付款明细」选 **不收费 (Unpaid)**。
7. 在「分发」选公开 / 不公开 / 部分用户。建议先选「**不公开**」走第一次审核，通过后再切公开。
8. 提交审核。**审核周期通常 1-3 天，首次发布偶尔会要求补充说明**。

### 常见拒绝原因

- 权限超出实际需要 — 我们使用 `activeTab` 而不是无差别 `tabs`，相对安全。
- 描述与功能不符 — 描述写的功能必须扩展真的有。
- 缺少隐私政策链接 — 用 GitHub Pages 把 `PRIVACY.md` 公开。
- 远程代码执行 — 我们不加载任何远程 JS，仅 fetch Firebase REST API（属数据请求，不算执行远程代码）。

---

## 2️⃣ Microsoft Edge Add-ons

提交链接：https://partner.microsoft.com/dashboard/microsoftedge/

1. 注册微软合作伙伴中心账号（个人账号即可，免费）。完成身份验证（需邮箱 + 手机），通常即时通过。
2. 在「概述」中点 **新建扩展**。
3. 上传 `dist/chrome.zip`（Edge 用的就是 Chromium 格式，与 Chrome zip 完全兼容）。
4. 填写：
   - **可用性**：开放给所有人，地区选所有，定价免费
   - **属性**：类别 **辅助功能**，隐私政策 URL，支持 URL，类别和子类别，用户使用语言（中文 - 简体）
   - **商店列表**：每种语言至少填一份，从 `STORE_LISTING.md` 复制
   - 截图：至少 1 张 1280×800
5. 提交审核。**审核周期 1-7 天**。Edge 审核相对宽松。

### 提示

Edge 与 Chrome 共享代码库，几乎不需要单独适配。我们的 `manifest.json` 同时被两边接受。

---

## 3️⃣ Firefox Add-ons (AMO)

提交链接：https://addons.mozilla.org/developers/

1. 用 Firefox 账号登录开发者门户。
2. 点击「**Submit a New Add-on**」。
3. 选 **On this site**（公开）或 **On your own**（自托管，自动更新需自己服务器）。建议选 On this site。
4. 上传 `dist/firefox.zip`（注意是 firefox.zip，不是 chrome.zip — 内含 `manifest_firefox.json` 重命名的 `manifest.json`，包含 `browser_specific_settings.gecko.id` 字段）。
5. AMO 会自动跑 lint 检查（验证 manifest、权限、远程代码等）。
6. 填写：
   - 名称、摘要（132 字内）、详细描述
   - 分类：**Accessibility** 或 **Other**
   - 标签：从 `STORE_LISTING.md` 复制英文标签
   - 隐私政策 URL
   - 源代码可选：如果你的代码做过混淆/打包（我们没有），需要上传源码包
7. 提交审核。**自动化通过快（几小时）；如果触发人工审核可能 3-10 天**。

### 注意

- 我们的 manifest 用了 MV3，Firefox 115+ 才完整支持，因此 `strict_min_version: "115.0"` 是合理的。
- 必须填一个唯一的 `gecko.id`（已设为 `chinese-reader@example.com`，建议改成你自己的邮箱或域名格式，比如 `chinese-reader@你的邮箱前缀.example`）。
- AMO 对远程代码非常严格，但我们只 fetch JSON，不会触发警告。

---

## 4️⃣ 发布后

- 商品页面 URL 可以分享、放到 README、社交账号。
- 用户安装后，扩展会出现在浏览器右上角。
- **更新版本**：改 `manifest.json` 的 `version`，重新跑 `node build.js`，把新 zip 上传到对应商店即可。版本号必须严格递增（不能等于已有版本）。

---

## 5️⃣ 多商店后续提示

| 场景 | 建议做法 |
|---|---|
| 修个 bug 要发到所有商店 | 改代码 → `node build.js` → 在三个商店分别上传新 zip + 简短改动说明 |
| 用户在 Edge 报问题但 Chrome 没问题 | 先看 Edge 的 console；通常是 voice 列表不同；不太需要分别打包 |
| 想多语言 | 在 manifest 加 `default_locale` 并新建 `_locales/zh_CN/messages.json` 等；商店描述也支持多语言版本 |

---

## 6️⃣ 我（开发者）做不了的事

- 不能替你点击"提交"
- 不能拥有你的开发者账号
- 不能为你支付 $5 / $99
- 不能在 Windows 上为你完成 Safari 转换（必须 Mac + Xcode）
- 不能保证审核 100% 通过（被拒就按反馈调整后重提即可）

但只要照这份指南走完，三大主流浏览器商店上架是可期的。

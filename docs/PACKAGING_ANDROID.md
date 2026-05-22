# Android APK 打包说明

本项目当前打包目标分两步：先产出面试/展示用 APK，再补正式发布包材料。展示包默认使用局域网后端和 HBuilderX 测试证书。

## 打包前收口

1. 启动后端：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. 手机和电脑连接同一局域网，在 App “我的”页填写 `http://电脑局域网IP:8000`。
3. 在“我的”页点击“保存地址”“自检后端”“登录后端”。
4. 点击“一键演示准备”：
   - 预填演示账号 `student / secret123`。
   - 可复制后端启动命令。
   - 按清单完成导入、搜索、阅读器和 AI 记录演示。
   - 查看“离线兜底”，确认已有内置书籍和 `static/test-novel.txt`，现场网络不稳定时先展示本地阅读链路。
5. 查看“APK 展示准备”卡片：
   - 前 3 项全部显示“已就绪”后，可以录屏演示主链路。
   - DCloud AppID 和云打包签名是 HBuilderX 发行阶段的手动项。
6. 使用合法演示书源或本地 TXT，完成导入、批量检测、发现页搜索、阅读器、AI 记录链路。

## 自动化检查

在项目根目录运行：

```powershell
node tests/importAdapters.test.mjs
node tests/backendConnection.test.mjs
node tests/androidReadiness.test.mjs
node tests/demoMode.test.mjs
node tests/sourceImport.test.mjs
node tests/sourceDiagnostics.test.mjs
node tests/sourceEngine.test.mjs
node tests/searchHelpers.test.mjs
node tests/apiClient.test.mjs
node tests/backendLibrary.test.mjs
node tests/readerExperience.test.mjs
node tests/h5Shell.test.mjs
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('pages.json','utf8')); JSON.parse(fs.readFileSync('manifest.json','utf8'));"
git diff --check
```

后端运行：

```powershell
cd D:\Codex\novel-reader-uniapp\backend
.\.venv\Scripts\python.exe -m pytest
```

## HBuilderX 云打包

1. 使用 HBuilderX 打开 `D:\Codex\novel-reader-uniapp`。
2. 在 `manifest.json` 可视化界面绑定正式 DCloud AppID，替换 `__UNI__NOVELREADER`。
3. 在 App 图标/启动界面配置中使用 `static/branding/` 下的源文件导出 PNG 后设置图标和启动页。
4. Android 权限至少保留相机权限，用于扫码导入。
5. 菜单选择：`发行` -> `原生App-云打包` -> `Android` -> `APK`。
6. 签名选择 HBuilderX 测试证书。
7. 输出文件命名建议：`novel-reader-0.1.0-android-demo.apk`。
8. APK 产物保留在 HBuilderX 默认输出目录或 `unpackage/release/apk/`，不要提交到 Git。

## 真机验收

- 冷启动正常，底部四个 Tab 可切换。
- “我的”页后端地址保存、自检、登录正常，“APK 展示准备”前 3 项已就绪。
- “我的”页“一键演示准备”可以预填演示账号、复制启动命令，并显示主链路演示清单。
- “离线兜底”显示内置书籍、本地 TXT 示例和阅读器兜底均可用；不需要新增更多演示数据。
- 本地 JSON、剪贴板、扫码导入分别可用；扫码取消有提示。
- 批量检测书源有进度和结果，失败源不会进入发现页搜索。
- 发现页搜索、详情、目录、加入书架、进入阅读器完整可跑通。
- 阅读器顶部栏显隐、返回按钮、底部菜单、AI 总结/问答可用。
- AI 记录页能看到 summary/chat/success/failed。
- 断网或后端地址错误时，有明确失败提示，不白屏。

## 正式发布包预留

正式包不要继续使用 HBuilderX 测试证书。发布前需要补齐：

- 自有 Android keystore，并备份别名、密码和有效期。
- HTTPS 公网后端或稳定部署地址。
- 隐私政策、权限说明、应用截图、测试账号和版本发布说明。
- App 图标/启动页最终 PNG 多尺寸资源。
- `versionCode` 每次发布递增。

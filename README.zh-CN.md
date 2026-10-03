# T3 Code 简体中文界面

此分支基于官方 V2 主线，保留上游功能并增加可持久保存的中英文界面切换。Web 与 Electron 桌面应用共用的界面使用这套汉化；独立 React Native 移动应用、操作系统菜单及第三方网页不属于本分支的汉化范围。

## 启用中文

在 **Settings → General → Interface language** 中选择 **简体中文**。语言设置保存在当前客户端，可随时切回 English；切换不重启应用，也不清空对话草稿。原有默认语言保持不变。

模型和产品名称、命令、路径、代码、协议值以及用户输入保留原文。外部代理或服务器临时返回且未收录的文案保留原文，避免改坏技术信息。

## 使用此版本

汉化已合入此 fork 的 `main` 主分支，日常使用和更新从 `main` 获取。官方安装脚本、官方发布包以及 `npx t3@latest` **不会**安装本分支的汉化。

本版本使用上游要求的 Node.js **24.13.1** 和仓库指定的 pnpm。依赖与开发启动方式见 [上游开发文档](docs/operations/development.md)。首次启动使用独立开发数据目录，不要把开发服务器指向现用的 T3 数据库。

## 本地运行

准备好 Node.js 24.13.1 和依赖后，在仓库根目录运行：

```sh
pnpm exec vp run dev --home-dir "$PWD/.t3"
```

打开终端输出的完整配对链接（pairing URL），不要只打开一个猜测的 localhost 地址。`Ctrl+C` 停止本次进程。此命令使用仓库内被 Git 忽略的 `.t3` 开发数据目录，不会覆盖现用的 `~/.t3/userdata`；首次启动看到空环境是正常的。

如果需要 Electron 桌面窗口，改用：

```sh
pnpm exec vp run dev:desktop --home-dir "$PWD/.t3"
```

桌面模式首次可能需要下载 Electron 并构建相关资源；它不会替换系统中安装的官方 T3 Code 应用。需要独立安装包时，按 [桌面打包说明](docs/operations/development.md#desktop-artifacts) 构建。

## 跟进上游

新增文案优先在显示边界翻译，不修改底层协议、模型 ID 或用户数据。使用 `useTranslate` 翻译组件文字；含变量的文案采用 `t("Open {0}", [name])`，参数在翻译后替换。

`pnpm check:i18n` 检查静态界面覆盖、词典空值和插值参数；运行受影响组件的测试及 Web 构建后再发布。动态设置标签、通知与服务端返回信息还需针对对应入口复核，静态覆盖检查不等于每一种运行状态都已人工验收。

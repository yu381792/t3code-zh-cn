# T3 Code 的 DSH 入口

本机已注册名为 `DSH Harness`、编号为 `dsh` 的智能体，使用现有 dsh 的标准应用接入接口。默认模型是 `gpt-6.1-sol`；模型线路复用本机 DSH 的已有配置。

入口程序是本目录的 `t3-dsh-acp`，专用配置位于 `~/.dsh/profiles/t3-acp/`。新配置使用当前安装版本的基础组件，避免加载旧 ACP 配置里版本不匹配的插件。

T3 的本机接入方式：使用 `acpRegistry` 接入层，目录编号 `agentId` 留空，程序路径 `commandPath` 指向入口程序。目录编号为空时，直接调用本机程序，不读取官方目录或安装其他软件；目录编号非空时，仍沿用官方目录的参数和环境。

运行 `node local/dsh/verify-acp.mjs --prompt` 可验证真实模型回答；运行 `node --experimental-strip-types apps/server/scripts/verify-dsh-acp.ts` 可验证 T3 自己的模型发现过程。

2026-10-03 安装到 `/Applications/T3 Code (Nightly).app`。原应用备份在 `/Users/yu/t3code-backups/dsh-20261003/T3 Code (Nightly).app`；重启应用后加载新代码。

# T3 Code 的 DSH 入口

本机已注册名为 `DSH Harness`、编号为 `dsh` 的智能体，使用现有 dsh 的标准应用接入接口。默认模型是 `gpt-6.1-sol`；模型线路复用本机 DSH 的已有配置。

入口程序是本目录的 `t3-dsh-acp`，专用配置位于 `~/.dsh/profiles/t3-acp/`。新配置使用当前安装版本的基础组件，避免加载旧 ACP 配置里版本不匹配的插件。

T3 的本机接入方式：使用 `acpRegistry` 接入层，目录编号 `agentId` 留空，程序路径 `commandPath` 指向入口程序。目录编号为空时，直接调用本机程序，不读取官方目录或安装其他软件；目录编号非空时，仍沿用官方目录的参数和环境。

运行 `node local/dsh/verify-acp.mjs --prompt` 可验证真实模型回答；运行 `node --experimental-strip-types apps/server/scripts/verify-dsh-acp.ts` 可验证 T3 自己的模型发现过程。

2026-10-03 安装到 `/Applications/T3 Code (Nightly).app`。原应用备份在 `/Users/yu/t3code-backups/dsh-20261003/T3 Code (Nightly).app`；重启应用后加载新代码。

T3 的运行模式通过接入层传入 `T3_RUNTIME_MODE`。入口程序把“完全访问”对应到 dsh 的 `danger-full-access`；其他模式使用工作目录沙箱，并由 T3 的审批策略处理需要确认的操作。专用配置还须通过 `insert` 装入本目录的 `runtime-permission.mjs`。它在新建和恢复会话时重新应用当前 T3 模式，避免旧会话中保存的权限覆盖当前选择；新增插件不能只写一个尚不存在的 `id` 覆盖条目，否则配置会被跳过。

权限验证可给 `verify-acp.mjs` 传 `--cwd <工作目录> --write-probe <工作目录外的专用测试文件>`。还可用 `--resume <会话编号>` 验证旧会话从受限模式切到完全访问、再切回受限模式。测试只使用隔离的自有文件，不测试业务数据或凭证。`T3_DSH_VERIFY_PERMISSION=1` 可显示实际应用的权限模式。

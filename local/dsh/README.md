# T3 Code 的 DSH 入口

本机已注册名为 `DSH Harness`、编号为 `dsh` 的智能体，使用现有 dsh 的标准应用接入接口。默认模型是 `gpt-6.1-sol`。每次启动或探测时，`sync-models.mjs` 读取 `ocx export --client dsh --json`，通过最后一层运行补丁完整同步 OpenCodex 的模型、名称、上下文与思考档位；导出失败明确停止，避免旧清单冒充已同步。OpenCodex 内建 DSH 集成仍指向旧 `~/.dsh/settings.yaml`，不能更新 T3 专用配置。T3 入口禁用 dsh 自带的 DeepSeek 适配器，只保留 OpenCodex 导出的路线，其中由 OpenCodex 提供的 DeepSeek 模型仍保留。

入口程序是本目录的 `t3-dsh-acp`，专用配置位于 `~/.dsh/profiles/t3-acp/`。配置使用当前安装版本的基础组件，默认预设为用户现有的 `pi-both`，支持直接工具调用和 `run_code`。其插件配置来自 `~/.dsh/profiles/web/cordis.patch.yml` 中的同名预设，并关闭基础层中对应的工具行，避免重复注册。`runtime-preset.mjs` 在模型开始回答前挂载预设并记录选择，恢复会话时保留已记录的预设；旧会话尚无记录时采用默认项。

T3 的本机接入方式：使用 `acpRegistry` 接入层，目录编号 `agentId` 留空，程序路径 `commandPath` 指向入口程序。目录编号为空时，直接调用本机程序，不读取官方目录或安装其他软件；目录编号非空时，仍沿用官方目录的参数和环境。

运行 `node local/dsh/verify-acp.mjs --prompt` 可验证真实模型回答；运行 `node --experimental-strip-types apps/server/scripts/verify-dsh-acp.ts` 可验证 T3 自己的模型发现过程。

2026-10-03 安装到 `/Applications/T3 Code (Nightly).app`。原应用备份在 `/Users/yu/t3code-backups/dsh-20261003/T3 Code (Nightly).app`；重启应用后加载新代码。

T3 的运行模式通过接入层传入 `T3_RUNTIME_MODE`。入口程序把“完全访问”对应到 dsh 的 `danger-full-access`；其他模式使用工作目录沙箱，并由 T3 的审批策略处理需要确认的操作。专用配置还须通过 `insert` 装入本目录的 `runtime-permission.mjs`。它在新建和恢复会话时重新应用当前 T3 模式，避免旧会话中保存的权限覆盖当前选择；新增插件不能只写一个尚不存在的 `id` 覆盖条目，否则配置会被跳过。

默认权限为完全访问，与 T3 的新会话默认值一致；显式选用受限模式仍会切回工作目录沙箱。无 T3 运行模式参数的验证入口也默认完全访问。`T3_DSH_VERIFY_PRESET=1 node local/dsh/verify-acp.mjs --preset-probe` 验证实际预设与 `run_code`。

新建会话的输入框下方提供“预设”选择，默认 `pi-both`，菜单只列自定义预设；官方 `standard`、`ptc`、`minimal`、`cordis` 不列入菜单。首条消息发送后固定；恢复会话保留原选择。`acp-with-presets.mjs` 包装已安装版本的 ACP 标准数据流，新增 `agent_preset` 配置项，使用 dsh 原生预设名录和首轮前选择服务；模型、工具、权限等其他消息仍走原 ACP。专用 profile 必须禁用原 `acp` 行并通过 `insert` 装入 `t3-acp-bridge`，不能用 `name` 覆盖原行：Cordis 把 `name` 当匹配条件，不是重命名。运行补丁同时更新桥接行的模型默认值。官方预设的提醒工具在此入口关闭，由 T3 管理提醒；其余预设插件和所需宿主依赖按现行已安装版本加载。预设失效时不列入可选项。

`node local/dsh/verify-acp.mjs --preset standard --prompt --assert-preset-locked pi-both` 验证首轮前选择与首轮后锁定，`--resume <会话编号> --preset standard` 验证恢复后的同值重放。OpenCodex 模型变化在下一次 DSH 进程启动或探测时读取，已运行进程不会即时换清单；T3 列表在会话初始化、刷新智能体设置或应用重启后更新。

权限验证可给 `verify-acp.mjs` 传 `--cwd <工作目录> --write-probe <工作目录外的专用测试文件>`。还可用 `--resume <会话编号>` 验证旧会话从受限模式切到完全访问、再切回受限模式。测试只使用隔离的自有文件，不测试业务数据或凭证。`T3_DSH_VERIFY_PERMISSION=1` 可显示实际应用的权限模式。

推理档位按模型分别提供。桥接层根据 dsh 的真实模型元数据，把各模型的配置通过 ACP 模型条目的 `_meta["t3code/config-options"]` 传给 T3；通用接入层只验证并使用该元数据，不把最后一个会话的 GLM 三档推理覆盖到 GPT 模型。没有该元数据的旧智能体保留原会话配置兼容路径。

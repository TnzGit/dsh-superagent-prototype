# 本地 Agent 任务书：DSH 原生微信通道（阶段 B 已完成）

> **2026-11-08 状态更新：用户已亲自扫码，旧 Clawbot 会话身份沿用，微信原生收发、白名单和本地 Qwen 代理均已真实验收。不要重复 A/B 配对步骤，也不要停止当前在线的 staging 微信 Source。** 本文剩余 A/B 说明供历史查询；新的任务请优先打开 **LOCAL_AGENT_STAGE_C.md**，只验收本地项目 Ticket → Worker 执行链。远程 ChatGPT 负责代码和 CI，本地 Agent 负责真实环境测试；未经许可不得重启、部署、合并或修改原业务项目。

> 2026-11-08 用户最终选定的使用方式：**DSH Superagent 直接使用微信 Clawbot/iLink 通道；完全不使用 OpenClaw**。旧 OpenClaw 早已停用。不要安装/启动 OpenClaw、其 Gateway、`@tencent-weixin/openclaw-weixin` OpenClaw 插件，也不要导入其旧凭据或旧配置。用户希望复用过去的微信入口，但**原机器人身份能否沿用必须通过扫码和官方后端确认，不得预先保证**。

本任务要求严格的**两段式流程**：先完成不需要用户参与的所有可做验证，**写报告并停止**，然后向用户明确请求二维码扫码配对；用户本人扫码确认之后，才做实际微信收发与任务闭环。遇到远程未实现的代码请交给远程 ChatGPT，而不是本地 Agent 自行开发。

仓库：https://github.com/TnzGit/dsh-superagent-prototype  
开发分支：`feat/local-first-wechat-foundation`  
PR：https://github.com/TnzGit/dsh-superagent-prototype/pull/1  
最新决策文档：`docs/010-direct-weixin-channel.md`  
历史文档：`docs/009-local-first-wechat.md`（OpenClaw 桥接方案已废弃）  
已有实机报告：2026-11-08 的 `REPORT-local-verification-20261108.md`（不要把其私有 IP/本机路径复制进公开仓库）

## 最高优先级：开发与测试责任分工

**远程 ChatGPT 负责一切能远程完成的事情**：架构、代码实现、从 MIT 源码适配 DSH 原生 Source、QR 登录组件、测试、CI、PR 和修复；本地 Agent **只负责远程无法实际访问的** macOS 系统、真实 DSH checkout、真实本地 Qwen、私有文件系统和扫码后微信账号验证。即使发现缺失的源代码或测试，也只报告最小复现和缺口给远程 ChatGPT，等待远程提交更新，除非用户另行明确授权改变分工。

优先复用经过许可核查的 `samanhappy/dsh-superagent` 原生 Weixin Source（MIT/NOTICE，含 `weixin.ts`、`weixin-api.ts`、`weixin-login.ts`、`weixin-channel.ts`、`weixin-trigger.ts`、`weixin-read.ts` 和测试），而不是自行从零编写 iLink 协议。腾讯的 `Tencent/openclaw-weixin/docs/protocol_zh_CN.md` 可作为**通信协议参考**，但不能安装它的 OpenClaw 插件，也无需 OpenClaw SDK。

### 重要状态：不要误把旧代码当作新实现

本轮已经**删除** `integrations/openclaw-weixin-dsh/*`、`src/sources/openclaw-bridge.ts` 和旧桥接测试，不再构建 OpenClaw 插件。远程已提交 `src/sources/weixin-native.ts`、`src/local-first/weixin-native-protocol.ts`、`scripts/weixin-native-pair.mjs` 以及协议/QR 离线测试。原生 Source 默认关闭，离线构建成功和真实微信账号接通是两个不同阶段；必须由本地 Agent 先验证兼容性和二维码工具依赖，**不要拿 mock 测试当作扫码成功**。

## 阶段 A — 无人值守准备（现在开始；不扫码）

### A1. 更新独立工作区、检查可用版本

现有 macOS worktree 中已有上一轮验证文件；先检查未提交变更。不要切到或覆盖生产 DSH profile、主分支、OpenClaw 残留环境。

```bash
git status --short
git fetch origin feat/local-first-wechat-foundation
git rev-parse HEAD
git rev-parse origin/feat/local-first-wechat-foundation
node --version
pnpm --version
```

若工作区干净，可安全更新独立测试 worktree；否则报告冲突并保持现状。兼容性基线：macOS / Node 25.9.0、pnpm 全局 11.24.0 且仓库固定 11.7.0；DSH checkout `0.2.2-alpha.2`，而本 fork 依赖 `0.2.1-alpha.2`，**应核验而非私自升级或替换 DSH**。本机 `dsh` 未在 PATH，不等于没有可用 checkout；查明安全的 CLI/宿主启动方式。

### A2. 检查构建与离线测试

```bash
pnpm install --frozen-lockfile
pnpm check
node --experimental-strip-types --test tests/local-projects.node-test.mjs tests/local-model-queue.node-test.mjs scripts/probe-local-llm.node-test.mjs tests/local-openai-queue-proxy.node-test.mjs tests/local-weixin-native.node-test.mjs tests/local-weixin-qr.node-test.mjs
```

新增原生协议与 Source 测试覆盖二维码状态（mock）、登录凭据权限、长轮询游标、重复消息 ID、允许名单、`context_token` 回复与 token 过期错误。全部使用模拟服务器，本阶段**不得向真实微信服务申请二维码或发送消息**。如缺少 `qrencode`，检查能否在隔离环境中安装本地二维码工具，勿调用第三方外部 QR 渲染服务。

记录退出码与最小失败日志。过去的 macOS `/var` vs `/private/var` 差异已由远程测试夹具修复，确认回归即可。

### A3. DSH 独立测试 Profile 与项目工作区

准备与现有业务完全隔离的 DSH profile、状态目录、SQLite 备份策略、测试工作区；默认所有微信 Source 关闭，原始 GitHub/Feishu 项目不变。

列出一个一次性 Git 项目与一个一次性非 Git 项目，验证 allowlist、符号链接拒绝、跨项目隔离和同项目写互斥。**项目注册表还没有完整接入 DSH Ticket/Worker**；如未接入，标为 `BLOCKED` 并交给远程 ChatGPT，而不是本地重写。

确认 worker 文件系统沙箱、测试命令、危险操作审批和回滚策略；没有隔离就不允许真实生产项目写入。

### A4. 本地模型配置与真实单并发

原有 Qwen 实机验证已经证明模型 ID `Qwen3.8-Flash-Next`，vLLM 的 **8002** 端口可用，工具调用、流式和 8K/32K/64K 输入均成功；400K 尚未压测。不要重复大负载。使用已知 LAN 上游地址（**仅保存在本机配置，不上传仓库**）。

本地主模型不是硬单并发，vLLM continuous batching 会并行处理短请求。要将 DSH **所有角色**（主 Session、评估、Worker）指向仓库的 `scripts/run-local-model-proxy.mjs` 所提供的 `127.0.0.1` 单槽入口；在未批准更改正式 provider 的情况下只在隔离 profile 中测试。

估算性能以现有短样本约 **60–80 decode tok/s**、约 **4.2K uncached prefill tok/s** 为参考；预填充缓存命中速率不能当作稳定冷请求吞吐。分别计算排队等待与解码超时，不自动因为队列忙改用付费模型。

检查代理测试配置、隔离端口、密钥注入和正常停止。实际探针、压力和任何密钥不能打印到公开报告。

### A5. DSH 原生微信预配对就绪检查

对**远程已提交的原生 iLink Source/QR 组件**执行离线检查：

1. 运行时是否完全不导入 `openclaw`、Gateway 或旧 bridge；确认 DSH bundle 的 `weixin-watch` 默认 `disabled: true`。
2. 扫码流程是否可以在本机安全展示 QR：`wait`、`scaned`、`confirmed`、`expired`、`need_verifycode`、`scaned_but_redirect` 等状态可由 mock 验证。
3. 登录前**没有读取或复用**旧 OpenClaw 账号、token、credentials 或 Chat 内容；扫码后只在新 DSH staging profile 的安全凭据文件/安全存储中保存 token，权限为用户独占。
4. 确保 `context_token`、`get_updates_buf` 游标和每条 Trigger ID 的持久性策略明确，且断电/重启不会导致无界重复工作或发送。
5. 确保仅私聊、允许名单、关闭危险操作和云端外发，默认不开启真实轮询。
6. 检查原有 Clawbot 可能处于旧绑定状态时的错误处理：**只报告状态，不绕过验证或擅自解绑**。

运行 `node --experimental-strip-types scripts/weixin-native-pair.mjs --check`（**仅检查本地 qrencode 可用性，不触发任何微信网络请求**）。若该工具未安装、DSH Source 构建不通过、版本适配缺失或隔离配置不能准备，报告阻塞给远程 ChatGPT；**不能提前请求二维码或假装准备完成**。

## 阶段 A 完成后的强制停止点

提交**第一次报告** `REPORT-pre-qr-native-weixin.md`（保存在独立工作区，不写入公开仓库），包括：

- 版本/目录和测试命令的脱敏摘要及 `PASS/FAIL/BLOCKED/NOT RUN` 表；
- DSH 原生 Source、扫码模块、隔离 Profile、Qwen 单槽代理及本地项目沙箱的就绪程度；
- 旧 OpenClaw 是否完全不再被调用；
- 是否确实具备安全的“现在开始二维码登录”条件；
- 遗留的代码/集成缺口（交远程 ChatGPT 修复）、可复现信息与回滚方式。

仅当 **QR 流程 + 原生 DSH Source + 隔离凭据保存**实际准备好，且这些验证通过时，向用户输出：

> **第一阶段准备已完成，尚未连接微信。请你确认是否现在开始使用微信扫码，把原 Clawbot 对话入口绑定到这个新的 DSH Superagent 测试实例？**
>
> 我会在本机安全显示二维码，你需要亲自扫码并在微信里确认。扫码结果有可能是新机器人/需要解除旧绑定，不能保证沿用旧身份；若遇到冲突我会先停止并征求你的决定。
>
> 在你答复前，我不会生成真实二维码、读取旧凭据或启用微信消息接收。

如果还有 P1 实现阻塞，就只说“准备的哪些部分通过、哪些被远程代码阻塞”，不要提前要求扫码。

## 阶段 B — 仅收到用户明确扫码同意后开始

1. **用户明确同意扫码后**，先在新建的用户独占（0700）目录选择一个尚不存在的绝对凭据路径，在本机终端运行：`node --experimental-strip-types scripts/weixin-native-pair.mjs --user-approved --output /PRIVATE/OWNER_ONLY_DIR/weixin-credentials.json`。必须本地存在 `qrencode` 来显示二维码；不使用外部 QR 图片服务。用户自行扫码和微信确认，遇到手机验证码由用户亲自输入。不能由 Agent 替用户确认。
2. 校验官方返回 `confirmed`、bot token、bot ID 与 HTTPS base URL，检查新文件为 0600，目录为 0700。将绝对路径通过环境变量 `DSH_WEIXIN_NATIVE_CREDENTIALS_FILE` 配给**隔离 DSH staging 进程**，不把 token 本身写入环境变量、公开源码、日志或聊天。Source 配置中的 `allowedPeers` 与 DSH Policy 的 `allowed` 必须分别手动登记获准微信发送者后才能接收任务。
3. 只对用户批准的私人微信测试会话做收消息 → Trigger → Policy → Ticket → Worker（本地单并发 Qwen）→ Outbox → iLink 原生回复的闭环测试。确认 `context_token` 的正确关联。
4. 回归相同消息 ID 去重、非允许名单拒绝、跨项目路径拒绝、长轮询游标恢复、重启与失联、无自动付费回退、异常发送不盲目重发。
5. 如果扫码后绑定得到的是新机器人而不是原 Clawbot，不要假称“接管成功”；报告差异并再次询问用户是否接受切换或需要旧端解绑。绝不尝试绕过微信服务端限制。
6. 交付第二份 `REPORT-post-qr-native-weixin.md`：成功项、失败项、匿名化 bot 状态、未验证功能、实际本机变更和回滚步骤。**不得自动启用生产工作区或合并 PR**。

## 安全和回滚底线

- 真实扫码与授权始终由用户控制；本地 Agent 在第一阶段停止点等待答复。
- 不操作旧 OpenClaw 残留，不破坏其他 Gateway，也不启动 OpenClaw；不要同时让旧、新客户端长轮询同一 bot token。
- 不修改业务模型量化/推理参数；不进行未批准的 400K 压力测试；不启用任何云端付费或外部敏感数据上传。
- 不向真实私有项目写入，不执行部署/删除/强推，未经审批不合并分支。
- 凭据不得复制到 repo、报告、公共日志或临时外网 QR 服务；出错时停止轮询、禁用 Source、停代理、恢复 DSH staging profile，并只保留脱敏诊断。

**交付原则：先完整做完你能做的准备；第一次汇报后明确请求用户二维码配对；用户配对成功才开展第二阶段。远程可做的开发仍由远程 ChatGPT 负责。**

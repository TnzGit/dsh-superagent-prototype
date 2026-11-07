# Local Agent handoff — 环境联调专用（远程优先规则）

**执行前确认：这不是要求本地 Agent 重写 Superagent。** 远程 ChatGPT 负责所有能在 GitHub/云端完成的设计、编码、静态检查、单测、模拟测试和 PR；本地 Agent 仅负责必须通过本地系统权限、微信账号、真实 Qwen 服务、私有工作区才能完成的探针、安装、联调、日志和回滚。不要重复实现已提交的模块，不要主动扩大范围。发现代码缺陷时，提供最小复现和脱敏日志给远程 ChatGPT，由远程侧先修复。

基础仓库：https://github.com/TnzGit/dsh-superagent-prototype
开发分支：`feat/local-first-wechat-foundation`
评审入口：https://github.com/TnzGit/dsh-superagent-prototype/pull/1

## 0. 已完成 / 未完成界线

**远程已提交：** 本地优先模型队列和路由判定原语、路径 allowlist 与单项目写互斥、微信 HMAC 验证和入站 HTTP 服务、DSH SourceKind 插件（默认关闭）、OpenClaw `before_dispatch` 入站插件、Node 测试与 CI、可关闭 GitHub Source 的启动分支以及无凭据 `gh` shim。每一项请以当前 PR/CI 代码为准，不要假设它们已经进入主分支。

**尚未实机验收：** OpenClaw → 腾讯微信的 DSH **签名出站接收器已提交模拟实现，但原生发送需要真实 Gateway + 腾讯账号验证**；真实 OpenClaw/Gateway 版本下的身份字段校验；多项目注册表与真正的 Worker/Ticket 绑定；非 Git 项目的快照/应用/回滚；模型队列与 DSH 的实际每次 LLM 请求钩子集成；云端路由 UI 和成本审计。这些是远程侧继续开发的项目，不自动委托本地 Agent。

**绝对禁止**：未验证以上能力便发布为生产版、填写假测试结果、暴露端口到公网、复制口令到聊天/GitHub、擅自 push、部署、合并、改生产项目或运行破坏性命令。

## 1. 本地环境清查（只读）

从仓库拉取上述分支，禁止直接覆盖主分支或用户的未提交修改。记录系统版本、DSH/Node/pnpm/OpenClaw 版本、插件列表与 `openclaw plugins inspect ... --runtime --json` 能否识别 `before_dispatch`。具体命令供按需执行：

```bash
git status --short
git fetch origin feat/local-first-wechat-foundation
git switch --track -c feat/local-first-wechat-foundation origin/feat/local-first-wechat-foundation
node --version; pnpm --version; dsh --version
openclaw --version
openclaw plugins list
```

**若本地已有同名分支或工作区有改动，不使用 `git switch -c` 或任何强制命令覆盖；先报告并使用独立 checkout/worktree。**

安装依赖并测试，不上传机器或项目内容：

```bash
pnpm install --frozen-lockfile
pnpm check
node --experimental-strip-types --test tests/local-*.node-test.mjs scripts/probe-local-llm.node-test.mjs
```

对不同 DSH/Node/OpenClaw 版本记录差异；不能用“跑通”替代真实命令与退出码。远程 CI 成功仅证明模拟环境的版本，不代表本机集成成功。

## 2. Qwen3.8-Flash-Next 实机探针（只读）

已在 2026-11-08 实测：vLLM 0.29.1rc1.dev402、模型 ID 为 `Qwen3.8-Flash-Next`、上游监听 **8002** 端口。地址来自用户私有 LAN 配置，**不要写入公开仓库**，由本地环境变量注入。只在上游确实需要时才设置 `LOCAL_LLM_API_KEY`。不要使用不通的默认 HTTP 80 端口。禁止把实际 API key、模型原始响应或私有文档发给远程：

```bash
LOCAL_LLM_BASE_URL="http://REPLACE_WITH_PRIVATE_LLM_HOST:8002/v1" \
LOCAL_LLM_MODEL="从 /v1/models 确认的真实 ID" \
node scripts/probe-local-llm.mjs
LOCAL_LLM_BASE_URL="http://REPLACE_WITH_PRIVATE_LLM_HOST:8002/v1" \
LOCAL_LLM_MODEL="从 /v1/models 确认的真实 ID" \
node scripts/probe-local-llm.mjs --tools
```

这里的 127.0.0.1 是示例，不代表实际服务地址。确认跨机访问、认证、工具调用数据格式、显存余量、预填充及生成速度。**不要直接压测 400K**：先做小型确认，再经操作者同意按 8K / 32K / 64K / 更大长度逐级验证，记录 OOM/延迟。并发默认 1，只做受控的两个客户端竞争测验，验证端点的真实单并发性质；不自动触发云端付费 API。

**已完成的实机数据不必重复测到相同风险程度**：8K/32K/64K 均通过；短输出 decode 约 60–80 tok/s，冷 prefill 样本约 4.2K tok/s；上游 vLLM 能 concurrent batching，并非硬单并发。保留代理的真实串行化；400K 不重压测。下一轮只在有变更时做回归，并区分短样本估算与稳定基准。

记录输出：真实模型 ID、服务实现与版本、上下文上限（实测与声明分开）、tool calling 成功/失败、单并发观测、p50/p95、token/s、估算内存，任何限制均如实注明。


### Optional single-slot OpenAI proxy (host-only preflight)

远程已新增 `src/local-first/openai-queue-proxy.ts` 和 `scripts/run-local-model-proxy.mjs`，提供独立、默认不启动的 127.0.0.1 代理。在**隔离测试环境**中设置强随机本地密钥、真实 Qwen 上游地址（必须以 `/v1` 结尾）后运行：

```bash
export LOCAL_MODEL_PROXY_CLIENT_KEY='仅在本机安全注入的32位以上随机密钥'
export LOCAL_MODEL_PROXY_UPSTREAM='http://REPLACE_WITH_PRIVATE_LLM_HOST:8002/v1'
export LOCAL_MODEL_PROXY_PORT=8123
node --experimental-strip-types scripts/run-local-model-proxy.mjs
```

在另一个终端让 `LOCAL_LLM_BASE_URL=http://127.0.0.1:8123/v1`、`LOCAL_LLM_API_KEY` 等于本机代理密钥后运行 `scripts/probe-local-llm.mjs --tools`；可用两个不同的独立客户端观察并发是否严格为 1。**不要在命令行记录或上传密钥**；上面的 export 是字段说明，不是要求把秘密写进脚本或 PR。代理不会自动变更 DSH 的 provider，它也不提供云端回退；真实 Provider 指向代理必须由操作者审核后在本机配置。确认端点正确之前，不把代理开放到 LAN 或公网。

## 3. 微信环境探查（不发真实消息前先确认授权）

使用用户**自己操作的**官方扫码登录完成腾讯 `@tencent-weixin/openclaw-weixin` 接入，检查当前安装包精确版本；确认 `openclaw-weixin` 渠道的 inbound `before_dispatch` 实际使用的事件字段 `event.channel/event.senderId/event.messageId/event.body/event.content/event.timestamp` 与上下文字段 `ctx.channelId/ctx.accountId/ctx.senderId`；这些字段已通过 OpenClaw 2026.11.1 静态类型检查确认，下一步是 **运行时**实测，字段缺失只报告**字段名、类型和是否存在**，不打印原文、账号 ID、二维码 token、聊天内容。

先在隔离测试环境安装本仓库的 `integrations/openclaw-weixin-dsh` 插件，并用 `openclaw plugins inspect dsh-weixin-bridge --runtime --json` 核对注册的 hook；**不要在未完成出站适配与权限审核前把它作为主微信入口上线**。

桥接当前只注册签名入站 HTTP `/v1/weixin/inbound`，绑定 `127.0.0.1`；涉及 `DSH_WEIXIN_BRIDGE_SECRET`、`DSH_WEIXIN_BRIDGE_PORT`、`DSH_WEIXIN_BRIDGE_URL`、`DSH_WEIXIN_BRIDGE_SEND_URL` 的设置都使用本地安全存储。OpenClaw → DSH 端已模拟验证；DSH → OpenClaw 的 **默认关闭** HTTP 出站接收器现已提交到 `integrations/openclaw-weixin-dsh/outbound.mjs`；会通过 Gateway 进程内 Tencent channel adapter 发送而非直接请求腾讯私有 iLink API。其 `DSH_WEIXIN_BRIDGE_OUTBOUND_ENABLED=1` 只能在获得用户明确授权、真实 Gateway 与白名单测试就绪后打开。实现已覆盖模拟身份允许名单、HMAC、持久投递记录、未知发送结果阻止自动重复发送；**真实两端联调仍未通过**。

对接本地前，探查 `openclaw message send --help`、官方插件 outbound 适配器和 Gateway 已有 RPC；提供版本/类型签名与候选调用方式给远程 ChatGPT，由远程侧实现后再做真实发送验收。禁止尝试未经确认的私有 iLink 协议写接口或模拟第三方身份。

### 本轮已解决的差异，下一次仅回归

- macOS `/var` 与 `/private/var` realpath 差异已由远程修复测试夹具，不修改项目路径安全逻辑。
- OpenClaw 入站插件先前错误读取 `event.channelId ?? ctx.channel`；现在先检查 `event.channel`，再使用 `ctx.channelId` 兼容降级。
- SDK 静态验证不代表真实微信聊天可以投递回复。腾讯插件 `sendText` 还依赖 **`contextToken`**，不能直接构造假 iLink 消息；出站桥接必须复用 Gateway 进程内的正式 Channel adapter 或可信 Gateway RPC。
- 目前 Gateway 未启动也没有得到授权，**不要重装或覆盖残留的 OpenClaw 配置，更不要替用户扫码**。需要用户决定复用原 Gateway 还是启用隔离的新 Gateway，才能继续实机联调。

### Outbound prototype: 实机验收范围（必须先授权）

新的出站接口是 `/plugins/dsh-weixin-bridge/outbound`，绑定到**同一 OpenClaw Gateway 进程**。使用现有 `api.runtime.channel.outbound.loadAdapter('openclaw-weixin')` / Tencent `sendText`，`contextToken` 保持由腾讯插件本身检索。不要替换成另一个 CLI 进程中的内存 Map，也不要手动复制或持久化 context token。

真实 Gateway 起来后，仅在测试微信号与私聊双方均授权的隔离环境中，逐项验证：inbound hook 有效、DSH 允许名单、原生回复、超过 3500 codepoints 的分块、同 ID 重试不重发、Gateway 重启后的持久记录、Native send 结果未知时暂停并人工处理。**不能因为 CI mock 成功就开启生产端口。**

## 4. 本地项目环境（仅清查和沙箱验证）

列出操作者指定的 1–2 个**测试项目**，确认本地 Git/非 Git 目录、是否存在远端、是否含子模块、符号链接、敏感文件、运行测试的命令与权限。不要遍历所有家庭目录或私密文件；提交报告时使用项目代号和相对路径。支持项目分离，测试目录应可丢弃；原始项目只读，绝不运行自动部署或自动合并。对工作区执行许可由操作者显式确认。

当前 `LocalProjectRegistry` 是路径验证和互斥原语，还未与 DSH Ticket/Executor 工作区生命周期联接；没有这一层的测试结果**不能**当作非 Git 自动执行已验收。

## 5. 出错处理与回滚

- 每个安装或配置更改先记录原值与版本，备份 DSH SQLite、OpenClaw 配置和相关非敏感状态；密钥备份仅在本机安全位置。
- 任一鉴权失败、重复消息、模型错误路由、意外外网数据传输、执行越权，立即停止桥接插件与自动任务，保留脱敏诊断。
- 不能确认回滚路径时暂停写操作；不在生产主机重置 Git、清空数据库、强制重启共享任务或删除进程数据。
- 恢复只读状态的方法：禁用 `dsh-weixin-bridge` 和 `dsh-superagent-openclaw-bridge` 插件，取消测试监听；保留原 GitHub/Feishu Source 和现有工作区。

## 6. 每轮给远程 ChatGPT 的报告格式

1. 环境版本、准确命令、退出码和脱敏日志；
2. 完成的测试及结果：`PASS`/`FAIL`/`BLOCKED`/`NOT RUN`，不得把模拟测试写成真实微信成功；
3. 微信 Hook 存在的字段名、发送目标格式、出站 API/CLI 的精确签名（隐藏身份和凭据）；
4. LLM endpoint 的已验证参数、能力与数据，区分声明与实测；
5. 本地两个测试项目的抽象类型和沙箱适配问题；
6. 所有阻塞的最小复现、建议远程修改的文件、风险/回滚命令；
7. 用户必须亲手完成或批准的动作（扫码、付费、敏感数据许可、生产改动）。

**交付原则：本地 Agent 不承担远程 ChatGPT 能完成的代码开发。遇到未实现功能，先交回可复现事实，等待远程分支更新；不要另起炉灶。**

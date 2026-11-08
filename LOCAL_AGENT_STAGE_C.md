# LOCAL_AGENT_STAGE_C — 现有 DSH 3080 项目接入（C0 已完成）

> **2026-11-08 C0 已完成**：3080 官方 `workspace/follow` baseline 与 `session/list` 已完成只读盘点，私有目录 0600 已落盘。三个服务无扰动。不要重复 C0，也不要把 3080 会话历史复制到 3083。**下阶段唯一生效的新指令是 `LOCAL_AGENT_STAGE_C1.md`：远程适配器离线测试、只读 RPC 探针、安全与 Qwen 单槽路由评估、报告并停止。**

> 最新指令优先级：**现有 3080 DSH Workspace/Session 的保留与复用，优先于独立项目副本 Worker 的 Stage C 回归。** 已经完成微信阶段 B，不再需要重新扫码。

## C0 — 必须先做、不会影响运行中的实例

用户 Mac 上已有 DSH 实例监听 127.0.0.1:3080，存有有价值的 Workspace、Session 与正在进行的工作；微信 DSH staging 实例在 127.0.0.1:3083，本地 Qwen 队列代理在 127.0.0.1:8123。**三个服务都保持现状；本轮先绝不停止、重启、覆盖、迁移或改变 3080 的任何持久化数据和 Session**。

1. 阅读 docs/012-existing-dsh-host-3080.md，理解 DSH 原生 WorkspaceRegistry / SessionController；确认 Workspace 的 path/title/workspaceId/sessionIds，不能把一个目录当作完整会话。
2. 在 3080 的现有、已授权本地 DSH 客户端中，使用其**官方只读 Workspace / Session API**盘点项目：Workspace ID、标题、规范化目录、关联 Session ID、存活状态、最近更新时间。优先通过原有客户端/宿主控制器，不能猜测 HTTP RPC 路径、盗用 Cookie、读取进程内存或自行创建管理员接口。
3. 精确核实 3080 的 DSH 版本、profile 和 API 能力；它与 staging 3083 的运行时版本可能不同。检查 session.prompt/create/fork/history 等**方法签名、鉴权和权限策略**，但此时只读，不向任何既有 Session 发消息。
4. 私有目录中保存一份权限 0600 的只读工作区目录 JSON（按 docs/012 的格式，精确来源于 3080 的官方返回）；**不发送完整路径、Session ID、Token、对话内容给 GitHub 或公共报告**。
5. 在项目开发分支的独立工作区运行：

    node --experimental-strip-types --test tests/local-existing-dsh-projects.node-test.mjs
    node --experimental-strip-types scripts/check-existing-dsh-catalog.mjs /PRIVATE/DSH-CATALOG.json

6. 检查选择策略：明确 `/project <id>`；唯一精确引用的《项目标题》；只有用户**先确认绑定**后才允许“继续之前项目”。重名、多 Session、模糊指代都应请求确认，不能仅凭最近访问自动选择。`/new-project <id>` 是新建提案，不代表已获准创建。
7. 确认现有 3080 原项目可安全**原地续做**的方案：通过已授权的原实例会话接口投递，而非将 Session 文件复制到 3083 或启动全新 Worker 冒充已恢复。检查它是否有可复用的已有 Session；一个 Workspace 有多个 Session 时必须分辨。
8. 完成前置报告 `REPORT-existing-dsh-3080-inventory.md`，明确哪些事实已确认，哪些是 BLOCKED。向用户简要汇报并请求仅必要的下一步授权（例如一次只读 API 登录、或未来的单条测试 Session 授权）；**不要提前升级、重启任一服务**。

该报告交远程 ChatGPT，由远程继续编写通过鉴权的跨实例 Session 接力适配器与测试。远程能完成的代码与 CI 不由本地 Agent 重做。

## 后续 Stage C — 仅在 3080 保护检查完成、用户授权后执行

以下为原始一次性 Git/non-Git **隔离副本 Worker** 回归；它不能保留 3080 的老 Session 上下文，也不能代替跨实例接力。仅作为**新项目或明确要求隔离执行的任务**的补充。任何需要重启 staging 3083 的操作都必须先由用户授权，并备份当前 SQLite/Profile；3080 始终保持运行。

> 阶段 B 已经成功：微信原生配对、旧会话身份沿用、入站/白名单、Qwen 单槽代理、Outbox 微信直发。**不再要求扫码。** 当前 staging DSH 和代理继续运行，本轮禁止擅自停机。

## 工作原则

远程 ChatGPT 负责全部代码、模拟测试、CI 和 PR 修复。本地 Agent 仅运行远程无法接触的 macOS/DSH/真实微信/私有测试项目验收。不得另起炉灶，不得覆盖现有 worktree、生产 Profile、微信凭据或模型参数。

仓库 https://github.com/TnzGit/dsh-superagent-prototype ，分支 feat/local-first-wechat-foundation，参见 docs/011-local-project-workers.md。此前的 LOCAL_AGENT_HANDOFF.md A/B 部分已完成，不需要重复。

## C1：无需用户介入的离线前置验证

1. 现有 worktree 检查 git status --short，git fetch origin feat/local-first-wechat-foundation；如有未提交改动，另建新 worktree，不做 reset --hard。
2. 运行 pnpm install --frozen-lockfile、pnpm check。
3. 运行 node --experimental-strip-types --test tests/local-project-workspaces.node-test.mjs tests/local-projects.node-test.mjs tests/local-model-queue.node-test.mjs。
4. 确认 tests/local-ticket-selection.spec.ts 与新 src/local-first/project-workspaces.ts 实际覆盖从微信首行 /project <id> 到 DshExecutor.prepare 的绑定、Git/non-Git 复制、敏感文件过滤、无来源写回。
5. 核查目标 DSH 0.2.2-alpha.2 对 workspace-write 权限的实际支持和沙箱约束；若不支持，标记 BLOCKED 并让远程 ChatGPT 修复，不切换为 danger-full-access。
6. 预备两份可丢弃的测试项目（Git 与非 Git），但**不要修改当前运行的 DSH staging 环境**。用已有 Qwen 验证基线，不重跑 400K 压测。

## C2：需要用户批准的受控 staging 升级

先汇报 C1 结果并请求用户批准一次短时 staging 受控重启。未经批准不能停止微信入口。

仅使用两个用户认可的一次性测试项目，在 repo 以外准备 chmod 600 的 JSON 项目注册表，字段为 allowedRoots 和 projects，示例详见 docs/011-local-project-workers.md。它只能通过 DSH_SUPERAGENT_LOCAL_PROJECTS_FILE 环境变量传给**新 staging 进程**，绝不写入 GitHub 或公共日志。保留现有 0600 微信凭据和 Qwen 单槽代理。

先做 staging SQLite/Profile 本地只读权限备份，并记录原服务启动方式、端口和回滚方法。用户批准窗口后，优雅停止旧 staging host，部署经过 CI 验证的代码并启动；**不能修改生产 ~/.dsh、不能清空旧数据库或重做微信二维码配对**。

## C3：真实 Ticket → Worker 验收

在原有微信会话从获准账号发起：

    /project test-plain
    请把这个临时项目 README.md 中的“测试错字”改为“测试修正”，运行检查并提供 diff 摘要。不要写回原项目、部署或 push。

观察 Weixin Trigger → Policy → accept → Ticket → project snapshot → workspace-write Worker → localqwen (127.0.0.1:8123) → report/Outbox/微信。

必须验证：真实 Ticket ID 与 Worker Session、原项目未修改、工作副本 git diff、工作副本路径被限制在 stateDir/work/<project>/<ticket>、Worker 无源代码目录写权限、不需要 GitHub 仓库、没有云 API。重复用已提交且干净的 test-git 项目测试，确认本地 clone 的 origin 已移除。另测不提供 /project、未知 ID、dirty Git、目录 symlink 时安全失败。**没有真实 Ticket 的结果一律不能写 PASS。**

如果 orchestrator 未把消息判为 accept，先保留完整的脱敏 decision/route 证据并交远程 ChatGPT，不能假造一个 Worker 成功。对已有 staging 的 answer 规则不做额外生产修改。

## C4：报告、回滚与禁止事项

生成 REPORT-local-ticket-worker-stageC.md，分别记录 PASS / FAIL / BLOCKED / NOT RUN、命令退出码、版本、脱敏 Ticket/Session/Outbox 状态、权限、原始目录哈希/内容未变的证据、git diff、Qwen 排队、日志与回滚。遇代码缺陷交远程 ChatGPT 编写修复。

若 Worker 实际越权、错误路由或重复执行，先暂停新的 Ticket；尽量保留微信 Source 在线，按已备份的安全步骤回滚 staging。不使用宽匹配 pkill、删除凭据、删除生产 Profile 或未经确认执行自动应用/合并/部署。

现阶段**只在副本中修改**，任何应用到 Git/非 Git 源项目的操作均需独立授权和新的验收。

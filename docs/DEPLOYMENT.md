# NSWFuelFinder 部署指引

本项目计划采用 **Vercel (前端) + Render (后端 API) + Neon (PostgreSQL)** 的组合。以下步骤帮助你从目前的代码仓库快速搭建起可供朋友试用的线上环境。

---

## 1. 前置准备

- GitHub 仓库：确认 main/dev 分支可用 `npm run build` 与 `dotnet build`。
- 准备以下敏感信息（不要写入仓库）：
  - NSW Fuel API `ApiKey`、`ApiSecret`（或现成 `Authorization` header 值）。
  - JWT 设置：`Jwt__Issuer`、`Jwt__Audience`、`Jwt__SigningKey`（建议 64+ 位随机字符串）。
  - Render/Neon/Vercel 专用环境变量。
- 确保本地 PostgreSQL 已完成迁移，以便随时验证：`dotnet ef database update`。

---

## 2. 数据库：Neon

1. 在 Neon Console 创建项目与数据库（建议为 staging/production 分别建立 DB branch）。
2. 记录连接串并转换为 EF Core 认可格式，例如：
   ```
   Host=<host>;
   Port=5432;
   Database=<database>;
   Username=<user>;
   Password=<password>;
   Ssl Mode=Require;
   Trust Server Certificate=true;
   PGUSER=neondb_owner
   PGPASSWORD=npg_aD0fYpy1HFGC
   Host=ep-muddy-brook-a7l3hw5d-pooler.ap-southeast-2.aws.neon.tech;Port=5432;Database=neondb;Username=neondb_owner;Password=npg_aD0fYpy1HFGC;Ssl Mode=Require;Trust Server Certificate=true;
   
   ```
3. 使用本地或云端运行一次迁移（任选其一）：
   ```bash
   # 本地（建议先在 .env 或 user-secrets 设置 ConnectionStrings:FuelFinder）
   dotnet ef database update --project backend/NSWFuelFinder/NSWFuelFinder.csproj --startup-project backend/NSWFuelFinder/NSWFuelFinder.csproj
   ```
   Render 也可以在 “Build Command” 中追加 `dotnet ef database update`（详见后文）。
4. 配置自动备份：
   - Neon 提供 PITR（7 天 / 30 天等），根据存储计划选择。
   - 价格历史表会持续增长，记得监控容量；必要时可以定期归档旧记录。

---

## 3. 后端：Render Web Service

### 3.1 创建服务

1. Render Dashboard → “New” → “Web Service”，选择 GitHub 仓库。
2. 选择地区（建议 `Singapore` 或 `Ohio`，与主要用户距离较近即可）。
3. 构建 & 启动命令：
   - Build Command:  
     ```bash
     dotnet restore
     dotnet publish backend/NSWFuelFinder/NSWFuelFinder.csproj -c Release -o publish
     ```
   - Start Command:  
     ```bash
     cd publish && ./NSWFuelFinder
     ```
   - 如果需要在部署阶段执行迁移，可在 build 命令后追加一行  
     `dotnet ef database update --project backend/NSWFuelFinder/NSWFuelFinder.csproj --startup-project backend/NSWFuelFinder/NSWFuelFinder.csproj`.

4. 实例规格：至少选择 “Starter” 级别，避免因免费实例休眠导致 `FuelDataSyncService` 无法按时运行。
5. 日志保留：Render 支持 stdout/stderr，必要时接入第三方（如 Sentry、Logtail）。

### 3.2 环境变量

• Render 环境变量建议配置如下（键名中 __ 会自动转换成 :）：

    Host=...;Port=5432;Database=...;Username=...;Password=...;Ssl Mode=Require;Trust Server
    Certificate=true
  - Jwt__Issuer：JWT 发行者（自定义）
  - Jwt__Audience：JWT 受众（自定义）
  - Jwt__SigningKey：JWT 签名密钥（建议 ≥64 字符的随机字符串）
  - Jwt__ExpiresMinutes（可选）：令牌有效分钟数，留空则使用默认 60
  - Jwt__RefreshTokenExpiresDays（可选）：刷新令牌有效天数，留空则使用默认 7
  - NswFuelApi__BaseUrl：默认 https://api.onegov.nsw.gov.au；如无特别需求沿用即可
  - NswFuelApi__NearbyPath：默认 FuelPriceCheck/v1/fuel/prices/nearby
  - NswFuelApi__AllPricesPath：默认 FuelPriceCheck/v1/fuel/prices
  - NswFuelApi__TokenPath：默认 oauth/client_credential/accesstoken
  - NswFuelApi__ApiKey：NSW Fuel API 的订阅 Key
  - NswFuelApi__ApiSecret：NSW Fuel API 的 Client Secret（若改用预生成 Authorization header，可换成
    NswFuelApi__Authorization）
  - FuelDisplay__AllowedFuelTypes（可选）：逗号分隔的油品列表，默认 [ "E10", "U91", "P95", "P98", "DL",
    "PDL" ]

| 键名 | 说明 |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | 建议设为 `Production`。 |
| `ConnectionStrings__FuelFinder` | Neon 连接串（参照上文）。 |
| `Jwt__Issuer` / `Jwt__Audience` / `Jwt__SigningKey` | JWT 配置。 |
| `Jwt__ExpiresMinutes` / `Jwt__RefreshTokenExpiresDays` | 若采用默认可省略。 |
| `NswFuelApi__BaseUrl` | 默认 `https://api.onegov.nsw.gov.au`，按需调整。 |
| `NswFuelApi__NearbyPath` / `NswFuelApi__AllPricesPath` / `NswFuelApi__TokenPath` | 使用默认即可。 |
| `NswFuelApi__ApiKey` / `NswFuelApi__ApiSecret` | NSW Fuel API 凭证。若有预制 Authorization，可用 `NswFuelApi__Authorization` 替代。 |
| `FuelDisplay__AllowedFuelTypes` | 若需要自定义可设置为逗号分隔列表。 |

Render UI 会自动将 `__` 转换为层级配置 (`ConnectionStrings:FuelFinder`)。

### 3.3 备选：后台 Worker / Cron

目前 `FuelDataSyncService` 已在 Web 服务进程内定时刷新（每日 0 点 / 12 点）。若担心 Web 服务重启影响时间点，可以在 Render 再建一个 “Cron Job” 调用 API 触发全量同步（例如新增一个 `/api/admin/sync` 受保护端点）。

---

## 4. 前端：Vercel

1. 连接 GitHub 仓库，选择 `frontend/NSWFuelFinderWeb` 目录。
2. 默认 Build Command：`npm run build`；Output Directory：`dist`（Vite 默认）。
3. 环境变量（Preview/Production 均同）：

• 不需要完全相同，但必须匹配那些要相互验证的值，尤其是 JWT 相关：

  - Jwt__Issuer、Jwt__Audience、Jwt__SigningKey 这三项，前端如果要验证 JWT（或拼接请求时需要某个值），
    就要和后端一致。在你的项目里，JWT 是由后端生成，前端只需要拿到 token 调用 API，所以更多是在后端配
    置；只是以后如果前端要解析 token，可以把这些值同步到 Vercel。但至少后端必须配置到 Render 的环境变量
    里，前端拿着后端签发的 token 就能用。
  - ConnectionStrings__FuelFinder、NswFuelApi__ApiKey 等仅后端需要，前端无需设置。
  - VITE_API_BASE_URL 是前端在 Vercel 上的关键变量，指出后端 Render 服务的公共 URL；这个值只在 Vercel
    配置，不需要在后端重复。

| 键名 | 值示例 |
| --- | --- |
| `VITE_API_BASE_URL` | `https://your-render-service.onrender.com`（替换为 Render API 域名） |

4. 默认会提供 `<your-project>.vercel.app` 域名；可绑定自定义域名。
5. 若需要调用 HTTPS，确保 Render 端启用 TLS（Render 有免费证书）。

---

## 5. 测试与回滚建议

1. **Staging 环境**：建议在 GitHub 创建 `staging` 分支，对应 Render/Vercel 的 Preview 服务，确认一切正常后再合并到 `main` → production 自动部署。
2. **健康检查**：在 Render 设置健康检查 URL（例如 `/health`，可在后端新增简单的健康检查端点）。
3. **监控与告警**：考虑接入 UptimeRobot 探活 + Slack/Email 告警。
4. **回滚**：Render/Vercel 都支持一键回滚到上一版发布。

---

## 6. 本地与线上环境差异注意事项

- Postgres 与 SQLite 已切换彻底完成；本地/线上统一使用 Postgres，避免 Provider 差异。
- 头像仍存于浏览器 localStorage；若未来需要云端存储，需规划 S3/GCS 或 Render Static 方案。
- 自定义过滤偏好保存在数据库（`UserPreferences` 表），迁移完成后无需额外数据同步。
- 如要提供 Google 登录，需在 Render 设置 `GoogleAuth__ClientId`、`GoogleAuth__ClientSecret`，并在 Google Console 添加 Render/Vercel 域名的授权回调。

---

## 7. 快速核对清单

- [ ] Neon 数据库创建并执行 EF 迁移。
- [ ] Render Web Service 已配置必需环境变量，成功启动且日志无异常。
- [ ] FuelDataSyncService 首次运行完成（日志中可看到同步成功信息）。
- [ ] Vercel 前端环境变量指向 Render API。
- [ ] 登录、油价列表、趋势图、个性化过滤在预发环境验证通过。

完成以上步骤，即可邀请朋友试用 Beta 版。保留好配置文档，后续扩容或迁移也更轻松。祝发布顺利！

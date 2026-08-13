# 智麦招聘需求监控中心

原项目基于 [vinext](https://github.com/cloudflare/vinext) + Cloudflare Workers + D1 构建。本项目已改造为**访问密码**模式，可部署到 Cloudflare 并生成公开链接。

## 改造内容

- 移除原 ChatGPT 强制登录，改为统一的访问密码验证
- 后端 API 通过 `x-access-password` 请求头校验密码
- 密码正确后方可在 localStorage 中保存，后续自动进入
- 保留原项目的招聘需求增删改查、AI 策略助手等核心功能

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

---

## 部署到 Cloudflare Workers（公开访问）

### 1. 上传源码到 GitHub

1. 在 GitHub 新建公开仓库，例如 `zhimai-recruitment-hub`
2. 把本文件夹里的全部文件上传到仓库
3. 确保 `wrangler.toml` 已包含在仓库中

### 2. 安装 wrangler 并登录

```bash
npm install -g wrangler
wrangler login
```

### 3. 创建 D1 数据库

```bash
wrangler d1 create zhimai-recruitment-hub-db
```

把返回的 `database_id` 填入 `wrangler.toml` 的 `database_id` 字段。

### 4. 运行数据库迁移

```bash
wrangler d1 migrations apply zhimai-recruitment-hub-db --local=false
```

### 5. 设置密钥

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put OPENAI_MODEL        # 输入 gpt-5.6-terra
wrangler secret put ACCESS_PASSWORD     # 输入你的访问密码
```

### 6. 部署

```bash
npm install
npm run build
wrangler deploy
```

部署成功后，终端会显示公开链接，例如：

```
https://zhimai-recruitment-hub.xxxxx.workers.dev
```

把这个链接分享给他人即可访问。

## 注意事项

- 项目不能在 GitHub Pages 上直接运行，因为它需要后端 API 和 D1 数据库。
- 如果不配置 `OPENAI_API_KEY`，AI 助手会自动降级为内置知识库回答。
- 密码仅做简单访问控制，不适合高安全场景。

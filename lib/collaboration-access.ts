export function isAccessPasswordValid(request: Request) {
  const configuredPassword = String(process.env.ACCESS_PASSWORD ?? "").trim();
  if (!configuredPassword) return true;

  const supplied = request.headers.get("x-access-password")?.trim() ?? "";
  return supplied === configuredPassword;
}

export function isCollaborationUserAllowed(email: string) {
  const normalized = email.trim().toLowerCase();
  return collaborationEmails().has(normalized);
}

export function getAuthorizedRequestUser(request: Request) {
  if (!isAccessPasswordValid(request)) return null;

  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (email && isCollaborationUserAllowed(email)) return email;

  // 兼容 Cloudflare 部署：没有 ChatGPT 登录时，使用密码作为匿名用户标识
  return "访客";
}

function collaborationEmails() {
  const list = String(process.env.COLLABORATION_ALLOWED_EMAILS ?? "").split(",");
  return new Set(
    list
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

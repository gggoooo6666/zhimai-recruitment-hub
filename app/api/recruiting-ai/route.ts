import { getAuthorizedRequestUser } from "../../../lib/collaboration-access";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequest = {
  messages?: ChatMessage[];
  filterContext?: string;
  apiBaseUrl?: string;
  model?: string;
};

const RECRUITING_CONTEXT = `
你是“招聘策略 AI 助手”，服务于花小猪招聘需求监控中心。回答必须简洁、可执行，并明确区分数据事实与策略建议。

可用数据口径：
- 历史 Offer 明细：74 个 Offer，56 人已入职，18 人拒绝，历史入职率 75.7%。
- Cooper 近期信号：13 个终面通过、4 个在途、5 个拒绝。
- 历史拒绝原因中，薪酬福利 9 次，占 50%；其他包括平台及岗位、定级、个人和职业发展。
- 算法：历史 15 个 Offer、入职率 80%；当前 2 个在招 HC。近期目标公司包括百度、字节跳动、奇富科技、美团；近期样本名校率 100%，CR 约 1.22，涨幅参考 29%。
- 研发工程：历史 7 个 Offer、入职率 71.4%；当前暂无在招需求。
- 产品策略：历史 7 个 Offer、入职率 85.7%；当前 1 个 P0 HC。近期目标公司包括美团、快手；名校与大厂占比均约 67%，CR 约 1.19，涨幅参考 17%。
- 平台运营：历史 25 个 Offer、入职率 76%；当前 5 个在招 HC。近期目标公司包括美团、快手、字节跳动及同类出行/本地生活平台。
- 商业/数据分析：历史 15 个 Offer、入职率 66.7%；当前 2 个储备 HC。近期目标公司包括美团、百度、字节跳动、快手；名校与大厂占比均为 100%，CR 约 1.29，涨幅参考 26%。
- 品牌市场：历史 2 个 Offer、入职率 100%；当前 1 个储备 HC。近期目标公司包括京东、华为和头部消费科技品牌；近期风险集中在原司挽留与竞业限制。

回答规则：
1. 优先回答用户问题，再给 2–4 条建议动作。
2. 涉及筛选结果时，只使用请求中提供的汇总上下文。
3. 不猜测候选人个人情况，不输出或索取姓名、邮箱、电话等个人信息。
4. 数据不足时明确说“样本不足”，不要把建议写成事实。
5. 不做录用、淘汰等最终决定；建议由招聘团队复核。
`.trim();

export async function POST(request: Request) {
  if (!getAuthorizedRequestUser(request)) {
    return Response.json({ error: "访问密码不正确或缺失" }, { status: 401 });
  }

  let payload: ChatRequest;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求内容格式不正确" }, { status: 400 });
  }

  const messages = sanitizeMessages(payload.messages);
  if (!messages.length || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "请输入需要分析的问题" }, { status: 400 });
  }

  const filterContext = String(payload.filterContext ?? "").slice(0, 6_000);
  const apiKey = request.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({
      answer: answerFromKnowledge(messages.at(-1)?.content ?? "", filterContext),
      mode: "knowledge",
    });
  }

  const apiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl);
  const model = payload.model?.trim() || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28_000);

  try {
    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "developer",
            content: `${RECRUITING_CONTEXT}\n\n当前页面筛选汇总：\n${filterContext || "未提供筛选上下文"}`,
          },
          ...messages,
        ],
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("OpenAI API error:", response.status, errorBody.slice(0, 500));
      const friendly = parseOpenAiError(response.status, errorBody);
      return Response.json(
        { error: friendly },
        { status: 502 },
      );
    }

    const result = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = result.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return Response.json(
        { error: "AI 暂未生成有效回答，请换一种问法" },
        { status: 502 },
      );
    }

    return Response.json({ answer, mode: "ai" });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "AI 回答超时，请精简问题后重试"
      : "AI 服务连接失败，请稍后重试";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeMessages(value: ChatRequest["messages"]): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is ChatMessage =>
      (message?.role === "user" || message?.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2_000),
    }));
}

function normalizeApiBaseUrl(value: unknown) {
  const fallback = "https://api.openai.com/v1";
  if (typeof value !== "string" || !value.trim()) return fallback;
  let url = value.trim();
  if (url.endsWith("/")) url = url.slice(0, -1);
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
  if (!/\/v\d+$/.test(url) && !url.endsWith("/v1")) url = `${url}/v1`;
  try {
    new URL(url);
    return url;
  } catch {
    return fallback;
  }
}

function parseOpenAiError(status: number, body: string) {
  if (status === 401) return "API Key 无效或已过期，请检查后重新输入";
  if (status === 429) return "API 调用频率超限或余额不足，请稍后再试";
  if (status === 404) return "当前模型不可用，请尝试切换模型（如 gpt-4o-mini）";
  if (status >= 500) return "AI 服务商暂时不可用，请稍后重试";
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message ?? "";
  } catch {
    detail = body.slice(0, 200);
  }
  return detail ? `AI 服务错误：${detail}` : "AI 服务暂时不可用，请稍后重试";
}

function answerFromKnowledge(question: string, filterContext: string) {
  const query = question.toLowerCase();
  const scope = filterContext
    ? `\n\n当前筛选范围：${filterContext.split("\n")[0]}。`
    : "";

  if (/p0|紧急|优先/.test(query)) {
    return `当前应优先推进 P0 需求，并为每个岗位明确 48 小时内的寻访、面试和 Offer 节点。建议：\n1. 先处理算法、产品和运营中的 P0 HC。\n2. 每个岗位至少保留 2–3 名备选人选。\n3. 面试前完成职级与薪酬边界校准。${scope}`;
  }
  if (/算法|交易策略|价格策略/.test(query)) {
    return `算法岗历史入职率为 80%，当前有 2 个在招 HC。建议优先关注百度、字节跳动、奇富科技、美团的相似团队；目标职级覆盖 D5–D7，重点验证交易、定价或策略算法经验。历史算法拒绝均与薪酬有关，应在定级后 24 小时内完成薪酬预沟通。${scope}`;
  }
  if (/运营|客服|区域|供需/.test(query)) {
    return `平台运营历史样本最多，共 25 个 Offer，入职率 76%，当前约 5 个在招 HC。建议优先经营美团、快手、字节及同类平台人才，面试重点验证量化业务结果、跨部门推动和高压执行能力；Offer 前完成岗位、薪酬、动机和回流标准四项校准。${scope}`;
  }
  if (/产品|治理|增长/.test(query)) {
    return `产品策略岗历史入职率为 85.7%，当前有 1 个 P0 HC。近期目标公司集中在美团、快手等头部平台。建议首轮讲清职责边界、决策权和成功标准，并在面试前校准定级，降低竞品机会和岗位预期不一致造成的流失。${scope}`;
  }
  if (/商业分析|数据分析|经营分析|商分/.test(query)) {
    return `商业/数据分析历史入职率为 66.7%，低于整体 75.7%，当前以 D6–D7 储备为主。建议重点经营美团、百度、字节、快手分析团队，用案例面验证分析对决策的影响，并在 Offer 前同步工作内容、定级和薪酬。${scope}`;
  }
  if (/市场|品牌|竞业/.test(query)) {
    return `品牌市场样本较少，当前画像只适合作为寻访方向。近期风险集中在原公司挽留和竞业限制。建议首轮核查竞业、离职动机和留任可能，同时保持 2–3 名备选梯队。${scope}`;
  }
  if (/拒绝|流失|offer|薪酬/.test(query)) {
    return `历史 18 次拒绝中，薪酬福利占 9 次，是首要风险；近期还出现竞品 Offer、原司挽留、工作内容和竞业限制。建议：\n1. 面试前确认薪酬区间与职级预期。\n2. 发 Offer 前完成竞品、挽留、岗位内容和竞业检查。\n3. 入职等待超过 30 天时每周保温。${scope}`;
  }
  if (/目标公司|公司|人才地图/.test(query)) {
    return `目标公司应按岗位分层：算法关注百度、字节、奇富科技、美团；产品关注美团、快手；运营关注美团、快手、字节及同类出行/本地生活平台；商业分析关注美团、百度、字节、快手；品牌市场关注京东、华为及头部消费科技品牌。${scope}`;
  }

  return `我可以结合历史 Offer、Cooper 近期信号和当前筛选需求回答招聘策略问题。你可以继续问：\n- 哪些需求应该优先推进？\n- 某类岗位的目标人群和目标公司是什么？\n- 如何降低 Offer 拒绝率？\n- 当前筛选结果应该采取什么行动？${scope}\n\n当前为知识库回答模式，配置服务端 AI 密钥后会启用生成式连续对话。`;
}

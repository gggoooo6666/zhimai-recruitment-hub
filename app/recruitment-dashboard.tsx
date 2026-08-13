"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Demand = {
  id: string;
  role: string;
  department: string;
  team: string;
  series: string;
  subSeries: string;
  level: string;
  headcount: number;
  requestType: string;
  employeeType: string;
  note: string;
  status: "招聘中" | "招聘暂停" | "需求完成";
  progress: string;
  urgency: "P0-紧急" | "P1-中等" | "P2-长期储备";
  ddl: string;
  ddlState: string;
  initiated: string;
  ytd: number | null;
  lastEdited?: string;
  updatedBy?: string;
};

const sourceUrl = "https://cooper.didichuxing.com/docs2/sheet/2209052728994?sheetId=oWrwV";

const statuses = ["全部需求", "招聘中", "招聘暂停", "需求完成"] as const;

function todayInShanghai() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function calculateDdlState(ddl: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ddl)) return "未设置 DDL";
  const today = todayInShanghai();
  const difference = Math.round(
    (Date.parse(`${ddl}T00:00:00+08:00`) - Date.parse(`${today}T00:00:00+08:00`)) / 86_400_000,
  );
  if (difference < 0) return `已超 DDL ${Math.abs(difference)} 天`;
  if (difference === 0) return "今日到期";
  return `剩余 ${difference} 天`;
}

type DemandFilters = {
  department: string;
  series: string;
  level: string;
  urgency: string;
  ddl: string;
};

type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "ai" | "knowledge";
};

const emptyFilters: DemandFilters = {
  department: "",
  series: "",
  level: "",
  urgency: "",
  ddl: "",
};

type ProfileKey = "algorithm" | "engineering" | "product" | "operations" | "analysis" | "marketing";

type TalentProfile = {
  key: ProfileKey;
  label: string;
  roles: string;
  sample: string;
  outcome: string;
  targetPeople: string[];
  targetCompanies: string[];
  hardMetrics: string[];
  softMetrics: string[];
  risks: string[];
  actions: string[];
  filter: string;
  tone: string;
};

const talentProfiles: TalentProfile[] = [
  {
    key: "algorithm",
    label: "算法人才",
    roles: "算法工程师 · 高级算法工程师",
    sample: "历史 15 个 Offer + Cooper 近期 5 条",
    outcome: "历史入职率 80% · 当前 2 个在招 HC",
    targetPeople: ["当前需求 D5–D7，历史成功样本集中 D5–D6", "硕士及以上为历史成功主力（10/12）", "近期样本以名校、连续 A/B 绩效为主"],
    targetCompanies: ["百度", "字节跳动", "奇富科技", "美团 / 同类策略团队"],
    hardMetrics: ["近期算法样本名校率 100%", "CR 约 1.22，涨幅预算参考 29%", "绩效以连续 A/B 为主", "交易、定价或策略算法直接经验"],
    softMetrics: ["复杂问题抽象与建模", "算法方案转化为业务结果", "与产品、运营协同落地", "潜力标签以 B 至 B+ 为主"],
    risks: ["历史 3 次拒绝均由薪酬福利触发", "近期存在竞品 Offer 截胡，且入职周期偏长"],
    actions: ["定级后 24 小时内完成薪酬预沟通", "重点经营四类目标公司相似团队", "等待期超过 30 天启用每周保温机制"],
    filter: "算法",
    tone: "indigo",
  },
  {
    key: "engineering",
    label: "研发工程人才",
    roles: "后端研发 · 研发工程师",
    sample: "历史 7 个 Offer · Cooper 暂无近期样本",
    outcome: "历史入职率 71.4% · 当前暂无在招",
    targetPeople: ["D5 为主、兼顾 D6 的工程人才", "本科或硕士，后端/平台研发直接匹配", "校招、内推与门户渠道人群"],
    targetCompanies: ["TMBK", "其他对标公司", "大型互联网研发团队"],
    hardMetrics: ["职级主攻 D5", "本科及以上", "后端或平台工程直接经验", "技术深度与岗位级别匹配"],
    softMetrics: ["工程质量与稳定性意识", "复杂系统拆解和排障", "跨团队协作与交付节奏", "对业务场景的理解能力"],
    risks: ["拒绝原因涉及薪酬与个人选择", "工程岗入职等待中位数 36 天"],
    actions: ["优先校招、内推及已验证门户渠道", "技术面后同步薪酬和入职周期", "建立 30–60 天等待期保温清单"],
    filter: "研发",
    tone: "sky",
  },
  {
    key: "product",
    label: "产品策略人才",
    roles: "用户与策略产品 · B 端产品",
    sample: "历史 7 个 Offer + Cooper 近期 3 条",
    outcome: "历史入职率 85.7% · 当前 1 个 P0 HC",
    targetPeople: ["当前需求聚焦 D7，近期样本覆盖 D6–D7", "治理、增长、用户策略或 B 端产品经验", "近期样本以名校和头部平台背景为主"],
    targetCompanies: ["美团", "快手", "其他头部平台", "成熟策略产品团队"],
    hardMetrics: ["近期名校与大厂占比均约 67%", "CR 约 1.19，涨幅预算参考 17%", "绩效以连续 A/B 为主", "能提供清晰的策略产品结果案例"],
    softMetrics: ["策略判断与用户洞察", "问题定义和优先级取舍", "复杂协作方推动", "潜力标签以 B 至 B+ 为主"],
    risks: ["近期流失来自竞品机会与定级预期", "岗位内容不清晰会放大候选人犹豫"],
    actions: ["首轮讲清职责边界、决策权和成功标准", "面试前校准定级，Offer 前对标竞品机会", "重点经营美团、快手相似产品团队"],
    filter: "产品",
    tone: "violet",
  },
  {
    key: "operations",
    label: "平台运营人才",
    roles: "策略运营 · 智能客服 · 区域运营",
    sample: "历史 25 个 Offer + Cooper 近期 7 条",
    outcome: "历史入职率 76% · 当前 5 个在招 HC",
    targetPeople: ["当前需求覆盖 D6–D8，历史成功样本覆盖 D5–D9", "有用户、供需、客服、渠道或区域运营经验", "优先连续 A/B 绩效与明确业务结果人群"],
    targetCompanies: ["美团", "快手", "字节跳动", "同类出行与本地生活平台"],
    hardMetrics: ["岗位经历与运营场景直接匹配", "职级以 D6–D8 为当前重点", "需有可量化业务结果案例", "高职级或回流人选前置校准标准"],
    softMetrics: ["一线问题感知与策略迭代", "资源协调和跨部门推动", "数据驱动的经营意识", "高压环境下的执行韧性"],
    risks: ["近期流失涉及竞品机会、回流标准与薪酬", "平台运营部分岗位已超 DDL，转化压力集中"],
    actions: ["优先 Boss、TL 自建及内推渠道", "首轮展示真实业务场景与发展路径", "Offer 前形成薪酬、岗位、动机与回流四项清单"],
    filter: "运营",
    tone: "mint",
  },
  {
    key: "analysis",
    label: "商业 / 数据分析",
    roles: "商业分析 · 经营分析 · 数据科学",
    sample: "历史 15 个 Offer + Cooper 近期 4 条",
    outcome: "历史入职率 66.7% · 当前 2 个储备 HC",
    targetPeople: ["当前储备需求聚焦 D6–D7，近期样本覆盖 D5–D6", "硕士人群为历史成功主力（7/10）", "商业、经营分析或数据科学直接经验"],
    targetCompanies: ["美团", "百度", "字节跳动", "快手"],
    hardMetrics: ["近期名校与大厂占比均为 100%", "CR 约 1.29，涨幅预算参考 26%", "绩效以连续 A/B 为主", "需有分析推动决策的完整案例"],
    softMetrics: ["商业敏感度与结构化思考", "从分析到决策建议的闭环", "高层沟通与叙事能力", "潜力标签以 B 至 B+ 为主"],
    risks: ["近期流失来自工作内容、定级及候选人失联", "数据科学历史样本仅 1/3 入职，需单独复盘"],
    actions: ["重点经营四家目标公司相似分析团队", "案例面验证决策影响力与表达", "Offer 前同步岗位内容、定级与薪酬"],
    filter: "商业分析",
    tone: "amber",
  },
  {
    key: "marketing",
    label: "品牌市场人才",
    roles: "市场经理 · 品牌渠道运营",
    sample: "历史 2 个 Offer + Cooper 近期 2 条",
    outcome: "历史入职率 100% · 当前 1 个储备 HC",
    targetPeople: ["当前与近期样本均聚焦 D7", "本科及以上，有整合营销或品牌渠道项目", "优先头部科技与大型平台市场团队"],
    targetCompanies: ["京东", "华为", "WHJM", "头部消费与科技品牌"],
    hardMetrics: ["近期样本以名校/大厂背景为主", "需有代表性整合营销项目", "绩效以连续 A/B 为主", "入场前核查竞业与原司挽留风险"],
    softMetrics: ["品牌策略与资源整合能力", "跨渠道项目统筹", "业务导向而非单纯传播导向", "稳定的加入动机"],
    risks: ["近期拒绝来自原司挽留与竞业限制", "合计样本仍小，不宜形成排他性门槛"],
    actions: ["寻访首轮核查竞业与留任可能", "同步建立 2–3 名备选梯队", "强化岗位业务权责与长期成长空间"],
    filter: "市场",
    tone: "coral",
  },
];

function urgencyClass(urgency: Demand["urgency"]) {
  if (urgency.startsWith("P0")) return "priority-p0";
  if (urgency.startsWith("P1")) return "priority-p1";
  return "priority-p2";
}

export default function RecruitmentDashboard() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [active, setActive] = useState<(typeof statuses)[number]>("全部需求");
  const [activeStrategy, setActiveStrategy] = useState<"p0" | "offer" | "overdue" | "reserve" | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>("algorithm");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DemandFilters>(emptyFilters);
  const [selected, setSelected] = useState<Demand | null>(null);
  const [editing, setEditing] = useState<Demand | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sharedStatus, setSharedStatus] = useState<"loading" | "connected" | "error">("loading");
  const [currentUser, setCurrentUser] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"ai" | "knowledge" | null>(null);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好，我是招聘策略助手。可以结合历史 Offer、Cooper 近期信号和当前筛选结果，帮你判断优先级、目标公司与转化动作。",
    },
  ]);
  const [toast, setToast] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("zhimai-access-password");
    if (saved) setAccessPassword(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedDemands() {
      try {
        const response = await fetch("/api/demands", {
          cache: "no-store",
          headers: accessPassword ? { "x-access-password": accessPassword } : {},
        });
        const result = await response.json() as {
          demands?: Demand[];
          user?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "共享需求库加载失败");

        if (cancelled) return;
        setDemands(result.demands ?? []);
        setCurrentUser(result.user ?? "");
        setSharedStatus("connected");
      } catch (error) {
        if (cancelled) return;
        setSharedStatus("error");
        setToast(error instanceof Error ? error.message : "共享需求库暂时不可用");
      }
    }

    if (accessPassword) {
      void loadSharedDemands();
    }
    return () => { cancelled = true; };
  }, [accessPassword]);

  const filterOptions = useMemo(() => ({
    departments: [...new Set(demands.map((item) => item.department).filter((value) => value && value !== "—"))].sort(),
    series: [...new Set(demands.map((item) => item.series).filter((value) => value && value !== "—"))].sort(),
    levels: [...new Set(demands.map((item) => item.level).filter((value) => value && value !== "暂无"))].sort(),
  }), [demands]);

  const filtered = useMemo(() => demands.filter((item) => {
    const matchesStatus = active === "全部需求" || item.status === active;
    const needle = query.trim().toLowerCase();
    const haystack = [item.role, item.department, item.team, item.series, item.subSeries, item.level, item.status, item.progress, item.urgency, item.ddlState, item.note].join(" ").toLowerCase();
    const matchesFilters =
      (!filters.department || item.department === filters.department) &&
      (!filters.series || item.series === filters.series) &&
      (!filters.level || item.level === filters.level) &&
      (!filters.urgency || item.urgency === filters.urgency) &&
      (!filters.ddl ||
        (filters.ddl === "overdue" && item.ddlState.includes("已超")) ||
        (filters.ddl === "remaining" && item.ddlState.includes("剩余")) ||
        (filters.ddl === "unset" && /未设置|待计算/.test(item.ddlState)));
    const matchesStrategy =
      !activeStrategy ||
      (activeStrategy === "p0" && item.status === "招聘中" && item.urgency === "P0-紧急") ||
      (activeStrategy === "offer" && /(Offer 待沟通|拒绝 Offer|拒绝入职)/i.test(item.progress)) ||
      (activeStrategy === "overdue" && item.status !== "需求完成" && item.ddlState.includes("已超")) ||
      (activeStrategy === "reserve" && item.urgency === "P2-长期储备");
    return matchesStatus && matchesFilters && matchesStrategy && (!needle || haystack.includes(needle));
  }), [active, activeStrategy, demands, filters, query]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const nextDemandId = useMemo(() => {
    const highest = demands.reduce((maximum, demand) => {
      const match = demand.id.match(/(\d+)$/);
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);
    return `需求-${String(highest + 1).padStart(2, "0")}`;
  }, [demands]);

  const stats = {
    recruiting: demands.filter((d) => d.status === "招聘中").length,
    paused: demands.filter((d) => d.status === "招聘暂停").length,
    p0: demands.filter((d) => d.urgency === "P0-紧急").length,
    seats: demands.filter((d) => d.status !== "需求完成").reduce((sum, d) => sum + d.headcount, 0),
  };

  const strategyCounts = {
    p0: demands.filter((d) => d.status === "招聘中" && d.urgency === "P0-紧急").length,
    offer: demands.filter((d) => /(Offer 待沟通|拒绝 Offer|拒绝入职)/i.test(d.progress)).length,
    overdue: demands.filter((d) => d.status !== "需求完成" && d.ddlState.includes("已超")).length,
    reserve: demands.filter((d) => d.urgency === "P2-长期储备").length,
  };

  async function submitDemand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = String(data.get("id") || nextDemandId).trim();
    if (demands.some((item) => item.id === id)) {
      setToast(`需求标识“${id}”已存在，请更换`);
      setTimeout(() => setToast(""), 3600);
      return;
    }

    const ddl = String(data.get("ddl") || "").trim() || "待确认";
    const ytdValue = String(data.get("ytd") || "").trim();
    const newDemand: Demand = {
      id,
      role: String(data.get("role") || "").trim() || "未命名岗位",
      department: String(data.get("department") || "").trim() || "待确认",
      team: String(data.get("team") || "").trim() || "待确认",
      series: String(data.get("series") || "").trim() || "待确认",
      subSeries: String(data.get("subSeries") || "").trim() || "待确认",
      level: String(data.get("level") || "").trim() || "待确认",
      headcount: Math.max(0, Number(data.get("headcount") || 0)),
      requestType: String(data.get("requestType") || "").trim() || "新增 HC",
      employeeType: String(data.get("employeeType") || "").trim() || "正式",
      note: String(data.get("note") || "").trim() || "网站新增，待同步 Cooper",
      status: String(data.get("status") || "招聘中") as Demand["status"],
      progress: String(data.get("progress") || "").trim() || "待启动",
      urgency: String(data.get("urgency") || "P1-中等") as Demand["urgency"],
      ddl,
      ddlState: calculateDdlState(ddl),
      initiated: String(data.get("initiated") || "").trim() || todayInShanghai(),
      ytd: ytdValue ? Number(ytdValue) : null,
    };

    try {
      const response = await fetch("/api/demands", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessPassword ? { "x-access-password": accessPassword } : {}),
        },
        body: JSON.stringify({ action: "create", demand: newDemand }),
      });
      const result = await response.json() as {
        demand?: Demand;
        user?: string;
        error?: string;
      };
      if (!response.ok || !result.demand) throw new Error(result.error || "新增需求失败");

      setDemands((current) => [result.demand as Demand, ...current]);
      setCurrentUser(result.user ?? currentUser);
      resetDemandView();
      setShowForm(false);
      setSelected(result.demand);
      setToast(`${result.demand.role}已新增，所有成员将看到最新内容`);
      setTimeout(() => setToast(""), 3600);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "新增需求失败");
      setTimeout(() => setToast(""), 3600);
    }
  }

  function openEditor(demand: Demand) {
    setSelected(null);
    setEditing(demand);
  }

  async function submitDemandEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const data = new FormData(event.currentTarget);
    const id = String(data.get("id") || editing.id).trim();
    if (demands.some((item) => item.id !== editing.id && item.id === id)) {
      setToast(`需求标识“${id}”已存在，请更换`);
      setTimeout(() => setToast(""), 3600);
      return;
    }

    const ddl = String(data.get("ddl") || "").trim() || "待确认";
    const ytdValue = String(data.get("ytd") || "").trim();
    const updated: Demand = {
      ...editing,
      id,
      role: String(data.get("role") || "").trim() || "未命名岗位",
      department: String(data.get("department") || "").trim() || "待确认",
      team: String(data.get("team") || "").trim() || "待确认",
      status: String(data.get("status") || editing.status) as Demand["status"],
      urgency: String(data.get("urgency") || editing.urgency) as Demand["urgency"],
      level: String(data.get("level") || "").trim() || "待确认",
      series: String(data.get("series") || "").trim() || "待确认",
      subSeries: String(data.get("subSeries") || "").trim() || "待确认",
      headcount: Math.max(0, Number(data.get("headcount") || 0)),
      requestType: String(data.get("requestType") || "").trim() || "待确认",
      employeeType: String(data.get("employeeType") || "").trim() || "正式",
      ddl,
      ddlState: calculateDdlState(ddl),
      initiated: String(data.get("initiated") || "").trim() || "待确认",
      note: String(data.get("note") || "").trim() || "暂无",
      progress: String(data.get("progress") || "").trim() || "—",
      ytd: ytdValue ? Number(ytdValue) : null,
    };

    try {
      const response = await fetch("/api/demands", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(accessPassword ? { "x-access-password": accessPassword } : {}),
        },
        body: JSON.stringify({ originalId: editing.id, demand: updated }),
      });
      const result = await response.json() as {
        demand?: Demand;
        user?: string;
        error?: string;
      };
      if (!response.ok || !result.demand) throw new Error(result.error || "保存需求失败");

      setDemands((current) => current.map((item) => item.id === editing.id ? result.demand as Demand : item));
      setCurrentUser(result.user ?? currentUser);
      setEditing(null);
      setToast(`${result.demand.role}已保存，所有成员将看到最新内容`);
      setTimeout(() => setToast(""), 3600);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "保存需求失败");
      setTimeout(() => setToast(""), 3600);
    }
  }

  function setDemandFilter(key: keyof DemandFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setActiveStrategy(null);
  }

  function resetDemandView() {
    setActive("全部需求");
    setActiveStrategy(null);
    setQuery("");
    setFilters(emptyFilters);
  }

  function applyQuickFilter(value: string) {
    setActive("全部需求");
    setActiveStrategy(null);
    setFilters(emptyFilters);
    setQuery(value);
  }

  function applyStrategy(strategy: "p0" | "offer" | "overdue" | "reserve") {
    setActive("全部需求");
    setQuery("");
    setFilters(emptyFilters);
    setActiveStrategy((current) => current === strategy ? null : strategy);
    window.setTimeout(() => document.getElementById("demand-table")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  const profile = talentProfiles.find((item) => item.key === selectedProfile) ?? talentProfiles[0];

  function applyProfileFilter() {
    setActive("全部需求");
    setActiveStrategy(null);
    setFilters(emptyFilters);
    setQuery(profile.filter);
    window.setTimeout(() => document.getElementById("demand-table")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function sendAiMessage(preset?: string) {
    const question = (preset ?? aiInput).trim();
    if (!question || aiLoading) return;

    const userMessage: AiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
    };
    const nextMessages = [...aiMessages, userMessage];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);

    const filterSummary = [
      `当前显示 ${filtered.length}/${demands.length} 条需求`,
      active !== "全部需求" ? `状态=${active}` : "",
      filters.department ? `部门=${filters.department}` : "",
      filters.series ? `序列=${filters.series}` : "",
      filters.level ? `职级=${filters.level}` : "",
      filters.urgency ? `紧急度=${filters.urgency}` : "",
      filters.ddl ? `DDL=${filters.ddl}` : "",
      query ? `关键词=${query}` : "",
    ].filter(Boolean).join("；");
    const demandContext = filtered.slice(0, 24).map((item) =>
      `${item.role}｜${item.department}/${item.team}｜${item.level}｜${item.status}｜${item.urgency}｜${item.ddlState}｜HC ${item.headcount}`,
    ).join("\n");

    try {
      const response = await fetch("/api/recruiting-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessPassword ? { "x-access-password": accessPassword } : {}),
        },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          filterContext: `${filterSummary}\n${demandContext}`,
        }),
      });
      const result = await response.json() as {
        answer?: string;
        mode?: "ai" | "knowledge";
        error?: string;
      };
      if (!response.ok || !result.answer) {
        throw new Error(result.error || "暂时无法获得回答");
      }
      setAiMode(result.mode ?? "ai");
      setAiMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.answer ?? "",
        mode: result.mode,
      }]);
    } catch (error) {
      setAiMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "AI 服务暂时不可用，请稍后重试。",
      }]);
    } finally {
      setAiLoading(false);
    }
  }

  function clearAiConversation() {
    setAiMessages([{
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: "对话已清空。你可以继续询问岗位优先级、目标公司、人才画像或 Offer 转化策略。",
    }]);
    setAiMode(null);
  }

  function verifyPassword() {
    const value = passwordInput.trim();
    if (!value) {
      setPasswordError("请输入访问密码");
      return;
    }
    localStorage.setItem("zhimai-access-password", value);
    setAccessPassword(value);
    setPasswordError("");
  }

  if (!accessPassword) {
    return (
      <main className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "20px",
          padding: "48px",
          width: "100%",
          maxWidth: "420px",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h1 style={{ fontSize: "24px", marginBottom: "8px", color: "#f8fafc" }}>访问验证</h1>
          <p style={{ color: "#94a3b8", marginBottom: "28px" }}>请输入访问密码以进入招聘需求监控中心</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(""); }}
            placeholder="访问密码"
            onKeyDown={(e) => { if (e.key === "Enter") verifyPassword(); }}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.25)",
              color: "#f8fafc",
              fontSize: "16px",
              marginBottom: "16px",
              outline: "none",
            }}
          />
          {passwordError && <p style={{ color: "#f87171", marginBottom: "16px", fontSize: "14px" }}>{passwordError}</p>}
          <button
            onClick={verifyPassword}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #ec4899)",
              color: "white",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            进入系统
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="招聘需求监控中心首页">
          <span className="brand-mark">需</span>
          <span><strong>招聘需求</strong><small>监控与对接中心</small></span>
        </a>
        <div className="search-wrap">
          <span>⌕</span>
          <input aria-label="搜索招聘需求" placeholder="搜索岗位、部门、序列、职级…" value={query} onChange={(e) => { setQuery(e.target.value); setActiveStrategy(null); }} />
          <kbd>⌘ K</kbd>
        </div>
        <div className="top-actions">
          <span className={`shared-pill ${sharedStatus}`}>
            <i />
            {sharedStatus === "connected" ? "多人共享" : sharedStatus === "error" ? "共享异常" : "正在同步"}
          </span>
          <a className="source-pill" href={sourceUrl} target="_blank" rel="noreferrer"><i /> Cooper 数据源</a>
          <div className="avatar">HR</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <nav aria-label="主导航">
            <p className="nav-label">需求工作台</p>
            <a className="nav-item active" href="#"><span>▦</span>需求总览</a>
            <a className="nav-item" href="#strategy"><span>✦</span>招聘策略<b>6</b></a>
            <button className="nav-item ai-nav" onClick={() => setShowAi(true)}><span>✧</span>AI 策略助手<i>NEW</i></button>
            <button className="nav-item" onClick={() => { setActive("招聘中"); setActiveStrategy(null); setQuery(""); }}><span>◎</span>招聘中<b>{stats.recruiting}</b></button>
            <button className="nav-item" onClick={() => { setActive("招聘暂停"); setActiveStrategy(null); setQuery(""); }}><span>Ⅱ</span>暂停需求<b>{stats.paused}</b></button>
            <p className="nav-label spaced">快捷筛选</p>
            <button className="filter-link" onClick={() => applyQuickFilter("P0")}><i className="dot coral" />P0 紧急需求<span>{stats.p0}</span></button>
            <button className="filter-link" onClick={() => applyQuickFilter("已超 DDL")}><i className="dot amber" />已超 DDL<span>11</span></button>
            <button className="filter-link" onClick={() => applyQuickFilter("Offer")}><i className="dot violet" />Offer 进展<span>4</span></button>
          </nav>
          <div className="sidebar-card">
            <span className="spark">↻</span>
            <strong>需求与近期样本来自 Cooper<br />历史基线来自 Offer 明细</strong>
            <p>双源聚合分析 · 策略区仅展示汇总结论</p>
            <a href={sourceUrl} target="_blank" rel="noreferrer">查看原始表格 →</a>
          </div>
          <div className="support"><span>i</span><div><strong>口径说明</strong><small>1 行对应 1 个招聘需求</small></div></div>
        </aside>

        <section className="content">
          <div className="heading-row">
            <div>
              <p className="eyebrow">COOPER · 需求明细</p>
              <h1>招聘需求监控中心</h1>
              <p className="subtitle">多人共享新增、编辑和筛选需求，并让 AI 助手结合双源数据给出推进建议。</p>
            </div>
            <div className="heading-actions">
              <a className="secondary-link" href={sourceUrl} target="_blank" rel="noreferrer">打开 Cooper 原表 ↗</a>
              <button className="ai-launch-button" onClick={() => setShowAi(true)}>✦ 询问 AI</button>
              <button className="primary-button" onClick={() => setShowForm(true)}><span>＋</span> 新建需求</button>
            </div>
          </div>

          <section className="stats-grid" aria-label="招聘需求数据概览">
            <article><span className="stat-icon blue">▤</span><div><small>招聘中需求</small><strong>{stats.recruiting}</strong><em>占全部 56%</em></div></article>
            <article><span className="stat-icon orange">!</span><div><small>P0 紧急需求</small><strong>{stats.p0}</strong><em className="warm">需重点跟进</em></div></article>
            <article><span className="stat-icon purple">Ⅱ</span><div><small>招聘暂停</small><strong>{stats.paused}</strong><em>均为长期储备</em></div></article>
            <article><span className="stat-icon green">HC</span><div><small>未关闭 HC</small><strong>{stats.seats}</strong><em>招聘中 + 暂停</em></div></article>
          </section>

          <section className="strategy-section" id="strategy" aria-labelledby="strategy-title">
            <div className="strategy-heading">
              <div>
                <p className="eyebrow">ACTION PLAYBOOK</p>
                <h2 id="strategy-title">招聘策略</h2>
              </div>
              <p>结合 74 个历史 Offer 与 Cooper 近期终面、在途和需求数据，拆解岗位策略与转化动作。</p>
            </div>
            <div className="strategy-bar">
              <button className={`strategy-card tone-coral ${activeStrategy === "p0" ? "active" : ""}`} onClick={() => applyStrategy("p0")} aria-pressed={activeStrategy === "p0"}>
                <span className="strategy-icon">⚡</span>
                <span className="strategy-copy"><small>最高优先级</small><strong>P0 岗位攻坚</strong><em>48 小时内完成寻访与面试节点复盘</em></span>
                <span className="strategy-count"><b>{strategyCounts.p0}</b>个需求</span>
                <span className="strategy-arrow">→</span>
              </button>
              <button className={`strategy-card tone-violet ${activeStrategy === "offer" ? "active" : ""}`} onClick={() => applyStrategy("offer")} aria-pressed={activeStrategy === "offer"}>
                <span className="strategy-icon">◇</span>
                <span className="strategy-copy"><small>转化保障</small><strong>Offer 防流失</strong><em>历史先校准薪酬，近期同步防竞品、挽留与竞业</em></span>
                <span className="strategy-count"><b>5</b>次近期拒绝</span>
                <span className="strategy-arrow">→</span>
              </button>
              <button className={`strategy-card tone-amber ${activeStrategy === "overdue" ? "active" : ""}`} onClick={() => applyStrategy("overdue")} aria-pressed={activeStrategy === "overdue"}>
                <span className="strategy-icon">◷</span>
                <span className="strategy-copy"><small>时效治理</small><strong>超期需求清理</strong><em>逐条确认继续、暂停或关闭并重设 DDL</em></span>
                <span className="strategy-count"><b>{strategyCounts.overdue}</b>个超期</span>
                <span className="strategy-arrow">→</span>
              </button>
              <button className={`strategy-card tone-mint ${activeStrategy === "reserve" ? "active" : ""}`} onClick={() => applyStrategy("reserve")} aria-pressed={activeStrategy === "reserve"}>
                <span className="strategy-icon">◎</span>
                <span className="strategy-copy"><small>渠道经营</small><strong>人才储备经营</strong><em>优先 TL 自建与内推，持续验证小样本渠道</em></span>
                <span className="strategy-count"><b>{strategyCounts.reserve}</b>个需求</span>
                <span className="strategy-arrow">→</span>
              </button>
            </div>

            <div className="profile-strategy">
              <div className="profile-strategy-head">
                <div>
                  <p className="eyebrow">SUCCESS PATTERN</p>
                  <h3>相似岗位人才画像策略</h3>
                  <p>双源分析：74 个历史 Offer 提供长期基线，Cooper 提供近期终面、绩效、潜力、公司与当前需求信号。</p>
                </div>
                <div className="outcome-summary" aria-label="历史招聘结果汇总">
                  <span><small>历史 Offer</small><b>74</b></span>
                  <span><small>历史入职率</small><b>75.7%</b></span>
                  <span><small>Cooper 终面</small><b>13</b></span>
                  <span><small>Cooper 在途</small><b>4</b></span>
                  <span className="risk"><small>Cooper 拒绝</small><b>5</b></span>
                </div>
              </div>

              <div className="profile-tabs" role="tablist" aria-label="选择相似岗位人才画像">
                {talentProfiles.map((item) => (
                  <button
                    key={item.key}
                    role="tab"
                    aria-selected={selectedProfile === item.key}
                    className={selectedProfile === item.key ? "active" : ""}
                    onClick={() => setSelectedProfile(item.key)}
                  >
                    <span className={`profile-tab-dot ${item.tone}`} />
                    <span><strong>{item.label}</strong><small>{item.sample}</small></span>
                  </button>
                ))}
              </div>

              <article className={`profile-panel profile-${profile.tone}`}>
                <div className="profile-overview">
                  <span className="profile-badge">画像策略</span>
                  <h4>{profile.label}</h4>
                  <p>{profile.roles}</p>
                  <div className="profile-result"><small>{profile.sample}</small><strong>{profile.outcome}</strong></div>
                  <button onClick={applyProfileFilter}>查看相似在招需求 →</button>
                </div>

                <div className="profile-dimensions">
                  <section>
                    <span className="dimension-icon">人</span>
                    <div><small>目标人群</small>{profile.targetPeople.map((text) => <p key={text}>{text}</p>)}</div>
                  </section>
                  <section>
                    <span className="dimension-icon">企</span>
                    <div><small>目标公司</small><div className="company-tags">{profile.targetCompanies.map((text) => <span key={text}>{text}</span>)}</div></div>
                  </section>
                  <section>
                    <span className="dimension-icon">硬</span>
                    <div><small>硬性指标</small>{profile.hardMetrics.map((text) => <p key={text}>{text}</p>)}</div>
                  </section>
                  <section>
                    <span className="dimension-icon">软</span>
                    <div><small>软性指标</small>{profile.softMetrics.map((text) => <p key={text}>{text}</p>)}</div>
                  </section>
                </div>

                <div className="profile-guidance">
                  <section>
                    <span className="guidance-label risk">转化风险</span>
                    <div>{profile.risks.map((text) => <span key={text}>! {text}</span>)}</div>
                  </section>
                  <section>
                    <span className="guidance-label action">寻访动作</span>
                    <div>{profile.actions.map((text) => <span key={text}>✓ {text}</span>)}</div>
                  </section>
                </div>
              </article>
            </div>
          </section>

          <section className="demand-panel" id="demand-table">
            <div className="panel-toolbar">
              <div className="tabs" role="tablist" aria-label="按状态筛选">
                {statuses.map((status) => (
                  <button key={status} role="tab" aria-selected={active === status} className={active === status ? "active" : ""} onClick={() => { setActive(status); setActiveStrategy(null); setQuery(""); }}>
                    {status}{status === "全部需求" && <span>{demands.length}</span>}
                  </button>
                ))}
              </div>
              <div className="view-actions"><button onClick={resetDemandView}>↻ <span>重置</span></button><button aria-label="列表视图" className="active">▤</button><button aria-label="卡片视图">▦</button></div>
            </div>

            <div className="advanced-filters" aria-label="需求高级筛选">
              <div className="filter-summary">
                <span>筛选</span>
                <strong>{activeFilterCount ? `${activeFilterCount} 项已启用` : "全部范围"}</strong>
              </div>
              <label>
                <span>部门</span>
                <select value={filters.department} onChange={(event) => setDemandFilter("department", event.target.value)}>
                  <option value="">全部部门</option>
                  {filterOptions.departments.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span>序列</span>
                <select value={filters.series} onChange={(event) => setDemandFilter("series", event.target.value)}>
                  <option value="">全部序列</option>
                  {filterOptions.series.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span>职级</span>
                <select value={filters.level} onChange={(event) => setDemandFilter("level", event.target.value)}>
                  <option value="">全部职级</option>
                  {filterOptions.levels.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>
                <span>紧急度</span>
                <select value={filters.urgency} onChange={(event) => setDemandFilter("urgency", event.target.value)}>
                  <option value="">全部紧急度</option>
                  <option value="P0-紧急">P0-紧急</option>
                  <option value="P1-中等">P1-中等</option>
                  <option value="P2-长期储备">P2-长期储备</option>
                </select>
              </label>
              <label>
                <span>DDL</span>
                <select value={filters.ddl} onChange={(event) => setDemandFilter("ddl", event.target.value)}>
                  <option value="">全部时效</option>
                  <option value="overdue">已超 DDL</option>
                  <option value="remaining">DDL 内</option>
                  <option value="unset">未设置</option>
                </select>
              </label>
              {activeFilterCount > 0 && <button className="clear-filters" onClick={() => setFilters(emptyFilters)}>清除筛选</button>}
            </div>

            <div className="table-scroll">
              <table>
                <thead><tr><th>岗位 / 需求</th><th>部门 / 团队</th><th>状态</th><th>紧急度</th><th>职级 / 序列</th><th>人员进展</th><th>DDL</th><th /></tr></thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} onClick={() => setSelected(item)}>
                      <td><strong>{item.role}</strong><small>{item.id} · HC {item.headcount} · {item.requestType}{item.updatedBy && item.updatedBy !== "系统导入" ? " · 已共享更新" : ""}</small></td>
                      <td><strong className="cell-main">{item.department}</strong><small className="cell-sub">{item.team}</small></td>
                      <td><span className={`status status-${item.status}`}>{item.status}</span></td>
                      <td><span className={`priority ${urgencyClass(item.urgency)}`}>{item.urgency}</span></td>
                      <td><strong className="cell-main">{item.level}</strong><small className="cell-sub">{item.series} · {item.subSeries}</small></td>
                      <td><div className="progress-note">{item.progress === "—" ? "暂无进展记录" : item.progress}</div>{item.ytd !== null && <small className="cell-sub">YTD：{item.ytd}</small>}</td>
                      <td><strong className="cell-main">{item.ddl}</strong><small className={`cell-sub ${item.ddlState.includes("已超") ? "overdue" : ""}`}>{item.ddlState}</small></td>
                      <td><button className="row-edit" onClick={(event) => { event.stopPropagation(); openEditor(item); }} aria-label={`编辑${item.role}`}>编辑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="empty"><span>⌕</span><strong>没有匹配的招聘需求</strong><p>试试调整关键词或筛选条件</p></div>}
            </div>
            <div className="table-footer"><span>当前显示 {filtered.length} / {demands.length} 条需求{activeStrategy ? " · 已应用招聘策略" : ""} · 共享需求库{currentUser ? ` · 当前账号 ${currentUser}` : ""}</span><div><button disabled>‹</button><button className="current">1</button><button disabled>›</button></div></div>
          </section>
        </section>
      </div>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}>
          <section className="modal edit-modal" role="dialog" aria-modal="true" aria-labelledby="new-title" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">NEW REQUEST</p><h2 id="new-title">新增招聘需求</h2><p>完整录入需求内容，保存后立即进入列表并参与所有分析。</p></div><button onClick={() => setShowForm(false)} aria-label="关闭">×</button></div>
            <form onSubmit={submitDemand}>
              <label><span>需求标识 *</span><input name="id" required defaultValue={nextDemandId} /></label>
              <label><span>岗位名称 *</span><input name="role" required placeholder="例如：算法工程师" autoFocus /></label>
              <label><span>部门 *</span><input name="department" required placeholder="例如：技术&策略部" /></label>
              <label><span>团队</span><input name="team" placeholder="例如：交易策略" /></label>
              <label><span>状态</span><select name="status" defaultValue="招聘中"><option>招聘中</option><option>招聘暂停</option><option>需求完成</option></select></label>
              <label><span>紧急度</span><select name="urgency" defaultValue="P1-中等"><option>P0-紧急</option><option>P1-中等</option><option>P2-长期储备</option></select></label>
              <label><span>职级</span><input name="level" placeholder="例如：D6~D7" /></label>
              <label><span>大序列</span><input name="series" placeholder="例如：技术" /></label>
              <label><span>小序列</span><input name="subSeries" placeholder="例如：算法" /></label>
              <label><span>需求数量（HC）</span><input name="headcount" type="number" min="0" defaultValue="1" /></label>
              <label><span>需求类型</span><input name="requestType" defaultValue="新增 HC" /></label>
              <label><span>员工类型</span><input name="employeeType" defaultValue="正式" /></label>
              <label><span>DDL</span><input name="ddl" type="date" /></label>
              <label><span>需求发起日期</span><input name="initiated" type="date" defaultValue={todayInShanghai()} /></label>
              <label><span>YTD</span><input name="ytd" type="number" min="0" /></label>
              <label className="full"><span>需求说明</span><textarea name="note" rows={3} placeholder="填写新增背景、替补原因或岗位说明" /></label>
              <label className="full"><span>人员进展</span><textarea name="progress" rows={3} placeholder="例如：待启动、简历筛选中、Offer 待沟通" /></label>
              <p className="edit-note full">新增内容会保存到共享需求库，所有授权成员都能看到；不会自动回写 Cooper 原表。</p>
              <div className="form-actions full"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>取消</button><button className="primary-button" type="submit">保存并新增需求</button></div>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="关闭详情">×</button>
            <p className="eyebrow">{selected.id} · {selected.initiated} 发起</p>
            <h2>{selected.role}</h2>
            <div className="drawer-tags"><span className={`status status-${selected.status}`}>{selected.status}</span><span className={`priority ${urgencyClass(selected.urgency)}`}>{selected.urgency}</span></div>
            <div className="detail-grid">
              <div><small>二级部门</small><strong>{selected.department}</strong></div><div><small>三级部门</small><strong>{selected.team}</strong></div>
              <div><small>大序列 / 小序列</small><strong>{selected.series} / {selected.subSeries}</strong></div><div><small>需求职级</small><strong>{selected.level}</strong></div>
              <div><small>需求数量</small><strong>{selected.headcount} HC</strong></div><div><small>员工类型</small><strong>{selected.employeeType}</strong></div>
              <div><small>需求类型</small><strong>{selected.requestType}</strong></div><div><small>DDL</small><strong>{selected.ddl}</strong></div>
            </div>
            <h3>需求说明</h3><div className="note-box">{selected.note}</div>
            <h3>人员进展说明</h3><div className="progress-detail"><span>↗</span><strong>{selected.progress === "—" ? "暂无人员进展记录" : selected.progress}</strong></div>
            <h3>时效状态</h3>
            <div className="timeline"><i /><div><strong>{selected.initiated} · 需求发起</strong><small>{selected.department} / {selected.team}</small></div><i className={selected.ddlState.includes("已超") ? "danger" : ""} /><div><strong>{selected.ddl} · DDL</strong><small>{selected.ddlState}</small></div><i className="muted" /><div><strong>当前状态：{selected.status}</strong><small>{selected.updatedBy && selected.updatedBy !== "系统导入" ? `${selected.updatedBy} · ${selected.lastEdited ?? "刚刚"} 更新` : "数据基线来自 Cooper「需求明细」"}</small></div></div>
            <div className="drawer-actions">
              <button className="primary-button drawer-action" onClick={() => openEditor(selected)}>编辑全部信息</button>
              <a className="secondary-button drawer-action link-button" href={sourceUrl} target="_blank" rel="noreferrer">查看 Cooper 原表</a>
            </div>
          </aside>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop edit-backdrop" onMouseDown={() => setEditing(null)}>
          <section className="modal edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><p className="eyebrow">EDIT REQUEST</p><h2 id="edit-title">编辑需求全部信息</h2><p>保存后，列表、筛选、统计和 AI 分析会立即使用新数据。</p></div>
              <button onClick={() => setEditing(null)} aria-label="关闭编辑">×</button>
            </div>
            <form onSubmit={submitDemandEdit}>
              <label><span>需求标识 *</span><input name="id" required defaultValue={editing.id} /></label>
              <label><span>岗位名称 *</span><input name="role" required defaultValue={editing.role} autoFocus /></label>
              <label><span>部门 *</span><input name="department" required defaultValue={editing.department} /></label>
              <label><span>团队</span><input name="team" defaultValue={editing.team} /></label>
              <label><span>状态</span><select name="status" defaultValue={editing.status}><option>招聘中</option><option>招聘暂停</option><option>需求完成</option></select></label>
              <label><span>紧急度</span><select name="urgency" defaultValue={editing.urgency}><option>P0-紧急</option><option>P1-中等</option><option>P2-长期储备</option></select></label>
              <label><span>职级</span><input name="level" defaultValue={editing.level} /></label>
              <label><span>大序列</span><input name="series" defaultValue={editing.series} /></label>
              <label><span>小序列</span><input name="subSeries" defaultValue={editing.subSeries} /></label>
              <label><span>需求数量（HC）</span><input name="headcount" type="number" min="0" defaultValue={editing.headcount} /></label>
              <label><span>需求类型</span><input name="requestType" defaultValue={editing.requestType} /></label>
              <label><span>员工类型</span><input name="employeeType" defaultValue={editing.employeeType} /></label>
              <label><span>DDL</span><input name="ddl" type="date" defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(editing.ddl) ? editing.ddl : ""} /></label>
              <label><span>需求发起日期</span><input name="initiated" type="date" defaultValue={/^\d{4}-\d{2}-\d{2}$/.test(editing.initiated) ? editing.initiated : ""} /></label>
              <label><span>YTD</span><input name="ytd" type="number" min="0" defaultValue={editing.ytd ?? ""} /></label>
              <label className="full"><span>需求说明</span><textarea name="note" rows={3} defaultValue={editing.note} /></label>
              <label className="full"><span>人员进展</span><textarea name="progress" rows={3} defaultValue={editing.progress === "—" ? "" : editing.progress} /></label>
              <p className="edit-note full">编辑内容会保存到共享需求库，并记录当前账号和时间；不会自动回写 Cooper 原表。</p>
              <div className="form-actions full">
                <button type="button" className="secondary-button" onClick={() => setEditing(null)}>取消</button>
                <button className="primary-button" type="submit">保存全部修改</button>
              </div>
            </form>
          </section>
        </div>
      )}
      <button className={`ai-fab ${showAi ? "hidden" : ""}`} onClick={() => setShowAi(true)} aria-label="打开招聘策略 AI 助手">
        <span>✦</span>
        <strong>问 AI</strong>
      </button>
      {showAi && (
        <aside className="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-title">
          <header className="ai-panel-head">
            <div className="ai-brand">
              <span>✦</span>
              <div>
                <small>RECRUITING COPILOT</small>
                <h2 id="ai-title">招聘策略 AI 助手</h2>
              </div>
            </div>
            <div className="ai-head-actions">
              <button onClick={clearAiConversation}>清空</button>
              <button className="ai-close" onClick={() => setShowAi(false)} aria-label="关闭 AI 助手">×</button>
            </div>
          </header>
          <div className="ai-context">
            <span className={`ai-mode ${aiMode ?? "ready"}`}>
              <i />
              {aiMode === "ai" ? "OpenAI 在线" : aiMode === "knowledge" ? "知识库模式" : "双源数据已就绪"}
            </span>
            <p>正在参考当前筛选的 <b>{filtered.length}</b> 条需求，不会发送候选人姓名或进展备注。</p>
          </div>
          <div className="ai-messages" aria-live="polite">
            {aiMessages.map((message) => (
              <article key={message.id} className={`ai-message ${message.role}`}>
                <span className="ai-message-avatar">{message.role === "assistant" ? "AI" : "我"}</span>
                <div>{message.content}</div>
              </article>
            ))}
            {aiLoading && (
              <article className="ai-message assistant">
                <span className="ai-message-avatar">AI</span>
                <div className="ai-typing"><i /><i /><i /></div>
              </article>
            )}
          </div>
          {aiMessages.length <= 1 && (
            <div className="ai-suggestions">
              {[
                "当前哪些需求应该优先推进？",
                "分析算法岗的目标公司和风险",
                "如何降低 Offer 拒绝率？",
              ].map((question) => (
                <button key={question} onClick={() => void sendAiMessage(question)}>{question}</button>
              ))}
            </div>
          )}
          <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); void sendAiMessage(); }}>
            <textarea
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendAiMessage();
                }
              }}
              placeholder="询问岗位优先级、目标公司、画像或转化策略…"
              rows={2}
              maxLength={2_000}
            />
            <button type="submit" disabled={!aiInput.trim() || aiLoading} aria-label="发送问题">↑</button>
          </form>
          <footer className="ai-disclaimer">AI 建议用于辅助判断，招聘决策请结合业务团队复核。</footer>
        </aside>
      )}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

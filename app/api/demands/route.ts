import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { demands } from "../../../db/schema";
import { initialDemandRows } from "../../../db/initial-demands";
import { getAuthorizedRequestUser } from "../../../lib/collaboration-access";

type DemandInput = {
  id?: string;
  role?: string;
  department?: string;
  team?: string;
  series?: string;
  subSeries?: string;
  level?: string;
  headcount?: number;
  requestType?: string;
  employeeType?: string;
  note?: string;
  status?: string;
  progress?: string;
  urgency?: string;
  ddl?: string;
  ddlState?: string;
  initiated?: string;
  ytd?: number | null;
};

const statuses = new Set(["招聘中", "招聘暂停", "需求完成"]);
const urgencies = new Set(["P0-紧急", "P1-中等", "P2-长期储备"]);

export async function GET(request: Request) {
  const user = getAuthorizedRequestUser(request);
  if (!user) return unauthorized();

  try {
    const db = getDb();
    let rows = await db.select().from(demands).orderBy(asc(demands.id));
    if (rows.length === 0) {
      const seedRows = initialDemandRows.map((item) => sanitizeDemand(item, "系统导入"));
      for (let index = 0; index < seedRows.length; index += 4) {
        await db
          .insert(demands)
          .values(seedRows.slice(index, index + 4))
          .onConflictDoNothing();
      }
      rows = await db.select().from(demands).orderBy(asc(demands.id));
    }
    return Response.json({
      demands: rows,
      user,
    });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const user = getAuthorizedRequestUser(request);
  if (!user) return unauthorized();

  try {
    const payload = await request.json() as {
      action?: "create";
      demand?: DemandInput;
    };
    const db = getDb();

    const demand = sanitizeDemand(payload.demand ?? {}, user);
    const [created] = await db.insert(demands).values(demand).returning();
    return Response.json({ demand: created, user }, { status: 201 });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      return Response.json({ error: "需求标识已存在，请更换" }, { status: 409 });
    }
    return databaseError(error);
  }
}

export async function PUT(request: Request) {
  const user = getAuthorizedRequestUser(request);
  if (!user) return unauthorized();

  try {
    const payload = await request.json() as {
      originalId?: string;
      demand?: DemandInput;
    };
    const originalId = clean(payload.originalId, 100);
    if (!originalId) {
      return Response.json({ error: "缺少原需求标识" }, { status: 400 });
    }

    const updated = sanitizeDemand(payload.demand ?? {}, user);
    const db = getDb();
    const [saved] = await db
      .update(demands)
      .set(updated)
      .where(eq(demands.id, originalId))
      .returning();

    if (!saved) {
      return Response.json({ error: "未找到需要修改的需求" }, { status: 404 });
    }
    return Response.json({ demand: saved, user });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      return Response.json({ error: "需求标识已存在，请更换" }, { status: 409 });
    }
    return databaseError(error);
  }
}

function sanitizeDemand(input: DemandInput, updatedBy: string) {
  const status = clean(input.status, 20);
  const urgency = clean(input.urgency, 30);
  const ytd = input.ytd === null || input.ytd === undefined
    ? null
    : Math.max(0, Math.round(Number(input.ytd) || 0));

  return {
    id: clean(input.id, 100) || `需求-${Date.now()}`,
    role: clean(input.role, 200) || "未命名岗位",
    department: clean(input.department, 120) || "待确认",
    team: clean(input.team, 120) || "待确认",
    series: clean(input.series, 80) || "待确认",
    subSeries: clean(input.subSeries, 80) || "待确认",
    level: clean(input.level, 50) || "待确认",
    headcount: Math.max(0, Math.round(Number(input.headcount) || 0)),
    requestType: clean(input.requestType, 80) || "待确认",
    employeeType: clean(input.employeeType, 50) || "正式",
    note: clean(input.note, 2_000) || "暂无",
    status: statuses.has(status) ? status : "招聘中",
    progress: clean(input.progress, 2_000) || "—",
    urgency: urgencies.has(urgency) ? urgency : "P1-中等",
    ddl: clean(input.ddl, 30) || "待确认",
    ddlState: clean(input.ddlState, 80) || "未设置 DDL",
    initiated: clean(input.initiated, 30) || "待确认",
    ytd,
    lastEdited: updatedBy === "系统导入" ? null : editedAt(),
    updatedBy,
  };
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function editedAt() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function unauthorized() {
  return Response.json({ error: "访问密码不正确或缺失" }, { status: 401 });
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Demand database request failed:", message);
  const missingTable = message.includes("no such table");
  return Response.json(
    { error: missingTable ? "共享需求库正在初始化，请稍后刷新" : "共享需求库暂时不可用" },
    { status: 500 },
  );
}

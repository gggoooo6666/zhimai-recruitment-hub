import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const demands = sqliteTable("demands", {
  id: text("id").primaryKey(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  team: text("team").notNull(),
  series: text("series").notNull(),
  subSeries: text("sub_series").notNull(),
  level: text("level").notNull(),
  headcount: integer("headcount").notNull().default(0),
  requestType: text("request_type").notNull(),
  employeeType: text("employee_type").notNull(),
  note: text("note").notNull(),
  status: text("status").notNull(),
  progress: text("progress").notNull(),
  urgency: text("urgency").notNull(),
  ddl: text("ddl").notNull(),
  ddlState: text("ddl_state").notNull(),
  initiated: text("initiated").notNull(),
  ytd: integer("ytd"),
  lastEdited: text("last_edited"),
  updatedBy: text("updated_by").notNull().default("系统导入"),
});

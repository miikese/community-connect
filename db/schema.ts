import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("records", {
 id: text("id").primaryKey(), kind: text("kind").notNull(), owner: text("owner").notNull(),
 status: text("status").notNull(), data: text("data").notNull(), created: text("created").notNull(), updated: text("updated").notNull(),
}, t => [index("records_kind_status").on(t.kind,t.status), index("records_owner").on(t.owner)]);
export const users = sqliteTable("users", {id:text("id").primaryKey(),name:text("name").notNull(),role:text("role").notNull().default("member")});
export const actions = sqliteTable("actions", {id:text("id").primaryKey(),owner:text("owner").notNull(),record:text("record").notNull(),type:text("type").notNull(),data:text("data").notNull().default("{}"),created:text("created").notNull()},t=>[index("actions_owner").on(t.owner)]);
export const audit = sqliteTable("audit", {id:text("id").primaryKey(),record:text("record").notNull(),actor:text("actor").notNull(),status:text("status").notNull(),note:text("note").notNull(),created:text("created").notNull()});
export const notifications = sqliteTable("notifications", {id:text("id").primaryKey(),owner:text("owner").notNull(),message:text("message").notNull(),read:integer("read").notNull().default(0),created:text("created").notNull()});
export const uploads = sqliteTable("uploads", {id:text("id").primaryKey(),owner:text("owner").notNull(),mime:text("mime").notNull(),created:text("created").notNull()});
export const limits = sqliteTable("limits", {id:text("id").primaryKey(),count:integer("count").notNull()});

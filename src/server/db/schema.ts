import { date, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const festivos = pgTable("festivos", {
  fecha: date("fecha", { mode: "string" }).primaryKey(),
  nombre: text("nombre").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

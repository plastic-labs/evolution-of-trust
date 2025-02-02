import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  player1Score: integer("player1_score").notNull().default(0),
  player2Score: integer("player2_score").notNull().default(0),
  currentRound: integer("current_round").notNull().default(1),
  totalRounds: integer("total_rounds").notNull(),
  status: text("status").notNull().default("waiting"),
  gameMode: text("game_mode").notNull().default("standard"), // standard or interactive
  agent1Config: jsonb("agent1_config").notNull().default({
    model: "llama3.2",
    systemPrompt: "default"
  }),
  agent2Config: jsonb("agent2_config").notNull().default({
    model: "llama3.2",
    systemPrompt: "default"
  })
});

export const moves = pgTable("moves", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  round: integer("round").notNull(),
  player1Move: text("player1_move").notNull(),
  player2Move: text("player2_move").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  sender: text("sender").notNull(), // agent1 or agent2
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("dialogue"), // dialogue or thought
  conversationTurn: integer("conversation_turn").notNull().default(1), // which conversation turn this message belongs to
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(games);
export const insertMoveSchema = createInsertSchema(moves);
export const insertMessageSchema = createInsertSchema(messages);

export const agentConfigSchema = z.object({
  model: z.enum(["llama3.2:3b", "llama3.3:70b"]),
  systemPrompt: z.enum(["default", "competitive", "cooperative", "random"])
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type Game = typeof games.$inferSelect;
export type Move = typeof moves.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type InsertMove = z.infer<typeof insertMoveSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

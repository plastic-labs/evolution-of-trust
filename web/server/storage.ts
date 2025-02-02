import { type Game, type Move, type Message, type InsertGame, type InsertMove, type InsertMessage, type AgentConfig } from "@shared/schema";

export interface IStorage {
  createGame(gameMode: string, agent1Config?: AgentConfig, agent2Config?: AgentConfig): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGame(game: Game): Promise<Game>;
  addMove(move: InsertMove): Promise<Move>;
  getMoves(gameId: number): Promise<Move[]>;
  addMessage(message: InsertMessage): Promise<Message>;
  getMessages(gameId: number): Promise<Message[]>;
}

export class MemStorage implements IStorage {
  private games: Map<number, Game>;
  private moves: Map<number, Move>;
  private messages: Map<number, Message>;
  private currentGameId = 1;
  private currentMoveId = 1;
  private currentMessageId = 1;

  constructor() {
    this.games = new Map();
    this.moves = new Map();
    this.messages = new Map();
  }

  async createGame(gameMode: string = "standard", agent1Config?: AgentConfig, agent2Config?: AgentConfig): Promise<Game> {
    const defaultConfig = {
      model: "gpt-4o" as const,
      systemPrompt: "default" as const
    };

    const totalRounds = Math.floor(Math.random() * 5) + 3; // Random number between 3 and 7

    const game: Game = {
      id: this.currentGameId++,
      player1Score: 0,
      player2Score: 0,
      currentRound: 1,
      totalRounds,
      status: "waiting",
      gameMode,
      agent1Config: agent1Config || defaultConfig,
      agent2Config: agent2Config || defaultConfig
    };
    this.games.set(game.id, game);
    return game;
  }

  async getGame(id: number): Promise<Game | undefined> {
    return this.games.get(id);
  }

  async updateGame(game: Game): Promise<Game> {
    this.games.set(game.id, game);
    return game;
  }

  async addMove(move: InsertMove): Promise<Move> {
    const newMove: Move = {
      ...move,
      id: this.currentMoveId++,
      timestamp: new Date()
    };
    this.moves.set(newMove.id, newMove);
    return newMove;
  }

  async getMoves(gameId: number): Promise<Move[]> {
    return Array.from(this.moves.values()).filter(move => move.gameId === gameId);
  }

  async addMessage(message: InsertMessage): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: this.currentMessageId++,
      timestamp: new Date()
    };
    this.messages.set(newMessage.id, newMessage);
    return newMessage;
  }

  async getMessages(gameId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(msg => msg.gameId === gameId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

export const storage = new MemStorage();
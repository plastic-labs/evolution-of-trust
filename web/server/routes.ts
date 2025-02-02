import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getAgentMove } from "./llm";
import type { AgentConfig } from "@shared/schema";

async function playGameRound(gameId: number) {
  try {
    console.log(`Starting round for game ${gameId}`);
    const game = await storage.getGame(gameId);
    if (!game || game.status !== "in_progress") {
      console.log(`Game ${gameId} not found or not in progress`);
      return;
    }

    const moves = await storage.getMoves(gameId);
    const messages = await storage.getMessages(gameId);
    const isInteractive = game.gameMode === "interactive";

    if (isInteractive) {
      // Handle interactive mode with conversation turns
      for (let turn = 0; turn < 2; turn++) {
        console.log(`Starting conversation turn ${turn + 1} for game ${gameId}`);

        const [agent1Response, agent2Response] = await Promise.all([
          getAgentMove(
            "agent1",
            moves.map(m => ({
              round: m.round,
              player1Move: m.player1Move,
              player2Move: m.player2Move
            })),
            { player1Score: game.player1Score, player2Score: game.player2Score },
            messages.map(m => ({
              sender: m.sender,
              content: m.content,
              messageType: m.messageType,
              conversationTurn: m.conversationTurn
            })),
            game.agent1Config as AgentConfig,
            true,
            turn
          ),
          getAgentMove(
            "agent2",
            moves.map(m => ({
              round: m.round,
              player1Move: m.player1Move,
              player2Move: m.player2Move
            })),
            { player1Score: game.player1Score, player2Score: game.player2Score },
            messages.map(m => ({
              sender: m.sender,
              content: m.content,
              messageType: m.messageType,
              conversationTurn: m.conversationTurn
            })),
            game.agent2Config as AgentConfig,
            true,
            turn
          )
        ]);

        await Promise.all([
          storage.addMessage({
            gameId,
            sender: "agent1",
            content: agent1Response.message,
            messageType: "dialogue",
            conversationTurn: turn + 1,
            timestamp: new Date()
          }),
          storage.addMessage({
            gameId,
            sender: "agent2",
            content: agent2Response.message,
            messageType: "dialogue",
            conversationTurn: turn + 1,
            timestamp: new Date()
          })
        ]);

        // Add delay between conversation turns
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Get final moves after dialogue
    const [agent1Decision, agent2Decision] = await Promise.all([
      getAgentMove(
        "agent1",
        moves.map(m => ({
          round: m.round,
          player1Move: m.player1Move,
          player2Move: m.player2Move
        })),
        { player1Score: game.player1Score, player2Score: game.player2Score },
        messages.map(m => ({
          sender: m.sender,
          content: m.content,
          messageType: m.messageType,
          conversationTurn: m.conversationTurn
        })),
        game.agent1Config as AgentConfig,
        isInteractive
      ),
      getAgentMove(
        "agent2",
        moves.map(m => ({
          round: m.round,
          player1Move: m.player1Move,
          player2Move: m.player2Move
        })),
        { player1Score: game.player1Score, player2Score: game.player2Score },
        messages.map(m => ({
          sender: m.sender,
          content: m.content,
          messageType: m.messageType,
          conversationTurn: m.conversationTurn
        })),
        game.agent2Config as AgentConfig,
        isInteractive
      )
    ]);

    // Record thoughts first
    await Promise.all([
      storage.addMessage({
        gameId,
        sender: "agent1",
        content: agent1Decision.message,
        messageType: "thought",
        conversationTurn: 0,
        timestamp: new Date()
      }),
      storage.addMessage({
        gameId,
        sender: "agent2",
        content: agent2Decision.message,
        messageType: "thought",
        conversationTurn: 0,
        timestamp: new Date()
      })
    ]);

    // Add delay to allow thoughts to be read
    await new Promise(resolve => setTimeout(resolve, 1000));


    // Record moves
    const player1Move = agent1Decision.move || "cooperate";
    const player2Move = agent2Decision.move || "cooperate";

    const move = await storage.addMove({
      gameId,
      round: game.currentRound,
      player1Move,
      player2Move,
      timestamp: new Date()
    });

    // Add move messages to show choices
    await Promise.all([
      storage.addMessage({
        gameId,
        sender: "agent1",
        content: player1Move,
        messageType: "move",
        round: game.currentRound,
        conversationTurn: 0,
        timestamp: new Date()
      }),
      storage.addMessage({
        gameId,
        sender: "agent2",
        content: player2Move,
        messageType: "move",
        round: game.currentRound,
        conversationTurn: 0,
        timestamp: new Date()
      })
    ]);

    console.log(`Game ${gameId} Round ${game.currentRound} moves:`, {
      player1: player1Move,
      player2: player2Move
    });


    // Calculate scores
    let p1Score = 0;
    let p2Score = 0;

    if (player1Move === "cooperate" && player2Move === "cooperate") {
      p1Score = 2;
      p2Score = 2;
    } else if (player1Move === "cheat" && player2Move === "cooperate") {
      p1Score = 3;
      p2Score = -1;
    } else if (player1Move === "cooperate" && player2Move === "cheat") {
      p1Score = -1;
      p2Score = 3;
    }

    // Update game state
    game.player1Score += p1Score;
    game.player2Score += p2Score;
    game.currentRound += 1;

    console.log(`Game ${gameId} Round ${game.currentRound - 1} scores:`, {
      player1Score: p1Score,
      player2Score: p2Score,
      totalPlayer1Score: game.player1Score,
      totalPlayer2Score: game.player2Score
    });

    // Only mark game as completed after the last round is fully processed
    if (game.currentRound > game.totalRounds) {
      // Add a small delay before marking as completed to ensure all messages are delivered
      await new Promise(resolve => setTimeout(resolve, 2000));
      game.status = "completed";
    }

    await storage.updateGame(game);

    // Continue game if not finished
    if (game.status === "in_progress") {
      console.log(`Scheduling next round for game ${gameId}`);
      setTimeout(() => playGameRound(gameId), 3000);
    } else {
      console.log(`Game ${gameId} completed`);
    }
  } catch (error) {
    console.error(`Error in game ${gameId} round:`, error);
  }
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  app.post("/api/games", async (req, res) => {
    const { agent1Config, agent2Config, gameMode } = req.body;
    const game = await storage.createGame(gameMode || "standard", agent1Config, agent2Config);
    console.log("Created new game:", game);
    res.json(game);
  });

  app.get("/api/games/:id", async (req, res) => {
    const game = await storage.getGame(parseInt(req.params.id));
    if (!game) {
      res.status(404).json({ message: "Game not found" });
      return;
    }
    res.json(game);
  });

  app.post("/api/games/:id/start", async (req, res) => {
    const game = await storage.getGame(parseInt(req.params.id));
    if (!game) {
      res.status(404).json({ message: "Game not found" });
      return;
    }

    console.log("Starting game:", game.id);
    game.status = "in_progress";
    await storage.updateGame(game);

    // Start game loop
    playGameRound(game.id);

    res.json(game);
  });

  app.get("/api/games/:id/moves", async (req, res) => {
    const moves = await storage.getMoves(parseInt(req.params.id));
    res.json(moves);
  });

  app.get("/api/games/:id/messages", async (req, res) => {
    const messages = await storage.getMessages(parseInt(req.params.id));
    res.json(messages);
  });

  return httpServer;
}

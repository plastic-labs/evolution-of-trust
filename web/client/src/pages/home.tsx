import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import GameMatrix from "@/components/game-matrix";
import Scoreboard from "@/components/scoreboard";
import ChatWindow from "@/components/chat-window";
import type { Game, Move, Message, AgentConfig } from "@shared/schema";

export default function Home() {
  const [gameId, setGameId] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<"standard" | "interactive">("standard");
  const [agent1Config, setAgent1Config] = useState<AgentConfig>({
    model: "llama3.2",
    systemPrompt: "default"
  });
  const [agent2Config, setAgent2Config] = useState<AgentConfig>({
    model: "llama3.2",
    systemPrompt: "default"
  });
  const [isGameCompleted, setIsGameCompleted] = useState(false);

  const { data: game, isLoading: isGameLoading } = useQuery<Game>({
    queryKey: [`/api/games/${gameId}`],
    enabled: !!gameId,
    refetchInterval: gameId && !isGameCompleted ? 2000 : false
  });

  const { data: moves = [] } = useQuery<Move[]>({
    queryKey: [`/api/games/${gameId}/moves`],
    enabled: !!gameId,
    refetchInterval: gameId && !isGameCompleted ? 2000 : false
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/games/${gameId}/messages`],
    enabled: !!gameId,
    refetchInterval: gameId && !isGameCompleted ? 2000 : false
  });

  // Update completion status when game data changes
  useEffect(() => {
    if (game) {
      setIsGameCompleted(game.status === "completed");
    }
  }, [game]);

  const createGame = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/games", {
        agent1Config,
        agent2Config,
        gameMode
      });
      const game = await res.json();
      console.log("Created game:", game);
      setGameId(game.id);
      return game;
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: [`/api/games/${game.id}`] });
    }
  });

  const startGame = useMutation({
    mutationFn: async () => {
      if (!gameId) return;
      console.log("Starting game with ID:", gameId);
      const res = await apiRequest("POST", `/api/games/${gameId}/start`);
      return res.json();
    },
    onSuccess: (game) => {
      if (gameId) {
        queryClient.invalidateQueries({ queryKey: [`/api/games/${gameId}`] });
      }
    }
  });

  console.log("Current game state:", {
    gameId,
    game,
    isGameLoading,
    movesCount: moves.length,
    messagesCount: messages.length
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Panel */}
          <div className="space-y-6">
            <Card className="p-6">
              <h1 className="text-2xl font-bold mb-4">Prisoner's Dilemma</h1>
              <GameMatrix />
              {!gameId ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold">Game Mode</h3>
                      <Select
                        defaultValue="standard"
                        onValueChange={(value) => setGameMode(value as "standard" | "interactive")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select game mode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="interactive">Interactive Dialogue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold">Agent 1</h3>
                      <Select
                        value={agent1Config.model}
                        onValueChange={(value) => setAgent1Config(prev => ({ ...prev, model: value as "gpt-4o" | "gpt-3.5-turbo" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="llama3.2:3b">Llama 3.2 3b</SelectItem>
                          <SelectItem value="llama3.3:70b">Llama 3.3 70b</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={agent1Config.systemPrompt}
                        onValueChange={(value) => setAgent1Config(prev => ({ ...prev, systemPrompt: value as "default" | "competitive" | "cooperative" | "random" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select behavior" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="competitive">Competitive</SelectItem>
                          <SelectItem value="cooperative">Cooperative</SelectItem>
                          <SelectItem value="random">Random</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold">Agent 2</h3>
                      <Select
                        value={agent2Config.model}
                        onValueChange={(value) => setAgent2Config(prev => ({ ...prev, model: value as "gpt-4o" | "gpt-3.5-turbo" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="llama3.2:3b">Llama 3.3 8b</SelectItem>
                          <SelectItem value="llama3.3:70b">Llama 3.3 70b</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={agent2Config.systemPrompt}
                        onValueChange={(value) => setAgent2Config(prev => ({ ...prev, systemPrompt: value as "default" | "competitive" | "cooperative" | "random" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select behavior" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="competitive">Competitive</SelectItem>
                          <SelectItem value="cooperative">Cooperative</SelectItem>
                          <SelectItem value="random">Random</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={() => createGame.mutate()}>New Game</Button>
                </div>
              ) : !isGameLoading && game?.status === "waiting" && (
                <div className="mt-4">
                  <Button onClick={() => startGame.mutate()}>
                    Start Game
                  </Button>
                </div>
              )}
            </Card>

            {game && (
              <Card className="p-6">
                <Scoreboard
                  player1Score={game.player1Score}
                  player2Score={game.player2Score}
                  currentRound={game.currentRound}
                  totalRounds={game.totalRounds}
                  status={game.status}
                />
              </Card>
            )}
          </div>

          {/* Right Panel */}
          <Card className="p-6">
            <ChatWindow messages={messages} />
          </Card>
        </div>
      </div>
    </div>
  );
}

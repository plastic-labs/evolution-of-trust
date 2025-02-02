import { Progress } from "@/components/ui/progress";

interface ScoreboardProps {
  player1Score: number;
  player2Score: number;
  currentRound: number;
  totalRounds: number;
  status: string;
}

export default function Scoreboard({ 
  player1Score,
  player2Score, 
  currentRound,
  totalRounds,
  status
}: ScoreboardProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Scoreboard</h2>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Agent 1</span>
          <span className="font-bold">{player1Score}</span>
        </div>
        <Progress value={(player1Score / 30) * 100} className="h-2" />

        <div className="flex justify-between mt-4">
          <span>Agent 2</span>
          <span className="font-bold">{player2Score}</span>
        </div>
        <Progress value={(player2Score / 30) * 100} className="h-2" />
      </div>

      <div className="mt-4">
        <div className="flex justify-between">
          <span>Round</span>
          <span>{Math.min(currentRound, totalRounds)} / {totalRounds}</span>
        </div>
        <Progress 
          value={(Math.min(currentRound, totalRounds) / totalRounds) * 100}
          className="h-2 mt-2"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Status: {status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    </div>
  );
}
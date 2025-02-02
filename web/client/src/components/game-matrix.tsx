import { Card } from "@/components/ui/card";

export default function GameMatrix() {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="font-bold">Player 1</div>
        <div className="font-bold">Player 2</div>
        
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <Card className="p-4 bg-muted">
            <div className="font-semibold">Both Cooperate</div>
            <div className="text-2xl text-green-600">+2, +2</div>
          </Card>
          
          <Card className="p-4 bg-muted">
            <div className="font-semibold">P1 Cooperate, P2 Cheat</div>
            <div className="text-2xl text-red-600">-1, +3</div>
          </Card>
          
          <Card className="p-4 bg-muted">
            <div className="font-semibold">P1 Cheat, P2 Cooperate</div>
            <div className="text-2xl text-red-600">+3, -1</div>
          </Card>
          
          <Card className="p-4 bg-muted">
            <div className="font-semibold">Both Cheat</div>
            <div className="text-2xl text-yellow-600">0, 0</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

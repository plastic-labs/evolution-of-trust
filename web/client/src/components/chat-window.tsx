import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message } from "@shared/schema";

interface ChatWindowProps {
  messages: Message[];
}

export default function ChatWindow({ messages }: ChatWindowProps) {
  return (
    <div className="h-[600px] flex flex-col">
      <h2 className="text-xl font-bold mb-4">Agent Conversation</h2>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "agent1" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.messageType === "thought" 
                    ? "bg-muted/50 italic" 
                    : message.messageType === "move"
                    ? "bg-accent text-accent-foreground font-mono"
                    : message.sender === "agent1"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <div className="text-sm font-semibold mb-1 flex justify-between items-center">
                  <span>{message.sender === "agent1" ? "Agent 1" : "Agent 2"}</span>
                  {message.messageType === "thought" && (
                    <span className="text-xs text-muted-foreground ml-2">(Internal Thought)</span>
                  )}
                  {message.messageType === "move" && (
                    <span className="text-xs text-accent-foreground/80 ml-2">Round {message.round}</span>
                  )}
                </div>
                <div className="text-sm">
                  {message.messageType === "move" 
                    ? `Chose to ${message.content.toUpperCase()}`
                    : message.content
                  }
                </div>
                {message.conversationTurn > 0 && message.messageType === "dialogue" && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Turn {message.conversationTurn}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
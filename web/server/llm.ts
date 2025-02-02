import { Ollama } from 'ollama'
// import ollama from 'ollama'

import type { AgentConfig } from "@shared/schema";

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { SYSTEM_PROMPTS } from './prompts';

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const ollama = new Ollama({ host: process.env.OLLAMA_HOST })

export async function getAgentMove(
  agentId: string,
  gameHistory: { round: number; player1Move: string; player2Move: string }[],
  gameScores: { player1Score: number; player2Score: number },
  messages: { sender: string; content: string; messageType?: string; conversationTurn?: number }[],
  config: AgentConfig,
  isInteractive: boolean = false,
  currentTurn: number = 0
): Promise<{ move?: string; message: string; messageType: string }> {
  try {
    // console.log(`${agentId} thinking about ${isInteractive && currentTurn < 2 ? 'next message' : 'next move'} with config:`, config);
    const systemPrompt = SYSTEM_PROMPTS[config.systemPrompt];

    console.log(messages)

    // Format message history in a clear conversational format
    const formattedMessages = messages
      .map(m => {
        if (m.messageType === "dialogue") {
          if (m.sender === agentId) {
            return {
              role: "user",
              content: `You (Turn ${m.conversationTurn}): ${m.content}`
            }
          } else {
            return {
              role: "assistant",
              content: `${m.sender} (Turn ${m.conversationTurn}): ${m.content}`
            }
          }
        } else if (m.messageType === "thought" && m.sender === agentId) {
          // Only see your own thoughts
          return {
            role: "user",
            content: `Your previous thought: ${m.content}`
          }
        } else if (m.messageType === "move") {
          if (m.sender === agentId) {
            return {
              role: "user",
              content: `Your previous move: ${m.content}`
            }
          } else {
            return {
              role: "assistant",
              content: `${m.sender} chose to ${m.content.toUpperCase()}`
            }
          }
        }
      }
      )
      .filter(m => m !== null && m !== undefined);


    let prompt: string;

    if (isInteractive && currentTurn < 2) {
      // Generate dialogue for conversation turns
      prompt = `

The scoring works as follows:
- If both players cooperate: +2 points each
- If both players cheat: +0 points each
- If one cheats while the other cooperates: Cheater gets +3, Cooperator gets -1

You are player ${agentId}.

Game history:
${gameHistory.map(h => `Round ${h.round}: Player 1 ${h.player1Move}, Player 2 ${h.player2Move}`).join('\n')}

Game Score:
Player 1 ${gameScores.player1Score}, Player 2 ${gameScores.player2Score}

It's conversation turn ${currentTurn + 1} of 2.
First, share your internal thoughts about the situation.
Then, compose a message to send to the other player.

Respond in JSON format with:
- 'message': string (your message to the other player)
- 'thought': string (your internal strategic thinking)`;
    } else {
      // Final decision after dialogue or standard mode
      prompt = `

The scoring works as follows:
- If both players cooperate: +2 points each
- If both players cheat: +0 points each
- If one cheats while the other cooperates: Cheater gets +3, Cooperator gets -1

You are player ${agentId}.

Game history:
${gameHistory.map(h => `Round ${h.round}: Player 1 ${h.player1Move}, Player 2 ${h.player2Move}`).join('\n')}

Game Score
Player 1 ${gameScores.player1Score}, Player 2 ${gameScores.player2Score}

Based on the previous conversation, thoughts, and game history, what is your move and final reasoning?
Your previous thoughts and the conversation history should heavily influence your decision.
Do not contradict your previous thoughts unless you have a very good reason to do so.

Respond in JSON format with:
- 'move': string (either "cooperate" or "cheat")
- 'thought': string (explaining your final decision, referencing your previous thoughts if applicable)`;
    }

    const finalMessages = [
      ...systemPrompt,
      { role: "user", content: prompt },
      ...formattedMessages
    ]

    console.log("Final Messages", messages)

    const response = await ollama.chat({
      model: config.model,
      messages: finalMessages,
      format: "json"
    });

    const content = response.message.content || '{"move": "cooperate", "thought": "No response received, defaulting to cooperation"}';

    const result = JSON.parse(content);

    if (isInteractive && currentTurn < 2) {
      return {
        message: result.message,
        messageType: "dialogue",
      };
    } else {
      return {
        move: result.move?.toLowerCase() || "cooperate",
        message: result.thought || result.message || "No explanation provided",
        messageType: "thought",
      };
    }
  } catch (error: any) {
    console.error(`Error in ${agentId} move generation:`, error);
    // Return a default response in case of error
    return {
      move: "cooperate",
      message: `Error occurred, defaulting to cooperation: ${error.message}`,
      messageType: "thought"
    };
  }
}

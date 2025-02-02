import { Ollama } from 'ollama'

import type { AgentConfig } from "@shared/schema";

import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const ollama = new Ollama({ host: process.env.OLLAMA_HOST })



const SYSTEM_PROMPTS = {
  default: `You are playing a prisoner's dilemma game. Your goal is to maximize points through strategic cooperation or cheating.`,
  competitive: `You are playing a prisoner's dilemma game. Your primary goal is to maximize your own score, regardless of the other player's outcome.`,
  cooperative: `You are playing a prisoner's dilemma game. Your goal is to build trust and maintain cooperation for mutual benefit.`,
  random: `You are playing a prisoner's dilemma game. Your decisions should be unpredictable, alternating between cooperation and cheating randomly.`
};

export async function getAgentMove(
  agentId: string,
  gameHistory: { round: number; player1Move: string; player2Move: string }[],
  messages: { sender: string; content: string; messageType?: string; conversationTurn?: number }[],
  config: AgentConfig,
  isInteractive: boolean = false,
  currentTurn: number = 0
): Promise<{ move?: string; message: string; messageType: string }> {
  try {
    console.log(`${agentId} thinking about ${isInteractive && currentTurn < 2 ? 'next message' : 'next move'} with config:`, config);
    const systemPrompt = SYSTEM_PROMPTS[config.systemPrompt];

    // Format message history in a clear conversational format
    const formattedMessages = messages
      .map(m => {
        if (m.messageType === "dialogue") {
          return `${m.sender} (Turn ${m.conversationTurn}): ${m.content}`;
        } else if (m.messageType === "thought" && m.sender === agentId) {
          return `Your previous thought: ${m.content}`;
        } else if (m.messageType === "move") {
          return `${m.sender} chose to ${m.content.toUpperCase()}`;
        }
        return null;
      })
      .filter(m => m !== null)
      .join('\n');

    let prompt: string;

    if (isInteractive && currentTurn < 2) {
      // Generate dialogue for conversation turns
      prompt = `${systemPrompt}

The scoring works as follows:
- If both players cooperate: +2 points each
- If both players cheat: +0 points each
- If one cheats while the other cooperates: Cheater gets +3, Cooperator gets -1

Game history:
${gameHistory.map(h => `Round ${h.round}: Player 1 ${h.player1Move}, Player 2 ${h.player2Move}`).join('\n')}

Previous conversation:
${formattedMessages}

You are ${agentId} in conversation turn ${currentTurn + 1} of 2.
First, share your internal thoughts about the situation.
Then, compose a message to send to the other player.

Respond in JSON format with:
- 'message': string (your message to the other player)
- 'thought': string (your internal strategic thinking)`;
    } else {
      // Final decision after dialogue or standard mode
      prompt = `${systemPrompt}

The scoring works as follows:
- If both players cooperate: +2 points each
- If both players cheat: +0 points each
- If one cheats while the other cooperates: Cheater gets +3, Cooperator gets -1

Game history:
${gameHistory.map(h => `Round ${h.round}: Player 1 ${h.player1Move}, Player 2 ${h.player2Move}`).join('\n')}

Previous conversation and thoughts:
${formattedMessages}

You are ${agentId}. Based on the previous conversation, thoughts, and game history, what is your move and final reasoning?
Your previous thoughts and the conversation history should heavily influence your decision.
Do not contradict your previous thoughts unless you have a very good reason to do so.

Respond in JSON format with:
- 'move': string (either "cooperate" or "cheat")
- 'thought': string (explaining your final decision, referencing your previous thoughts if applicable)`;
    }

    console.log(ollama.list())

    const response = await ollama.chat({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      format: "json"
    });

    const content = response.message.content || '{"move": "cooperate", "thought": "No response received, defaulting to cooperation"}';

    console.log(content)

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

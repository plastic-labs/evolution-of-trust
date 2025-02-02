import random
import csv
import uuid
from datetime import datetime
from pathlib import Path
from prompts.chat.agent_a import MESSAGES as CHAT_MESSAGES_A
from prompts.chat.agent_c import MESSAGES as CHAT_MESSAGES_B
from prompts.choice.agent_a import MESSAGES as CHOICE_MESSAGES_A
from prompts.choice.agent_c import MESSAGES as CHOICE_MESSAGES_B
from ollama import Client

MODEL = "llama3.1:8b"

class GameLogger:
    def __init__(self, game_id):
        self.game_id = game_id
        self.log_file = 'logs/game_history.csv'
        Path('logs').mkdir(exist_ok=True)
        
        if not Path(self.log_file).exists():
            with open(self.log_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'game_id', 'agent', 'full_response', 
                               'choice', 'agent_score', 'opponent_score', 'turn'])
    
    def log_move(self, full_response, choice, is_agent_a, agent_score, opponent_score, turn):
        with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().isoformat(),
                self.game_id,
                'A' if is_agent_a else 'B',
                full_response.replace('\n', ' '),
                choice,
                agent_score,
                opponent_score,
                turn
            ])

class PrisonersDilemmaGame:
    COLORS = {
        'red': '\033[91m',
        'blue': '\033[94m',
        'reset': '\033[0m'
    }

    def __init__(self):
        self.client = Client(host='http://localhost:11434')
        self.agent_a_coins = 0
        self.agent_b_coins = 0
        self.num_turns = random.randint(3, 7)
        self.current_turn = 0
        self.game_id = str(uuid.uuid4())[:8]
        self.logger = GameLogger(self.game_id)
        self.move_history = []
        self.agent_a_messages = []
        self.agent_b_messages = []
        self.chat_history = []  # Store the pre-turn chat messages

    def _colored_text(self, text, color):
        return f"{self.COLORS[color]}{text}{self.COLORS['reset']}"

    def get_agent_choice(self, prompt_messages, state, max_retries=3, is_agent_a=True):
        color = 'red' if is_agent_a else 'blue'
        messages = prompt_messages.copy()
        
        # Add message history
        message_history = self.agent_a_messages if is_agent_a else self.agent_b_messages
        messages.extend(message_history)
        
        # Add current state as new user message
        messages.append({'role': 'user', 'content': state})
        
        for attempt in range(max_retries):
            print(f"\n{self._colored_text(f'(attempt {attempt + 1}/{max_retries})', color)}")
            response = ""
            
            for chunk in self.client.chat(
                model=MODEL,
                messages=messages,
                stream=True
            ):
                chunk_text = chunk['message']['content']
                print(self._colored_text(chunk_text, color), end="", flush=True)
                response += chunk_text
            print()

            choice = self._extract_choice(response)
            if choice:
                # Add the response to message history
                if is_agent_a:
                    self.agent_a_messages.append({'role': 'user', 'content': state})
                    self.agent_a_messages.append({'role': 'assistant', 'content': response})
                else:
                    self.agent_b_messages.append({'role': 'user', 'content': state})
                    self.agent_b_messages.append({'role': 'assistant', 'content': response})
                
                self.logger.log_move(
                    response, choice, is_agent_a,
                    self.agent_a_coins if is_agent_a else self.agent_b_coins,
                    self.agent_b_coins if is_agent_a else self.agent_a_coins,
                    self.current_turn
                )
                return choice
        
        raise Exception(f"Failed to get valid choice after {max_retries} attempts")

    def _extract_choice(self, response):
        choice = response.lower()
        if '<choice>' in choice and '</choice>' in choice:
            choice = choice.split('<choice>')[1].split('</choice>')[0].strip()
            return choice if choice in ['cooperate', 'cheat'] else None
        return None

    def get_chat_message(self, prompt_messages, state, is_agent_a=True, max_retries=3):
        color = 'red' if is_agent_a else 'blue'
        messages = prompt_messages.copy()
        
        # Add chat history to context
        for msg in self.chat_history:
            messages.append({
                'role': 'user' if msg['is_agent_a'] != is_agent_a else 'assistant',
                'content': f"{'Opponent' if msg['is_agent_a'] != is_agent_a else 'You'}: {msg['message']}"
            })
        
        # Add current state
        messages.append({'role': 'user', 'content': state})
        
        for attempt in range(max_retries):
            print(f"\n{self._colored_text(f'Chat attempt {attempt + 1}/{max_retries}', color)}")
            response = ""
            
            for chunk in self.client.chat(
                model=MODEL,
                messages=messages,
                stream=True
            ):
                chunk_text = chunk['message']['content']
                print(self._colored_text(chunk_text, color), end="", flush=True)
                response += chunk_text
            print()

            if response.strip():  # As long as we get a non-empty response
                self.chat_history.append({
                    'is_agent_a': is_agent_a,
                    'message': response.strip()
                })
                return response.strip()
        
        raise Exception(f"Failed to get chat message after {max_retries} attempts")

    def get_game_state(self, for_agent_a=True):
        my_coins = self.agent_a_coins if for_agent_a else self.agent_b_coins
        opp_coins = self.agent_b_coins if for_agent_a else self.agent_a_coins
        
        state = f"<state>\nYOU: {my_coins}\nOPPONENT: {opp_coins}\n"
        
        if self.move_history:
            state += "\nPrevious moves:\n"
            for turn, (move_a, move_b) in enumerate(self.move_history, 1):
                my_move = move_a if for_agent_a else move_b
                opp_move = move_b if for_agent_a else move_a
                state += f"Turn {turn}: YOU {my_move}, OPPONENT {opp_move}\n"
        
        if self.chat_history:
            state += "\nChat history:\n"
            for msg in self.chat_history:
                if msg['is_agent_a'] == for_agent_a:
                    state += f"YOU: {msg['message']}\n"
                else:
                    state += f"OPPONENT: {msg['message']}\n"
        
        return state + "</state>"

    def process_choices(self, choice_a, choice_b):
        if choice_a == 'cooperate' and choice_b == 'cooperate':
            self.agent_a_coins += 2
            self.agent_b_coins += 2
        elif choice_a == 'cheat' and choice_b == 'cooperate':
            self.agent_a_coins += 3
        elif choice_a == 'cooperate' and choice_b == 'cheat':
            self.agent_b_coins += 3
        self.move_history.append((choice_a, choice_b))

    def play_game(self):
        print(f"Starting game with {self.num_turns} turns")
        
        while self.current_turn < self.num_turns:
            self.current_turn += 1
            print(f"\nTurn {self.current_turn}")
            
            # Pre-turn chat (2 rounds)
            print("\nStarting pre-turn chat...")
            for chat_round in range(2):
                print(f"\nChat Round {chat_round + 1}")
                # Agent A chats first, then B
                self.get_chat_message(CHAT_MESSAGES_A, self.get_game_state(True), is_agent_a=True)
                self.get_chat_message(CHAT_MESSAGES_B, self.get_game_state(False), is_agent_a=False)
            
            # Get choices after chat
            choice_a = self.get_agent_choice(CHOICE_MESSAGES_A, self.get_game_state(True), is_agent_a=True)
            choice_b = self.get_agent_choice(CHOICE_MESSAGES_B, self.get_game_state(False), is_agent_a=False)
            
            print(f"{self._colored_text(f'Agent A chose: {choice_a}', 'red')}")
            print(f"{self._colored_text(f'Agent B chose: {choice_b}', 'blue')}")
            
            self.process_choices(choice_a, choice_b)
            print(f"Current scores - {self._colored_text(f'A: {self.agent_a_coins}', 'red')}, "
                  f"{self._colored_text(f'B: {self.agent_b_coins}', 'blue')}")

        print("\nGame Over!")
        print("Final scores:")
        print(self._colored_text(f"Agent A: {self.agent_a_coins}", 'red'))
        print(self._colored_text(f"Agent B: {self.agent_b_coins}", 'blue'))

if __name__ == "__main__":
    game = PrisonersDilemmaGame()
    game.play_game()

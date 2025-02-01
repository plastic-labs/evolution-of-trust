import random
import csv
import uuid
from datetime import datetime
from pathlib import Path
from prompts.agent_a import SYSTEM_PROMPT as PROMPT_A
from prompts.agent_b import SYSTEM_PROMPT as PROMPT_B
from ollama import Client

class PrisonersDilemmaGame:
    def __init__(self):
        self.client = Client(host='http://localhost:11434')
        self.agent_a_coins = 0  # Start with 0, will earn/lose coins each turn
        self.agent_b_coins = 0
        self.num_turns = random.randint(3, 7)
        self.current_turn = 0
        self.game_id = str(uuid.uuid4())[:8]  # Generate unique game ID
        # Add color codes
        self.RED = '\033[91m'
        self.BLUE = '\033[94m'
        self.RESET = '\033[0m'
        
        # Ensure the logs directory exists
        Path('logs').mkdir(exist_ok=True)
        
        # Create or check CSV header
        self.log_file = 'logs/game_history.csv'
        if not Path(self.log_file).exists():
            with open(self.log_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['timestamp', 'game_id', 'agent', 'full_response', 
                               'choice', 'agent_score', 'opponent_score', 'turn'])
        self.move_history = []  # Add this to track moves

    def get_agent_choice(self, prompt, state, max_retries=3, is_agent_a=True):
        color = self.RED if is_agent_a else self.BLUE
        for attempt in range(max_retries):
            response = ""
            print(f"\n{color}(attempt {attempt + 1}/{max_retries})", end="\n", flush=True)
            for chunk in self.client.chat(
                model='llama3.1:8b',
                messages=[
                    {
                        'role': 'system',
                        'content': prompt
                    },
                    {
                        'role': 'user',
                        'content': state
                    }
                ],
                stream=True
            ):
                chunk_text = chunk['message']['content']
                print(chunk_text, end="", flush=True)
                response += chunk_text
            print(self.RESET)  # Reset color after response

            # Extract choice from <choice></choice> tags
            choice = response.lower()
            if '<choice>' in choice and '</choice>' in choice:
                choice = choice.split('<choice>')[1].split('</choice>')[0].strip()
                # Validate the choice
                if choice in ['cooperate', 'cheat']:
                    # Log the response
                    self.log_response(response, choice, is_agent_a)
                    return choice
                else:
                    print(f"{color}Invalid choice '{choice}'. Must be 'cooperate' or 'cheat'. Retrying...{self.RESET}")
            else:
                print(f"{color}No choice found in response. Retrying...{self.RESET}")
        
        raise Exception(f"Failed to get valid choice after {max_retries} attempts")

    def log_response(self, full_response, choice, is_agent_a):
        """Log the agent's response and game state to CSV"""
        with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().isoformat(),
                self.game_id,
                'A' if is_agent_a else 'B',
                full_response.replace('\n', ' '),  # Remove newlines for CSV
                choice,
                self.agent_a_coins if is_agent_a else self.agent_b_coins,
                self.agent_b_coins if is_agent_a else self.agent_a_coins,
                self.current_turn
            ])

    def get_game_state(self, for_agent_a=True):
        state = "<state>\n"
        state += f"YOU: {self.agent_a_coins if for_agent_a else self.agent_b_coins}\n"
        state += f"OPPONENT: {self.agent_b_coins if for_agent_a else self.agent_a_coins}\n"
        
        # Add history of moves if any exists
        if self.move_history:
            state += "\nPrevious moves:\n"
            for turn, (move_a, move_b) in enumerate(self.move_history, 1):
                if for_agent_a:
                    state += f"Turn {turn}: YOU {move_a}, OPPONENT {move_b}\n"
                else:
                    state += f"Turn {turn}: YOU {move_b}, OPPONENT {move_a}\n"
        
        state += "</state>"
        return state

    def process_choices(self, choice_a, choice_b):
        # Each agent gets one coin to use this turn
        if choice_a == 'cooperate' and choice_b == 'cooperate':
            # Both cooperate: each gets 2 coins
            self.agent_a_coins += 2
            self.agent_b_coins += 2
        elif choice_a == 'cheat' and choice_b == 'cooperate':
            # A cheats, B cooperates: A gets 3 coins, B gets 0
            self.agent_a_coins += 3
        elif choice_a == 'cooperate' and choice_b == 'cheat':
            # A cooperates, B cheats: A gets 0, B gets 3 coins
            self.agent_b_coins += 3
        # If both cheat, neither gets any coins
        # Add the moves to history after processing
        self.move_history.append((choice_a, choice_b))

    def play_game(self):
        print(f"Starting game with {self.num_turns} turns")
        
        while self.current_turn < self.num_turns:
            self.current_turn += 1
            print(f"\nTurn {self.current_turn}")
            
            # Get choices from both agents
            state_a = self.get_game_state(for_agent_a=True)
            state_b = self.get_game_state(for_agent_a=False)
            
            choice_a = self.get_agent_choice(PROMPT_A, state_a, is_agent_a=True)
            choice_b = self.get_agent_choice(PROMPT_B, state_b, is_agent_a=False)
            
            print(f"{self.RED}Agent A chose: {choice_a}{self.RESET}")
            print(f"{self.BLUE}Agent B chose: {choice_b}{self.RESET}")
            
            self.process_choices(choice_a, choice_b)
            print(f"Current scores - {self.RED}A: {self.agent_a_coins}{self.RESET}, {self.BLUE}B: {self.agent_b_coins}{self.RESET}")

        print("\nGame Over!")
        print(f"Final scores:")
        print(f"{self.RED}Agent A: {self.agent_a_coins}{self.RESET}")
        print(f"{self.BLUE}Agent B: {self.agent_b_coins}{self.RESET}")

if __name__ == "__main__":
    game = PrisonersDilemmaGame()
    game.play_game()

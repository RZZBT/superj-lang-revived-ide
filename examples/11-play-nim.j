// NIM, a tiny game. 21 sticks; take 1, 2 or 3 per turn; whoever takes the last stick wins.
// Type your move in the console and press Enter. Can you beat the computer?
int sticks : 21;
int move : 0;
int ai : 0;

print("NIM: 21 sticks. Take 1, 2 or 3. The last stick wins.".);
while(sticks > 0){
    print("Sticks left:",,sticks.);
    print("Your move (1-3): ");
    take(move);
    if(move < 1 || move > 3 || move > sticks){
        print("Not allowed, try again.".);
        skip;
    }
    sticks : sticks - move;
    if(sticks == 0){
        print("You took the last stick. You win!".);
        end;
    }
    ai : sticks % 4;
    if(ai == 0){ ai : 1; }
    print("I take",,ai.);
    sticks : sticks - ai;
    if(sticks == 0){
        print("I took the last stick. I win!".);
        end;
    }
}

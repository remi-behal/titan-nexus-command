## **Through Manual Testing**
### Turn Resolution Race Condition (Stuck "Locked-In" State)
1. When you do more than 1 action on multiple hubs but don't get the last one released in time (release it just after the timer expires). This then fails in 1 of 2 different ways observed:
    a. The launch structure button then can't be pressed on the opposing player's HUD, but they can press the complete turn button again, which resolves the issue
    b. The opposing player can't press either the launch structure button or the complete turn button (they display as mission locked and waiting for others, respectively), and the game is stuck in this state until the timer expires, at which point the game resolves normally.

### Turn resolution hub destroyed race condition
Destroying the 2nd hub of a player in one turn, causes the game to be stuck in a state in the next turn for all players where the UI buttons can't be clicked

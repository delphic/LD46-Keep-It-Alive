# Ludum Dare 46 - Keep It Alive
You are in charge of live cargo on a space hauler. Ideally keep them happy, at least keep them alive.

## Basic Features:
The creature has needs and a mood.
You can perform actions to change it's needs and/or moods (but it's unclear what actions will do).
There is a timer for each trip and you have to manage the creature for that long.
If certain needs are not met the creature dies, you get money on reaching your destination based on their condition and mood (i.e. your base if they're alive, tip from owner if they're happy).

## Stretch Features:
More Creatures and Multiple Runs
Manage your own schedule (You need to sleep / eat, requiring you leave the creature alone).
You choose room to place them in, which determines the actions you can take.
A wiki to consult for the care of your creatures (the timer doesn't stop).
Owner personality - likely hood to tip, if they care more about needs or mood.
Habits - if you play with certain ones too much they become troublesome and the owner won't like it (and it'll cause problems for you too - if you play with them the need to play increases).

## Basic System Design
### Needs and Mood
Needs: 0 to 100
Moods: -50 / +50 
The most extreme value is the current one.

Not all creatures have all needs or all moods.
Example Needs: Rest, Food, Exercise, Light, Bloodlust, Play, Security (converse Fear), Company
Example Moods: Tired, Restless, Scared, Hungry (converse stated), Lonleness

Creatures have a cost per tick (i.e. needs than increase, moods decay), which can change based on conditions (mood, environment, your presence).

When a new mood or need becomes dominant a notification is shown (or we change the sprite).
When the dominant mood or any need enters a new threshold (25 intervals for need, +/- 10 and +/-30 for mood) a notification is shown (or we change the sprite).

^^ We may want to play with the visibility of this, if part of the game is figuring out.

If we want extreme / readable reactions just set values to max / min. For each creature the reaction to an action varies, based on mood / need)

### Creature Concepts
Space Cat - reacts pretty much as you'd think, requires play, food, sleep (lots of sleep)
Space Dog - reacts pretty much as you'd think, requires excerise/play, food, sleep, gets lonely
Blank Slate - it's needs are determined by your actions
The blob - it doesn't need anything it just sits there
Space Corn - you need to set light levels and water it
Space Orchid - don't water it too much! Give it a day night cycle

### Actions
> Play (+ select toy? laser pointer, squeaky toy, yourself) (e.g. increase happiness, indifferent, bites your arm off (lol actions take longer to perform?))
> Feed (+ select type) (e.g. decrease hunger, decrease bloodlust - if live food, indifference)
> Environment (e.g. set light level, set temperature)
(> Move - if going for room stretch)
(> Self -> Sleep / Nap / Eat / Medical - if going for self care stretch - might allow for you to confidently go through journies quicker when you're sure) 

### Trip Definition
At least: creature def, duration.
Bonus: creature initial state, destination name, description, care instructions.

## Assets
### Required Art
Sprite per creature
Font

### Sretch Art
Supporting Icons where possible
Sprite per mood
Lighting capable (i.e. use a palette of 8, even though we have four colours, allowing for shading based on light conditions). 

### Required Audio
None

### Stretch Audio
Creature Noises
UI Sounds
BGM


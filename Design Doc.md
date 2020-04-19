# Ludum Dare 46 - Keep It Alive
You are in charge of live cargo on a space hauler. Ideally keep them happy, at least keep them alive.

## Basic Features:
The creature has needs and a mood.
You can perform actions to change it's needs and/or moods (but it's unclear what actions will do).
There is a timer for each trip and you have to manage the creature for that long.
If certain needs are not met the creature dies, you get money on reaching your destination based on their condition and mood (i.e. your base if they're alive, tip from owner if they're happy).
Update: No money - the goal is to keep it alive. But you get feedback!

## Stretch Features:
More Creature Types and Multiple Runs
Multiple Creatures at Once
Manage your own schedule (You *need* to sleep / eat, requiring you leave the creature alone).
You choose room to place them in, which determines the actions you can take.
A wiki to consult for the care of your creatures (the timer doesn't stop).
Owner personality - shapes feedack if they care more about needs or mood.
Habits - if you play with certain ones too much they become troublesome and the owner won't like it (and it'll cause problems for you too - if you play with them the need to play increases).

## Basic System Design
### Needs and Emotions
Needs: 0 to 100
Emotions: -50 / +50 
The most extreme value is the current one.

Not all creatures have all needs or all moods.
Example Needs: Rest, Food, Exercise, Light, Bloodlust, Play, Security, Company
Example Emotions: Cheer, Energy (Tired -> Resentless), Fear (Scared -> Confident), Hunger (hungry -> stated), Lonileness (Lonely -> Content)

Creatures have a cost per tick (i.e. needs than increase, moods decay), which can change based on conditions (mood, environment, your presence).

When a new emotion or need becomes dominant a notification is shown (or we change the sprite).
When the dominant emotions or any need enters a new threshold (25 intervals for need, +/- 10 and +/-30 for mood) a notification is shown (or we change the sprite).

Mood = dominant emotion (to begin with but could move to event based)

^^ We may want to play with the visibility of this, if part of the game is figuring out.

If we want extreme / readable reactions just set values to max / min. For each creature the reaction to an action varies, based on mood / need)

### Creature Concepts
Space Cat - reacts pretty much as you'd think, requires play, food, sleep (lots of sleep)
Space Dog - reacts pretty much as you'd think, requires excerise/play, food, sleep, gets lonely
Blank Slate - it's needs are determined by your actions
Ravener - you have to feed it, a lot, but if you don't play with it for a long time it'll hurt you
when you do
The blob - it doesn't need anything it just sits there
Space Corn - you need to set light levels and water it
Space Orchid - don't water it too much! Give it a day night cycle
Dead Parrot - it's dead, but you didn't kill it
Triffid - like space corn but if you try to pet it you have to go to medic
Tribble - if you feed it, it multiplies

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
Sprite for actions (e.g. kitty > need eating - can reuse play)

### Required Audio
None

### Stretch Audio
Creature Noises
UI Sounds
BGM

### Task List
x Labels on progress bars
x Explicit width of text box
x Auto lines spliter for messages (using text box)
x Emotion -> Mood mapping
x Display current mood function (depending on creature may or may not be easily to read)
x ADD DEATH - I guess maybe a health bar that ticks down? when full need on essential needs
x Trip progress bar
x Rewards

o Main Menu Screen
o Score Screen

x Make interactions pause sim for whilst displaying, but then iterrate sim a specified number of ticks (including checks for and increase of journeyTick)

o TODO - reposition and/or resize numbers (i.e. make positioning match lower case, or size match uppercase so the Kerning doesn't look awful)

o Add Take a Nap function (just skips time) - make it easy to neglect but skips time and gives people a reason - but then they're responsible for this not the systems

o (!Dangerous) Cheer / emotion base line and track back when not in need extremes.
	Will upset existing balance which is more or less working for kitty, however this *should* be there

o Moods should have a minimum time, then wear off and re-evalute.
o Change Mood descriptions to behaviour for that mood descriptions

x balance pass - cheer drops like a stone (if you just play with the kitty as soon as prompted they end up unhappy, that might be fixed by cheer base line), also values are such that they go sleepy for just a moment. 

x Sprite(s) for the Space Kitty (64x64) + mini for intro (32x32)
	So *need* an idle/indifferent pose, would also like "wants to play", "needs something", "miserable/unwell", "sleepy"
	x Update sleep with zZz
	x Icon for journey and death (fix into char size)

o Some actual UI design
	Main Menu, Intro, Journey Report, Tour Report
	Main Screen: Should show name + species, number of deaths, journey progress
q
o More Creatures => dead parrot, the blob etc - consider encouraged behaviour with each creature type
	o Starting creatures on different need levels and health levels
	o Difficult creatures, which may refuse to eat even when they need to

o Probably too much for this Jam, but in retrospect would have been good to have a day/night cycle to help guide timings and add some variation to need growth rates / rhythm to looking after things (and some creatures could be noctornal) - also dangerous for them to be very hungry when night comes (also you could config gremlins).

o Variable Journey Lengths
(?) o Inspect option to check health / tiredness


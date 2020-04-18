// LUDUM DARE 46 - Keep It Alive
var config = { 
	"width": 160,
	"height": 144,
	"pixelRatio": 4,
	"tickRate": 30,
	"palette": "palettes/andrade-gameboy.json",
	"font": {
	    "name": "mini",
	    "path": "images/mini-font-offset.png",
	    "width": 5,
	    "height": 7,
	    "spacing": 1,
	    "alphabet":  "ABCDEFGHIJKLMNOPQRSTUVabcdefghijklmnopqrstuvWXYZ0123456789_.,!?:; wxyz()[]{}'\"/\\|=-+*<>",
	    "reducedWidthLowerCase": 1,
	    "baselineOffsets": "gjpqy"
	},
	/*"spriteSheet": { 
		"path": "", 
		"spriteSize": 32
	},*/
	"keys": [ 37, 39, 38, 40, 90, 88], // left, right, up, down, z, x
	"hideCursor": false
};

var debug = true, debugBars = false;

var GameStates = {
    BOOT: -1,
    MAIN_MENU: 0,
    INTRO: 1,
    JOURNEY: 2,
    JOURNEY_COMPLETE: 3,
    FINAL_SCORE: 4
};
var gameState = -1; 

// JOURNEY State 
var actionsBox, currentReactionBox, journeyProgressBar, moodText, scoreText;
var debugBarUIs = [];
var journeyTick = 0, journeyLength = config.tickRate * 120;
var interactionMessageShowTime = 3;
var score = 0, journeysComplete = 0, tourLength = 3;
var creature, creatureUpdateInterval = config.tickRate;
var pauseSim;

var toggleDebugUI = function(value) {
    if (debug && debugBars) {
        for (let i = 0, l = debugBarUIs.length; i < l; i++) {
            debugBarUIs[i].active = value;
        }
    }
};

// These should probably be in their own module
var uiElements = [];
var addUIElement = function(uiElement){
    uiElement.index = uiElements.length;
    uiElements.push(uiElement);
};

// These should probably be in their own module
var routines = [], routineStarts = [], routineTick = 0;
var addRoutine = function(predicate) {
    if (!predicate(0)) {
        routines.push(predicate);
        routineStarts.push(routineTick);
    }
};
var removeRoutine = function(i) {
    routines.splice(i, 1);
    routineStarts.splice(i, 1);
};
var updateRoutines = function() {
    routineTick++;
    for (let i = routines.length - 1; i >= 0; i--) {
        if (routines[i](routineTick - routineStarts[i])) {
            removeRoutine(i);
        }
    }
};
var resetRoutines = function() {
    routines = [];
    routineStarts = [];
    routineTick = 0;
};

var Creature = (function() {
    var exports = {};
    var proto = {
    };
    
    exports.calculateHighestEmotionalNeed = function(creature) {
        let emotions = creature.def.emotions;
        let highestEmotionId = "";
        let highestEmotionPriority = 0;
        let highestValue = "";
        for(let i = 0, l = emotions.length; i < l; i++) {
            let emotionId = emotions[i];
            let attention = creature.getEmotionalAttentionNeed(emotionId);
            // This tie break probably wants to be inverted if attention need is 'negative' (i.e. < 2)
            if (highestValue < attention || (highestValue == attention && emotions[i].priority > highestEmotionPriority)) {
                highestEmotionId = emotionId;
                highestEmotionPriority = emotions[i].priority;
                highestValue = attention;
            }
        }
        return highestEmotionId;
    };
    
    exports.create = function(def) {
        var creature = Object.create(proto);
        let nameIndex = Math.floor(Math.random() * def.names.length);
        creature.name = def.names[nameIndex];
        creature.health = def.health;
        creature.def = def;
        creature.needs = {};
        if (def.needs) {
            for (let i = 0, l = def.needs.length; i < l; i++) {
                let need = def.needs[i];
                creature.needs[need.id] = { 
                    value: need.value, 
                    growth: need.growth
                };
            }
        }
        creature.emotions = {};
        if (def.emotions) {
            for (let i = 0, l = def.emotions.length; i < l; i++) {
                let emotion = def.emotions[i];
                creature.emotions[emotion.id] = {
                    value: emotion.value
                };
            }
        }
        
        creature.mood = {
            emotionId: "",
            category: -1,
            priority: -1,
            desc: ""
        };
        
        creature.calculateFeedback = function() {
            return creature.def.calculateFeedback(creature);
        };
        
        creature.getEmotionalAttentionNeed = function(id, invert) {
            let value = creature.emotions[id].value;
            let attention = 0;
            if (value > 30) {
                attention = 4;
            } else if (value > 10) {
                attention = 3;
            } else if (value > -10) {
                attention = 2;
            } else if (value > -30) {
                attention = 1;
            } else {
                attention = 0;
            }
            return invert ? 4 - attention : attention;
        };
        
        creature.changeNeed = function(id, delta) {
            let need = creature.needs[id];
            if (need) {
                need.value = Math.max(Math.min(need.value + delta, 100), 0);
            } else {
                console.log("Unable to find need of " + id);
            }
        };
        creature.changeEmotion = function(id, delta) {
            let emotion = creature.emotions[id];
            if (emotion) {
                emotion.value = Math.max(Math.min(emotion.value + delta, 50), -50);
            }
        };
        creature.update = function() {
            // Update Needs
            for (let i = 0, l = creature.def.needs.length; i < l; i++) {
                let id = creature.def.needs[i].id;
                let need = creature.needs[id];
                creature.changeNeed(id, need.growth);
            }
            creature.def.update(creature);  
        };
        creature.interact = function(action) {
            return def.responses(creature, action);
        };
        creature.recalculateMood = function() {
            let moodChanged = false;
            for (let i = 0, l = creature.def.emotions.length; i < l; i++) {
                let emotionDef = creature.def.emotions[i];
                let previousCategory = creature.emotionalCategories[i];
                let category = creature.getEmotionalAttentionNeed(emotionDef.id, emotionDef.invert);
                if (category != previousCategory || creature.mood.category < category) {
                    creature.emotionalCategories[i] = category;
                    if (creature.mood.emotionId === emotionDef.id
                        || creature.mood.category < category
                        || (creature.mood.category === category && creature.mood.priority <= emotionDef.priority)) {
                        moodChanged = true;
                        // TODO: Mood should be combos of emotions not highest emotional need
                        creature.mood.emotionId = emotionDef.id;
                        creature.mood.category = category;
                        creature.mood.priority = emotionDef.priority;
                        creature.mood.desc = emotionDef.moods[category];
                    }
                }
            }
            // Consider weighting instead of priority (e.g. for Kitty would like hungry to trump restless)
            return moodChanged;
        };
        
        creature.draw = function() {
            def.draw(creature);
        };
        
        def.init(creature);
        
        return creature;
    };
    return exports;
})();

var kittyDef = {
    names: [ "Floofmiester", "Prof. Jiggly", "Fuzzy Boots", "Beans" ],
    health: 100,
    needs: [
        { "id": "play", "growth": 2, "value": 40, "priority": 3 },
        { "id": "food", "growth": 1, "value": 40, "priority": 5 }
        // TODO: Rest Need
    ],
    emotions: [
        { "id": "cheer", "value": 0, "priority": 3, "invert": true, "moods": [ "Happy", "Content", "Indifferent", "Unhappy", "Miserable" ] },
        { "id": "hunger", "value": 10, "priority": 5, "moods": [ "Stated", "Sleepy", "Indifferent", "Hungry", "Ravenous"] },
        { "id": "playfulness", "value": 10, "priority": 4, "moods": [ "Asleep", "Sleepy", "Indifferent", "Playful", "Restless"] }
        // anger?
    ],
    calculateFeedback: function(creature) { 
        let score = 0;
        let desc = 0;
        if (creature.health === 100) {
            let happiness = creature.getEmotionalAttentionNeed("cheer"); // Note not inverting
            switch(happiness){
                case 4:
                case 3:
                    desc = creature.name + "seems to have had a great time!"
                    break;
                case 2:
                    desc = "Thanks for taking care of " + creature.name;
                    break;
                case 1:
                case 0:
                default:
                    desc = creature.name + " seems glad to be off the ship";
                    break;
            }
        } else if (creature.health > 50) {
            desc = creature.name + "doesn't seem to be in the best of health";
        } else if (creature.health > 0) {
            desc = "What have you done to my kitty?";
        } else {
            desc = "What!? " + creature.health + " is dead. The revival fees are coming out of your pocket!";
        }
        return desc;
    },
    init: function(creature) {
        let highestEmotionId, highestEmotionCategory = -1,  highestEmotionPriority = -1, highestEmotionDesc;
        creature.emotionalCategories = [];
        for (let i = 0, l = creature.def.emotions.length; i < l; i++) {
            let emotionDef = creature.def.emotions[i];
            let category = creature.getEmotionalAttentionNeed(emotionDef.id, emotionDef.invert);
            creature.emotionalCategories.push(category);
            if (category > highestEmotionCategory 
                || (category == highestEmotionCategory && highestEmotionPriority < emotionDef.priority)) {
                highestEmotionId = emotionDef.id;
                highestEmotionCategory = category;
                highestEmotionPriority = emotionDef.priority;
                highestEmotionDesc = emotionDef.moods[category];
            }
        }
        creature.mood.emotionId = highestEmotionId;
        creature.mood.category = highestEmotionCategory;
        creature.mood.priority = highestEmotionPriority;
        creature.mood.desc = highestEmotionDesc;
    },
    update: function(creature) {
        if (creature.health == 0) {
            return;
        }
        
        // Turn needs into emotions
        if (creature.needs["food"].value > 50) {
            creature.changeEmotion("cheer", -2);
            creature.changeEmotion("hunger", 3);
        }
        if (creature.needs["play"].value > 80) {
            creature.changeEmotion("cheer",-1);
            creature.changeEmotion("playfulness", +3);
        } else if (creature.needs["play"].value > 50) {
            creature.changeEmotion("playfulness", +1);
        }
        
        // Emotions
        // Should equalise to some base value if needs are low

        // Starvation
        if (creature.needs["food"].value == 100) {
            creature.health -= 2;
            // TODO: Health to influence mood
            if (creature.health == 0) {
                creature.mood.emotionId = null;
                creature.mood.category = 100;
                creature.mood.priority = 100;
                creature.mood.desc = "Dead";
            }
        } else if (creature.health < 100 && creature.needs["food"].value < 50) {
            // TODO: Iff rested
            creature.health += 1;
        }
        
        creature.recalculateMood();
        
    },
    responses: function(creature, action) {
        // TODO: Replace "space kitty" with creature.name
        let result = {};
        let desc = "";
        let duration = interactionMessageShowTime * config.tickRate;
        if (creature.health == 0) {
            return {
                duration: duration,
                desc: "The space kitty is dead"
            }
        }
        
        switch(action.name) {
            case "feed":
            {
                duration = 60;
                let hunger = creature.emotions["hunger"].value;
                if (hunger > -10) { // i.e. neutral, quite or very
                    creature.changeNeed("food", -50);
                    creature.changeEmotion("hunger", -30);
                    if (hunger > 30) {
                        duration = 30;
                        desc = creature.name + " devours the food";
                    } else if (hunger > 10) {
                        creature.changeEmotion("cheer", 20);
                        desc = creature.name + " happily eats the food";
                        // TODO: Remove reference to happiness unless you're going to look up cheer
                    } else {
                        duration = 90;
                        desc = creature.name + " picks at the food";
                    }
                } else {
                    let playfulness = creature.emotions["playfulness"].value;
                    if (playfulness > 10) {
                        duration = 30;
                        desc = creature.name + " stares at you and meows";
                    } else {
                        duration = 30;
                        desc = creature.name + " goes to sleep";
                    }
                }
                break;
            }
            case "play":
            {
                duration = 90
                let hunger = creature.emotions["hunger"].value;
                if (hunger > 30) {
                    duration = 30;
                    desc = creature.name + " stares at you and meows";
                } else { 
                    // TODO: base reaction on mood so we get hunger reactions for free
                    let playfulness = creature.emotions["playfulness"].value; 
                    if (playfulness > -30) { // i.e. not really, neutral, quite, very
                        if (playfulness > 30) {
                            creature.changeNeed("play", -30);
                            creature.changeEmotion("playfulness", -30);
                            creature.changeEmotion("cheer", 20);
                            creature.changeEmotion("hunger", 10);
                            desc = creature.name + " plays enthusiastically";
                        } else if (playfulness > 10) {
                            creature.changeNeed("play", -20);
                            creature.changeEmotion("playfulness", -30);
                            creature.changeEmotion("cheer", 15);
                            desc = creature.name + " plays with you";
                        } else if (playfulness > -10) {
                            creature.changeNeed("play", -10);
                            creature.changeEmotion("playfulness", -30);
                            creature.changeEmotion("cheer", 5);
                            duration = 60;
                            desc = creature.name + " plays idly";
                        } else {
                            creature.changeNeed("play", -5);
                            creature.changeEmotion("playfulness", -30);
                            duration = 30;
                            desc = creature.name + " bats the toy once and lies down";
                        }
                    } else {
                        duration = 0;
                        desc = creature.name + " ignores you";
                    }
                }
                break;
            }
            default:
                desc = creature.name + " stares at you";
                duration = 30;
                break;
        }

        return { desc: desc, duration: duration };
    },
    draw: function(creature) {
        // Sprite please
        Hestia.fillRect((160/2) - 16, (144/2) - 16, 32, 32, 1);
        // TODO: Display primary mood
    }
};

// TODO: Move actions + interaction to class / protype
var interaction = function(index) { // TODO: Context / Options
    let interactionResult = creature.interact(actions[index]);
    pauseSim = true;
    showMessageBox(interactionResult.desc, interactionMessageShowTime, function(){
        let moodChanged = creature.recalculateMood();
        runSimStep(interactionResult.durtion);
        // ^^ Might be better to try to spread this, however this way has the nice
        // effect of not updating the mood until after the interaction is complete
        // but before running the extra sim steps (once we make moods have a min. time
        // this will be more important).
        pauseSim = false;
    })
};

var showMessageBox = function(text, duration, callback) {
    currentReactionBox.lines = TextBox.calculateLines(
        text,
        currentReactionBox.width - 2 * currentReactionBox.padding);
    currentReactionBox.dirty = true;
    currentReactionBox.active = true;
    actionsBox.active = false;  // Should this be outside?
    addRoutine(function(ticks) {
       // show progress bar for action
       if (ticks > 30 * duration) {
           currentReactionBox.active = false;
           actionsBox.active = true;    // Should this be in callback?
           if (callback) {
               callback();
           }
           return true;
       }
       return false;
    });
};

var actions = [{
    name: "play",
    desc: "Play",
    interaction: function() { interaction(0); }
},{
    name: "feed",
    desc: "Feed",
    interaction: function() { interaction(1); }
}]; // Contextual Actions?

var init = function() {
    // Journey UI Init
    actionsBox = TextBox.create({ 
        x: 3,
        y: config.height - 24,
        lines: [actions[0].desc, actions[1].desc],
        color: 0,
        bgColor: 3,
        select: true,
        actions: [actions[0].interaction, actions[1].interaction],
        width: config.width - 6
    });
    addUIElement(actionsBox);
    
    currentReactionBox = TextBox.create({
        x: 3,
        y: config.height - 24,
        color: 0,
        bgColor: 3,
        width: config.width - 6
    });
    addUIElement(currentReactionBox);
    
    journeyProgressBar = ProgressBar.create({
        x: 1, y: 1, width: config.width - 4, height: 3,
        valueDelegate: function() {
            return journeyTick / journeyLength;
        }
    });
    addUIElement(journeyProgressBar);
    
    moodText = {
        x: config.width - 1,
        y: 7,
        color: 1,
        text: "",
        update: function() {
            this.text = creature.mood.desc;
        },
        draw: function() {
            if (this.text) {
                // right aligned
                let width = Hestia.measureText(this.text);
                Hestia.drawText(this.text, this.x - width , this.y, this.color);
            }
        }
    };
    addUIElement(moodText);
    
    scoreText = {
        x: 2,
        y: 7,
        color: 0,
        text: "",
        update: function() {
            this.text = "" + (journeysComplete - score) + "deaths";
        },
        draw: function() {
            Hestia.drawText(this.text, this.x, this.y, this.color);
        }
    };
    addUIElement(scoreText);

    // Debug Bars
    if (debug && debugBars) {
        let yOffset = 18;
        let healthBar = ProgressBar.create({ x: 1, y: yOffset , width: 64, height: 3, valueDelegate: function() { return creature.health / 100; } })
        healthBar.label = "+";
        addUIElement(healthBar);
        debugBarUIs.push(healthBar);
        yOffset += 10;
        
        let createNeedValueDelegate = function(needId) {
            return function() { return creature.needs[needId].value / 100; };
        };
        let needBars = [];
        for (let i = 0, l = kittyDef.needs.length; i < l; i++) {
            let need = kittyDef.needs[i];
            needBars[i] = ProgressBar.create({ x: 1, y: yOffset, width: 64, height: 3, valueDelegate: createNeedValueDelegate(need.id) });
            needBars[i].label = need.id[0].toUpperCase();
            addUIElement(needBars[i]);
            debugBarUIs.push(needBars[i]);
            yOffset += 8;
        }
        yOffset += 2;
        
        let createEmotionValueDelegate = function(emotionId) {
            return function() { return (creature.emotions[emotionId].value + 50) / 100; };
        };
        let emotionBars = [];
        for (let i = 0, l = kittyDef.emotions.length; i < l; i++) {
            let emotion = kittyDef.emotions[i];
            emotionBars[i] = ProgressBar.create({ x: 1, y: yOffset , width: 64, height: 3, valueDelegate: createEmotionValueDelegate(emotion.id) })
            emotionBars[i].label = emotion.id[0].toUpperCase();
            debugBarUIs.push(emotionBars[i]);
            addUIElement(emotionBars[i]);
            yOffset += 8;
        } 
    }

    setGameState(GameStates.MAIN_MENU);
};

var setGameState = function(index) {
    // Exit Code
    switch(gameState) {
        case GameStates.MAIN_MENU:
            break;
        case GameStates.INTRO:
            break;
        case GameStates.JOURNEY:
            actionsBox.active = false;
            journeyProgressBar.active = false;
            moodText.active = false;
            scoreText.active = false;
            toggleDebugUI(false);
            break;
        case GameStates.JOURNEY_COMPLETE:
            break;
        case GameStates.FINAL_SCORE:
            score = 0;
            journeysComplete = 0;
            break;
    }
    gameState = index;
    // Enter Code
    switch(gameState) {
        case GameStates.MAIN_MENU:
            // TODO: Show prompt for this!
            setGameState(GameStates.INTRO); 
            break;
        case GameStates.INTRO:
            creature = Creature.create(kittyDef); 
            journeyTick = 0;
            // TODO: Show prompt for this
            setGameState(GameStates.JOURNEY);
            break;
        case GameStates.JOURNEY:
            actionsBox.active = true;
            journeyProgressBar.active = true;
            moodText.active = true;
            scoreText.active = true;
            toggleDebugUI(true);
            break;
        case GameStates.JOURNEY_COMPLETE:
            journeysComplete += 1;
            let feedback = creature.calculateFeedback();
            if (creature.health > 0) {
                score += 1; 
            }
            
            // TODO: Update to use different UI
            // Who's speaking - it's the owner right? We should probably show this info
            showMessageBox(feedback, 2, function(){
                let text;
                if (creature.health > 0) {
                    text = "You kept it alive! :D";
                } else {
                    text = "You failed to keep it alive. :(";
                }
                showMessageBox(text, 2, function(){
                    if (journeysComplete >= tourLength) {
                        setGameState(GameStates.FINAL_SCORE);
                    } else {
                        // TODO: Show prompt for continuing
                        setGameState(GameStates.INTRO);
                    }
                });
            });
            break;
        case GameStates.FINAL_SCORE:
            // TODO: Update to use different UI
            showMessageBox("You kept " + score + " out of " + journeysComplete + " creatures alive.", 5, function() {
                // TODO: Show prompt for continuing
                setGameState(GameStates.MAIN_MENU);
            });
            break;
    }
};

var runSimStep = function(count) {
    let stepsTaken = 0;
    while (stepsTaken < count && journeyTick < journeyLength) {
        stepsTaken += 1;
        journeyTick += 1;
        if (journeyTick % creatureUpdateInterval === 0) {
            creature.update();
        }
    }
};

var update = function() {
    updateRoutines();
    
    if (gameState == GameStates.JOURNEY) {
        if (!pauseSim) {
            if (journeyTick >= journeyLength) {
                setGameState(GameStates.JOURNEY_COMPLETE);
            } else {
                runSimStep(1);
            }         
        }
    }

    for (let i = 0, l = uiElements.length; i < l; i++) {
        if (uiElements[i].active) {
            uiElements[i].update();
        }
    }
};

var draw = function() {
	Hestia.clear(3);

	if (gameState == GameStates.JOURNEY) {
    	creature.draw();
	}

	for (let i = 0, l = uiElements.length; i < l; i++) {
        if (uiElements[i].active) { // differentiate active & visible
            uiElements[i].draw();
        }
    }
};

window.onload = function() {
	var canvas = document.getElementById("canvas");

	config.update = update;
	config.draw = draw;
	config.canvas = canvas;
	
	init();
    
	Hestia.init(config);
	Hestia.run();
};

// Pay attention to your charge!
// Only pause on non-focus for debug
if (debug) {
    var paused = false;
    window.addEventListener('focus', function(event) {
        if (paused) {
            Hestia.run();
        }
    });
    window.addEventListener('blur', function(event){
        paused = true;
        Hestia.stop();
    });    
}

var TextBox = (function(){
	var proto = {
		padding: 3,
		spacing: 1,
		index: 0,
		select: false,
		boxed: true,
		charWidth: 6,	// Technically this comes from font but only one font atm
		charHeight: 8,	// ^^ as above
		color: 0,
		bgColor: 21,
		draw: function() {
		    if (this.dirty) {
		        this.dirty = false;
		        this.recalculateDimensions();
		    }
			var indent = 0;
			if (this.select) {
				indent = 4;
			}

			var x = this.x, y = this.y, w = this.w, h = this.h,
				padding = this.padding, spacing = this.spacing, lines = this.lines,
				select = this.select, index = this.index, c = this.color, charHeight = this.charHeight;

			if (this.boxed) {
				Hestia.fillRect(x+1,y+1,w-2,h-2, this.bgColor);
				Hestia.drawRect(x, y, w, h, c);					
			}
			
			for(var i = 0; i < lines.length; i++) {
				Hestia.drawText(lines[i], x + padding + indent, y + padding + (spacing + charHeight)*i, c);
				
				if (select && i == index) {
					var px = x + padding;
					var py = y + padding + (charHeight + spacing) * i + Math.floor(charHeight/2) - 1;
					Hestia.setPixel(px, py, c);
					Hestia.setPixel(px+1, py, c);
					Hestia.setPixel(px, py+1, c);
					Hestia.setPixel(px, py-1, c);
				}
			}		
		},
		update: function() {
			if (this.select) {
				if (Hestia.buttonUp(2)) {
					this.index = (this.index - 1 + this.lines.length) % this.lines.length;
				}
				if (Hestia.buttonUp(3)) {
					this.index = (this.index + 1) % this.lines.length;
				}
				if (Hestia.buttonUp(4) && this.actions[this.index]) {
				    this.actions[this.index]();
				}
				if (Hestia.buttonUp(5) && this.cancelAction) {
				    this.cancelAction();
				}
			}
		},
		recalculateDimensions: function() {
			this.w = this.width ? this.width : this.calculateMinWidth();
			this.h = this.calculateMinHeight();
		},
		calculateMinWidth: function() {
			var indent = 0;
			if (this.select) {
				indent = 3;
			}
			var maxWidth = 0;
			var maxWidthText = "";
			for(var i = 0; i < this.lines.length; i++) {
				if (this.lines[i].length > maxWidth) {
					maxWidth = this.lines[i].length;
					maxWidthText = this.lines[i];
				}
			}
			return Hestia.measureText(maxWidthText) + 2 * this.padding + indent;   // TODO: Adjust for kerning
		},
		calculateMinHeight: function() {
			return 2 * this.padding + this.lines.length*(this.charHeight+this.spacing) - (this.spacing+1);
		}
	};
	
	var calculateLines = function(text, width) {
	    var lines = [];
	    var words = text.split(' ');
	    var line = "", newline = "";
	    while (words.length > 0) {
	        let newLine = words[0];
	        while(words.length > 0 && (!line || Hestia.measureText(newLine) < width)) {
                words.splice(0, 1);
	            line = newLine;
	            newLine += " " + words[0];
	        }
	        lines.push(line);
	    }
	    return lines;
	};

	var create = function(params) {
		var textBox = Object.create(proto);
		textBox.x = params.x;
		textBox.y = params.y;
		textBox.lines = params.lines;
		textBox.color = params.color;
		textBox.bgColor = params.bgColor;
		textBox.select = params.select;
		textBox.actions = params.actions;
		textBox.cancelAction = params.cancelAction;
		textBox.width = params.width;
		// TODO: Explicit height option (+ scrolling)
		textBox.dirty = true;
		return textBox;
	};

	return { create: create, calculateLines: calculateLines };
})();

var ProgressBar = (function() {
    var proto = {
        x: 0,
        y: 0,
        borderColor: 0,
        barColor: 1,
        borderSize: 1,
        height: 1,
        width: 10,
        value: 0,
        update: function() {
            this.value = this.getValue();
        },
        draw: function() {
            let xOffset = 0;
            if (this.label) {
                Hestia.drawText(this.label, this.x, this.y - 1, this.borderColor); // TODO: Do centre calc rather than just -1
                xOffset = Hestia.measureText(this.label) + 1; // Could probably make drawText return width
            }
            Hestia.drawRect(xOffset + this.x, this.y, this.width + 2 * this.borderSize, this.height + 2 * this.borderSize, this.borderColor);
            if (this.value > 0) {
                Hestia.fillRect(xOffset + this.x + this.borderSize, this.y + this.borderSize, Math.floor(this.value * this.width), this.height, this.barColor);
            }
        }
    };
    
    var create = function(params) {
        var progressBar = Object.create(proto);
        
        progressBar.x = params.x;
        progressBar.y = params.y;
        progressBar.width = params.width;
        progressBar.height = params.height;
        progressBar.getValue = params.valueDelegate;
        progressBar.value = progressBar.getValue();
        
        if (params.borderColor !== undefined) {
            progressBar.borderColor = params.borderColor;
        }
        if (params.barColor !== undefined) {
            progressBar.barColor = params.barColor;
        }
        if (params.borderSize !== undefined) {
            progressBar.borderSize = params.borderSize;
        }
        
        return progressBar;
    };
    
    return { create: create };
})();
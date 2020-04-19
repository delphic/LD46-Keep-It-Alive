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
	"spriteSheet": { 
		"path": "images/spritesheet.png", 
		"spriteSize": 64
	},
	"keys": [ 37, 39, 38, 40, 90, 88], // left, right, up, down, z, x
	"hideCursor": false
};

var debug = false, debugBars = false;

var GameStates = {
    BOOT: -1,
    MAIN_MENU: 0,
    INTRO: 1,
    JOURNEY: 2,
    JOURNEY_COMPLETE: 3,
    FINAL_SCORE: 4
};
var gameState = -1; 
var comendations = 0;

// Form States
var confirmingReceipt, feedback, starFieldPoints, starFieldTick;

// TOUR State
var score = 0, journeysComplete = 0, tourLength = 3;

// JOURNEY State 
var actionsBox, currentReactionBox;
var debugUIs = [], journeyUIs = [];
var journeyTick = 0, journeyLength = config.tickRate * 120;
var interactionMessageShowTime = 2.5;
var creature, creatureUpdateInterval = config.tickRate;
var simPaused;

var createDebugUI = function() {
    if (debug && debugBars) {
        let moodText = {
            x: config.width - 1,
            y: 26,
            color: 2,
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
        debugUIs.push(moodText);
        addUIElement(moodText);
        
        let yOffset = 26;
        let healthBar = ProgressBar.create({ x: 1, y: yOffset , width: 64, height: 3, valueDelegate: function() { return creature.health / creature.def.health; } })
        healthBar.label = "+";
        addUIElement(healthBar);
        debugUIs.push(healthBar);
        yOffset += 10;
        
        let createNeedValueDelegate = function(needId) {
            return function() { return creature.needs[needId].value / 100; };
        };
        let needBars = [];
        for (let i = 0, l = creature.def.needs.length; i < l; i++) {
            let need = creature.def.needs[i];
            needBars[i] = ProgressBar.create({ x: 1, y: yOffset, width: 64, height: 3, valueDelegate: createNeedValueDelegate(need.id) });
            needBars[i].label = need.id[0].toUpperCase();
            addUIElement(needBars[i]);
            debugUIs.push(needBars[i]);
            yOffset += 8;
        }
        yOffset += 2;
        
        let createEmotionValueDelegate = function(emotionId) {
            return function() { return (creature.emotions[emotionId].value + 50) / 100; };
        };
        let emotionBars = [];
        for (let i = 0, l = creature.def.emotions.length; i < l; i++) {
            let emotion = creature.def.emotions[i];
            emotionBars[i] = ProgressBar.create({ x: 1, y: yOffset , width: 64, height: 3, valueDelegate: createEmotionValueDelegate(emotion.id) })
            emotionBars[i].label = emotion.id[0].toUpperCase();
            debugUIs.push(emotionBars[i]);
            addUIElement(emotionBars[i]);
            yOffset += 8;
        } 
    }
};

var toggleDebugUI = function(value) {
    if (debugUIs.length === 0) {
        createDebugUI();
    }
    
    if (debug && debugBars) {
        for (let i = 0, l = debugUIs.length; i < l; i++) {
            debugUIs[i].active = value;
        }
    }
};

var toggleJourneyUIs = function(value) {
    for (let i = 0, l = journeyUIs.length; i < l; i++) {
        journeyUIs[i].active = value;
        // HACK: actions box index is setting itself
        // to 1 but I've no idea why
        if (journeyUIs[i].index !== undefined) {
            journeyUIs[i].index = 0;
        }
    }
    toggleDebugUI(value);
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
    routineTick = 0;
};
var clearRoutines = function() {
    routineTick = 0;
    routines.length = 0;
    routineStars.lenght = 0;
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
            desc: "",
            time: 0
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
                let priority = emotionDef.priority;
                if (category === 4 && emotionDef.overridePriority !== undefined && creature.health < creature.def.health) {
                    previousCategory -= 1; // HACK - so we pass the "has changed" check
                    // Because we're overriding priority not category
                    priority = emotionDef.overridePriority;
                }
                
                if (category != previousCategory || creature.mood.category < category) {
                    creature.emotionalCategories[i] = category;
                    if (creature.mood.emotionId === emotionDef.id
                        || creature.mood.category < category
                        || (creature.mood.category === category && creature.mood.priority <= priority)) {
                        // TODO: Mood should be combos of emotions not highest emotional need
                        creature.mood.emotionId = emotionDef.id;
                        creature.mood.category = category;
                        creature.mood.priority = priority;
                        if (creature.mood.desc != emotionDef.moods[category]) {
                            // Only reset timer for new mood desc (i.e. an entire new mood, rather than just new source)
                            moodChanged = true;
                            creature.mood.desc = emotionDef.moods[category];
                            creature.mood.time = 0;
                        }
                    }
                }
            }
            // Consider weighting instead of priority (e.g. for Kitty would like hungry to trump restless)
            return moodChanged;
        };
        
        creature.draw = function(x, y, isThumbnail) {
            def.draw(creature, x, y, isThumbnail);
        };
        
        def.init(creature);
        
        return creature;
    };
    return exports;
})();

var kittyDef = {
    names: [ "Floofmiester", "Prof. Jiggly", "Fuzzy Boots", "Beans" ],
    desc: "Space Kitty",
    health: 100,
    moodTime: 4,
    needs: [
        { "id": "play", "growth": 2, "value": 40, "priority": 3 },
        { "id": "food", "growth": 1, "value": 40, "priority": 5 }
        // TODO: Rest Need
    ],
    emotions: [
        { "id": "cheer", "value": 0, "priority": 2, "invert": true, "moods": [ "Happy", "Content", "Indifferent", "Unhappy", "Miserable" ], "overridePriority": 6 },
        { "id": "hunger", "value": 10, "priority": 5, "moods": [ "Stated", "Sleepy", "Indifferent", "Hungry", "Ravenous"] },
        { "id": "playfulness", "value": 10, "priority": 4, "moods": [ "Asleep", "Sleepy", "Indifferent", "Playful", "Restless"] }
        // anger?
        // TODO: Method or mapping for emotion priority based on current category 
    ],
    calculateFeedback: function(creature) { 
        let score = 0;
        let desc = 0;
        if (creature.health === creature.def.health) {
            let happiness = creature.getEmotionalAttentionNeed("cheer"); // Note not inverting
            switch(happiness){
                case 4:
                case 3:
                    desc = creature.name + " seems to have had a great time!"
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
        } else if (creature.health > creature.def.health / 2) {
            desc = creature.name + " doesn't seem to be in the best of health";
        } else if (creature.health > 0) {
            desc = "What have you done to my kitty?";
        } else {
            desc = "What!? You're paying the revival fees!";
        }
        return desc;
    },
    init: function(creature) {
        let highestEmotionId, highestEmotionCategory = -1,  highestEmotionPriority = -1, highestEmotionDesc;
        creature.emotionalCategories = [];
        for (let i = 0, l = creature.def.emotions.length; i < l; i++) {
            let emotionDef = creature.def.emotions[i];
            let category = creature.getEmotionalAttentionNeed(emotionDef.id, emotionDef.invert);
            let priority = emotionDef.priority;
            creature.emotionalCategories.push(category);
            if (category > highestEmotionCategory 
                || (category == highestEmotionCategory && highestEmotionPriority < priority)) {
                highestEmotionId = emotionDef.id;
                highestEmotionCategory = category;
                highestEmotionPriority = priority;
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
                creature.mood.time = 0;
            }
        } else if (creature.health < creature.def.health && creature.needs["food"].value < 50) {
            // TODO: Iff rested
            creature.health += 1;
        }
        
        if (!simPaused) {
            // It's more important for time in mood to be visually accurate than sim accurate
            // So only increase if sim is running naturally (rather than being sped up)
            creature.mood.time += creatureUpdateInterval / config.tickRate;
        }
        if (creature.mood.time > creature.def.moodTime) {
            creature.recalculateMood();
        }
        
    },
    responses: function(creature, action) {
        // TODO: Replace "space kitty" with creature.name
        let result = {};
        let desc = "";
        let duration = interactionMessageShowTime * config.tickRate;
        let recalculateMoodAfterDuration = false;
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
                        desc = creature.name + " eats the food";
                        // TODO: maybe add happiness reference based on cheer level
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
            case "nap":
            {
                duration = 360 + Math.floor(Math.random() * 240);
                desc = "You doze off";
                recalculateMoodAfterDuration = true;
                break;
            }
            default:
                desc = creature.name + " stares at you";
                duration = 30;
                break;
        }

        return { desc: desc, duration: duration, recalculateMoodAfterDuration: recalculateMoodAfterDuration };
    },
    draw: function(creature, x, y, isThumbnail) {
        // Kitty is 0 to 6
        // idle - 0, playful - 1, demanding - 2, unhappy - 3, asleep - 4, dead - 5, thumbnail - 6
        if (isThumbnail) {
            Hestia.drawSpriteSection(6, x, y, 0, 0, 32, 32, 3);
        } else {
            let index;
            switch(creature.mood.desc) {
                case "Happy":
                case "Content":
                case "Indifferent":
                case "Stated":
                default:
                    index = 0;
                    break;
                case "Playful":
                    index = 1;
                    break;
                case "Restless":
                case "Hungry":  // Maybe Hungry should be 0
                case "Ravenous":
                    index = 2;
                    break;
                case "Unhappy":
                case "Miserable":
                    index = 3;
                    break;
                case "Sleepy":
                case "Asleep":
                    index = 4;
                    break;
                case "Dead":
                    index = 5;
                    break;
            }
            Hestia.drawSprite(index, x, y, 3);
        }
    }
};

var blobDef = {
    names: [ "Jelly", "Blob", "Pulper", "Zogoo" ],
    desc: "Unknown",
    health: 100,
    moodTime: 4,
    needs: [
        { "id": "play", "growth": 2, "value": 40, "priority": 3 },
        { "id": "food", "growth": 2, "value": 40, "priority": 5 }
    ],
    emotions: [
        { "id": "cheer", "value": 0, "priority": 2, "invert": true, "moods": [ "Happy", "Content", "Indifferent", "Unhappy", "Miserable" ], "overridePriority": 6 },
        { "id": "hunger", "value": 10, "priority": 5, "moods": [ "Stated", "Sleepy", "Indifferent", "Hungry", "Ravenous"] },
        { "id": "playfulness", "value": 10, "priority": 4, "moods": [ "Unhappy", "Sleepy", "Indifferent", "Playful", "Restless"] }
    ],
    calculateFeedback: function(creature) { 
        let score = 0;
        let desc = 0;
        if (creature.health === creature.def.health) {
            let descs = [ "wibbling", "wobbling", "jiggling" ];
            desc = "Still " + descs[Math.floor(Math.random() * descs.length)];
        } else if (creature.health > 0) {
            desc = "Why is " + creature.name + " flashing shapes constantly now?"
        } else {
            desc = "Oh no, " + creature.name  + "solidified";
        }
        return desc;
    },
    init: function(creature) {
        let highestEmotionId, highestEmotionCategory = -1,  highestEmotionPriority = -1, highestEmotionDesc;
        creature.emotionalCategories = [];
        for (let i = 0, l = creature.def.emotions.length; i < l; i++) {
            let emotionDef = creature.def.emotions[i];
            let category = creature.getEmotionalAttentionNeed(emotionDef.id, emotionDef.invert);
            let priority = emotionDef.priority;
            creature.emotionalCategories.push(category);
            if (category > highestEmotionCategory 
                || (category == highestEmotionCategory && highestEmotionPriority < priority)) {
                highestEmotionId = emotionDef.id;
                highestEmotionCategory = category;
                highestEmotionPriority = priority;
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
            creature.changeEmotion("hunger", 3);
        }
        if (creature.needs["play"].value > 80) {
            creature.changeEmotion("playfulness", +2);
        } else if (creature.needs["play"].value > 60) {
            creature.changeEmotion("playfulness", +1);
        } else if (creature.needs["play"].value < 40) {
            creature.changeEmotion("playfulness", -2);
        }
        
        // Emotions
        if ((creature.needs["play"] > 20 || creature.needs["play"] < 80) 
            && (creature.needs["food"] < 80)) {
            // Track back to 0
            creature.changeEmotion("cheer", -1 * Math.sign(craeture.emotion["cheer"]));
        }

        // Starvation
        if (creature.needs["food"].value == 100) {
            creature.health -= 2;
            if (creature.health <= 0) {
                creature.mood.emotionId = null;
                creature.mood.category = 100;
                creature.mood.priority = 100;
                creature.mood.desc = "Dead";
                creature.mood.time = 0;
            }
        }
        // Oversimulation
        if (creature.needs["play"].value < 20) {
            creature.health -= 1;
            if (creature.health <= 0) {
                creature.mood.emotionId = null;
                creature.mood.category = 100;
                creature.mood.priority = 100;
                creature.mood.desc = "Dead";
                creature.mood.time = 0;
            }
        }
        // Health regeneration
        if (creature.health < creature.def.health && creature.needs["food"].value < 50 && creature.needs["play"] > 20) {
            creature.health += 1;
        }
        
        if (!simPaused) {
            // It's more important for time in mood to be visually accurate than sim accurate
            // So only increase if sim is running naturally (rather than being sped up)
            creature.mood.time += creatureUpdateInterval / config.tickRate;
        }
        if (creature.mood.time > creature.def.moodTime) {
            creature.recalculateMood();
        }
        
    },
    responses: function(creature, action) {
        let duration = interactionMessageShowTime * config.tickRate;
        let recalculateMoodAfterDuration = false;
        if (action.name != "nap" && creature.health == 0) {
            return {
                duration: duration,
                desc: "It's rock solid"
            }
        }
        
        let result = {};
        let descs = [ "wibbles", "wobbles", "jiggles" ];
        let desc = creature.name + " " + descs[Math.floor(Math.random() * descs.length)];

        switch(action.name) {
            case "feed":
            {
                duration = 60;
                {
                    let hunger = creature.emotions["hunger"].value;
                    if (hunger > -10) { // i.e. neutral, quite or very
                        creature.changeNeed("food", -50);
                        creature.changeEmotion("hunger", -50);
                    }
                }
                break;
            }
            case "play":
            {
                duration = 60;
                { 
                    let playfulness = creature.emotions["playfulness"].value; 
                    creature.changeNeed("play", -30);
                    creature.changeEmotion("playfulness", -30);
                    if (playfulness > 0) {
                        creature.changeEmotion("cheer", 100);
                    } else {
                        creature.changeEmotion("cheer", -100);
                    }
                }
                break;
            }
            case "nap":
            {
                duration = 360 + Math.floor(Math.random() * 240);
                desc = "You doze off";
                recalculateMoodAfterDuration = true;
                break;
            }
            default:
                duration = 30;
                break;
        }

        return { desc: desc, duration: duration, recalculateMoodAfterDuration: recalculateMoodAfterDuration };
    },
    draw: function(creature, x, y, isThumbnail) {
        // Blob is 14 to 19 + 6 offset 32, 32
        // idle - 14, colorChange - 15, ring - 16, spots - 17, rings - 18, dead - 19, thumbnail - 6
        if (isThumbnail) {
            Hestia.drawSpriteSection(6, x, y, 32, 32, 32, 32, 3);
        } else {
            let index;
            // TODO: Randomise mappings
            switch(creature.mood.desc) {
                case "Happy":
                case "Content":
                case "Indifferent":
                case "Stated":
                default:
                    index = 14;
                    break;
                case "Restless":
                case "Playful":
                    index = 17;
                    break;
                case "Hungry":
                case "Ravenous":
                    index = 16;
                    break;
                case "Unhappy":
                case "Miserable":
                    index = 15;
                    break;
                case "Sleepy":
                case "Asleep":
                    index = 18;
                    break;
                case "Dead":
                    index = 19;
                    break;
            }
            Hestia.drawSprite(index, x, y, 3);
        }
    }
};

var kassaDef = {
    names: [ "xm-329", "72-zr-5", "kf-12", "7_xr_7", "5_hf_5", "lr+17" ],
    desc: "Kassa",
    health: 100,
    moodTime: 0,
    needs: [
        { "id": "food", "growth": 1.5, "value": 50, "priority": 5 }
    ],
    emotions: [
        { "id": "hunger", "value": 10, "priority": 5, "moods": [ "Overfed", "Overfed", "Healthy", "Healthy", "Underfed"] },
    ],
    calculateFeedback: function(creature) { 
        let score = 0;
        let desc = "";
        if (creature.health > 80) {
            desc = creature.name + " is looking quite hale"
        } else if (creature.health > 0) {
            desc = creature.name + " is a bit limp";
        } else {
            let descs = [ "We're never using xeno haul again", "You can't even take care of Kassa!?", "What am I supposed to feed the children?" ];
            desc = descs[Math.floor(Math.random() * descs.length)];
        }
        return desc;
    },
    init: function(creature) {
        let highestEmotionId, highestEmotionCategory = -1,  highestEmotionPriority = -1, highestEmotionDesc;
        creature.emotionalCategories = [];
        for (let i = 0, l = creature.def.emotions.length; i < l; i++) {
            let emotionDef = creature.def.emotions[i];
            let category = creature.getEmotionalAttentionNeed(emotionDef.id, emotionDef.invert);
            let priority = emotionDef.priority;
            creature.emotionalCategories.push(category);
            if (category > highestEmotionCategory 
                || (category == highestEmotionCategory && highestEmotionPriority < priority)) {
                highestEmotionId = emotionDef.id;
                highestEmotionCategory = category;
                highestEmotionPriority = priority;
                highestEmotionDesc = emotionDef.moods[category];
            }
        }
        creature.mood.emotionId = highestEmotionId;
        creature.mood.category = highestEmotionCategory;
        creature.mood.priority = highestEmotionPriority;
        creature.mood.desc = highestEmotionDesc;
    },
    update: function(creature) {
        if (creature.health <= 0) {
            return;
        }
        // No actual emotions for kassa
        if (creature.health < 80) {
            creature.emotions["hunger"].value = creature.needs["food"].value - 50;
        } else {
            creature.emotions["hunger"].value = 0;
        }

        // Over or underfeeding
        if (creature.needs["food"].value > 80 || creature.needs["food"].value < 40) {
            creature.health -= 3;
            if (creature.health <= 0) {
                creature.mood.emotionId = null;
                creature.mood.category = 100;
                creature.mood.priority = 100;
                creature.mood.desc = "Dead";
                creature.mood.time = 0;
            }
        } else if (creature.health < creature.def.health) {
            creature.health += 0.5;
        }
        
        if (!simPaused) {
            // It's more important for time in mood to be visually accurate than sim accurate
            // So only increase if sim is running naturally (rather than being sped up)
            creature.mood.time += creatureUpdateInterval / config.tickRate;
        }
        if (creature.mood.time > creature.def.moodTime) {
            creature.recalculateMood();
        }
        
    },
    responses: function(creature, action) {
        let duration = interactionMessageShowTime * config.tickRate;
        let recalculateMoodAfterDuration = false;
        if (action.name != "nap" && creature.health == 0) {
            return {
                duration: duration,
                desc: creature.name + " doesn't respond"
            }
        }
        
        let result = {};
        let descs = [ " sways", " makes beeping noises", ];
        let desc = creature.name + " " + descs[Math.floor(Math.random() * descs.length)];

        switch(action.name) {
            case "feed":
            {
                duration = 60;
                creature.changeNeed("food", -40);
                break;
            }
            case "play":
            {
                duration = 60;
                break;
            }
            case "nap":
            {
                duration = 480 + Math.floor(Math.random() * 360);
                desc = "You doze off";
                recalculateMoodAfterDuration = true;
                break;
            }
            default:
                duration = 30;
                break;
        }

        return { desc: desc, duration: duration, recalculateMoodAfterDuration: recalculateMoodAfterDuration };
    },
    draw: function(creature, x, y, isThumbnail) {
        // Blob is 11, 12, 13, 20 + 6 (offset 0, 32)
        // healthy - 11, underfed - 12, overfed - 13, dead - 20, thumbnail - 6
        if (isThumbnail) {
            Hestia.drawSpriteSection(6, x, y, 0, 32, 32, 32, 3);
        } else {
            let index;
            // TODO: Randomise mappings
            switch(creature.mood.desc) {
                case "Healthy":
                default:
                    index = 11;
                    break;
                case "Underfed":
                    index = 12;
                    break;
                case "Overfed":
                    index = 13;
                    break;
                case "Dead":
                    index = 20;
                    break;
            }
            Hestia.drawSprite(index, x, y, 3);
        }
    }
};

var createRandomCreature = function() {
    let type = Math.floor(Math.random() * 3);
    let result;
    if (type == 0) {
        result = Creature.create(blobDef);
    } else if (type == 1) {
        result = Creature.create(kassaDef);
    } else {
        result = Creature.create(kittyDef);
    }

    // TODO: Randomise Starting Needs

    return result;
};

// TODO: Move actions + interaction to class / protype
var interaction = function(index) { // TODO: Context / Options
    let interactionResult = creature.interact(actions[index]);
    actionsBox.active = false;
    simPaused = true;
    let after = interactionResult.recalculateMoodAfterDuration; 
    showMessageBox(interactionResult.desc, interactionMessageShowTime, function(){
        actionsBox.active = true;
        let moodChanged = false;
        if (!after) { moodChanged = creature.recalculateMood(); }
        runSimStep(Math.ceil(interactionResult.duration));
        // ^^ Might be better to try to spread over display time
        // but be aware of the visual needs of mood communication
        if (after) { moodChanged = creature.recalculateMood(); }
        if ((moodChanged || creature.health === 0)  && journeyTick >= journeyLength) {
            // If end of journey and changed state wait for interactionMessageShowTime
            // so the player can see the effect of the interaction
            addRoutine(function(ticks) {
                if (ticks > interactionMessageShowTime * config.tickRate) {
                    simPaused = false;
                    return true;
                }
                return false;
            });
        } else {
            simPaused = false;
        }
    })
};

var showMessageBox = function(text, duration, callback) {
    currentReactionBox.lines = TextBox.calculateLines(
        text,
        currentReactionBox.width - 2 * currentReactionBox.padding);
    currentReactionBox.dirty = true;
    currentReactionBox.active = true;
    addRoutine(function(ticks) {
       // show progress bar for action
       if (ticks > 30 * duration) {
           currentReactionBox.active = false;
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
}, {
    name: "nap",
    desc: "Nap",
    interaction: function() { interaction(2); }
}]; // Contextual Actions?

var generateStarField = function() {
    starFieldPoints = [];
    for (let i = 0; i < 100; i++) {
        let x = 1 + Math.floor(Math.random() * (config.width - 2));
        let y = 1 + Math.floor(Math.random() * (config.height - 2));
        starFieldPoints.push([x, y]);
    }
    starFieldTick = 0;
};

var drawStarField = function() {
    starFieldTick++;
	let twinkleIndex = Math.floor(starFieldTick / config.tickRate);
	for (let i = 0, l = starFieldPoints.length; i < l; i++) {
	    Hestia.setPixel(starFieldPoints[i][0], starFieldPoints[i][1], ((i + twinkleIndex) % 5) ? 2 : 3);
	}
};

var init = function() {
    // Journey UI Init
    actionsBox = TextBox.create({ 
        x: 3,
        y: config.height - 24,
        lines: [ actions[0].desc, actions[1].desc, actions[2].desc],
        color: 0,
        bgColor: 3,
        select: true,
        actions: [ actions[0].interaction, actions[1].interaction, actions[2].interaction],
        width: config.width - 6,
        grid: [ 2, 2 ]
    });
    addUIElement(actionsBox);
    journeyUIs.push(actionsBox);
    
    currentReactionBox = TextBox.create({
        x: 3,
        y: config.height - 24,
        color: 0,
        bgColor: 3,
        width: config.width - 6,
        height: 22
    });
    addUIElement(currentReactionBox);
    // visibility controlled by separate logic, also currently reused
    // so not adding to journeyUIs which are auto toggled
    
    let journeyProgressBar = ProgressBar.create({
        x: 2 + 10, y: 1, width: config.width - 6 - 10, height: 4,
        valueDelegate: function() {
            return journeyTick / journeyLength;
        }
        // TODO: Suppose icon labels
    });
    addUIElement(journeyProgressBar);
    journeyUIs.push(journeyProgressBar);

    let creatureName = {
        x: config.width - 1,
        y: 8,
        color: 1,
        text: "",
        dead: false,
        update: function() {
            this.text = creature.name;
        },
        draw: function() {
            if (this.text) {
                // right aligned
                let width = Hestia.measureText(this.text);
                Hestia.drawText(this.text, this.x - width , this.y, this.color);
            }
        }
    };
    addUIElement(creatureName);
    journeyUIs.push(creatureName);

    let creatureDesc = {
        x: config.width - 1,
        y: 16,
        color: 2,
        text: "",
        dead: false,
        update: function() {
            if (creature.health === 0) {
                this.text = "Dead " + creature.def.desc;
            } else {
                this.text = creature.def.desc;
            }
        },
        draw: function() {
            if (this.text) {
                // right aligned
                let width = Hestia.measureText(this.text);
                Hestia.drawText(this.text, this.x - width , this.y, this.color);
            }
        }
    };
    addUIElement(creatureDesc);
    journeyUIs.push(creatureDesc);

    let scoreText = {
        x: 2,
        y: 16,
        color: 1,
        text: "",
        update: function() {
            this.text = "" + (journeysComplete - score);
        },
        draw: function() {
            Hestia.drawSpriteSection(6, this.x, this.y, 32, 0, 8, 8, 3);
            Hestia.drawText(this.text, this.x + 10, this.y, this.color);
        }
    };
    addUIElement(scoreText);
    journeyUIs.push(scoreText);
    
    let toursText = {
        x: 2,
        y: 8,
        color: 0,
        text: "",
        update: function() {
            this.text = "" + (journeysComplete) + "/" + tourLength;
        },
        draw: function() {
            // HACK: Label for journey bar
            Hestia.drawSpriteSection(6, this.x, this.y - 8, 32, 24, 8, 8, 3);
            Hestia.drawSpriteSection(6, this.x, this.y, 32, 8, 8, 8, 3);
            Hestia.drawText(this.text, this.x + 10, this.y, this.color);
        }
    };
    addUIElement(toursText);
    journeyUIs.push(toursText);

    setGameState(GameStates.MAIN_MENU);
};

var scheduleGameStateChange = function (index) {
    addRoutine(function(ticks) {
        if (ticks > 0) {
            setGameState(index);
            return true;
        }
        return false;
    });
};

var setGameState = function(index) {
    resetRoutines();
    // Exit Code
    switch(gameState) {
        case GameStates.MAIN_MENU:
            break;
        case GameStates.INTRO:
            break;
        case GameStates.JOURNEY:
            toggleJourneyUIs(false);
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
            generateStarField();
            tourLength = 2 + Math.floor(Math.random() * 4); // Between 2 and 5
            break;
        case GameStates.INTRO:
            confirmingReceipt = false;
            journeyLength = (120 + Math.floor(Math.random() * 24) * 5) * config.tickRate;
            creature = createRandomCreature();  
            journeyTick = 0;
            break;
        case GameStates.JOURNEY:
            simPaused = false;
            toggleJourneyUIs(true);
            break;
        case GameStates.JOURNEY_COMPLETE:
            confirmingReceipt = false;
            journeysComplete += 1;
            feedback = creature.calculateFeedback();
            if (creature.health > 0) {
                score += 1; 
            }
            break;
        case GameStates.FINAL_SCORE:
            if (journeysComplete - score <= 0) {
                comendations += 1;
            }
            confirmingReceipt = false;
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
        if (!simPaused) {
            if (journeyTick >= journeyLength) {
                scheduleGameStateChange(GameStates.JOURNEY_COMPLETE);
            } else {
                runSimStep(1);
            }         
        }
        if (debug && Hestia.buttonUp(5)) {
            journeyTick = journeyLength;
        }
    } else if (gameState == GameStates.INTRO
        || gameState == GameStates.FINAL_SCORE
        || gameState == GameStates.JOURNEY_COMPLETE) {

        let targetState = GameStates.MAIN_MENU;
        if (gameState == GameStates.INTRO) {
            targetState = GameStates.JOURNEY;
        } else if (gameState == GameStates.JOURNEY_COMPLETE) {
            if (journeysComplete >= tourLength) {
                targetState = GameStates.FINAL_SCORE;
            } else {
                targetState = GameStates.INTRO;
            }
        }
        
        if (!confirmingReceipt && Hestia.buttonUp(4)) {
            confirmingReceipt = true;
            addRoutine(function(ticks) {
                if (ticks > 1 * config.tickRate) {
                    scheduleGameStateChange(targetState);
                    return true;
                }
            });
        }
    } else if (gameState == GameStates.MAIN_MENU) {
        if (Hestia.buttonUp(4)) {
            scheduleGameStateChange(GameStates.INTRO);
        }
    } 

    for (let i = 0, l = uiElements.length; i < l; i++) {
        if (uiElements[i].active) {
            uiElements[i].update();
        }
    }
};

var draw = function() {
    if (gameState == GameStates.MAIN_MENU) {
    	Hestia.clear(0);
    	
    	// Draw Starfield
    	drawStarField();

    	// Top Bar
    	Hestia.fillRect(0, 6, config.width, 1, 3);
    	Hestia.fillRect(0, 7, config.width, 1, 2);
    	Hestia.fillRect(0, 8, config.width, 1, 1);
    	
    	// Background
    	Hestia.fillRect(0, 9, config.width, 85, 3);
    	
    	// Title (7,8, then 9,10 (24 height)) 
    	Hestia.drawSprite(7, 17, 17, 3);
    	Hestia.drawSprite(8, 17+64, 17, 3);
    	Hestia.drawSpriteSection(9, 17, 17+48, 0, 0, 64, 24, 3); // Could have packed these better
    	Hestia.drawSpriteSection(10, 17+64, 17+48, 0, 0, 64, 24, 3); // Could have packed these better
    	
    	// Bottom Bar
    	Hestia.fillRect(0, 94, config.width, 1, 2);
    	Hestia.fillRect(0, 95, config.width, 1, 1);
    	
    	// Border
    	Hestia.fillRect(0, 9, 1, 86, 1);
    	Hestia.fillRect(config.width-1, 9, 1, 86, 1);
    	
    	// Commendations
    	Hestia.drawSpriteSection(6, config.width / 2 - 5, 102, 32, 16, 8, 8, 3);
    	Hestia.drawText("" + comendations, config.width / 2 + 5, 101, 2);
    	
    	// Continue Prompt
    	let tw = Hestia.measureText("Press Z to Start");
    	let offset = 4;
    	let x = Math.floor((config.width / 2) - ((tw + 8 + offset) / 2));
    	Hestia.drawText("Press Z to Start", x, 116, 2);
    	Hestia.drawSpriteSection(6, x + tw + offset, 116, 32, 8, 8, 8, 3);
    	
    } else if (gameState == GameStates.INTRO 
        || gameState == GameStates.JOURNEY_COMPLETE
        || gameState == GameStates.FINAL_SCORE) {

    	Hestia.clear(0);
    	drawStarField();
    	
    	// BG
    	Hestia.fillRect(26, 0, config.width - 2*26, config.height, 3);
    	// Border
    	Hestia.fillRect(26, 0, config.width - 2*26, 1, 2);
    	Hestia.fillRect(26, 0, 1, config.height, 2);
    	Hestia.fillRect(config.width - 26, 0, 1, config.height, 1);
    	Hestia.fillRect(26, config.height-1, config.width - 2*26, 1, 1);

        // Haulage Inc Logo
        Hestia.drawSpriteSection(9, 34, 5, 14, 32, 50, 12, 3);
        Hestia.drawSpriteSection(10, 83, 5, 0, 32, 50, 12, 3);

        let y = 32; 
        if (gameState == GameStates.INTRO) {
            Hestia.drawText("Form 38s27-e", 40, 18, 2);
               
            Hestia.drawText("Creature Type:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1, y + 2, 2);
            Hestia.drawText(creature.def.desc, 40, y, 1);

            y += 16
            Hestia.drawText("Creature Name:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            Hestia.drawText(creature.name, 40, y, 1);
            
            y += 16;
            creature.draw(40, y, true);
            
            Hestia.drawSpriteSection(6, 80, y, 32, 24, 8, 8, 3);
            Hestia.drawText(".....", 80-1+10, y+2, 2);
            Hestia.drawText("" + journeyLength / config.tickRate, 80 + 16, y, 1);
            
            y += 16;
            Hestia.drawSpriteSection(6, 80, y, 32, 8, 8, 8, 3);
            Hestia.drawText(".....", 80-1+10, y+2, 2);
            Hestia.drawText("" + journeysComplete + "/" + tourLength, 80 + 16, y, 1);
            
            y += 24;
        } else if (gameState == GameStates.FINAL_SCORE) {
            let deaths = journeysComplete - score;
            Hestia.drawText("Form 42z13-b", 40, 18, 2);
   
            Hestia.drawText("Journeys:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1, y + 2, 2);
            Hestia.drawText("" + journeysComplete, 40, y, 1); 
            
            y += 16;
            Hestia.drawText("Deaths:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            Hestia.drawText("" + deaths, 40, y, 1);
            
            
            y += 16;
            Hestia.drawText("Commendation:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1, y + 2, 2);
            if (deaths <= 0) {
                Hestia.drawText("Earned", 40, y, 1);
            } else {
                Hestia.drawText("Not Earned", 40, y, 1);
            }
            
            y += 16;
            if (deaths <= 0) {
                // Draw Commendation
                Hestia.drawSpriteSection(6, 40, y, 32, 16, 8, 8, 3);
            } else {
                // Draw Skulls
                for (let i = 0; i < deaths; i++) {
                    Hestia.drawSpriteSection(6, 40 + i * 10, y, 32, 0, 8, 8, 3);
                }
            }

            y += 16;
        } else if (gameState == GameStates.JOURNEY_COMPLETE) {
            let death = creature.health <= 0;
            Hestia.drawText("Form 93q03-k", 40, 18, 2);
   
            Hestia.drawText("Cargo Status:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1, y + 2, 2);
            Hestia.drawText(death ? "Deceased" : "Alive" , 40, y, 1); 
            
            let feedbackLines = TextBox.calculateLines(feedback, 80);
            y += 16;
            Hestia.drawText("Feedback:", 40, y, 0);
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            if (feedbackLines.length > 0) {
                Hestia.drawText(feedbackLines[0], 40, y, 1); 
            }
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            if (feedbackLines.length > 1) {
                Hestia.drawText(feedbackLines[1], 40, y, 1); 
            }
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            if (feedbackLines.length > 2) {
                Hestia.drawText(feedbackLines[2], 40, y, 1); 
            }
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            if (feedbackLines.length > 3) {
                Hestia.drawText(feedbackLines[3], 40, y, 1); 
            }
            y += 8;
            Hestia.drawText(".............", 40 - 1 , y + 2, 2);
            if (feedbackLines.length > 4) {
                Hestia.drawText(feedbackLines[4], 40, y, 1); 
            }

            y += 24;
        }
        Hestia.drawText("Confirm Reciept:", 40, y, 0);
        y += 8;
        Hestia.drawText(".............", 40 - 1, y + 2, 2);
        if (confirmingReceipt) {
            Hestia.drawText("Accepted", 40, y, 1);
        } else if (Hestia.button(4)) {
            Hestia.drawText("Accepted", 40, y, 2);
        }
    } else if (gameState == GameStates.JOURNEY) {
        Hestia.clear(3);
    	// TODO: Draw portholes? with moving stars? (mock plz)
    	creature.draw(config.width/2 - 32, config.height/2 - 32);
    } else {
        Hestia.clear(3);
        
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
		indent: 0,
		align: 0,
		grid: undefined,
		draw: function() {
		    if (this.dirty) {
		        this.dirty = false;
		        this.recalculateDimensions();
		    }

			var x = this.x, y = this.y, w = this.w, h = this.h, indent = this.indent
				padding = this.padding, spacing = this.spacing, lines = this.lines,
				select = this.select, index = this.index, c = this.color, charHeight = this.charHeight;

			if (this.boxed) {
				Hestia.fillRect(x+1,y+1,w-2,h-2, this.bgColor);
				Hestia.drawRect(x, y, w, h, c);					
			}
			
			for(var i = 0; i < lines.length; i++) {
			    var bx = x + padding + indent;
			    var by = y + padding + (spacing + charHeight)*i;
			    var bw = w;

                if (this.grid) {
                    bw = w / this.grid[1];
                    bx = x + padding + indent + Math.floor(Math.floor(i / this.grid[0]) * bw);
                    by = y + padding + (spacing + charHeight) * (i % this.grid[0]);
                }
                var tx = bx;
			    
			    if (this.align === 1) {
    		        let lineWidth = Hestia.measureText(lines[i]);
			        tx = bx - padding + Math.floor(((bw - indent) / 2) - (lineWidth / 2));
			    } else if (this.align == 2) {
			        let lineWidth = Hestia.measureText(lines[i]);
			        tx =  bw - padding - lineWidth;
			    }

				Hestia.drawText(lines[i], tx, by, c);
				
				if (select && i == index) {
					var px = bx - indent;
					var py = by + Math.floor(charHeight/2);
					this.drawSelect(px, py, c);
				}
			}
		},
		drawSelect: function(px, py, c) {
		    Hestia.setPixel(px, py - 1, c);
			Hestia.setPixel(px+1, py - 1, c);
			Hestia.setPixel(px, py, c);
			Hestia.setPixel(px, py-2, c);
		},
		update: function() {
			if (this.select) {
			    if (this.grid) {
			        let targetIndex = this.index;
                    if (Hestia.buttonUp(0)) {
                        targetIndex = this.index - this.grid[0];
                    }
                    if (Hestia.buttonUp(1)) {
                        targetIndex = this.index + this.grid[0];   
                    }
                    if (Hestia.buttonUp(2) && this.index % this.grid[0] != 0) {
                        targetIndex = this.index - 1; 
                    }
                    if (Hestia.buttonUp(3) && this.index % this.grid[0] != this.grid[1] - 1) {
                        targetIndex = this.index + 1;
                    }
                    if (targetIndex >= 0 && targetIndex < this.lines.length) {
                        this.index = targetIndex;
                    }
			    } else {
    				if (Hestia.buttonUp(2)) {
    					this.index = (this.index - 1 + this.lines.length) % this.lines.length;
    				}
    				if (Hestia.buttonUp(3)) {
    					this.index = (this.index + 1) % this.lines.length;
    				}			        
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
			this.h = this.height ? this.height : this.calculateMinHeight();
		},
		calculateMinWidth: function() {
		    // TODO: Update for grid (check each column against grid column width)
		    // can assume uniform column widths (for now...)
			var maxWidth = 0;
			var maxWidthText = "";
			for(var i = 0; i < this.lines.length; i++) {
				if (this.lines[i].length > maxWidth) {
					maxWidth = this.lines[i].length;
					maxWidthText = this.lines[i];
				}
			}
			// TODO: Don't assume the longest string is the widest
			return Hestia.measureText(maxWidthText) + 2 * this.padding + this.indent;
		},
		calculateMinHeight: function() {
		    if (this.grid) {
		        return 2 * this.padding + this.grid[0] * (this.charHeight + this.spacing) - (this.spacing + 1);
		    } else {
    			return 2 * this.padding + this.lines.length*(this.charHeight+this.spacing) - (this.spacing + 1);
		    }
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
		textBox.height = params.height;
		if (params.align !== undefined) {
		    textBox.align = params.align;
		}
		if (params.indent !== undefined) {
		    textBox.indent = params.indent;
		} else {
		    textBox.indent = textBox.select ? 4 : 0;
		}
		if (params.drawSelect) {
    		textBox.drawSelect = params.drawSelect;
		}
		if (params.grid !== undefined) {
		    textBox.grid = params.grid; 
		}

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
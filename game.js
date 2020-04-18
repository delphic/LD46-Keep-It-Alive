var actionsBox;
var currentReaction;
var creature;

var uiElements = [];
var addUIElement = function(uiElement){
    uiElement.index = uiElements.length;
    uiElements.push(uiElement);
};

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
    var proto = {};
    
    exports.create = function(def) {
        var creature = Object.create(proto);

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
            def.update(creature);  
        };
        creature.interact = function(action) {
            return def.responses(creature, action);
        };
        
        creature.draw = function() {
            def.draw(creature);
        };
        
        return creature;
    };
    return exports;
})();

var kittyDef = {
    needs: [
        // TODO: Hiearchy of needs - if same category (i.e. band) the higher need gets prio
        { "id": "play", "growth": 2, "value": 50, "priority": 3 },
        { "id": "food", "growth": 1, "value": 10, "priority": 5 }
    ],
    emotions: [
        { "id": "cheer", "value": 0 },
        { "id": "hunger", "value": 10 },
        { "id": "playfulness", "value": 10 }
        // anger?
    ],
    // TODO: Emotion -> mood state mapping
    update: function(creature) {
        // How to turn needs into moods
        if (creature.needs["food"].value > 50) {
            creature.changeEmotion("cheer", -2);
            creature.changeEmotion("hunger", 3);
        }
        if (creature.needs["play"].value > 80) {
            creature.changeEmotion("cheer",-1);
            creature.changeEmotion("playfulness", +2);
        } else if (creature.needs["play"].value > 50) {
            creature.changeEmotion("cheer", -1);
            creature.changeEmotion("playfulness", +1);
        }
        // TODO: should cheer equalise if there's no particular needs?
        // TODO: If hunger negative increase for lower food values
        // TODO: Die if not fed for long enough - that or growth curve and die at reaching 100
    },
    responses: function(creature, action) {
        let desc = "";
        switch(action.name) {
            case "feed":
            {
                let hunger = creature.emotions["hunger"].value;
                if (hunger > -10) { // i.e. neutral, quite or very
                    creature.changeNeed("food", -50);
                    creature.changeEmotion("hunger", -30);
                    if (hunger > 30) {
                        desc = "Space kitty devours the food";
                    } else if (hunger > 10) {
                        creature.changeEmotion("cheer", 20);
                        desc = "Space kitty happily eats the food";
                    } else {
                        desc = "Space kitty picks at the food";
                    }
                } else {
                    let playfulness = creature.emotions["playfulness"].value;
                    if (playfulness > 10) {
                        desc = "Space kitty stares at you and meows";
                    } else {
                        desc = "Space kitty goes to sleep";
                    }
                }
                break;
            }
            case "play":
            {
                let hunger = creature.emotions["hunger"].value;
                if (hunger > 30) {
                    desc = "Space kitty stares at you and meows";
                } else { 
                    // TODO: base reaction on mood rather so we get hunger reactions for free
                    let playfulness = creature.emotions["playfulness"].value; 
                    if (playfulness > -30) { // i.e. not really, neutral, quite, very
                        if (playfulness > 30) {
                            creature.changeNeed("play", -30);
                            creature.changeEmotion("playfulness", -30);
                            creature.changeEmotion("cheer", 20);
                            creature.changeEmotion("hunger", 10);
                            desc = "Space kitty plays enthusiastically";
                        } else if (playfulness > 10) {
                            creature.changeNeed("play", -20);
                            creature.changeEmotion("playfulness", -30);
                            creature.changeEmotion("cheer", 15);
                            desc = "Space kitty plays with you";
                        } else if (playfulness > -10) {
                            creature.changeNeed("play", -10);
                            creature.changeEmotion("playfulness", -30);
                            creature.changeEmotion("cheer", 5);
                            desc = "Space kitty plays idly";
                        } else {
                            creature.changeNeed("play", -5);
                            creature.changeEmotion("playfulness", -30);
                            desc = "Space kitty bats the toy once and lies down";
                        }
                    } else {
                       desc = "Space kitty ignores you";
                    }
                }
                break;
            }
            default:
                desc = "Space kitty stares at you";
                break;
        }
        return desc;    // Can we return duration too? Currently issue that play need decreases at less than the growth + duration (this is an arguement for growth curves though)
    },
    draw: function(creature) {
        // Sprite please
        Hestia.fillRect((160/2) - 16, (144/2) - 16, 32, 32, 1);
        // TODO: Display primary mood
    }
};

// TODO: Move to class / protype
var interaction = function(index) { // TODO: Context / Options
   currentReaction = creature.interact(actions[index]);
   actionsBox.active = false;
   let duration = actions[index].duration;
   addRoutine(function(ticks) {
       // show progress bar for action
       if (ticks > 30 * duration) {
           currentReaction = "";
           actionsBox.active = true;
           return true;
       }
       return false;
   });
};

var actions = [{
    name: "play",
    desc: "Play",
    interaction: function() { interaction(0); },
    duration: 5
},{
    name: "feed",
    desc: "Feed",
    interaction: function() { interaction(1); },
    duration: 2
}]; // Floof?



var init = function() {
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
    actionsBox.active = true;
    addUIElement(actionsBox);
    creature = Creature.create(kittyDef);
    
    // Debug Bars
    let createNeedValueDelegate = function(needId) {
        return function() { return creature.needs[needId].value / 100; };
    };
    let needBars = [];
    for (let i = 0, l = kittyDef.needs.length; i < l; i++) {
        let need = kittyDef.needs[i];
        needBars[i] = ProgressBar.create({ x: 1, y: 1 + i * 4 , width: 64, height: 1, valueDelegate: createNeedValueDelegate(need.id) });
        needBars[i].label = need.id;
        needBars[i].active = true;
        addUIElement(needBars[i]);
    }
    let createEmotionValueDelegate = function(emotionId) {
        return function() { return (creature.emotions[emotionId].value + 50) / 100; };
    };
    let emotionBars = [];
    for (let i = 0, l = kittyDef.emotions.length; i < l; i++) {
        let emotion = kittyDef.emotions[i];
        emotionBars[i] = ProgressBar.create({ x: 1, y: 3 + (i + needBars.length) * 4 , width: 64, height: 1, valueDelegate: createEmotionValueDelegate(emotion.id) })
        emotionBars[i].label = emotion.id;
        emotionBars[i].active = true;
        addUIElement(emotionBars[i]);
    }
};


var journeyTick = 0, creatureUpdateRate = 30;
var update = function() {
    updateRoutines();
    
    journeyTick += 1;
    if (journeyTick % creatureUpdateRate === 0) {
        creature.update();
    }

    for (let i = 0, l = uiElements.length; i < l; i++) {
        if (uiElements[i].active) {
            uiElements[i].update();
        }
    }
};

var draw = function() {
	Hestia.clear(3);

	//drawPalette(0,0,2);
	creature.draw();

    if (currentReaction) {
        // Show hot key in hestia to show grid lines with labels would be nice
        // TODO: Wrapping text / text box 
        Hestia.drawText(currentReaction, 3, 100, 1);
    }

	for (let i = 0, l = uiElements.length; i < l; i++) {
        if (uiElements[i].active) {
            uiElements[i].draw();
        }
    }
};

var drawPalette = function(x, y, size) {
	var l = Hestia.palette().length;
	for(var i = 0; i < l; i++) {
		Hestia.fillRect(x+i*size,y,size,size,i);
	}
};

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

window.onload = function() {
	var canvas = document.getElementById("canvas");

	config.update = update;
	config.draw = draw;
	config.canvas = canvas;
	
	init();
    
	Hestia.init(config);
	Hestia.run();
};

/* Pay attention to your charge!
var paused = false;
window.addEventListener('focus', function(event) {
    if (paused) {
        Hestia.run();
    }
});
window.addEventListener('blur', function(event){
    paused = true;
    Hestia.stop();
});*/


// Text Box 'class'
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
				Hestia.drawText(lines[i], x+padding + indent, y + padding + (spacing + charHeight)*i, c);
				
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
		textBox.dirty = true;
		return textBox;
	};

	return { create: create };
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
            Hestia.drawRect(this.x, this.y, this.width + 2 * this.borderSize, this.height + 2 * this.borderSize, this.borderColor);
            if (this.value > 0) {
                Hestia.fillRect(this.x + this.borderSize, this.y + this.borderSize, Math.floor(this.value * this.width), this.height, this.barColor);
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
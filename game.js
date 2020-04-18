var actionsBox;
var currentReaction;
var uiElements = [];
var creature;

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
        { "id": "play", "growth": 5, "value": 50 },
        { "id": "food", "growth": 1, "value": 10 }
    ],
    emotions: [
        { "id": "cheer", "value": 0 },
        { "id": "hunger", "value": 10 }
    ],
    // TODO: Emotion -> mood state mapping
    update: function(creature) {
        // How to turn needs into moods
        if (creature.needs["food"].value > 50) {
            creature.changeEmotion("cheer", -2);
            creature.changeEmotion("hunger", 5);
        }
        if (creature.needs["play"].value > 80) {
            creature.changeEmotion("cheer",-2);
        } else if (creature.needs["play"].value > 50) {
            creature.changeEmotion("cheer", -1);
        }
    },
    responses: function(creature, action) {
        let desc = "";
        switch(action.name) {
            case "feed":
                creature.changeNeed("food", -50);
                desc = "Space kitty devours the food"; // TODO: dependent on hunger levels
                break;
            case "play":
                creature.changeNeed("play", -25);
                creature.changeEmotion("cheer", 20);
                desc = "Space kitty is amused"; // TODO: dependent on anger / plafulness
                break;
            default:
                desc = "Space kitty stares at you";
                break;
        }
        return desc;
    },
    draw: function(creature) {
        // Sprite please
        Hestia.fillRect((160/2) - 16, (144/2)-32, 32, 32, 1);
    }
};

var actions = [{
    name: "feed",
    description: "Feed"
    /* TODO: Options */
}, {
    name: "play",
    description: "Play"
    /* TODO: Options */
}];

var reactionTimeoutId = -1;
var setCurrentReaction = function(message, duration) {
    currentReaction = message;
    if (reactionTimeoutId >= 0) {
        window.clearTimeout(reactionTimeoutId);
    }
    reactionTimeoutId = window.setTimeout(function(){ currentReaction = ""; reactionTimeoutId = -1; }, duration * 1000);
};

var init = function() {
    actionsBox = TextBox.create(16, 144 - 24, [actions[0].description, actions[1].description], 0, 3, true, [ function(){
        setCurrentReaction(creature.interact(actions[0]), 2);
    }, function() {
        setCurrentReaction(creature.interact(actions[1]), 2);
    }]);
    actionsBox.index = uiElements.length;
    actionsBox.active = true;
    uiElements.push(actionsBox);
    creature = Creature.create(kittyDef);
    
    // Debug Bars
    let needBars = [];
    for (let i = 0, l = kittyDef.needs.length; i < l; i++) {
        let need = kittyDef.needs[i];
        needBars[i] = ProgressBar.create({ x: 1, y: 1 + i * 4 , width: 64, height: 1, valueDelegate: createNeedValueDelegate(need.id) });
        needBars[i].label = need.id;
        needBars[i].active = true;
        uiElements.push(needBars[i]);
    }
    let emotionBars = [];
    for (let i = 0, l = kittyDef.emotions.length; i < l; i++) {
        let emotion = kittyDef.emotions[i];
        emotionBars[i] = ProgressBar.create({ x: 1, y: 3 + (i + needBars.length) * 4 , width: 64, height: 1, valueDelegate: createEmotionValueDelegate(emotion.id) })
        emotionBars[i].label = emotion.id;
        emotionBars[i].active = true;
        uiElements.push(emotionBars[i]);
    }
};

var createNeedValueDelegate = function(needId) {
    return function() { return creature.needs[needId].value / 100; };
}
var createEmotionValueDelegate = function(emotionId) {
    return function() { return (creature.emotions[emotionId].value + 50) / 100; };
};

var journeyTick = 0, creatureUpdateRate = 30;
var update = function() {
    journeyTick += 1;
    if (journeyTick % creatureUpdateRate === 0) {
        console.log("Creature update!");
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
        Hestia.drawText(currentReaction, 32, 144-32, 1);
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
	    "alphabet":  "ABCDEFGHIJKLMNOPQRSTUVabcdefghijklmnopqrstuvWXYZ0123456789_.,!?:; wxyz()[]{}'\"/\\|=-+*<>"
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
			this.w = this.calculateMinWidth();
			this.h = this.calculateMinHeight();
		},
		calculateMinWidth: function() {
			var indent = 0;
			if (this.select) {
				indent = 3;
			}
			var maxWidth = 0;
			for(var i = 0; i < this.lines.length; i++) {
				if (this.lines[i].length > maxWidth) {
					maxWidth = this.lines[i].length;
				}
			}			
			return this.charWidth * maxWidth + 2 * this.padding + indent;
		},
		calculateMinHeight: function() {
			return 2 * this.padding + this.lines.length*(this.charHeight+this.spacing) - (this.spacing+1);
		}
	};

	// Could probably take parameters object as it's a create
	var create = function(x, y, lines, color, bgColor, select, actions, cancelAction) {
		var textBox = Object.create(proto);
		textBox.x = x;
		textBox.y = y;
		textBox.lines = lines;
		textBox.color = color;
		textBox.bgColor = bgColor;
		textBox.select = select;
		textBox.recalculateDimensions();
		textBox.actions = actions;
		textBox.cancelAction = cancelAction;
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
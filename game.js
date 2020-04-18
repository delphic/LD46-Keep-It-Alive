var testBox;

var init = function() {
    testBox = TextBox.create(32, 32, ["ABCDEFGHIJKLM ", "NOPQRSTUVWXYZ_", "abcdefghijklm", "nopqrstuvwxyz"], 0, 3);
};

var update = function() {
    testBox.update();
};

var draw = function() {
	Hestia.clear(3);
	testBox.draw();
	//drawPalette(0,0,1);
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
					var py = y + padding + (charHeight + spacing) * i + 2;
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
				// TODO: Need a callback for selecting an option with a button!
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
	var create = function(x, y, lines, color, bgColor, select) {
		var textBox = Object.create(proto);
		textBox.x = x;
		textBox.y = y;
		textBox.lines = lines;
		textBox.color = color;
		textBox.bgColor = bgColor;
		textBox.select = select;
		textBox.recalculateDimensions();
		return textBox;
	};

	return { create: create };
})();
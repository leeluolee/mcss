/*
 * color.js
 * Version 0.2.1.2
 *
 * 2009-09-12
 * 
 * By Eli Grey, http://eligrey.com
 * Licensed under the X11/MIT License
 *   See LICENSE.md
 */

/*jslint undef: true, nomen: true, eqeqeq: true, regexp: true, strict: true, newcap: true, immed: true */

/*! @source http://purl.eligrey.com/github/color.js/blob/master/color.js*/

"use strict";

var Color = module.exports = (function () {
    var
    str   = "string",
    Color = function Color(r, g, b, a) {
        var
        color    = this,
        args     = arguments.length,
        parseHex = function (h) {
            return parseInt(h, 16);
        };
        
        if (args < 3) { // called as Color(color [, alpha])
            if (typeof r === str) {
                r = r.substr(r.indexOf("#") + 1);
                var threeDigits = r.length === 3;
                r = parseHex(r);
                threeDigits &&
                    (r = (((r & 0xF00) * 0x1100) | ((r & 0xF0) * 0x110) | ((r & 0xF) * 0x11)));
            }
            
            args === 2 && // alpha specifed
                (a = g);
            
            g = (r & 0xFF00) / 0x100;
            b =  r & 0xFF;
            r =  r >>> 0x10;
        }
        
        if (!(color instanceof Color)) {
            return new Color(r, g, b, a);
        }
        
        this.channels = [
            typeof r === str && parseHex(r) || r,
            typeof g === str && parseHex(g) || g,
            typeof b === str && parseHex(b) || b,
            (typeof a !== str && typeof a !== "number") && 1 ||
                typeof a === str && parseFloat(a) || a
        ];
    },
    proto       = Color.prototype,
    undef       = "undefined",
    lowerCase   = "toLowerCase",
    math        = Math,
    colorDict;
    
    // RGB to HSL and HSL to RGB code from
    // http://www.mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
    
    Color.RGBtoHSL = function (rgb) {
        // in JS 1.7 use: var [r, g, b] = rgb;
        var r = rgb[0],
            g = rgb[1],
            b = rgb[2];
        
        r /= 255;
        g /= 255;
        b /= 255;
        
        var max = math.max(r, g, b),
            min = math.min(r, g, b),
        h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, l];

    };
    
    Color.HSLtoRGB = function (hsl) {
        // in JS 1.7 use: var [h, s, l] = hsl;
        var h = hsl[0],
            s = hsl[1],
            l = hsl[2],
        
        r, g, b,
        
        hue2rgb = function (p, q, t){
            if (t < 0) {
                t += 1;
            }
            if (t > 1) {
                t -= 1;
            }
            if (t < 1/6) {
                return p + (q - p) * 6 * t;
            }
            if (t < 1/2) {
                return q;
            }
            if (t < 2/3) {
                return p + (q - p) * (2/3 - t) * 6;
            }
            return p;
        };
        
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            var
            q = l < 0.5 ? l * (1 + s) : l + s - l * s,
            p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r * 0xFF, g * 0xFF, b * 0xFF];
    };
    
    Color.rgb = function (r, g, b, a) {
        return new Color(r, g, b, typeof a !== undef ? a : 1);
    };
    
    Color.hsl = function (h, s, l, a) {
        var rgb = Color.HSLtoRGB([h, s, l]),
           ceil = math.ceil;
        return new Color(ceil(rgb[0]), ceil(rgb[1]), ceil(rgb[2]), typeof a !== undef ? a : 1);
    };
    
    Color.TO_STRING_METHOD = "hexTriplet"; // default toString method used
    
    Color.parse = function (color) {
        color = color.replace(/^\s+/g, "") // trim leading whitespace
            [lowerCase]();
        
        if (color[0] === "#") {
            return new Color(color);
        }
        
        var cssFn = color.substr(0, 3), i;
        
        color = color.replace(/[^\d,.]/g, "").split(",");
        i     = color.length;
        
        while (i--) {
            color[i] = color[i] && parseFloat(color[i]) || 0;
        }
        
        switch (cssFn) {
            case "rgb": // handle rgb[a](red, green, blue [, alpha])
                return Color.rgb.apply(Color, color); // no need to break;
            case "hsl": // handle hsl[a](hue, saturation, lightness [, alpha])
                color[0] /= 360;
                color[1] /= 100;
                color[2] /= 100;
                return Color.hsl.apply(Color, color);
        }
        
        return null;
    };
    
    (Color.clearColors = function () {
        colorDict = Color.prototype = {
            transparent: [0, 0, 0, 0]
        };
    })();
    
    Color.define = function (color, rgb) {
        colorDict[color[lowerCase]()] = rgb;
    };
    
    Color.get = function (color) {
        color = color[lowerCase]();
        
        if (Object.prototype.hasOwnProperty.call(colorDict, color)) {
            return Color.apply(null, [].concat(colorDict[color]));
        }
        
        return null;
    };
    
    Color.del = function (color) {
        return delete colorDict[color[lowerCase]()];
    };
    
    Color.random = function (rangeStart, rangeEnd) {
        typeof rangeStart === str &&
            (rangeStart = Color.get(rangeStart)) &&
            (rangeStart = rangeStart.getValue());
        typeof rangeEnd === str &&
            (rangeEnd = Color.get(rangeEnd)) &&
            (rangeEnd = rangeEnd.getValue());
        
        var floor = math.floor,
           random = math.random;
        
        rangeEnd = (rangeEnd || 0xFFFFFF) + 1;
        if (!isNaN(rangeStart)) {
            return new Color(floor((random() * (rangeEnd - rangeStart)) + rangeStart));
        }
        // random color from #000000 to #FFFFFF
        return new Color(floor(random() * rangeEnd));
    };
    
    proto.toString = function () {
        return this[Color.TO_STRING_METHOD]();
    };
    
    proto.valueOf = proto.getValue = function () {
        var channels = this.channels;
        return (
            (channels[0] * 0x10000) |
            (channels[1] * 0x100  ) |
             channels[2]
        );
    };
    
    proto.setValue = function (value) {
        this.channels.splice(
            0, 3,
            
            value >>> 0x10,
            (value & 0xFF00) / 0x100,
            value & 0xFF
        );
    };
    
    proto.hexTriplet = ("01".substr(-1) === "1" ?
    // pad 6 zeros to the left
        function () {
            return "#" + ("00000" + this.getValue().toString(16)).substr(-6);
        }
    : // IE doesn't support substr with negative numbers
        function () {
            var str = this.getValue().toString(16);
            return "#" + (new Array( str.length < 6 ? 6 - str.length + 1 : 0)).join("0") + str;
        }
    );
    
    proto.css = function () {
        var color = this;
        return color.channels[3] === 1 ? color.hexTriplet() : color.rgba();
    };
    
    // TODO: make the following functions less redundant
    
    proto.rgbData = function () {
        return this.channels.slice(0, 3);
    };
    
    proto.hslData = function () {
        return Color.RGBtoHSL(this.rgbData());
    };
    
    proto.rgb = function () {
        return "rgb(" + this.rgbData().join(",") + ")";
    };
    
    proto.rgba = function () {
        return "rgba(" + this.channels.join(",") + ")";
    };
    
    proto.hsl = function () {
        var hsl = this.hslData();
        return "hsl(" + hsl[0] * 360 + "," + (hsl[1] * 100) + "%," + (hsl[2] * 100) + "%)";
    };
    
    proto.hsla = function () {
        var hsl = this.hslData();
        return "hsla(" + hsl[0] * 360 + "," + (hsl[1] * 100) + "%," + (hsl[2] * 100) + "%," + this.channels[3] + ")";
    };
    
    return Color;
}());
/*
 * color.js CSS Module
 * 
 * By Eli Grey, http://eligrey.com
 * Licensed under the X11/MIT License
 *   See LICENSE.md
 */

/*jslint white: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, strict: true, newcap: true, immed: true */

/*global Color */

/*! @source http://purl.eligrey.com/github/color.js/blob/master/css.color.js*/

"use strict";

(function () {
    var cssColors = {
        aliceblue: 0xF0F8FF,
        antiquewhite: 0xFAEBD7,
        aqua: 0x00FFFF,
        aquamarine: 0x7FFFD4,
        azure: 0xF0FFFF,
        beige: 0xF5F5DC,
        bisque: 0xFFE4C4,
        black: 0x000000,
        blanchedalmond: 0xFFEBCD,
        blue: 0x0000FF,
        blueviolet: 0x8A2BE2,
        brown: 0xA52A2A,
        burlywood: 0xDEB887,
        cadetblue: 0x5F9EA0,
        chartreuse: 0x7FFF00,
        chocolate: 0xD2691E,
        coral: 0xFF7F50,
        cornflowerblue: 0x6495ED,
        cornsilk: 0xFFF8DC,
        crimson: 0xDC143C,
        cyan: 0x00FFFF,
        darkblue: 0x00008B,
        darkcyan: 0x008B8B,
        darkgoldenrod: 0xB8860B,
        darkgray: 0xA9A9A9,
        darkgrey: 0xA9A9A9,
        darkgreen: 0x006400,
        darkkhaki: 0xBDB76B,
        darkmagenta: 0x8B008B,
        darkolivegreen: 0x556B2F,
        darkorange: 0xFF8C00,
        darkorchid: 0x9932CC,
        darkred: 0x8B0000,
        darksalmon: 0xE9967A,
        darkseagreen: 0x8FBC8F,
        darkslateblue: 0x483D8B,
        darkslategray: 0x2F4F4F,
        darkslategrey: 0x2F4F4F,
        darkturquoise: 0x00CED1,
        darkviolet: 0x9400D3,
        deeppink: 0xFF1493,
        deepskyblue: 0x00BFFF,
        dimgray: 0x696969,
        dimgrey: 0x696969,
        dodgerblue: 0x1E90FF,
        firebrick: 0xB22222,
        floralwhite: 0xFFFAF0,
        forestgreen: 0x228B22,
        fuchsia: 0xFF00FF,
        gainsboro: 0xDCDCDC,
        ghostwhite: 0xF8F8FF,
        gold: 0xFFD700,
        goldenrod: 0xDAA520,
        gray: 0x808080,
        grey: 0x808080,
        green: 0x008000,
        greenyellow: 0xADFF2F,
        honeydew: 0xF0FFF0,
        hotpink: 0xFF69B4,
        indianred: 0xCD5C5C,
        indigo: 0x4B0082,
        ivory: 0xFFFFF0,
        khaki: 0xF0E68C,
        lavender: 0xE6E6FA,
        lavenderblush: 0xFFF0F5,
        lawngreen: 0x7CFC00,
        lemonchiffon: 0xFFFACD,
        lightblue: 0xADD8E6,
        lightcoral: 0xF08080,
        lightcyan: 0xE0FFFF,
        lightgoldenrodyellow: 0xFAFAD2,
        lightgray: 0xD3D3D3,
        lightgrey: 0xD3D3D3,
        lightgreen: 0x90EE90,
        lightpink: 0xFFB6C1,
        lightsalmon: 0xFFA07A,
        lightseagreen: 0x20B2AA,
        lightskyblue: 0x87CEFA,
        lightslategray: 0x778899,
        lightslategrey: 0x778899,
        lightsteelblue: 0xB0C4DE,
        lightyellow: 0xFFFFE0,
        lime: 0x00FF00,
        limegreen: 0x32CD32,
        linen: 0xFAF0E6,
        magenta: 0xFF00FF,
        maroon: 0x800000,
        mediumaquamarine: 0x66CDAA,
        mediumblue: 0x0000CD,
        mediumorchid: 0xBA55D3,
        mediumpurple: 0x9370D8,
        mediumseagreen: 0x3CB371,
        mediumslateblue: 0x7B68EE,
        mediumspringgreen: 0x00FA9A,
        mediumturquoise: 0x48D1CC,
        mediumvioletred: 0xC71585,
        midnightblue: 0x191970,
        mintcream: 0xF5FFFA,
        mistyrose: 0xFFE4E1,
        moccasin: 0xFFE4B5,
        navajowhite: 0xFFDEAD,
        navy: 0x000080,
        oldlace: 0xFDF5E6,
        olive: 0x808000,
        olivedrab: 0x6B8E23,
        orange: 0xFFA500,
        orangered: 0xFF4500,
        orchid: 0xDA70D6,
        palegoldenrod: 0xEEE8AA,
        palegreen: 0x98FB98,
        paleturquoise: 0xAFEEEE,
        palevioletred: 0xD87093,
        papayawhip: 0xFFEFD5,
        peachpuff: 0xFFDAB9,
        peru: 0xCD853F,
        pink: 0xFFC0CB,
        plum: 0xDDA0DD,
        powderblue: 0xB0E0E6,
        purple: 0x800080,
        red: 0xFF0000,
        rosybrown: 0xBC8F8F,
        royalblue: 0x4169E1,
        saddlebrown: 0x8B4513,
        salmon: 0xFA8072,
        sandybrown: 0xF4A460,
        seagreen: 0x2E8B57,
        seashell: 0xFFF5EE,
        sienna: 0xA0522D,
        silver: 0xC0C0C0,
        skyblue: 0x87CEEB,
        slateblue: 0x6A5ACD,
        slategray: 0x708090,
        slategrey: 0x708090,
        snow: 0xFFFAFA,
        springgreen: 0x00FF7F,
        steelblue: 0x4682B4,
        tan: 0xD2B48C,
        teal: 0x008080,
        thistle: 0xD8BFD8,
        tomato: 0xFF6347,
        turquoise: 0x40E0D0,
        violet: 0xEE82EE,
        wheat: 0xF5DEB3,
        white: 0xFFFFFF,
        whitesmoke: 0xF5F5F5,
        yellow: 0xFFFF00,
        yellowgreen: 0x9ACD32
    },
    color;
    
    for (color in cssColors) {
        if (cssColors.hasOwnProperty(color)) {
            Color.define(color, cssColors[color]);
        }
    }
}());

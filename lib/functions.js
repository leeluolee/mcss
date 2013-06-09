/**
 * @TODO: percent -> float number
 */
/**
 * cli
 */
var tree = require('./node');
var u = require('./helper/util');
var tk = require('./tokenizer');





var _ = module.exports = {
    // Color:
    // -------------------------

    // /**
    //  * lighten the color
    //  * @param  {tree.RGBA} rgba    
    //  * @param  {DIMENSION} percent unit=== '%'
    //  * @return {RGBA}         修改后的色
    //  */
    // lighten: function(rgba, percent){
    //     if(!percent || percent.unit !== '%'){
    //         this.error('the 2rd argument must be a percent like "10%"')
    //     }
    //     var chs = rgba.channels;
    //     var rate = 1 + percent.value/100
    //     var channels = fixChannels([chs[0]*rate, chs[1] * rate, chs[2]*rate, chs[3]])
    //     return new tree.RGBA(channels);
    // }.__accept(['RGBA', 'DIMENSION']),
    // /**
    //  * darken the color
    //  * @param  {tree.RGBA} rgba    
    //  * @param  {DIMENSION} percent unit=== '%'
    //  * @return {RGBA}         修改后的色
    //  */
    // darken: function(rgba, percent){
    //     if(!percent || percent.unit !== '%'){
    //         this.error('the 2rd argument must be a percent like "10%"')
    //     }
    //     var chs = rgba.channels;
    //     var rate = 1 + percent.value/100
    //     var channels = fixChannels([chs[0]*rate, chs[1] * rate, chs[2]*rate, chs[3]])
    //     return new tree.RGBA(channels);
    // }.__accept(['RGBA', 'DIMENSION']),
    // red: function(rgba){
    //     return rgba.channels[0];
    // }.__accept(['RGBA']),
    // green: function(rgba){
    //     return rgba.channels[1];
    // }.__accept(['RGBA']),
    // blue: function(rgba){
    //     return rgba.channels[2];
    // }.__accept(['RGBA']),
    // // alpha: function(rgba){
    // //     return rgba.channels[3]
    // // }.__accept(['RGBA']),
    // // @TODO

    rgba: function(r, g, b, a){
        if(r.type === 'color'){
            return new(tree.Color)(r, g && g.value);
        }else{
            return new(tree.Color)([r.value, g.value, b.value], a && a.value);
        }
    }.__accept(['DIMENSION color','DIMENSION','DIMENSION','DIMENSION']),
    rgb: function(){
        return _.rgba.apply(this, arguments);
    },
    hsla: function(h, s, l, a){
        return Color.hsl([h.value, s.value, l.value], a && a.value);
    }.__accept(['DIMENSION', 'DIMENSION', 'DIMENSION', 'DIMENSION']),
    hsl: function(){
        return _.hsla.apply(this.arguments);
    },
    mix: function(){

    }.__accept(['color', 'color']),
    /**
     * Math relative
     * ==============================
     */
    // @TODO:
    abs: function(d){

    }.__accept(['DIMENSION']),
    floor: function(d){

    }.__accept(['DIMENSION']),
    round: function(d){

    }.__accept(['DIMENSION']),
    ceil: function(d){

    }.__accept(['DIMENSION']),
    max: function(d1, d2){

    }.__accept(['DIMENSION']),
    min: function(d1, d2){

    },
    typeof: function(node){
        return node.type.toLowerCase();
    },

    /**
     * Other build in function
     * ============================
     */

    /**
     * uquote
     * @return {[type]} [description]
     */
    u: function(str){
        return {
            type: 'STRING',
            value: str.value,
            lineno: str.lineno
        }
    }.__accept(['STRING']),

    /**
     * get the argument with the index *only work in function block *
     * @param  {Dimension} number the arg's number
     * @return {Any Value} the argument
     * @example
     * ```
     * args(0) --> got the first arguments
     * ```
     */
    args: function(number){
        var arguments = this.resolve('$arguments'),arg;
        if(!arguments){
            throw Error('the args() must be called in function block');
        }
        if(!number || number.type !== 'DIMENSION'){
            throw Error('invalid arguments passed to args()');
        }
        if(arg = arguments.list[number.value]){
            return arg;
        }else{
            return {type : 'NULL'}
        }
    }
}

// Color
// ========================================
_['-adjust'] = function(color, prop, weight, absolute){
    var p = prop.value, key = channelsMap[p];
    var isAbsolute = tree.toBoolean(absolute);
    if(isRGBA(p)){
        if(!weight) return color[key];
        if(p === 'a' && weight.unit === '%') {
            weight.unit = null;
            weight.value /= 100;
        }
        if(weight.unit) this.error('rgba adjust only accpet NUMBER');
        var clone = color.clone();
        if(isAbsolute){
            clone[key] = weight.value;
        }else{
            clone[key] += weight.value;
        }
        
        return clone;
    }
    if(isHSL(p)){
        var hsl = color.toHSL();
        if(!weight){
            switch(p){
                case 'saturation':
                case 'lightness':
                    return {
                        type: 'DIMENSION',
                        value:hsl[key],
                        unit: '%'
                    } 
            }
            return hsl[key];
        }
        if(isAbsolute){
            hsl[key] = weight.value;
        }else{
            hsl[key] += weight.value;
        }
        return Color.hsl(hsl, color.alpha);
    }
    this.error('invalid adjust property ' + p + " " +color.lineno);
}.__accept(['color', 'STRING', 'DIMENSION'])

var RGBA_STR = "red green blue alpha";
var HSL_STR = "hue saturation lightness";
var isRGBA = u.makePredicate(RGBA_STR);
var isHSL = u.makePredicate(HSL_STR);

var channelsMap = {
    // channels index pos ops
    'hue': 0,
    'saturation': 1,
    'lightness': 2,
    'red': 0,
    'green': 1,
    'blue': 2,
    'alpha': 'alpha'
}

;(RGBA_STR + " " + HSL_STR).split(' ').forEach(function(name){
    var text = tk.createToken('STRING', name);
    _[name.charAt(0)+'-adjust'] = _[name] = function(color, amount, absolute){
        return _['-adjust'].call(this, color, text, amount, absolute);
    }
})
// conflict with alpha()
delete _.alpha;






/**
 * base 64 related
 * @type {Object}
 */
var mediatypes = {
    '.eot'       : 'application/vnd.ms-fontobject',
    '.gif'       : 'image/gif',
    '.ico'       : 'image/vnd.microsoft.icon',
    '.jpg'       : 'image/jpeg',
    '.jpeg'      : 'image/jpeg',
    '.otf'       : 'application/x-font-opentype',
    '.png'       : 'image/png',
    '.svg'       : 'image/svg+xml',
    '.ttf'       : 'application/x-font-ttf',
    '.webp'      : 'image/webp',
    '.woff'      : 'application/x-font-woff'
}


function converToBase64(imagePath){
    imagePath = imagePath.replace(/[?#].*/g, '');
    var extname = path.extname(imagePath),
        stat, img;
    try{
        stat = fs.statSync(imagePath)
        if(stat.size > 4096){
            return false
        }
        img = fs.readFileSync(imagePath, 'base64');
        return 'data:' + mediatypes[extname] + ';base64,' + img
    }catch(e){
        return false; 
    }
}
var fixColor = function(number){
    return number > 255? 255: 
        number < 0 ? 0 : number;
}

var fixChannels = function(channels){
    channels[0] = fixColor(channels[0]);
    channels[1] = fixColor(channels[1]);
    channels[2] = fixColor(channels[2]);
    return channels;
}

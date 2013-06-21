/**
 * @TODO: percent -> float number
 */
/**
 * cli
 */
var fs = require('fs');
var path = require('path');
var tree = require('./node');
var u = require('./helper/util');
var tk = require('./tokenizer');
var Color = tree.Color;





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
            return new Color(r, g && g.value);
        }else{
            return new Color([r.value, g.value, b.value], a && a.value);
        }
    }.__accept(['DIMENSION color','DIMENSION','DIMENSION','DIMENSION']),
    rgb: function(){
        return _.rgba.apply(this, arguments);
    },
    hsla: function(h, s, l, a){
        if(arguments.length < 3) this.error('hsla need at least 3 arguments got:' + arguments.length);
        if(s.unit !== '%' || l.unit !== '%') this.error('hsl param saturation and light all only accpet percent');
        if(a && a.unit === '%') a.value /= 100; 
        return Color.hsl([h.value, s.value, l.value], a && a.value);
    }.__accept(['DIMENSION', 'DIMENSION', 'DIMENSION', 'DIMENSION']),
    hsl: function(){
        return _.hsla.apply(this, arguments);
    },
    mix: function(){

    }.__accept(['color', 'color']),
    /**
     * Math relative
     * ==============================
     */

    /**
     * return node's type
     * @param  {Node} node 
     * @return {String}  nodeType
     */
    typeof: function(node){
        return node.type.toLowerCase();
    },

    js: function(string){
        try{
            return eval('(' + string.value + ')');
        }catch(e){
            this.error(e.message);
        }
    }.__accept(['STRING']),

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
            type: 'TEXT',
            value: str.value,
            lineno: str.lineno
        }
    }.__accept(['STRING']),
    // 连接list中的多个部分 类似Array.join
    join: function(list, separator){
        separator = separator? separator.value : '-'
        return tree.token('TEXT', list.list.map(tree.toStr).join(separator), list.lineno);
    }.__accept(['valueslist values', 'TEXT STRING']),

    // to TEXT
    t: function(node){
        var text = tree.toStr(node);
        if(text == null) text = '';
        return tree.token('TEXT', text, node.lineno);
    },
    // throw the error;
    //  @if arg == 1{
    //      error('can not be 1');
    //  }
    error: function(message){
        this.error(message.value);
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
    index: function(list, index){
        var elem;
        if(!index || index.type !== 'DIMENSION'){
            this.error('invalid param:index passed to args()');
        }
        if(elem = list.list[index.value]){
            return elem;
        }else{
            return tree.null()
        }
    }.__accept(['valueslist values','DIMENSION']),
    /**
     * get the specify index arguments
     * @param  {DIMENSION} index 
     * @return {Mix}       
     */
    args: function(index){
        var args = this.resolve('$arguments');
        if(!args){
            this.error('the args() must be called in function block');
        }
        return _.index.call(this, args, index);
    },
    len: function(list){
        return tree.token('DIMENSION', list.list.length, list.lineno);
    }.__accept(['values valueslist']),
    /**
     * image related
     */
    'data-uri': function(string){
        var value = string.value,
            url =  {type:'URL', value: value};

        if(!fs) return url;
        else{
            var fullname = path.resolve(path.dirname(this.get('filename')), value);
            var base64 = converToBase64(fullname)
            if(!base64) return url;
            url.value = base64;
            return url;
        }

    }.__accept(['STRING'])

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
        Color.limit(clone);
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
                        value: hsl[key],
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
_.fade = _.alpha;
delete _.alpha;



// math realted


['floor', 'ceil', 'round', 'abs', 'max', 'min'].forEach(function(name){
    _[name] = function(d){
        if(arguments.length < 1) this.error('at least pass one argument')
        var clone = tree.cloneNode(d);
        var args = u.slice(arguments).map(function(item){
            return item.value
        });    
        clone.value = Math[name].apply(Math, args);
        return clone;
    }.__accept(['DIMENSION']);
})




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
        if(stat.size > 1024 * 6){// ignore 6k 
            return false
        }
        img = fs.readFileSync(imagePath, 'base64');
        return 'data:' + mediatypes[extname] + ';base64,' + img
    }catch(e){
        return false; 
    }
}

    // abs: function(d){
    //     if(arguments.length < 1) this.error('at least pass one argument')
    //     var clone = d.clone();
    //     clone.value = Math.abs(d.value);
    //     return value;
    // }.__accept(['DIMENSION']),
    // floor: function(d){
    //     if(arguments.length < 1) this.error('at least pass one argument')
    //     var clone = d.clone();
    //     clone.value = Math.abs(d.value);
    //     return value;
    // }.__accept(['DIMENSION']),
    // round: function(d){
    //     if(arguments.length < 1) this.error('at least pass one argument')
    //     var clone = d.clone();
    //     clone.value = Math.abs(d.value);
    //     return value;
    // }.__accept(['DIMENSION']),
    // ceil: function(d){
    //     if(arguments.length < 1) this.error('at least pass one argument')
    //     var clone = d.clone();
    //     clone.value = Math.abs(d.value);
    //     return value;
    // }.__accept(['DIMENSION']),
    // max: function(d1, d2){
    //     if(arguments.length < 1) this.error('at least pass one argument')
    //     var clone = d1.clone();
    //     var args = u.slice(arguments).map(function(value){
    //         return item.value
    //     });    
    //     clone.value = Math.max.apply(Math, args);
    //     return clone;
    // }.__accept(['DIMENSION']),
    // min: function(d1, d2){
    //     if(arguments.length < 1) this.error('at least pass one argument')

    // },

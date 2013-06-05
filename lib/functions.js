/**
 * cli
 */
var tree = require('./node');
var u = require('./helper/util');





var _ = module.exports = {
    // Color:
    // -------------------------

    /**
     * lighten the color
     * @param  {tree.RGBA} rgba    
     * @param  {DIMENSION} percent unit=== '%'
     * @return {RGBA}         修改后的色
     */
    lighten: function(rgba, percent){
        if(!percent || percent.unit !== '%'){
            this.error('the 2rd argument must be a percent like "10%"')
        }
        var chs = rgba.channels;
        var rate = 1 + percent.value/100
        var channels = fixChannels([chs[0]*rate, chs[1] * rate, chs[2]*rate, chs[3]])
        return new tree.RGBA(channels);
    }.__accept(['RGBA', 'DIMENSION']),
    /**
     * darken the color
     * @param  {tree.RGBA} rgba    
     * @param  {DIMENSION} percent unit=== '%'
     * @return {RGBA}         修改后的色
     */
    darken: function(rgba, percent){
        if(!percent || percent.unit !== '%'){
            this.error('the 2rd argument must be a percent like "10%"')
        }
        var chs = rgba.channels;
        var rate = 1 + percent.value/100
        var channels = fixChannels([chs[0]*rate, chs[1] * rate, chs[2]*rate, chs[3]])
        return new tree.RGBA(channels);
    }.__accept(['RGBA', 'DIMENSION']),
    red: function(rgba){
        return rgba.channels[0];
    }.__accept(['RGBA']),
    green: function(rgba){
        return rgba.channels[1];
    }.__accept(['RGBA']),
    blue: function(rgba){
        return rgba.channels[2];
    }.__accept(['RGBA']),
    // alpha: function(rgba){
    //     return rgba.channels[3]
    // }.__accept(['RGBA']),
    // @TODO
    rgba: function(r, g, b, a){

    }.__accept(['RGBA']),
    rgb: function(){
        return _.rgba.apply(this, arguments);
    },
    hsla: function(){

    }.__accept(['RGBA']),
    hsl: function(){
        return _.hsla.apply(this.arguments);
    },
    hue: function(){

    }.__accept(['RGBA']),
    saturation: function(){

    }.__accept(['RGBA']),
    lightness: function(){

    }.__accept(['RGBA']),
    /**
     * Math relative
     * ==============================
     */
    // @TODO:
    abs: function(){

    }.__accept(['DIMENSION']),
    floor: function(){

    }.__accept(['DIMENSION']),
    round: function(){

    }.__accept(['DIMENSION']),
    ceil: function(){

    }.__accept(['DIMENSION']),
    max: function(){

    }.__accept(['DIMENSION']),
    min: function(){

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

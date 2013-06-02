/**
 * cli
 */
var tree = require('./node');
var _ = require('./helper/util');


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


module.exports = {
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
    },
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
    },
    red: function(rgba){
        return rgba.channels[0];
    },
    green: function(rgba){
        return rgba.channels[1];
    },
    blue: function(rgba){
        return rgba.channels[2];
    },
    alpha: function(rgba){
        return rgba.channels[3]
    },
    /**
     * get the argument with the index *only work in function block *
     * @param  {Dimension} number the arg's number
     * @return {Any Value} the argument
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
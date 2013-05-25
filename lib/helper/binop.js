var tree = require('../node');
var _  = require('./util');
module.exports = {
    '+': function(o1, o2){
        var compos = prepare(o1, o2);
        switch(compos){
            case 'string-string':
                return {
                    type: 'string',
                    val: o1.val + o2.val
                }
            case 'string-dimension':
                return {
                    type: 'string',
                    val: o1.val + o2.toString()
                }
            case 'dimension-dimension':
                var unit = o1.unit || o2.unit;
                if(o1.unit && o2.unit && o1.unit !== o2.unit) _.warn('unmatched unit, forced 2rd unit equal with the 1st one')
                return new tree.Dimension()
        }

    },
    '-': function(o1, o2){
        
    },
    '*': function(){

    },
    '/': function(){

    },
    '==': function(){

    },
    '>=': function(){

    },
    '>': function(){

    },
    '<=': function(){

    },
    '<': function(){

    },
    '!=': function(){

    }
}

var prepare = function(o1, o2){
    var type1 = tree.inspect(o1),
        type2 = tree.inspect(o2)
    return type1 + '-' + type2
}
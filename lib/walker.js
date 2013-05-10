var _ = require('./helper/util');

var Walker = function(){

}


Walker.prototype = {
    constructor: Walker,
    walk: function(node){
        if(Array.isArray(node)){
            return this._walkArray(node);
        }else{
            return this._walk(node);
        }
    },
    walk_defaut: function(node){
        if(node.list || node.body){
            return this.walk(node.list || node.body);
        }else if(node.type && this.walk_token){
            return this.walk_token(node)
        }else{
            throw Error('no' + this._inspect(node) + ' specify node walker defined');
        }
    },
    // walk_token: function(tree){
    //     throw Error('walk_token must be realized');
    //     // _.log('walk token: ' + this._inspect(node));

    // },
    _walkArray: function(nodes){
        var self = this;
        return nodes.map(function(node){
            return self._walk(node);
        })
    },
    _walk: function(node){
        var sign = this._inspect(node);
        var name = 'walk_' + sign;
        _.log(name,'visit');
        if(this[name]) return this[name](node);
        else return this.walk_defaut(node);
    },
    // inspect token or node
    _inspect: function(node){
        return node.type? node.type.toLowerCase() : node.constructor.name.toLowerCase();
    }
}

module.exports = Walker;




var Walker = function(){

}

var _ = Walker.prototype = {
    constructor: Walker,
    visit: function(node){
        if(Array.isArray(node)){
            this.visit
        }
    },
    _visits:function(){

    },
    _inspect: function(node){
        return node.type || node.constructor.name.toLowerCase();
    },
}


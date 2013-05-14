// the latest walker for output the translate css;
// add before an after event hook;

var Walker = require('../walker');
var Event = require('../helper/Event');
var hooks = require('./hooks');


function Hook(options){
    options = options || {};
    this.load(options.hooks)
    this.indent = 0;
}

var _ = Hook.prototype = new Walker();



Event.mixTo(_);


var on = _.on;
var walk = _._walk;


_.load = function(names){
    if(!names) return;
    var name;
    if(!(names instanceof Array)){
        names = [names]
    }
    for(var i = 0, len = names.length ; i< len; i ++){
        name = names[i];
        if(typeof name === 'string'){
            this.on(hooks[name]);
        }else {
            this.on(name);
        }
    }
}

_.on = function(name){
    if(typeof name === 'string' && !~name.indexOf(':')){
        name = name + ':up';
    }
    on.apply(this, arguments);
}

_._walk = function(tree){
    var name = this._inspect(tree);
    // event hook
    if(name) this.trigger(name+':'+'down', tree);
    var res = walk.apply(this, arguments);
    if(name) this.trigger(name+':'+'up', tree);
    return res;
}

_.walk_stylesheet = function(tree){
    this.walk(tree.list);
}


_.walk_ruleset = function(tree){
    this.indent ++;
    this.walk(tree.block);
    this.indent --;
}

_.walk_selectorlist = function(tree){
    this.walk(tree.list)
}
_.walk_complexselector = function(tree){
}

_.walk_block = function(tree){
    this.walk(tree.list);
}
_.walk_componentvalues = function(tree){
    this.walk(tree.list);
}

_.walk_declaration = function(tree){
    this.walk(tree.value);
}
// componentValue
_.walk_ident = function(tree){
    return tree.val;
}


_.walk_string = function(tree){
}

_['walk_,'] = function(tree){
}
_['walk_='] = function(tree){
}


_.walk_unknown = function(tree){
    return tree.name;
}

_.walk_cssfunction =  function(tree){
}


_.walk_uri = function(tree){
}

_.walk_rgba = function(tree){
    // return tree.color.css();
}


_.walk_dimension = function(tree){
}

_.walk_variable = function(){
}






module.exports = Hook;

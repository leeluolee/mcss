var Walker = require('../walker');
var tree = require('../node');
var symtab = require('../symtab');

function Interpreter(options){};

var _ = Interpreter.prototype = new Walker();



_.interpret = function(ast){
    this.ast = ast;
    this.scope = new symtab.Scope();
    // 相当于函数调用栈
    this.istack = [];
    this.rulesets = [];
    this.walk(ast);
    // console.log(tree.cloneNode(ast));
}

_.walk_stylesheet = function(){
    var node = new tree.Stylesheet();
}

_.walk_ruleset = function(ast){
    this.walk(ast.block, ast);
}

_.walk_mixin = function(ast){
}

_.walk_variable = function(tree){
    
}

_.walk_include = function(tree){
    var mixin = this.scope.resolve(tree.name);
    if(!mixin) this.error('no ' + tree.name + 'defined');

    var includeScope = new symtab.Scope(),
        params = tree.params;
    for(var i = 0 ; i < params.length; i++){
        includeScope.define()
    }
    this.istack.push(includeScope);
    var ast = tree.clone(this.walk(mixin.block));

    this.leave();
}

_.walk_extend = function(ast){

}

_.walk_block = function(ast){
    var block = new tree.Block();
    var list = ast.list;
    var res = [], r;
    for(var i = 0, len = list.length; i < list.length ; i++){
        if(list[i] && (r = this.walk(list[i]))) res.push(r); 
    }
    return res;
}


_.walk_declaration = function(ast){

}

_.walk_declaration = function(){

}


_.invoke_include = function(){

}

_.getScope = function(id){
    var len,scope;
    if(len = this.istack.length){
        if((scope = this.istack[len - 1]) &&
            scope.resolve(id)){
            return scope
        }
    }
    if(this.scope.resolve(id)){
        return this.scope;
    }
    return null;
}

_.peekStack = function(){

}

// lexel scope down
_.down = function(){
    this.scope = new symtab.Scope(this.scope);
}

// lexel scope up
_.up = function(){

    this.scope = this.scope.getOuterScope();
}
_.concatSelector = function(selectorList){
    var ss = this.rulesets;
    if(!ss.length) return selectorList;

    var parentList = ss[ss.length - 1].selector,
        slist = selectorList.list,
        plist = parentList.list,
        slen = slist.length, 
        plen = plist.length,
        sstring, pstring, rstring,
        s, p, res;
    var res = new tree.SelectorList();
    for(p = 0; p < plen; p ++){
        pstring = plist[p].string;
        for(s = 0; s < slen; s ++) {
            sstring = slist[s].string;
            if(~sstring.indexOf('&')){
                rstring = sstring.replace(/&/g, pstring)
            }else{
                rstring = pstring + ' ' + sstring;
            }
            res.list.push(new tree.ComplexSelector(rstring));
        }
    }
    return res
}


// push function scope
_.push = function(scope){

}

// push function scope
_.leave = function(){
    this.scope = this.saveScope;
}





module.exports = Interpreter;


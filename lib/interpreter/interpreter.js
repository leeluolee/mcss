
var Walker = require('../walker');
var tree = require('../node');
var symtab = require('../symtab');
var state = require('../helper/state');
var u = require('../helper/util');
var binop = require('../helper/binop');
var functions = require('../functions');
var color = require('../helper/color');
// 可以转换为字符串的都转化为字符串

function Interpreter(options){};

var _ = Interpreter.prototype = new Walker();




state.mixTo(_);

var errors = {
    'RETURN': u.uid()
}

/**
 * start interpret the ast build from parser
 * all scope,space,selector-combine ... will operated in this step
 *
 * @param  {Node} ast [description]
 * @return {}     [description]
 */

_.ierror = new Error();

_.interpret = function(ast){
    this.ast = ast;
    this.scope = new symtab.Scope();
    // 相当于函数调用栈
    this.istack = [];
    this.rulesets = [];
    this.indent = 0;
    var res = this.walk(ast);
    return res;
}

/**
 * walk the root stylesheet ast
 * 
 * @param  {[type]} ast [description]
 * @return {[type]}     [description]
 */


_.walk_default = function(ast){
    return ast;
}

_.walk_stylesheet = function(ast){
    ast.scope = this.scope;
    var plist  = ast.list, item;
    ast.list = [];

    for(ast.index = 0; !!plist[ast.index] ; ast.index++){
        if(item = this.walk(plist[ast.index])){
            u.merge(ast.list, item)
            // if(Array.isArray(item) || item.type === 'block'){
            //     ast.list = ast.list.concat(item.list || item);
            // }else{
            //     ast.list.push(item);
            // }
        }
    }
    return ast;
}


_.walk_ruleset = function(ast){
    this.down(ast);
    var rawSelector = this.walk(ast.selector),
        values, iscope, res = [];

    if(values = ast.values){
        this.up(ast);
        for(var i =0 ,len = values.length; i < len; i++){
            iscope = new symtab.Scope();
            this.push(iscope);
            this.define('$i', {type:'DIMENSION', value: i})
            this.define('$item', values[i]);
            var block = ast.block.clone();
            var selector = new tree.SelectorList([rawSelector.list[i]]);
            var ruleset = new tree.RuleSet(selector, block)
            res.push(this.walk(ruleset));
            this.pop();
        }
    }else{
        ast.block = this.walk(ast.block);
        this.up(ast);
        ast.selector = this.concatSelector(rawSelector);
    }
    return res.length? res : ast;
}
_.walk_selectorlist = function(ast){
    var list = ast.list, 
        len = list.length,
        self = this,
        res = [];
    if(len === 1){
        this.enter('ACCEPT_LIST');
    }
    list = this.walk(list)
    if(Array.isArray(list[0])){
        list = list[0]
    }
    ast.list = list;
    this.leave('ACCEPT_LIST');
    return ast;
}


_.walk_complexselector = function(ast){
    var ruleset = this.rulesets[this.rulesets.length -1];
    var interpolations = ast.interpolations,
        i, len = interpolations.length, valuesList;
    var values = [];
    for(i = 0 ;i< len; i++){
        var value = this.walk(interpolations[i]);
        if(value.type === 'valueslist'){
            if(ruleset.values || !this.state('ACCEPT_LIST')){
                this.error('con"t has (or more) interpolations in ComplexSelector')
            }else{
                ruleset.values = value.list
                values.push(null)
            }
        }else{
            values.push(this.toStr(value));
        }
    }
    // step 2 replace static value
    ast.string = ast.string.replace(/#\{(\d+)}/g, function(all, index){
        var value = values[parseInt(index)];
        if(typeof value === 'string'){
            return value
        }else{
            return '#{interpolation}'
        }
    })
    // replace valuesList
    if(valuesList = ruleset.values){
        var res = [], toStr = this.toStr;
        for(var j = 0, jlen = valuesList.length; j< jlen;j++){
            var value = valuesList[j];
            var string = ast.string.replace(/#\{interpolation}/, function(){
                return toStr(value)
            })
            res.push(new tree.ComplexSelector(string))
        }
        return res;
    }
    return ast
}

_.walk_operator = function(ast){
    var left = this.walk(ast.left);
    var right = this.walk(ast.right);
    if(tree.isRelationOp(ast.op)){
        return binop.relation.apply(this, [left, right, ast.op]);
    }else{
        return binop[ast.op].apply(this,[left, right]);
    }
}
// _.walk_mixin = function(ast){
//     this.define(ast.name, ast);
// }
_.walk_assign = function(ast){
    if(ast.override || !this.resolve(ast.name)){
        var value = this.walk(ast.value);
        this.define(ast.name, value);
    }
    return ast.value;
}

_.walk_var = function(ast){
    var symbol = this.resolve(ast.value);
    if(symbol) return symbol;
    else this.error('undefined variable: '+ ast.value);
}

_.walk_string = function(ast){
    var self = this, symbol;
    ast.value = ast.value.replace(/#\{(\w+)}/g, function(all, name){
        if(symbol = this.resolve(name)){
            return self.toStr(symbol)
        }else{
            throw Error('not defined String interpolation')
        }
    })
    return ast;
}





_.walk_debug = function(ast){
    var value = this.walk(ast.expression); 
    console.log(tree.toStr(value));
}

_.walk_if = function(ast){
    var test = this.walk(ast.test);
    if(tree.toBoolean(test)){
        return this.walk(ast.block)
    }else{
        return this.walk(ast.alt)
    }
}

_.walk_for = function(ast){
    // ast.list is a 'valuesList'
    var list = ast.list.list,
        index = ast.index,
        element = ast.element,
        block, iscope , len, 
        iscope = new symtab.Scope(),
        res = [];

    for(var i = 0, len = list.length; i< len; i++){
        this.push(iscope);
        this.define(element, list[i]);
        if(index) this.define(index, {type: 'DIMENSION', value: i})
        block = this.walk(ast.block.clone());
        this.pop(iscope);
        res.push(block);
    }
    return res;
}

/**
 * [ description]
 * @return {[type]} [description]
 */
_.walk_call = function(ast){
    var func = this.resolve(ast.name), 
    iscope , params, args;
    if(!func || func.type !== 'func'){
        if(func = functions[ast.name]){
            return func.apply(this, ast.args);
        }else{
            if(ast.name.charAt(0) === '$') this.error('no function "'+ast.name+'" founded')
            else return ast;
        }
    }
    iscope = new symtab.Scope();
    params = func.params;
    args = this.walk(ast.args);
    this.push(iscope);
    for(var i = 0, len = params.length;  i < len; i++){
        var param = params[i],arg = args[i];
        if(param.rest){
            // the params number after index "i"
            var restNum = len - 1 - i;
            var slicelen = args.length - restNum;
            if(slicelen > i){// 你必须满足大于i
                var arg = new tree.ValuesList(args.slice(i, slicelen));
                this.define(param.name, arg);
            }
        }else{
            var value = args[i] || param.default;
            if(value) this.define(param.name, value);
        }
    }
    if(args.length){
        this.define('$arguments', new tree.ValuesList(args));
    }
    try{
        var block = this.walk(func.block.clone());
    }catch(err){
        this.pop(iscope);
        if(err.code === errors.RETURN){
            return err.value;
        }else{
            throw err;
        }
    }
    this.pop(iscope);
    return block;
}

/**
 * 返回与js一致
 * @return {[type]} [description]
 */
_.walk_return = function(ast){
    debugger;
    _.ierror.code = errors.RETURN;
    _.ierror.value = this.walk(ast.value);
    throw _.ierror;
}

_.walk_func = function(ast){
    ast.params = this.walk(ast.params);
    return ast;
}

_.walk_param = function(ast){
    if(ast.default){
        ast.default = this.walk(ast.default);
    }
    return ast;
}

/**
 * struct 结构
 * 
 * @param  {[type]} ast [description]
 * @return {[type]}     [description]
 */
_.walk_module = function(ast){
    var block = this.walk(ast.block);
}



_.walk_componentvalues = function(ast){
    var self = this;
    var list = [], tmp;
    ast.list.forEach(function(item){
        if(tmp = self.walk(item)){
            var type = self._inspect(tmp);
            if(type === 'variable'){
                list = list.concat(tmp.value.list)
            }else{
                list.push(tmp);
            }
        } 
        // 如果什么都没返回则装如原数据
        else list.push(item)
    })
    ast.list = list;
    return ast;
}

_.walk_extend = function(ast){
    this.walk(ast.selector);
}

_.walk_import = function(ast){
    
}

_.walk_media = function(ast){

}

_.walk_block = function(ast){
    var list = ast.list;
    var res = [], r;
    for(var i = 0, len = list.length; i < list.length ; i++){
        if(list[i] && (r = this.walk(list[i]))){
            u.merge(res, r)
            // if(Array.isArray(r) || r.type === 'block'){
            //     res = res.concat(r.list || r);
            // }else{
            //     res.push(r);
            // }
        }
    }
    ast.list = res;
    return ast;
}


_.walk_declaration = function(ast){
    ast.property = this.walk(ast.property);
    ast.value = this.walk(ast.value);
    return ast;
}

_.walk_compoundident = function(ast){
    var text = '', self = this;
    this.walk(ast.list).forEach(function(item){
        text += typeof item === 'string' ? item :self.walk(item).value;
    })
    return {
        type: 'TEXT',
        value: text
    }
}

_.walk_valueslist = function(ast){
    ast.list = this.walk(ast.list);
    return ast;
}

_.walk_values = function(ast){
    ast.list = this.walk(ast.list);
    return ast
}



// util function
// ===========================


// lexel scope down
_.down = function(ruleset){
    if(ruleset) this.rulesets.push(ruleset);
    this.scope = new symtab.Scope(this.scope);
}

// lexel scope up
_.up = function(ruleset){
    if(ruleset) this.rulesets.pop();
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
    this.istack.push(scope);
}

// push function scope
_.pop = function(){
    this.istack.pop()
}

_.peek = function(){
    var len;
    if(len = this.istack.length) return this.istack[len - 1];
}

_.define = function(id, symbol){
    var scope;
    if(scope = this.peek()){
        scope.define(id, symbol);
    }else{
        this.scope.define(id, symbol)
    }
}

_.resolve = function(id){
    var scope, symbol;
    if((scope = this.peek()) && (symbol =  scope.resolve(id))){
        // console.log(scope, symbol)
        return symbol;
    }
    return this.scope.resolve(id);
}

_.expect = function(ast, type){
    if(!(this._inspect(ast) === type)){
        throw Error('interpreter error! expect node: "'+ type +'" got: "' + this._inspect(ast) + '"')
    }
}

_.error = function(msg){
    throw Error(msg)
}




_.toStr = function(ast){
    switch(ast.type){
        case 'TEXT':
        case 'BOOLEAN':
        case 'NULL':
            return ast.value
        case 'DIMENSION':
            var value = ''+ast.value + (ast.unit? ast.unit : '');
            return value;
        case 'STRING':
            return this.walk(ast);
        default: 
            return ast.value;
    } 
}


module.exports = Interpreter;


/**
 * 无论多少个Parser 只有一个Interpreter 以维持一个根Context
 */


var Walker = require('../walker');
var parser = require('../parser');
var tree = require('../node');
var symtab = require('../symtab');
var state = require('../helper/state');
var promise = require('../helper/promise');
var path = require('../helper/path');
var u = require('../helper/util');
var io = require('../helper/io');
var options = require('../helper/options');
var binop = require('../helper/binop');
var functions = require('../functions');
var color = require('../node/color');
var error = require('../error');
// 可以转换为字符串的都转化为字符串

function Interpreter(options){
    this.options = options;
};

var _ = Interpreter.prototype = new Walker();




state.mixTo(_);
options.mixTo(_);


var errors = {
    'RETURN': u.uid()
}

var states = {
    'DECLARATION': u.uid()
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
    this.medias = [];
    this.indent = 0;
    return this.walk(ast);
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
    var plist  = ast.list, item;
    ast.list = [];

    for(ast.index = 0; !!plist[ast.index] ; ast.index++){
        if(item = this.walk(plist[ast.index])){
            u.merge(ast.list, item)
        }
    }
    return ast;
}

_.walk_directive = function(ast){
    ast.value = this.walk(ast.value);
    if(ast.block) ast.block = this.walk(ast.block);
    return ast;
}
_.walk_keyframes = function(ast){
    ast.name = this.walk(ast.name);
    ast.blocks = this.walk(ast.blocks);
    return ast;
}
_.walk_keyframesblock = function(ast){
    ast.step = this.walk(ast.step);
    ast.block = this.walk(ast.block);
    return ast;
}

_.walk_ruleset = function(ast){
    this.down(ast);

    var rawSelector = this.walk(ast.selector),
        values = ast.values, iscope, res = [];

    this.up(ast);
    var self = this;
    rawSelector.list.forEach(function(complex){
        self.define(complex.string, ast);
    });
    if(ast.abstract){
        rawSelector.list = [];
    }
    if(!values) ast.selector = this.concatSelector(rawSelector);
    ast.lineno = rawSelector.lineno;
    ast.filename = this.get('filename')
    if(values){
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
        this.down(ast);
        var block = this.walk(ast.block);
        this.up(ast);
        res = block.exclude();
        ast.block = block;
        if(res.length){
            res.unshift(ast);
        }
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
                this.error('con"t has more than 2 interpolations in ComplexSelector', ast)
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
}

_.walk_var = function(ast){
    var symbol = this.resolve(ast.value);
    if(symbol) return symbol;
    else this.error('Undefined variable: '+ ast.value, ast);
}

_.walk_url = function(ast){
    var self = this, symbol;
    ast.value = ast.value.replace(/#\{(\w+)}/g, function(all, name){
        if(symbol = this.resolve(name)){
            return tree.toStr(symbol)
        }else{
            this.error('Undefined ' + name + ' in interpolation', ast)
        }
    })
    return ast;
}

_.walk_unary = function(ast){
    var value = this.walk(ast.value)
    if(value.type !== 'DIMENSION'){
        this.error('Unary Value only accept DIMENSION bug got '+value.type, ast.value)
    }
    if(ast.reverse) value.value = -value.value;
    return value
}

/**
 * @todo : 修改 某些情况下并不需要得到值 
 * @param  {[type]} ast [description]
 * @return {[type]}     [description]
 */
_.walk_text = function(ast){
    var chs = color.maps[ast.value]
    if(chs){
        return new color(chs)
    }else{
        return ast;
    }
}

_.walk_string = function(ast){
    var self = this, symbol;
    ast.value = ast.value.replace(/#\{(\w+)}/g, function(all, name){
        if(symbol = this.resolve(name)){
            return tree.toStr(symbol)
        }else{
            self.error('not defined String interpolation', ast)
        }
    })
    return ast;
}


_.walk_debug = function(ast){
    ast.value = this.walk(ast.value); 
    return ast;
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
    iscope , params, args = this.walk(ast.args);;
    if(!func || func.type !== 'func'){
        if(func = functions[ast.name]){
            var value = tree.convert(func.apply(this, args));
            return value;
        }else{
            if(ast.name.charAt(0) === '$') this.error('undefined function: '+ast.name, ast)
            else return ast;
        }
    }
    iscope = new symtab.Scope();
    params = func.params;
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
        if(this.state('DECLARATION')){
            this.define('$_dada')
        }
    }
    try{
        var prev = this.scope;
        this.scope = func.scope;
        var block = this.walk(func.block.clone());
    }catch(err){
        this.scope = prev;
        this.pop(iscope);
        // means vistor the return statement
        if(err.code === errors.RETURN){
            var value = tree.convert(err.value);
            // 存在在函数作用域定义的function
            if(value.type === 'func' && iscope.resolve(value.name, true)){
                value.scope = iscope;
                iscope.parentScope = this.scope;
            }
            return value;
        }else{
            throw err;
        }
    }
    this.scope = prev;
    this.pop(iscope);
    return block;
}

/**
 * 返回与js一致
 * @return {[type]} [description]
 */
_.walk_return = function(ast){
    _.ierror.code = errors.RETURN;
    _.ierror.value = this.walk(ast.value);
    throw _.ierror;
}

_.walk_func = function(ast){
    ast.params = this.walk(ast.params);
    ast.scope = this.scope;
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



// _.walk_componentvalues = function(ast){
//     var self = this;
//     var list = [], tmp;
//     ast.list.forEach(function(item){
//         if(tmp = self.walk(item)){
//             var type = self._inspect(tmp);
//             if(type === 'variable'){
//                 list = list.concat(tmp.value.list)
//             }else{
//                 list.push(tmp);
//             }
//         } 
//         // 如果什么都没返回则装如原数据
//         else list.push(item)
//     })
//     ast.list = list;
//     return ast;
// }

_.walk_extend = function(ast){
    var ruleset = this.rulesets[this.rulesets.length-1];
    if(!ruleset) this.error('can not use @extend outside ruleset', ast);
    var selector = this.walk(ast.selector);
    var self = this;
    selector.list.forEach(function(item){
        var extend = self.resolve(item.string);
        if(extend){
            extend.addRef(ruleset);
        }
        // @MARK else prevent the error just ignored
    })
}

_.walk_import = function(ast){
    this.walk(ast.url);
    var url = ast.url;
    if(ast.stylesheet){
        var queryList = ast.queryList;
        var stylesheet = ast.stylesheet;
        // 改写成media
        if(queryList.length){
            var media = new tree.Media(queryList, stylesheet);
            return this.walk(media);
        }else{
            // @TODO
            var pre = this.get('filename');
            // 进行work时
            this.set('filename', ast.filename);
            var list = this.walk(stylesheet).list;
            list.forEach(function(){

            })
            this.set('filename', pre);
            return list;
        }
    }else{
        return ast;
    }
}

_.walk_media = function(ast){
    ast.queryList = this.walk(ast.queryList);
    this.concatMedia(ast);
    this.down(null, ast);
    this.walk(ast.stylesheet);
    this.up(null, ast);
    var res = ast.stylesheet.exclude();
    if(res.length){
        res.unshift(ast);
    }
    return res.length? res: ast;

}
_.walk_mediaquery = function(ast){
    ast.expressions = this.walk(ast.expressions);
    return ast;
}

_.walk_mediaexpression = function(ast){
    ast.feature = this.walk(ast.feature);
    ast.value = this.walk(ast.value);
    return ast
}

_.walk_block = function(ast){
    var list = ast.list;
    var res = [], r;
    for(var i = 0, len = list.length; i < list.length ; i++){
        if(list[i] && (r = this.walk(list[i]))){
            u.merge(res, r)
        }
    }
    ast.list = res;
    return ast;
}


_.walk_declaration = function(ast){
    this.enter('DECLARATION');
    ast.property = this.walk(ast.property);
    ast.value = this.walk(ast.value);
    this.leave('DECLARATION');
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
_.down = function(ruleset, media){
    if(ruleset) this.rulesets.push(ruleset);
    if(media) this.medias.push(media);
    this.scope = new symtab.Scope(this.scope);
}

// lexel scope up
_.up = function(ruleset, media){
    if(ruleset) this.rulesets.pop();
    if(media) this.medias.pop();
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

/**
 * concat nested mediaquery list
 * @param  {Media} media current visted media
 * @return {[type]}       [description]
 */
_.concatMedia = function(media){
    var ss = this.medias;
    if(!ss.length) return media;
    var slist = ss[ss.length-1].queryList,
        mlist = media.queryList,
        queryList = [];
    // index,len, mediaquery
    var s, m, slen = slist.length, mlen = mlist.length,
        mm, sm, nm;
    for(m = 0; m < mlen; m ++){
        mm = mlist[m];
        for(s = 0; s < slen; s ++) {
            sm = slist[s];
            // 1. all have mediaType then can't concat
            nm = new tree.MediaQuery()
            // @TODO 忽略无法concat的组合
            if(sm.mediaType && mm.mediaType) continue;
            nm.mediaType = sm.mediaType || mm.mediaType;
            nm.expressions = sm.expressions.concat(mm.expressions);
            queryList.push(nm);
        }
    }
    media.queryList = queryList;
    return media;
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
        if(!this.scope) debugger
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
        this.error('interpreter error! expect node: "'+ type +'" got: "' + ast.type + '"', ast)
    }
}

_.error = function(msg, ll){
    var lineno = ll.lineno || ll;
    throw new error.McssError(msg, lineno, this.options)
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


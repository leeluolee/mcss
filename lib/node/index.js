var _ = require('../helper/util'),
    splice = [].splice,
    isPrimary = _.makePredicate('hash rgba dimension string boolean text null url');


function Stylesheet(list){
    this.type = 'stylesheet';
    this.list = list || [];
}

Stylesheet.prototype.clone = function(){
    var clone = new Stylesheet();
    clone.list = cloneNode(this.list);
    return clone;
}

Stylesheet.prototype.exclude = function(){
    var res = [], 
        list = this.list,
        item;
    for(var len = list.length; len--;){
        item = list[len]
        if(item.type === 'media'){
            res.unshift(list.splice(len, 1)[0]);
        }
    }
    return res;
}


//  选择器列表
function SelectorList(list){
    this.type = 'selectorlist';
    this.list = list || [];
}

SelectorList.prototype.clone = function(){
    var clone = new SelectorList(cloneNode(this.list));
    return clone;
}
SelectorList.prototype.len = function(){
    return this.list.length;
}

// 复选择器
function ComplexSelector(string, interpolations){
    this.type = 'complexselector';
    this.string = string;
    this.interpolations = interpolations || [];
}

ComplexSelector.prototype.clone = function(){
    var clone = new ComplexSelector(this.string, cloneNode(this.interpolations));
    return clone;
}




function RuleSet(selector, block){
    this.type = 'ruleset';
    this.selector = selector;
    this.block = block;
    // @TODO for mixin
    this.ref = [];
}

RuleSet.prototype.remove = function(ruleset){
    
}
RuleSet.prototype.clone = function(){
    var clone = new RuleSet(cloneNode(this.selector), cloneNode(this.block));
    return clone;
}



function Block(list){
    this.type = 'block';
    this.list = list || [];
}

Block.prototype.clone = function(){
    var clone = new Block(cloneNode(this.list));
    return clone;
}

Block.prototype.exclude = function(){
    var res = [], 
        list = this.list,
        item;
    for(var len = list.length; len--;){
        item = list[len]
        if(item.type !== 'declaration'){
            res.unshift(list.splice(len, 1)[0]);
        }
    }
    return res;
}



function Call(name, arguments){
    this.name = name;
    this.arguments = arguments;
}

Call.prototype.clone = function(){
    var clone = new Call(this.name, cloneNode(this.arguments));
    return clone;
}

// module Node
function Declaration(property, value, important){
    this.type = 'declaration';
    this.property = property;
    this.value = value;
    this.important = important || false;
}

Declaration.prototype.clone = function(name){
    var clone = new Declaration(cloneNode(this.property), cloneNode(this.value), this.important);
    return clone;
}




// module Node
function Values(list){
    this.type = 'values';
    this.list = list || [];
}

Values.prototype.clone = function(){
    var clone = new Values(cloneNode(this.list));
    return clone;
}

// 将内容便平化
Values.prototype.flatten = function(){
    var list = this.list,
        i = list.length,
        value;
    for(;i--;){
        value = list[i];
        if(value.type = 'values'){
            splice.apply(this, [i, 1].concat(value.list));
        }
    }
}


function ValuesList(list){
    this.type = 'valueslist'
    this.list = list || [];
}
ValuesList.prototype.clone = function(){
    var clone = new ValuesList(cloneNode(this.list));
    return clone;
}
// 将内容便平化
ValuesList.prototype.flatten = function(){
    var list = this.list,
        i = list.length,
        values;
    for(;i--;){
        values = list[i];
        if(values.type = 'valueslist'){
            splice.apply(this, [i, 1].concat(values.list));
        }
    }
}

ValuesList.prototype.first = function(){
    return this.list[0].list[0]
}


// 所有侦测不出的类似统一放置在这里;
function Unknown(name){
    this.type = 'unknown';
    this.name = name;
}

Unknown.prototype.clone = function(){
    var clone = new Unknown(this.name);
    return clone;
}



function RGBA(channels){
    this.type = 'RGBA';
    if(typeof channels === 'string'){
        var string = channels.charAt(0) === '#'? channels.slice(1) : channels;
        if (string.length === 6) {
            channels = [
                parseInt(string.substr(0, 2), 16), 
                parseInt(string.substr(2, 2), 16), 
                parseInt(string.substr(4, 2), 16),
                1
            ];
        }else {
            var r = string.substr(0, 1);
            var g = string.substr(1, 1);
            var b = string.substr(2, 1);
            channels = [
                parseInt(r + r, 16), 
                parseInt(g + g, 16), 
                parseInt(b + b, 16), 
                1
            ];
        }
    }
    this.channels = channels || [];
}

RGBA.prototype.clone = function(){
    var clone = new RGBA(cloneNode(this.channels));
    return clone;
}
RGBA.prototype.tocss = function(){
    var chs = this.channels;
    if(chs[3] === 1 || chs[3] === undefined){
        return 'rgb(' + chs[0] + ',' + chs[1] + ',' + chs[2] + ')';
    }
}




// function Variable(name, value, kind){
//     this.type = 'variable';
//     // const or var
//     this.kind = kind || 'var';
//     this.name = name;
//     this.value = value || [];
// }

// Variable.prototype.clone = function(name){
//     var clone = new Variable(this.name,cloneNode(this.value), this.kind);
//     return clone;
// }

function Assign(name, value, override){
    this.type = 'assign';
    // const or var
    this.name = name;
    this.value = value;
    this.override = override === undefined ? true: override;
}

Assign.prototype.clone = function(name){
    var clone = new Assign(this.name, cloneNode(this.value), this.override);
    return clone;
}


// list is a block statement
// defaults is default params
function Func(name, params, block){
    this.type = 'func'
    this.name = name;
    this.params = params || [];
    this.block = block;
}

Func.prototype.clone = function(){
    var clone = new Func(this.name, this.params, this.block);
    return clone;
}


function Param(name, dft, rest){
    this.type = 'param'
    this.name = name;
    this.default = dft;
    this.rest = rest || false;
}

function Include(name, params){
    this.type = 'include'
    this.name = name;
    this.params = params || [];
}

Include.prototype.clone = function(){
    var clone = new Include(this.name, this.params);
    return clone;
}

// params default
function Extend(selector){
    this.type = 'extend';
    this.selector = selector;
}

Extend.prototype.clone = function(){
    var clone = new Extend(this.selector);
    return clone;
}

function Module(name, block){
    this.type = 'module';
    this.block = block;
}

Module.prototype.clone = function(){
    var clone = new Module(this.name, cloneNode(this.block));
    return clone;
}

function Pointer (name, key){
    this.type = 'pointer';
    this.name = name;
    this.key = key;
}

Pointer.prototype.clone = function(){
    var clone = new Pointer(this.name, this.key);
    return clone;
}


function Import(url, queryList){
    this.type = 'import'
    this.url = url;
    this.queryList = queryList || [];
}

Import.prototype.clone = function(){
    var clone = new Import(this.url, this.queryList);
    return clone;
}


// if statement
function IfStmt(test, block, alt){
    this.type = 'if';
    this.test = test;
    this.block = block;
    this.alt = alt;
}



IfStmt.prototype.clone = function(){
    var clone = new IfStmt(cloneNode(this.test), cloneNode(this.block), cloneNode(this.alt));
    return clone;
}

// if statement
function ForStmt(element, index, list, block){
    this.type = 'for'
    this.element = element;
    this.index = index;
    this.list = list;
    this.block = block;
}

ForStmt.prototype.clone = function(){
    var clone = new ForStmt(this.element, this.index, cloneNode(this.list), cloneNode(this.block));
    return clone;
}

function ReturnStmt(value){
    this.type = 'return';
    this.value = value;
}

ReturnStmt.prototype.clone = function(){
    var clone = new ReturnStmt(cloneNode(this.value));
    return clone;
}

// 
function CompoundIdent(list){
    this.type = 'compoundident';
    this.list = list || [];
}

CompoundIdent.prototype.clone = function(){
    var clone = new CompoundIdent(cloneNode(this.list));
    return clone;
}

CompoundIdent.prototype.toString = function(){
    return this.list.join('');
}

function Dimension(value, unit){
    this.type = 'dimension';
    this.value = value;
    this.unit = unit;
}

Dimension.prototype.clone = function(){
    var clone = new Dimension(this.value, this.unit);
    return clone;
}

Dimension.prototype.toString = function(){
    return '' + this.value + (this.unit || '');
}



function Operator(op, left, right){
    this.type = 'operator';
    this.op = op;
    this.left = left;
    this.right = right;
}

Operator.prototype.clone = function(){
    var clone = new Operator(this.op, cloneNode(this.left), cloneNode(this.right));
    return clone;
}

Operator.prototype.toBoolean = function(){

}

Operator.toValue = function(){

}



function Range(left, right){
    this.type = 'range';
    this.left = left;
    this.right = right;
}

Range.prototype.clone = function(){
    var clone = new Range(cloneNode(this.left), cloneNode(this.right));
    return clone;
}




function Unary(value, reverse){
    this.value = value
    this.reverse = !!reverse
}

Unary.prototype.clone = function(value, reverse){
    var clone = new Unary(value, reverse);
    return clone;
}


function Call(name, args){
    this.type = 'call';
    this.name = name;
    this.args = args || [];
}

Call.prototype.clone = function(){
    var clone = new Call(this.name, cloneNode(this.args));
    return clone;
}

function FontFace(block){
    this.type = 'fontface';
    this.block = block;

}

FontFace.prototype.clone = function(){
    var clone = new FontFace(param);
    return clone;
}

function Media(queryList, block){
    this.type = 'media';
    this.queryList = queryList || [];
    this.block = block
}

Media.prototype.clone = function(){
    var clone = new Media(cloneNode(this.list), cloneNode(this.block));
    return clone;
}

function MediaQuery(type ,expressions){
    this.type = 'mediaquery'
    // sreen
    this.meidaType = type;
    this.expressions = expressions || [];
}

MediaQuery.prototype.clone = function(){
    var clone = new MediaQuery(this.mediaType, cloneNode(this.list));
    return clone;
}
MediaQuery.prototype.equals = function(media){
    var expressions = this.expressions,
        len = expressions.length,
        test, exp;
    if(!media) return false;
    if(this.mediaType !== media.mediaType){
        return false
    }
    if(len !== media.length){
        return false
    }
    for(; len--;){
        exp = expressions[len - 1];
        test = media.expressions.some(function(exp2){
            return exp.equals(exp2);
        })
    }
}


function MediaExpression(feature, value){
    this.type = 'mediaexpression';
    this.feature = feature; 
    this.value = value;
}

MediaExpression.prototype.clone = function(){
    var clone = new MediaExpression(cloneNode(this.feature), cloneNode(this.value));
    return clone;
}
MediaExpression.prototype.equals = function(exp2){
    return this.feature == exp2.feature 
        && this.value === exp2.feature;
}


function Keyframes(name, blocks){
    this.type = 'keyframes'
    this.blocks = blocks || [];
}
Keyframes.prototype.clone = function(){
    var clone = new Keyframes(cloneNode(this.blocks));
    return clone;
}


function KeyframesBlock(step, block){
    this.type = 'keyframesblock';
    this.step = step;
    this.block = block;
}
KeyframesBlock.prototype.clone = function(){
    var clone = new KeyframesBlock(cloneNode(this.step), cloneNode(this.block));
    return clone;
}





function Page(selector, block ){
    this.type = 'page';
    this.selector = selector;
    this.block = block;
}

Page.prototype.clone = function(){
    var clone = new Page(this.selector, cloneNode(this.block));
    return clone;
}


// @beidirective支持

function Debug(expression){
    this.type = 'debug'
    this.expression = expression
}

Debug.prototype.clone = function(){
    var clone = new Debug(cloneNode(this.expression));
    return clone;
}

function Directive(name, value, block ){
    this.type = 'directive'
    this.name = name;
    this.value = value;
    this.block = block;
}
Directive.prototype.clone = function(){
    var clone = new Directive(this.name, cloneNode(this.value), cloneNode(this.block));
    return clone
}


exports.Stylesheet = Stylesheet;
exports.SelectorList = SelectorList;
exports.ComplexSelector = ComplexSelector;
exports.RuleSet = RuleSet;
exports.Block = Block;
exports.Declaration = Declaration;
exports.ValuesList = ValuesList;
exports.Values = Values;
exports.Unknown = Unknown;
exports.Func = Func;
exports.Param = Param;
exports.Include = Include;
exports.Extend = Extend;
exports.IfStmt = IfStmt;
exports.ForStmt = ForStmt;
exports.ReturnStmt = ReturnStmt;
exports.Module = Module;
exports.Debug = Debug;
exports.Pointer = Pointer;
exports.Range = Range;
exports.Import = Import;
exports.Page = Page;
exports.Directive = Directive;
exports.RGBA = RGBA;
exports.Assign = Assign;
exports.Call = Call;
exports.Operator = Operator;
exports.CompoundIdent = CompoundIdent;
exports.Media = Media;
exports.MediaQuery = MediaQuery;
exports.MediaExpression = MediaExpression;
exports.Keyframes = Keyframes;
exports.KeyframesBlock = KeyframesBlock;










exports.inspect = function(node){
    return node.type? node.type.toLowerCase(): null;
}


// 看看是否有便利的方法
var cloneNode = exports.cloneNode = function(node){
    if(!node) return node;
    if(node.clone) return node.clone()
    // array
    if(Array.isArray(node)) return node.map(cloneNode)
    // token
    if(node.type){
        var res = {type: node.type, value: node.value}
        if(node.type === 'DIMENSION') res.unit = node.unit;
        return res;
    }
    if(typeof node !== 'object') return node;
    else{
        _.error(node);
        throw Error('con"t clone node')
    }
}

exports.toStr = function(ast){
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
        case 'RGBA':
            return ast.tocss();
        default: 
            return ast.value;
    } 
}

exports.toBoolean = function(node){
    if(!node) return false;
    var type = exports.inspect(node);
    switch(type){
        case 'dimension':
            return node.value != 0;
        case 'string':
        case 'text':
            return node.value.length !== ''
        case 'boolean':
            return node.value === true;
        case 'null':
            return false;
        default: 
            return true; 
    }

}

exports.isPrimary = isPrimary;

exports.isRelationOp = _.makePredicate('== >= <= < > !=');


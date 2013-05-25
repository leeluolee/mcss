var _ = require('../helper/util'),
    splice = [].splice;

function Stylesheet(list){
    this.type = 'stylesheet';
    this.list = list || [];
}

Stylesheet.prototype.clone = function(){
    var clone = new Stylesheet();
    clone.list = cloneNode(this.list);
    return clone;
}


//  选择器列表
function SelectorList(list){
    this.type = 'selectorlist';
    this.list = list || [];
}

SelectorList.prototype.clone = function(){
    var clone = new SelectorList();
    clone.list = cloneNode(this.list);
    return clone;
}
SelectorList.prototype.toString = function(){
    
}

// 复选择器
function ComplexSelector(string, interpolations){
    this.type = 'complexselector';
    this.string = string;
    this.interpolations = interpolations || [];
}

ComplexSelector.prototype.clone = function(){
    var clone = new ComplexSelector();

    return clone;
}


function RuleSet(selector, block){
    this.type = 'ruleset';
    this.selector = selector;
    this.block = block;
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
    var clone = new Declaration(name || this.property, cloneNode(this.value), important);
    return clone;
}


function String(){
    this.type = 'string'
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
    this.type = 'rgba';
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
    var clone = new Variable(this.name, cloneNode(this.value), this.override);
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
    this.name = name;
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


function Import(url, media, assign){
    this.type = 'import'
    this.url = url;
    this.media = media;
    this.assign = assign
}

Import.prototype.clone = function(){
    var clone = new Import(this.url, cloneNode(this.media), this.assign);
    return clone;
}


// if statement
function IfStmt(test, block, alt){
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

function Operator(type, left, right){
    this.type = type;
    this.left = left;
    this.right = right;
}

Operator.prototype.clone = function(type, left, right){
    var clone = new Operator(this.type, cloneNode(this.left), cloneNode(this.right));
    return clone;
}

Operator.toBoolean = function(){

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


function CssFunction(name, value){
    this.name = name;
    this.value = value;
}



function Unary(value, reverse){
    this.value = value
    this.reverse = !!reverse
}

Unary.prototype.clone = function(value, reverse){
    var clone = new Unary(value, reverse);
    return clone;
}


function Call(name, params){
   this.params = params;
}

Call.prototype.clone = function(name, params){
    var clone = new Call(name, cloneNode(params));
    return clone;
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
exports.Pointer = Pointer;
exports.Range = Range;
exports.Import = Import;
exports.RGBA = RGBA;
exports.Assign = Assign;
exports.Call = Call;
exports.Operator = Operator;

exports.CompoundIdent = CompoundIdent;





function FontFace(){

}

function Media(name, mediaList){
    this.name = name;
    this.media = mediaList;
}

function Page(){

}

function Charset(){

}

function NameSpace(){

}



exports.inspect = function(node){
    return node.type.toLowerCase() || node.constructor.name.toLowerCase();
}


// 看看是否有便利的方法
var cloneNode = exports.cloneNode = function(node){
    // simple node
    if(node.clone) return node.clone()
    // array
    if(Array.isArray(node)) return node.map(cloneNode)
    // token
    if(node.type){
        var res = {type: node.type, value: node.value}
        return 
    }
    if(typeof node !== 'object') return node;
    else{
        _.error(node);
        throw Error('con"t clone node')
    }
}


exports.toBoolean = function(node){
    if(!node) return false;
    var type = exports.inspect(node);
    switch(type){
        case 'dimension':
            return node.value != 0;
        case 'string':
            return node.value.length !== ''
        case 'boolean':
            return node.value === true
        case 'rgba':
        case 'ident':
        case 'componentvalues':
            //TODO
        case 'unknown':
            return true
        default: 
            return null; 
    }

}


exports.isPrimary = function(){
}

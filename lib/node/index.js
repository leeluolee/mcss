// program Node (root toplevel)
function Stylesheet(){
    this.body = [];
}

//  选择器列表
function SelectorList(){
    this.list = [];
}

// 复选择器
function ComplexSelector(){
    this.string;
}

// // 复合选择器
// var CompoundSelector = exports.CompoundSelector = function(){
//     this.lists = [];
// }



function RuleSet(selector, block){
    this.selector = selector;
    this.block = block;
}

function Block(list){
    this.list = list || [];
}




// module Node
function Declaration(property, value){
    this.property = property;
    this.value = value || [];
}

// module Node
function ComponentValues(){
    this.list = [];
}

function FunctionCall(name, params){
    this.params = params || [];
    this.name = name
}


// 所有侦测不出的类似统一放置在这里;
function Unrecognized(name){
    this.name = name;
}


Unrecognized.prototype = {
    toString: function(){
        return this.name;
    }
}

function RGBA(color){
    this.color = color
}





function Token(tk){
    tk = tk || {};
    this.val = tk.val;
    this.type = tk.type;
}


function Variable(name, value, kind){
    // const or var
    this.kind = kind || 'var';
    this.name = name;
    this.value = value || [];
}

// body is a block statement
// defaults is default params
function Mixin(name, params, body){
    this.name = name;
    // this.defaults = defaults || [];
    this.body = body;
    this.refs = [];
}

function Params(params){
    this.list = params || [];
}

Params.prototype.isEmpty = function(){
    return this.list.length === 0;
}

function Param(name){
    this.name = name;
}

function Include(mixin, args){
    this.mixin = mixin;
    this.args = args || [];
}

// params default
function Extend(mixin){
    this.mixin = mixin;
}


exports.Stylesheet = Stylesheet;
exports.SelectorList = SelectorList;
exports.ComplexSelector = ComplexSelector;
exports.RuleSet = RuleSet;
exports.Block = Block;
exports.Declaration = Declaration;
exports.ComponentValues = ComponentValues;
exports.FunctionCall = FunctionCall;
exports.Unrecognized = Unrecognized;
exports.Mixin = Mixin;
exports.Include = Include;
exports.Extend = Extend;
exports.Variable = Variable;
exports.Token = Token;
exports.RGBA = RGBA;
exports.Params = Params;




function FontFace(){

}

function Media(name, mediaList){
    this.name = name;
    this.media = mediaList;
}

function Import(href, mediaList, block){
    this.href = href;
    this.media = mediaList;
    this.block = block;
}

function Page(){

}

function Charset(){

}

function NameSpace(){

}



exports.inspect = function(node){
    return node.constructor.name.toLowerCase();
}


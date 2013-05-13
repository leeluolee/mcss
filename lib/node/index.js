var _ = require('../helper/util');

function Stylesheet(list){
    this.list = list || [];
}

Stylesheet.prototype.clone = function(){
    var clone = new Stylesheet();
    clone.list = cloneNode(this.list);
    return clone;
}


//  选择器列表
function SelectorList(list){
    this.list = list || [];
}

SelectorList.prototype.clone = function(){
    var clone = new SelectorList();
    clone.list = cloneNode(this.list);
    return clone;
}

// 复选择器
function ComplexSelector(string){
    this.string = string;
}

ComplexSelector.prototype.clone = function(){
    var clone = new ComplexSelector();

    return clone;
}


function RuleSet(selector, block){
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
    this.list = list || [];
}

Block.prototype.clone = function(){
    var clone = new Block(cloneNode(this.list));
    return clone;
}


// module Node
function Declaration(property, value){
    this.property = property;
    this.value = value;
}

Declaration.prototype.clone = function(){
    var clone = new Declaration(this.property, cloneNode(this.value));
    return clone;
}

// module Node
function ComponentValues(list){
    this.list = list || [];
}

ComponentValues.prototype.clone = function(){
    var clone = new ComponentValues(cloneNode(this.list));
    return clone;
}


function FunctionCall(name, params){
    this.params = params || [];
    this.name = name
}

FunctionCall.prototype.clone = function(){
    var clone = new FunctionCall(this.name, cloneNode(this.params));
    return clone;
}


// 所有侦测不出的类似统一放置在这里;
function Unknown(name){
    this.name = name;
}

Unknown.prototype.clone = function(){
    var clone = new Unknown(this.name);
    return clone;
}



function RGBA(channels){
    this.channels = channels || [];
}

RGBA.prototype.clone = function(){
    var clone = new RGBA(cloneNode(this.channels));
    return clone;
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

Variable.prototype.clone = function(){
    var clone = new Variable(this.name,cloneNode(this.value), this.kind);
    return clone;
}


// list is a block statement
// defaults is default params
function Mixin(name, params, block){
    this.name = name;
    this.formalParams = params || [];
    this.block = block;
}

Mixin.prototype.clone = function(){
    var clone = new Mixin(this.name, this.formalParams, this.block);
    return clone;
}

function Param(name, value){
    this.name = name;
    this.default = value;
}

function Include(name, params){
    this.name = name;
    this.params = params || [];
}

Include.prototype.clone = function(){
    var clone = new Include(this.name, this.params);
    return clone;
}

// params default
function Extend(selector){
    this.selector = selector;
}

Extend.prototype.clone = function(){
    var clone = new Extend(this.selector);
    return clone;
}


function CssFunction(name, value){
    this.name = name;
    this.value = value;
}


exports.Stylesheet = Stylesheet;
exports.SelectorList = SelectorList;
exports.ComplexSelector = ComplexSelector;
exports.RuleSet = RuleSet;
exports.Block = Block;
exports.Declaration = Declaration;
exports.ComponentValues = ComponentValues;
exports.FunctionCall = FunctionCall;
exports.Unknown = Unknown;
exports.Mixin = Mixin;
exports.Include = Include;
exports.Extend = Extend;
exports.Variable = Variable;
exports.Token = Token;
exports.RGBA = RGBA;
exports.Param = Param;

exports.CssFunction = CssFunction;




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


// 看看是否有便利的方法
var cloneNode = exports.cloneNode = function(node){
    // simple node
    if(node.clone) return node.clone()
    // array
    if(Array.isArray(node)) return node.map(cloneNode)
    // token
    if(node.type) return {type: node.type, val: node.val}
    if(typeof node !== 'object') return node;
    else{
        _.error(node);
        throw Error('con"t clone node')
    }
}



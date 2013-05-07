/**
 * http://dev.w3.org/csswg/css-syntax/#parsing   准绳
 * 组合media query  有时候设错的条件 导致重复
 * TODO: roole 的占位
 * TODO: 
 */

var tk = require('./tokenizer'),
    tree = require('./node/index'),
    color = require('./helper/color'),
    util = require('./helper/util'),
    biFunctions = require('./buildIn/index'),
    symtab = require('./symtab'),
    slice = [].slice;


var combos = ['WS', '>', '~', '+'];
var skipStart = 'WS NEWLINE COMMENT ;'; 
var operators = '+ - * /';

// 判断是否是Color关键词
var isColor = util.makePredicate("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen")
var isMcssAtKeyword = util.makePredicate('mixin extend var');
var isMcssFutureAtKeyword = util.makePredicate('if else css for');
var isCssAtKeyword = util.makePredicate('import page keyframe media font-face charset');

var isSkipStart = util.makePredicate(skipStart);
var isCombo = util.makePredicate(combos);
var isSelectorSep = util.makePredicate(combos.concat(['PSEUDO_CLASS', 'PSEUDO_ELEMENT', 'ATTRIBUTE', 'CLASS', 'HASH','&', 'IDENT', '*']));
var isOperator = util.makePredicate(operators);


var isBuildInFunction = function(name){
    return !!biFunctions[name];
}


var yy = module.exports = function(input, options){
    var parser = new Parser()
    return parser.setInput(input, options);
}

function Parser(input, options){
    // this.parse(input, options)
}
// yy.Parser = Parser

Parser.prototype = {
    // ===============
    // main 
    // ===============
    parse: function(input, options){
        // this.setInput(input, options)
        return this.stylesheet();        
    },
    setInput: function(input, options){
        this.options = options || {};
        this.tokenizer = tk(input, util.extend(options||{}, {ignoreComment:true}));
        // Temporarily ll(3) parser
        // lookahead number = 3;
        this.lookahead = [this.tokenizer.lex(), this.tokenizer.lex(), this.tokenizer.lex()];
        this.p = 0;
        this.states = ['accept'];
        this.state='accept';
        // symbol table
        this.scope = this.options.scope || new symtab.Scope();
        this.selectors = [];
        return this;
    },

    next: function(k){
        k = k || 1;
        var cur = this.p;
        this.p += k;//游标
        // var offset = k - 3;
        // if(offset > 0){ //如果超过了一轮
        //     while(offset--) this.tokenizer.lex();// discard这部分已经路过的token
        // }else{
        for(var i = 0; i < k ; i++){
            this.lookahead[(cur + i /* + 3*/ ) % 3] = this.tokenizer.lex(); 
        }
        // }
        this.skip('COMMENT');
    },
    //      util
    // ----------------------
    pushState:function(condition){
        this.states.push(condition);
        this.state = condition;
    },
    // TODO:
    popState:function(){
        this.states.pop();
        this.state = this.states[this.states.length-1];
    },
    match: function(tokenType, val){
        var ll = this.ll();
        if(!this.eat(tokenType, val)){
            this.error('expect:"' + tokenType + '" -> got: "' + ll.type + '"');
        }
    },
    expect: function(tokenType, val){

    },
    matcheNewLineOrSemeColon: function(){
        if(this.eat(';')){
            return true;
        }else if(this.eat('NEWLINE')){
            return true;
        }else{
            this.error('expect: "NEWLINE" or ";"'+ '->got: ' + ll.type);
        }
    },
    // Temporarily set to ll(3) parser,
    ll: function(k){
        k = k || 1;
        if(k > 3) this.error('max lookahead 3 tokens');
        return this.lookahead[(this.p + k - 1) % 3];
    },
    // lookahead
    la: function(k){
        return this.ll(k).type;
    },
    // type at pos is some type
    is: function(pos, tokenType){
        return this.la(pos) === tokenType;
    },
    mark: function(){

    },
    release: function(){

    },
    // expect
    // some times we need to ignored some lookahead , etc. NEWLINE
    eat: function(tokenType, val){
        var ll = this.ll();
        if(ll.type === tokenType && (!val || ll.val === val)){
            this.next();
            return true;
        }
    },
    skip: function(type){
        while(true){
            var la = this.la()
            if(la === type) this.next();
            else break;
        }
    },
    skipStart: function(){
        while(true){
            var la = this.la()
            if(isSkipStart(la)) this.next();
            else break;
        }
    },
    error: function(msg){
        console.log(this.tokenizer.remained)
        throw Error(msg + " on line:" + this.tokenizer.lineno);
    },

    // scope man
    // -------------------
    down: function(selectorList){
        if(selectorList) this.selectors.push(selectorList);
        this.scope = new symtab.Scope(this.scope);
    },
    up: function(popSelector){
        if(popSelector) this.selectors.pop();
        this.scope = this.scope.getOuterScope();
    },

    // parse Function
    // ===================
    // 1.main

    // 1. grammer
    // ---------------------------------------

    // stylesheet
    //   :  stmt EOF 
    //   ;

    // stmt
    //   :  ruleset
    //   |  directive
    //   |  atrule
    //   ;


    // directive
    //   :  var_directive
    //   :  if_directive
    //   |  for_directive


    // expression
    //   :  literal
    //   |  


    // literal
    //   :  arrayLiteral
    //   |  

    // ruleset
    //   :  assign
    //   |  rule
    //   ;  

    // atrule
    //   : import
    //   | charset 
    //   | font-face
    //   | page
    //   | KEYFRAME keyframe_block
    //   ;

    // keyframe
    //   : KEYFRAME keyframe_block
    //   ;

    // keyframe_blocks


    // import
    //   : IMPORT URL media_query_list?      :@import url('xx.js') screen 
    //   | IMPORT STRING media_query_list?      :@import url('xx.js') screen 
    //   ;

    // charset
    //   : CHARSET STRING
    //   ;

    // page
    //   : PAGE

//--------------------暂时不这么细-----------------
    // media
    //   : MEDIA media_query_list;
    //   | 
    //

    // media_query_list
    //   : media_query_list , media_query;
    //   | 

    // media_query
    //   : media_query_prefixer

    // media_query_prefixer
    //   : media_query_prefixer

    // media_query_keyword
    //   : 

    // media_query_expression
    //   : 
//------------------------------------------------------

    // rule
    //   : SELECTOR block
    //   | KEYFRAME block
    //   | MEDIA block
    //   ;

    // block
    //   : asign
    //   | mixin
    //   | 



    // mixin
    //   : MIXIN VARIABLE '(' paramlist? ')'
    //   | MIXIN VARIABLE
    //   ;


    // assign
    //   : VARIABLE COLON(:) EXPRESSION

    // parenBlock
    //     : stmt
    //     ;



    // stylesheet(topLevel)
    //  : WS      {skipWhiteSpace}
    //  | stmt EOF
    //  | 
    //  ;
    //           
    stylesheet: function(){
        var node = this.node = new tree.Stylesheet();

        while(this.la(1) !== 'EOF'){
            this.skipStart();
            var stmt = this.stmt();
            node.body.push(stmt)
            this.skipStart();
        }
        return node;
    },

    // statement
    // stmt
    //  : ruleset
    //  | atrule
    //  ;
    stmt: function(){
        var tokenType = this.la(1);
        var ll = this.ll(),
            ll2 = this.ll(2),
            la = ll.type,
            la2 = ll2.type;
        if(la === 'AT_KEYWORD'){
            return this.atrule();
        }
        if(la === 'IDENT'){
            var start = ll.val.charAt(0);
            if(start === '$') return this.var(true);
        }

        if(isSelectorSep(la)){
            return this.ruleset(true);
        }
    },

    // AT RULE
    // =========================
    atrule: function(){
        var lv = this.ll().val;    
        var node;
        if(this[lv]) return this[lv]();
        return this.unkownAtRule();
    },
    // type: 
    //  0 - defaults atkeyword start
    //  1 - $dollarIdent start
    var: function(type){
        if(!type){
            this.next();
            this.match('WS');
        }
        var node = new tree.Variable(), 
            la, ll=this.ll();

        this.match('IDENT');
        this.match('WS');
        node.name = ll.val;
        while(true){
            ll = this.ll(1);
            la = ll.type;
            if(la === 'NEWLINE' || la === ';'){
                this.skipStart();
                break;
            }else{
                node.value.push(this.componentValue());
            }
        }
        this.scope.define(node.name, node);
        return node;
    },
    // type: 
    //  0 - defaults atkeyword start
    //  1 - .className start
    mixin: function(){
        var node = new tree.Mixin();
        // push scope 
        this.down();
        this.scope.define(node.name, node);
        // pop scope
        this.up();
    },
    css: function(){

    },
    extend: function(){
        this.match('AT_KEYWORD', 'extend');
        this.match('WS');
        var ll = this.ll();
        var la = ll.type;
        var node;
        if(la === 'IDENT' || la === 'CLASS'){
            var mixin = this.scope.resolve(ll.val);
            if(!mixin) {
                this.error('undefined mixin -> ' + ll.val);
            }
            if(mixin.refs === undefined){
                this.error('not a expected type mixin -> ' + ll.val); 
            }else{
                node = new exports.Extend();
                return node;
            }
        }
        this.error('invalid extend at rule');
    },
    include: function(){
        this.match('AT_KEYWORD', 'include');
        this.match('WS');
        var ll = this.ll(), 
            la = ll.type;
        if(la === 'IDENT' || la === 'CLASS'){
            this.scope.resolve(ll.val)
        }
        this.next();
        return  {};
    },
    // @import xx mediaquery_list;
    import: function(){

    },
    //media
    media: function(){

    },
    "font-face": function(){

    },
    charset: function(){

    },
    keyframe: function(){

    },
    page: function(){

    },

    // 所有未定义rule
    unknownAtRule: function(){

    },

    // ruleset
    //  :  selectorlist '{' rule ((NewLine|;) rule)* '}'

    ruleset: function(){
        var node = new tree.RuleSet(),
            rule;
        // 1. 是Selector Sep 2 
        // 2. 在是IDENT(Selector Sep之一)时后续不接: 代表不是declaration //  &&(la !== 'IDENT'|| this.la(2) !== ':'
        // @changelog: 2 remove 这不需要
        node.selector = this.selectorList();
        // 进入作用域 and push selector
        this.down(node.selector);
        this.match('{');
        // 将rule合并放在这个位置
        while(this.la() !== '}'){
            this.skipStart();
            var ll1 = this.ll(1);
            var ll2 = this.ll(2);
            if(ll1.type == 'IDENT' || ll2.type == ':'){
                node.list.push(this.declaration(true));
            }else{
                node.list.push(this.stmt());
            }
            this.skipStart();
        }
        this.match('}');
        // up 出作用域 and pop selector
        this.up(true);
        return node;
    },
    // selectorList
    //  : complexSelector (, complexSelector)*
    //  ;
    selectorList: function(){
        var node = new tree.SelectorList();
        node.list.push(this.complexSelector());
        while(this.la() === ','){
            this.next();
            node.list.push(this.complexSelector()); 
        }
        return node;
    },
    // 由于只是要翻译，略过更基础的的不做记录  只需处理SelectorList
    complexSelector: function(){
        var node = new tree.ComplexSelector();
        var selectorString = '';
        while(true){
            var ll = this.ll();
            if(isSelectorSep(ll.type)){
                selectorString += ll.val || (ll.type === 'WS' ? ' ' : ll.type );
                this.next();
            }else{
                break;
            }
        }
        node.string = selectorString; 
        return node;
    },
    // 
    // rule
    //  : declaration
    //  | stmt
    //  | skipped;    '; NEWLINE COMMENT SPACE'
    //  ;

    // compoundSelector: function(){

    // },
    // simpleSelector: function(){

    // },

    // declaration
    //  : 
    //  | IDENT : compoundValue  // start with $
    //  ; 
    declaration: function(checked){
        var node = new tree.Declaration(),
            ll1 = this.ll(1),
            ll2 = this.ll(2);

        if(checked || (this.ll(1).type = 'IDENT' && this.ll(2).type == ':')){
            node.property = ll1.val;
            this.next(2);
        }
        while(true){
            var ll = this.ll(1);
            var la = ll.type;
            if(la === 'IMPORTANT'){
                this.next();
                node.important = true;
                this.matcheNewLineOrSemeColon();
                break;
            }
            if(la === 'NEWLINE' || la === ';'){
                break;
            }else{
                node.value.push(this.componentValue());
            }
        }
        return node;
    },
    // css syntax compound value
    componentValue: function(){
        var ll1 = this.ll(1);
        var node, val, res;
        // 如果是计算表达式 @TODO: 加入颜色运算
        switch(ll1.type){
            case 'IDENT':
                var ref = this.scope.resolve(ll1.val);
                if(ref && ref.kind === 'var'){
                    return ref;
                }else{
                    var node = new tree.TokenNode(ll1)
                    this.next();
                    return node;
                }
            case 'WS':
            case 'STRING':
            case ',':
            case 'URI': 
                var node = new tree.TokenNode(ll1)
                this.next();
                return node;
            case 'FUNCTION':
                this.match('(');
                var params = [];
                while(this.la() != ')'){
                    node.params.push(this.expression());
                }
                this.match(')')
                return node;

            case 'DIMENSION':
            case '(':
                // this.match('(');
                var node = this.additive();
                console.log(node)
                // this.match(')');
                return node;

            case 'HASH': 
                if(ll1.type === HASH)
                val = ll.val;
                if(res = val.exec(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)){
                }else{
                    return tree.Unregniezed(ll1);
                }
                break;
            default: 
                this.error('Unregniezed component Value with Token start: ' + ll1.type);
        }
    },

    // componentValue 
    //  : 
    // IDENT                // tokenNode
    // HASH                 // 进行 rgba的侦测 计算computed
    // STRING               // 暂时TokenType
    // URL                  //
                            // DELIM  |? @remove
    // NUMBER               // 合并成计算 computed
    // PERCENTAGE           
    // DIMENSION         

    // WHITESPACE           // tokenNode
    // Function block       // mcss BuildInFunction 计算 或者tokenNode
    // COMMA  ,             // tokenNode
    // () block         
                            // AT-KEYWORD
                            // CDO @remove
                            // CDC @remove
                            // COLON  : @remove
                            // SEMICOLON     ; @remove
                            // {} block    
                            // [] block  @remove


    // expression
    //  : multive + addtive
    //  : expression

    expression: function(){
        var ll = this.ll(1);
        var la = ll.type;
        switch(ll.type){
            case 'DIMENSION':
            case 'RGBA':
            case '(':
                var node = this.additive()
                return tree.TokenNode(node);
        }
        this.error('invalid expression start');
    },


    // simple caculator
    // --------------------------

    additive: function(d1, d2){
        var left = this.multive(), right;
        var op = this.ll();
        if(op.type === '+' || op.type === '-'){
            this.next();
            right = this.additive();
            return this._add(left, right, op.type);
        }else{
            return left;
        }
    },
    // dimension + dimension
    // dimension - dimension
    // 单位永远以第一个为准
    _add: function(d1, d2, op){
        var val1 = d1.val, 
            val2 = d2.val,
            unit, number;

        if(val1.unit){
            unit = val1.unit;
        }else{
            unit = val2.unit;
        }
        if(op === '+'){ //+
            number = val1.number + val2.number;
        }else{ //-
            number = val1.number - val2.number;
        }
        return {
            type: 'DIMENSION',
            val: {
                number: number,
                unit: unit
            }
        }

    },

    multive: function(){
        var left = this.primary(), right;
        var op = this.ll();
        if(op.type === '*' || op.type === '/'){
            this.next();
            right = this.multive();
            return this._mult(left, right, op.type);
        }else{
            return left;
        }
    },
    // dimension * dimension
    // dimension / dimension
    _mult: function(d1, d2, op){
        var val1 = d1.val, 
            val2 = d2.val,
            unit, number;

        if(val1.unit){
            unit = val1.unit;
        }else{
            unit = val2.unit;
        }

        if(op === '*'){ //+
            number = val1.number * val2.number;
        }else{ //-
            number = val1.number / val2.number;
        }
        return {
            type: 'DIMENSION',
            val: {
                number: number,
                unit: unit
            }
        }
    },
    // (additive)
    // dimension
    primary: function(){
        var ll = this.ll();
        if(ll.type === 'DIMENSION'){
            this.next();
            return ll;
        } 
        if(ll.type === '('){
            this.next();
            var d1 = this.additive();
            this.match(')')
            return d1;
        }
        this.error('invalid primary');
    },
    // mult
    functionBlock: function(){

    },

    parenExpression:function(){
        this.match('(');
        var t = this.expression();
        this.match(')');
        return t;
    },

    params:function(){

    },
    definition: function(){

    },

    // private function
    // ============================

    // inspect lookahead array
    _lookahead: function(){
        return this.lookahead.map(function(item){
            return item.type
        }).join(',')
    }

}

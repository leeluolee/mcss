/**
 * http://dev.w3.org/csswg/css-syntax/#parsing   准绳
 * 组合media query  有时候设错的条件 导致重复
 * TODO: roole 的占位
 * TODO: 完成 block componentValue 等的重构
 * TODO: animate 直接接 keyframes
 * TODO: parser还是要尽量改写ast
 * TODO: forEach 性能爆差 全部改回来
 * TODO: compute
 */

var tk = require('./tokenizer');
var tree = require('./node/index');
var functions = require('./functions');
var color = require('./helper/color');
var _ = require('./helper/util');
var io = require('./helper/io');
var symtab = require('./symtab');
var state = require('./state');



var perror = new Error();
var slice = [].slice;

// nodejs spec API


var combos = ['WS', '>', '~', '+'];
var skipStart = 'WS NEWLINE COMMENT ;'; 
var operators = '+ - * /';

// 判断
var isSkipStart = _.makePredicate(skipStart);
var isCombo = _.makePredicate(combos);
// probably selector segment
var isSelectorSep = _.makePredicate(combos.concat(['PSEUDO_CLASS', 'PSEUDO_ELEMENT', 'ATTRIBUTE', 'CLASS', 'HASH', '&', 'IDENT', '*', ':']));
var isOperator = _.makePredicate(operators);
var isColor = _.makePredicate("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen")
var isMcssAtKeyword = _.makePredicate('mixin extend var');
var isMcssFutureAtKeyword = _.makePredicate('if else css for');
var isCssAtKeyword = _.makePredicate('import page keyframe media font-face charset');
var isShorthandProp = _.makePredicate('background font margin border border-top border-right border-bottom border-left border-width border-color border-style transition padding list-style border-radius.')

var isWSOrNewLine = _.makePredicate('WS NEWLINE');
var isCommaOrParen = _.makePredicate(', )');

var mayNotPsedudoClass = /^:-?[_A-Za-z][-_\w]*$/;


var isBuildInFunction = function(name){
    return !!biFunctions[name];
}




function Parser(options){
    this.options = options || {};
}
// yy.Parser = Parser
exports.Parser = Parser
exports.parse = function(input, options, callback){
    if(typeof input === 'string'){
        input = tk.tokenize(input, options || {});
    }
    return new Parser(options).parse(input, callback);
}

Parser.prototype = {
    // ===============
    // main 
    // ===============
    parse: function(tks, callback){
        // this.tokenizer = tk(input, _.extend(options||{}, {ignoreComment:true}));
        this.lookahead = tks;
        // Temporarily ll(3) parser
        // lookahead number = 3;
        // this.lookahead = [this.tokenizer.lex(), this.tokenizer.lex(), this.tokenizer.lex()];
        this.p = 0;
        this.length = this.lookahead.length;
        this.states = ['accept'];
        this.state='accept';
        // symbol table
        this.scope = this.options.scope || new symtab.Scope();

        this.marked = null;
        // this.setInput(input, options)
        this.tasks = 1;
        this.callback = callback;
        this.stylesheet();
        this._complete();
    },
    _complete: function(){
        this.tasks --;
        if(this.tasks == 0){
            this.callback(null, this.ast);
        }
    },
    enter: function(tks){
        this.plookahead = this.lookahead;
        this.pp = this.p;
        this.lookahead = tks;
        this.p = 0;
    },
    leave: function(){
        this.lookahead = this.plookahead;
        this.plookahead = null;
        this.p = this.pp;
    },
    next: function(k){
        k = k || 1;
        this.p += k;
        //@TODO 以后再修改为token流
    },
    // next: function(k){
    //     k = k || 1;
    //     // var cur = this.p,
    //     //     marked = this.marked;
    //     // this.p += k;//游标
    //     // // var offset = k - 3;
    //     // // if(offset > 0){ //如果超过了一轮
    //     // //     while(offset--) this.tokenizer.lex();// discard这部分已经路过的token
    //     // // }else{
    //     // for(var i = 0; i < k ; i++){
    //     //     var lex = marked === null && this.markstack.length? this.markstack.shift(): this.tokenizer.lex(); 
    //     //     this.lookahead[(cur + i /* + 3*/ ) % 3] = lex;
    //     //     if(marked !== null){
    //     //         this.markstack.push(lex);
    //     //     }
    //     // }
    //     // // }
    // },
    //      _
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
    //
    match: function(tokenType){
        if(!this.eat.apply(this, arguments)){
            var ll = this.ll();
            // _.log(this.lookahead, this.ll(2));
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
            this.error('expect: "NEWLINE" or ";"'+ '->got: ' + this.ll().type);
        }
    },
    // Temporarily set to ll(3) parser,
    ll: function(k){
        k = k || 1;
        if((this.p + k) > this.length){
            return this.lookahead[this.length-1];
        }
        return this.lookahead[this.p + k -1];
        // return this.lookahead[(this.p + k - 1) % 3];
    },
    // lookahead
    la: function(k){
        return this.ll(k).type;
    },
    // type at pos is some type
    is: function(pos, tokenType){
        return this.la(pos) === tokenType;
    },
    // 简单版本 只允许mark一次
    mark: function(){
        this.marked = this.p;
    },
    restore: function(){
        if(this.marked != undefined) this.p = this.marked;
        this.marked = null;
    },
    // expect
    // some times we need to ignored some lookahead , etc. NEWLINE
    // 
    // while to eat ';'
    // 1. eat ;
    // 2. eat newLine;
    eat: function(tokenType){
        var ll = this.ll();
        for(var i = 0, len = arguments.length; i < len; i++){
            if(ll.type === arguments[i]) return ll;
        }
        return false;
    },
    skip: function(type){
        var skiped, la, test;
        while(true){
            la = this.la();
            test = typeof type ==='string'? 
                type === la: type(la);
            if(test){
                this.next();
                skiped = true;
            }
            else break;    
        }
        return skiped;
    },
    skipStart: function(){
        return this.skip(isSkipStart);
    },
    skipWSorNewlne: function(){
        return this.skip(isWSOrNewLine);
    },
    error: function(msg){
        console.log(this.stylesheet,this.lookahead.slice(this.p-5, this.p+5))
        throw Error(msg + " on line:" + this.ll().lineno);
    },

    // parse Function
    // ===================
    // 1.main



    // stylesheet(topLevel)
    //  : WS      {skipWhiteSpace}
    //  | stmt EOF
    //  | 
    //  ;
    //           
    stylesheet: function(){
        var node = new tree.Stylesheet();
        this.ast = node;
        while(this.la(1) !== 'EOF'){
            this.skipStart();
            var stmt = this.stmt();
            node.list.push(stmt)
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
        this.error('invliad statementstart');
    },

    // AT RULE
    // =========================
    atrule: function(){
        var lv = this.ll().val.toLowerCase();    
        var node;
        if(this[lv]){
            node = this[lv]()
            return node;
        };
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
        // this.markstack;
        // debugger
        // this.next(3);
        // var haha = this.ll()
        node.name = ll.val;
        node.value = this.componentValues();
        this.matcheNewLineOrSemeColon();
        return node;
    },
    ident: function(){

    },
    css: function(){

    },
    // type: 
    //  0 - defaults atkeyword start
    //  1 - .className start
    mixin: function(){
        this.match('AT_KEYWORD');
        this.match('WS');
        var name = this.ll().val;
        if(!this.eat('FUNCTION') && !this.eat('IDENT')){
            this.error('expected FUNCTION or IDENT');
        }
        var node = new tree.Mixin(name);
        this.eat('WS');
        node.formalParams = []; 
        if(this.eat('(')){
            this.skipWSorNewlne();
            if(this.la() !== ')'){
                do{
                    node.formalParams.push(this.param());
                    this.skipWSorNewlne();
                }while(this.eat(','))
            }
        }
        this.match(')');
        this.skipWSorNewlne();
        node.block = this.block();
        
        return node;
    },
    param: function(){
        var ll = this.ll();
        this.match('IDENT');
        return new tree.Param(ll.val);
    },
    extend: function(){
        this.match('AT_KEYWORD');
        this.match('WS');
        var ll = this.ll();
        var la = ll.type;
        var node;
        // if(la === 'IDENT' || la === 'CLASS'){
        //     var mixin = this.scope.resolve(ll.val);
        //     if(!mixin) {
        //         this.error('undefined mixin -> ' + ll.val);
        //     }
        //     if(mixin.refs === undefined){
        //         this.error('not a expected type mixin -> ' + ll.val); 
        //     }else{
        //         this.next();
        //         node = new tree.Extend();
        //         node.mixin = mixin;
        //         this.matcheNewLineOrSemeColon();
        //         return node;
        //     }
        // }
        this.error('invalid extend at rule');
    },
    include: function(){
        var node = new tree.Include();
        this.match('AT_KEYWORD');
        this.match('WS');
        var ll = this.ll();
        if(ll.type ==='FUNCTION') ll.type = 'IDENT';
        node.name = this.expression();
        if(this.eat('(')){
            this.skipWSorNewlne();
            if(this.la() !== ')'){
                do{
                    node.params.push(this.componentValues(isCommaOrParen));
                    if(this.la() === ')') break;
                }while(this.eat(','))
            }
            this.match(')');
        }
        this.matcheNewLineOrSemeColon();
        node.scope = this.scope;
        return  node;
    },
    // @import Ident?  url mediaquery_list
    // @import xx ()
    import: function(){
        var node = new tree.Import(),ll;
        this.match('AT_KEYWORD');
        this.match('WS');

        if(this.la() === 'IDENT'){
            node.assign = this.ll().val;
            this.next();
            this.match('WS')
        }
        ll = this.ll();
        if(ll.type === 'URL' || ll.type === 'STRING'){
            node.url = ll.val;
            this.next()
        }else{
            this.error('expect URL or STRING' + ' got '+ ll.type);
        }
        this.eat('WS');
        // @TODO media query
        this.matcheNewLineOrSemeColon();
        var uid = _.uid();
        this.tasks += 1;
        var self = this;
        io.get(node.url, function(error, text){
            exports.parse(text, {}, function(err, ast){
                var list = self.ast.list, len = list.length;
                if(ast.list.length){
                    for(var i = 0; i < len; i++){
                        if(list[i] === uid){
                            var args;
                            if(node.assign){
                                var tmp = [new tree.Module(node.assign, 
                                        new tree.Block(ast.list))]


                            }else{
                                tmp = ast.list
                            }
                            args = [i,1].concat(tmp);
                            list.splice.apply(list, args);
                            break;
                        }
                    }
                }
                self._complete();
            })
        })

        return uid;
    },
    module: function(){
        var node = new tree.Module();
        this.match('AT_KEYWORD');
        this.match('WS');
        node.name = this.ll().val;
        this.match('IDENT');
        this.skipWSorNewlne();
        node.block = this.block();
        return node;
    },

    pointer: function(){
        var name = this.ll().val;
        var node = new tree.Pointer(name)
        this.match('IDENT');
        this.match('->');
        node.key = this.ll().val;
        if(!this.eat('IDENT') && !this.eat('FUNCTION')){
            this.error('invalid pointer')
        }
        // 1级够用 @TODO: 增加多极  加入parent即可
        // while(this.eat('->')){
        //     node.list.push(this.ll());
        //     this.match('IDENT');
        // }
        return node;
    },

    if: function(){

    },
    else: function(){

    },
    for: function(){

    },
    // block 外围插值
    // declaration 插值
    // componentValues 插值
    interpolate: function(){
        var node;
        this.match('INTERPOLATION');
        var ll = this.ll();
        if(ll.type === 'DIMENSION' && this.la(2) === '..'){
            node = this.range();
        }
        if((ll.type === 'DIMENSION' || ll.type === 'IDENT')){
            if(this.la(2) !== ','){
                node = ll;
            }else{
                node = this.list();
            }
        }
        this.match('}')
        return node;
    },
    // interpolate accept expression
    // inter_exp
    //  : ident
    //  : list literal
    //  ;
    literal: function(){

    },
    list: function(){
        var ll = this.ll(), start;
        var node = new tree.List();
        do{
            if(ll = this.eat('DIMENSION', 'IDENT')){
                node.list.push(ll);
            }else{
                this.error('invalid list literal');
            }
        }while(this.eat(','))
        return node
    },
    range: function(){
        var node = tree.Range();
        node.start = this.ll().val.number, end;
        this.match('DIMENSION');
        this.match('..');
        node.end = this.ll().val.number;
        return node;
    },


    //      media
    // ==================
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

    media: function(){

    },
    media_query_list: function(){

    },
    // [node | only]? ident<media_type> 
    media_query: function(){

    },
    "font-face": function(){

    },
    charset: function(){

    },
    keyframe: function(){

    },
    page: function(){

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
        this.skipWSorNewlne();
        node.block = this.block();
        return node;
    },
    block: function(){
        var node = new tree.Block();
        this.match('{');
        this.skipStart();
        while(this.la() !== '}'){
            this.skipStart();
            if(this.ll(1).type == '*' && this.ll(2).type == 'IDENT'){
                this.ll(2).val = "*" + this.ll(2).val;
                this.next();
            }
            var ll1 = this.ll(1);
            var ll2 = this.ll(2);
                // height
            if(ll1.type === 'IDENT'){
                try{
                    this.mark();
                    var declaration = this.declaration();
                    node.list.push(declaration);
                    // 说明declar不成
                }catch(_e){
                    if(_e.code === 1987){
                        this.restore();
                        node.list.push(this.stmt());
                    }else{
                        throw _e;
                    }
                }

            }else{
                // console.log(this.ll(), this.ll(2), this.ll(3))
                node.list.push(this.stmt());
            }
            this.skipStart();
        }
        this.match('}');
        return node;
    },
    // selectorList
    //  : complexSelector (, complexSelector)*
    //  ;
    selectorList: function(){
        var node = new tree.SelectorList();
        node.list.push(this.complexSelector());
        this.skipWSorNewlne();
        while(this.la() === ','){
            this.next();
            this.skipWSorNewlne();
            node.list.push(this.complexSelector()); 
            this.skipWSorNewlne();
        }
        return node;
    },
    // 由于只是要翻译，略过更基础的的不做记录  只需处理SelectorList
    complexSelector: function(){
        var node = new tree.ComplexSelector();
        var selectorString = '';
        var i = 0;
        while(true){
            var ll = this.ll();
            if(ll.type === 'INTERPOLATION'){
                selectorString += '@' + (i++)
            }
            if(ll.type == ':' && this.ll(2).type == 'ident'){
                selectorString += ':' + this.ll(2).val;
                this.next(2); 
            }else if(isSelectorSep(ll.type)){
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
    //  | IDENT : Value  // start with $
    //  ; 
    declaration: function(checked){
        var node = new tree.Declaration(),
            ll1 = this.ll(1),
            ll2 = this.ll(2);
        node.property = ll1.val;
        // 说明是PSEUDO_CLASS
        this.next(2);
        node.value = this.componentValues();
        this.matcheNewLineOrSemeColon();
        return node;
    },
    componentValues: function(end){
        if(end){
            var test = typeof end === 'string'? function(type){return type === end} : end;
        }
        var node = new tree.ComponentValues(),
            ll, la, i = 10;
        while(i++){
            ll = this.ll(1);
            la = ll.type;
            if(i > 100) throw Error('dada'); 
            if(la === 'IMPORTANT'){
                this.next();
                node.important = true;
                this.matcheNewLineOrSemeColon();
                break;
            }
            if((test && test(la)) || (la === 'NEWLINE' || la === ';')){
                // this.next();
                break;
            }else{
                var componentValue = this.componentValue()
                if(componentValue instanceof tree.ComponentValues){
                    node.list = node.list.concat(componentValue.list);

                }else if(componentValue !== null) node.list.push(componentValue);
            }
        }
        return node;

    },
    // css syntax  value
    componentValue: function(){
        var ll1 = this.ll(1);
        var node, val = ll1.val, res;
        // 如果是计算表达式 @TODO: 加入颜色运算

        switch(ll1.type){
            case '{': 
            // case '>':
            // case '+':
                //@FIX   暂时这样处理declaration 与ruleset的冲突
                // code 1987代表返回mark处
                // throw 的代价远比创建小
                perror.code = 1987;
                throw perror;
                break;
            case ',':
            case '=':
                this.next();
                return ll1;
            case 'WS':
                this.next();
                return null;
            // case 'IDENT':
            //     this.next();
            //     var ref = this.scope.resolve(ll1.val);
            //     if(ref && ref.kind === 'var'){
            //         return ref;
            //     }else{
            //         return ll1;
            //     }
            // case 'WS':
            //     this.next();
            //     return null;
            // case 'RGBA':
            // case 'STRING':
            // case ',':
            // case 'URI': 
            //     this.next();
            //     return ll1;
            // case 'FUNCTION':
            //     this.match('(');
            //     var params = [];
            //     var fn = ll1.val;
            //     while(this.la() != ')'){
            //         node.params.push(this.expression());
            //     }
            //     this.match(')');
            //     return node;

            // case 'DIMENSION':
            // case '(':
            //     // this.match('(');
            //     var node = this.additive();
            //     // this.match(')');
            //     return node;
            default: 
                return this.expression();
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

    //@todo 目前 exression 与componentValue 重复 与 addtive重复
    expression: function(prefix){
        var ll = this.ll(1),
            la = ll.type, node;


        switch(ll.type){
            case '(':
                node = this.parenExpression();
                break;
            case 'DIMENSION':
                node = this.additive();
                break;
            case '+':
            case '-':
                if(this.ll(2)!=='ws'){
                    node = this.expression(ll.type)
                }else{
                    node = ll;
                }
            case 'WS':
            case 'NEWLINE':
                this.next();
                node = this.expression();
                break;
            case 'IDENT':
                if(this.ll(2).type == '->'){
                    node = this.pointer();
                    break;
                } 
            case 'STRING':
            case 'RGBA':
            case 'URL':
                this.next();
                node = ll;
                break;
            case 'HASH':
                this.next();
                val = ll.val;
                if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)){
                    node = new tree.RGBA(val);
                }else{
                    node = new tree.Unknown(ll.val);
                }
                break;
            case 'FUNCTION':
                this.next();
                this.match('(');
                var fn = functions[ll.val];
                if(!fn){
                    // then means css function
                    node = new tree.CssFunction(ll.val);
                    node.value = this.componentValues(')');
                    this.match(')')
                }else{
                    var params = [];
                    this.skipWSorNewlne();
                    if(this.la() !== ')'){
                        do{
                            params.push(this.expression());
                        }while(this.la() === ',')
                    }
                    this.match(')');
                    node = fn.apply(this, params);
                    // 所有函数如果返回了字符串 都认为是要原样输出，否则应返回node 参与计算
                    if(typeof node === 'string'){
                        node = new tree.Unknown(node);
                    }
                }
                break; 
            default:
                perror.code = 1987;
                throw perror;
        }
        if(node && node.type === 'DIMENSION'){
            if(prefix === '-'){
                node.val.number = 0 - node.val.number;
            }
        }
        return node;
    },


    // simple caculator
    // --------------------------

    additive: function(options){
        var left = this.multive(), right;
        this.eat('WS');
        var op = this.ll();
        if(op.type === '+' || op.type === '-'){
            this.next();
            this.eat('WS');
            right = this.additive();
            return this._add(left, right, op.type);
        }else{
            return left;
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
            if(val2.number === 0) this.error('can"t divid by zero');
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

    parenExpression:function(){
        this.match('(');
        var t = this.expression();
        this.match(')');
        return t;
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

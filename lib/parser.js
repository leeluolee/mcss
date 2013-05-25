/**
 * http://dev.w3.org/csswg/css-syntax/#parsing   准绳
 * 组合media query  有时候设错的条件 导致重复
 * TODO: animate 直接接 keyframes
 * TODO: parser还是要尽量改写ast
 * TODO: forEach 性能爆差 全部改回来
 * TODO: compute
 * TODO: buildin animate like shake 
 * 选择起中的所有符号都不能跳过WS
 * 为什么要function
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
var errors = {
    INTERPOLATE_FAIL: 1,
    DECLARION_FAIL:2
}

// nodejs spec API

var combos = ['WS', '>', '~', '+'];
var skipStart = 'WS NEWLINE COMMENT ;'; 
var operators = '+ - * /';

// 判断
var isSkipStart = _.makePredicate(skipStart);
var isCombo = _.makePredicate(combos);
// probably selector segment
var isSelectorSep = _.makePredicate(combos.concat(['PSEUDO_CLASS', 'PSEUDO_ELEMENT', 'ATTRIBUTE', 'CLASS', 'HASH', '&', 'TEXT', '*', '#', ':','.', 'compoundident']));
var isOperator = _.makePredicate(operators);
var isColor = _.makePredicate("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen")

var isMcssAtKeyword = _.makePredicate('mixin extend var');
var isMcssFutureAtKeyword = _.makePredicate('if else css for');
var isCssAtKeyword = _.makePredicate('import page keyframe media font-face charset');

var isShorthandProp = _.makePredicate('background font margin border border-top border-right border-bottom border-left border-width border-color border-style transition padding list-style border-radius.')

var isWSOrNewLine = _.makePredicate('WS NEWLINE');
var isCommaOrParen = _.makePredicate(', )');

var isDirectOperate = _.makePredicate('RGBA DIMENSION STRING BOOLEAN TEXT NULL');
var isRelationOp = _.makePredicate('== >= <= < > !=');


var states = {
    // 进入filter
    'FILTER_DECLARATION': _.uid(),
    // 失败则进入Ruleset
    'TRY_DECLARATION': _.uid(),
    'TRY_INTERPOLATION': _.uid(),
    // 当遇到特殊属性时
    'FUNCTION_CALL': _.uid()
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
        // this.lookahead = [this.tokenizer.lex(), this.tokenizer.lex(), this.tokenizer.lex()];
        this.p = 0;
        this.length = this.lookahead.length;
        this._states = {};
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
    // store intermidia state
    state: function(state){
        return this._states[state] === true;
    },
    // enter some state
    enter: function(state){
        this._states[state] = true;
    },
    // enter some state
    leave: function(state){
        this._states[state] =false;
    },
    // read the next token;
    // @TODO return to token stream!
    next: function(k){
        k = k || 1;
        this.p += k;
    },
    lookUpBefore:function(lookup, before){
        var i = 1, la;
        while(i++){
            if( (la = this.la(i)) === lookup) return true
            if( la === before || la === 'EOF' || la === '}' ){
                return false;
            }
        }
        return false;
    },
    match: function(tokenType){
        if(!this.eat.apply(this, arguments)){
            var ll = this.ll();
            // _.log(this.lookahead, this.ll(2));
            this.error('expect:"' + tokenType + '" -> got: "' + ll.type + '"');
        }
    },
    expect: function(tokenType, value){

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
        return this;
    },
    restore: function(){
        if(this.marked != undefined) this.p = this.marked;
        this.marked = null;
        return this;
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
            if(ll.type === arguments[i]){
                this.next();
                return ll;
            }
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
        if(typeof msg === 'number') {
            perror.code = msg
            throw perror;
        }
        console.log(this.ast,this)
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
            if(stmt){
                node.list.push(stmt);
            }
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
        var la = this.la(), node = false;
        if(la === 'AT_KEYWORD'){
            node = this.atrule();
        }
        if(la === 'VAR'){
            switch(this.la(2)){
                case '(':
                    node = this.fnCall();
                    this.match(';');
                    break;
                case ':':
                    node = this.transparentCall();
                    break;
                case '=':
                case '?=':
                    node = this.assign();
                    if(node.value.type !== 'func'){
                        this.match(';');
                    }
                    break;
                default:
                    this.error('invalid squence after VARIABLE')
            }
        }
        if(isSelectorSep(la)){
            node = this.ruleset(true);
        }

        if(node !== false){
            return node
        }
        this.error('invalid statementstart');
    },
    // atrule
    //  : css_atrule(@import, @charset...)
    //  : bi_atrule(@if, @else, @mixin...)
    //  : directive 
    //  ;
    atrule: function(){
        var lv = this.ll().value.toLowerCase();
        if(typeof this[lv] === 'function'){
            return this[lv]()
        }
        return this.directive();
    },
    directive: function(){
        this.error('undefined atrule: "' + this.ll().value + '"')
    },
    // mixin' params
    param: function(){
        var name = this.ll().value, 
            dft, rest = false;
        this.match('VAR');
        if(this.eat('...')){
            rest = true
        }
        if(this.eat('=')){
            if(rest) this.error('reset params can"t has default params')
            dft = this.values();
        }
        return new tree.Param(name, dft, rest);
    },
    extend: function(){
        this.match('AT_KEYWORD');
        this.match('WS');
        var node = new tree.Extend(this.selectorList());
        this.match(';')
        return node;

        // if(la === 'IDENT' || la === 'CLASS'){
        //     var mixin = this.scope.resolve(ll.value);
        //     if(!mixin) {
        //         this.error('undefined mixin -> ' + ll.value);
        //     }
        //     if(mixin.refs === undefined){
        //         this.error('not a expected type mixin -> ' + ll.value); 
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
    return: function(){
        this.match('AT_KEYWORD');
        this.match('WS');
        var node = new tree.ReturnStmt(this.valuesList());
        this.skip('WS');
        this.match(';')
    },
    // @import Ident?  url mediaquery_list
    // @import xx ()
    import: function(){
        var node = new tree.Import(),ll;
        this.match('AT_KEYWORD');
        this.match('WS');

        if(this.la() === 'IDENT'){
            node.assign = this.ll().value;
            this.next();
            this.match('WS')
        }
        ll = this.ll();
        if(ll.type === 'URL' || ll.type === 'STRING'){
            node.url = ll.value;
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
        node.name = this.ll().value;
        this.match('TEXT');
        node.block = this.block();
        return node;
    },

    pointer: function(){
        var name = this.ll().value;
        var node = new tree.Pointer(name)
        this.match('IDENT');
        this.match('->');
        node.key = this.ll().value;
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

    // ifStatement(test, cons, alt)
    // test: expression
    // block: block
    // alt: stmt
    if: function(){
        this.match('AT_KEYWORD');
        var test = this.expression(), 
            block = this.block(),alt, ll;
        this.eat('WS');
        ll = this.ll();
        if(ll.type == 'AT_KEYWORD'){
            if(ll.value === 'else'){
                this.next();
                alt = this.block();
            }
            if(ll.value === 'elseif'){
                alt = this.if();
            }
        }
        return new tree.IfStmt(test, block, alt);
    },
    // 'FOR' $item, $i of xx, 
    for: function(){
        var element, index, list, of, block;
        this.match('AT_KEYWORD');
        this.match('WS');
        element = this.ll().value;
        this.match('VAR');
        if(this.eat(',')){
            index = this.ll().value;
            this.match('VAR')
        }
        this.match('WS');
        of = this.ll();
        if(of.value !== 'of'){
            this.error('for statement need "of" but got:' + ll.value)   
        }
        this.match('TEXT');
        list = this.valuesList();
        if(list.list.length <=1){
            this.error('@for statement need at least one element in list');
        }
        block = this.block();
        return new tree.ForStmt(element, index, list, block)
    },
    // interpolate accept expression
    // inter_exp
    //  : ident
    //  : list literal
    //  ;
        // literal: function(){

    // },
    // // list中只能有基本类型
    // list: function(){
    //     var list = [this.expression()];
    //     while(this.eat(',')){
    //         list.push(this.expression());
    //     }
    //     if(list.length ===1) return list[0];
    //     return new tree.List(list);
    // },
    // range: function(){
    //     var node = tree.Range();
    //     node.start = this.ll().value.number, end;
    //     this.match('DIMENSION');
    //     this.match('...');
    //     node.end = this.ll().value.number;
    //     return node;
    // },


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
    debug: function(){
        this.match('AT_KEYWORD');
        this.match('WS');
        var node = this.expression();
        console.log(node, '!debug')
        this.match(';')
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
        node.block = this.block();
        return node;
    },
    block: function(){
        var node = new tree.Block();
        this.match('{');
        this.skip('WS');
        while(this.la() !== '}'){
            node.list.push(this.mark().declaration() || this.restore().stmt());
            this.skip('WS');
        }
        this.match('}');
        return node;
    },
    // selectorList
    //  : complexSelector (, complexSelector)*
    //  ;
    selectorList: function(){
        var node = new tree.SelectorList();
        do{
            node.list.push(this.complexSelector())
        }while(this.eat(','))
        return node;
    },
    // 简化处理 之允许id、class、type插值
    complexSelector: function(){
        var node = new tree.ComplexSelector();
        var selectorString = '';
        var i = 0, ll, interpolation;
        while(true){
            ll = this.ll();
            if(ll.type === '#{' && this.ll(2) !== '}'){
                interpolation = this.interpolation()
                if(interpolation){
                    selectorString += '#{' + (i++) + '}'
                    node.interpolations.push(interpolation);
                }else{
                    break;
                }
            } else if(isSelectorSep(ll.type)){
                selectorString += ll.value || (ll.type === 'WS' ? ' ' : ll.type );
                this.next();
            }else{
                break;
            }
        }
        node.string = selectorString; 
        return node;
    },
    declaration: function(checked){
        var node = new tree.Declaration();
        var ll1 = this.ll(1), ll2 = this.ll(2);
        if(ll1.type === '*' && ll2.type =='TEXT'){
            this.next(1);
            ll2.value = '*' + ll2.value;
        }
        node.property = this.compoundIdent();
        // dont't start with tag  or dont't ll(2) !== ':'
        if(!node.property) return;
        this.eat('WS')
        if(!this.eat(':')) return;
        // filter_declaration在IE下是支持一些不规则的语法
        if(node.property.toString() === 'filter'){
            this.enter(states.FILTER_DECLARATION)
        }
        this.enter(states.TRY_DECLARATION);
        try{
            node.value = this.valuesList();
            this.leave(states.TRY_DECLARATION);
        // if catch error
        }catch(error){
            if(error.code === errors.DECLARION_FAIL) return
            throw error;
        }
        
        if(this.eat('IMPORTANT')){
            node.important = true;
        }
        if(this.la()!=='}'){
            this.match(';')
        }
        this.leave(states.FILTER_DECLARATION)
        return node;
    },
    // 1px 1px #fff , 1px 1px #fff ...
    // comma separated values
    // valuesList
    valuesList: function(){
        var list = [], values;
        do{
            values = this.values();
            if(values) list.push(values);
            else break;
        }while(this.eat(','))
        return new tree.ValuesList(list);
    },
    // component Values 
    values: function(){
        var list = [],
            value;
        while(true){
            value = this.value();
            if(!value) break;
            // if range
            if(value.type === 'values'){
                list = list.concat(value.list)
            }else{
                list.push(value)
            }
        }
        if(list.length === 1) return list[0];
        return new tree.Values(list)
    },
    // component Value
    value: function(){
        // 如果是计算表达式 @TODO: 加入颜色运算
        this.eat('WS');
        return this.expression();
    },
    assign: function(){
        var name = this.ll().value, 
            value, op, block,
            params = [], rest = 0;
        this.match('VAR');
        op = this.la();
        this.match('=', '?=');
        // function assign

        if(this.la() === '(' || this.la() === '{'){
            if(this.eat('(')){
                this.eat('WS');
                if(this.la() !== ')'){
                    do{
                        param = this.param();
                        if(param.rest) rest++;
                        params.push(param);
                    }while(this.eat(','))
                    if(rest >=2) this.error('can"t have more than 2 rest param');
                    this.eat('WS');
                }
                this.match(')');
            }
            block = this.block();
            value = new tree.Func(name, params, block);
        // variable define
        }else{
            value = this.valuesList();
        }
        return new tree.Assign(name, value, op === '?='? false: true);
    },

    expression: function(){
        this.eat('WS');
        if(this.la(2) === '...') return this.range();
        return this.logicOrExpr();
    },

    logicOrExpr: function(){
        var node = this.logicAndExpr(), ll, right;
        while((la = this.la()) === '||'){
            this.next();
            right = this.logicAndExpr();
            var bValue = tree.toBoolean(node)
            if(bValue !== null){
                if(bValue === false){
                    node = right
                }
            }else{
                node = new tree.Operator(la, node, right)
            }
            this.eat('WS');
        }
        return node;
    },
    // &&
    logicAndExpr: function(){
        var node = this.relationExpr(), ll, right;
        while((la = this.la()) === '&&'){
            this.next();
            right = this.relationExpr();
            var bValue = tree.toBoolean(node)
            if(bValue !== null){
                if(bValue === true){
                    node = right
                }else{
                    node = {
                        type: 'BOOLEAN',
                        value: false
                    }
                }
            }else{
                node = new tree.Operator(la, node, right)
            }
            this.eat('WS');
        }
        return node;
    },
    // ==
    // !=
    // >=
    // <=
    // >
    // <
    relationExpr: function(){
        var left = this.binop1(),la, right;
        while(isRelationOp(la = this.la())){
            this.next();
            this.eat('WS');
            right = this.binop1();
            if(isDirectOperate(left.type) && isDirectOperate(right.type)){
                left = this._relate(left, right, la)
            }else{
                left = new tree.Operator(la, left, right)
            }
            this.eat('WS');
        }
        return left;
    },
    // range: function(){
    //     var left = this.binop1()
    //     this.eat('WS');
    //     if(this.la() == '...'){
    //         this.next();
    //         this.eat('WS');
    //         var node = new tree.Range();
    //         node.left = left;
    //         node.right = this.binop1();
    //         return node
    //     }
    //     return left;
    // },
    range: function(){
        var left = this.ll(),
            node = new tree.ValuesList(),
            right, lc, rc, reverse;
        this.match('DIMENSION')
        this.eat('...');
        right = this.ll();
        this.match(left.type);
        lc = left.value;
        rc = right.value;
        reverse = lc > rc;

        for(; lc != rc ;){
            node.list.push({
                type: left.type,
                value: lc
            })
            if(reverse)  lc -= 1
            else lc += 1
        }
        node.list.push({
            type: left.type,
            value: lc
        })
        return node;
    },

    // + - 

    binop1: function(){
        var left = this.binop2(), right, la;
        this.eat('WS');
        while((la = this.la()) === '+' 
                || this.la() === '-'){
            this.next();
            this.eat('WS');
            // @TODO: add other type
            right = this.binop2();
            if(right.type === 'DIMENSION' 
                && left.type === 'DIMENSION'){
                left = this._add(left, right, la);
            }else{
                left = {
                    type: la,
                    left: left,
                    right: right
                }
            }
            this.eat('WS');
        }
        return left;

    },
    // * / %
    binop2: function(){
        var left = this.unary(), right, la;
        this.eat('WS');
        while((la = this.la()) === '*' 
                || la === '/'){
            this.next();
            this.eat('WS');
            // @TODO: add other type
            right = this.unary();
            if(right.type === 'DIMENSION' 
                && left.type === 'DIMENSION'){
                left = this._mult(left, right, la);
            }else{
                left = {
                    type: la,
                    left: left,
                    right: right
                }
            }
            this.eat('WS');
        }
        return left;
    },
    // 一元数
    unary: function(){
        var la,operator,value;
        if((la = this.la()) === '-' || la === '+'){
            operator = la;
            this.next();
        }
        value = this.primary();
        if(operator !== '-') return value;
        if(value.type === 'DIMENSION'){
            return {
                type: 'DIMENSION',
                value: -value.value,
                unit: value.unit
            }
        }
        return new tree.Unary(value, operator);
    },
    // primar   y
    //  : Ident
    //  : Dimension
    //  : RGBA
    //  : function
    //  : Var
    primary: function(){
        var ll = this.ll(), node;
        switch(ll.type){
            case '(':
                return this.parenExpr();
            case '=':
                // filter: alpha(xx=80, xx=xx, ddd=xx)
                if(this.state(states.FILTER_DECLARATION) 
                    && this.state(states.FUNCTION_CALL)){
                    return ll
                }
            case '#{':
            case 'TEXT':
                return this.compoundIdent()
            case 'FUNCTION':
                return this.fnCall();
            case 'HASH':
                this.next();
                value = ll.value;
                if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)){
                    node = new tree.RGBA(value);
                }else{
                    node = new tree.Unknown(ll.value);
                }
                return node;
            // TODO 插值
            case 'RAW_STRING':
            case 'DIMENSION':
            case 'VAR':
            case 'BOOLEAN':
            case 'NULL':
            case 'URL':
                this.next()
                return ll;
            case '>':
            case '+':
            case '.':
            case '#':
            case ':':
            case '*':
            case 'PSEUDO_CLASS':
            case 'ATTRIBUTE':
                if(this.state(states.TRY_DECLARATION)){
                    _.error(errors.DECLARION_FAIL);
                    break;
                }
                
            default:
                return null;
        }

    },
    // parenExpr
    //  : '(' expresion ')'
    parenExpr: function(){
        this.match('(');
        this.eat('WS');
        if(this.la() === 'VAR' && 
            (this.la(2) === '=' || this.la(2) === '?=')){
            node = this.assign();
        }else{
            node = this.expression();
        }
        this.eat('WS');
        this.match(')');
        return node;
    },
    // compoundIdent 组合Ident
    //  : (interpolation| TEXT) +
    compoundIdent: function(){
        var list =[] , ll, sep, node;
        while(true){
            ll = this.ll();
            if(ll.type === '#{'){
                sep = this.interpolation();
                list.push(sep)
            }else if(ll.type === 'TEXT'){
                this.next();
                list.push(ll.value)
            }
            else break;
        }
        if(!sep){
            return {
                type: 'TEXT',
                value: list[0]        
            }
        }else{
            return new tree.CompoundIdent(list)
        }
    },
    //  : '#{' values '}'
    interpolation: function(){
        var node;
        this.match('#{')
        node = this.valuesList();
        this.match('}')
        return node;
    },
    // fnCall 
    //  : FUNCTION '('  expresion * ')'
    fnCall: function(){
        var ll = this.ll();
        var node = new tree.Call()
        node.name = ll.value;
        this.match('FUNCTION', 'VAR');
        this.match('(');
        this.enter(states.FUNCTION_CALL);
        node.arguments = this.valuesList();
        this.leave(states.FUNCTION_CALL);
        this.match(')');
        return node;
    },
    transparentCall: function(){
        var ll = this.ll();
        var node = new tree.Call()
        node.name = ll.value;
        this.match('VAR');
        this.match(':');
        node.arguments = this.valuesList();
        this.match(';')
        return node;
    },
    _add: function(actor1, actor2, op){
        var value, unit;

        if(actor1.unit){
            unit = actor1.unit;
        }else{
            unit = actor2.unit;
        }
        if(op === '+'){ //+
            value = actor1.value + actor2.value;
        }else{ //-
            value = actor1.value -actor2.value;
        }
        return {
            type: 'DIMENSION',
            value: value,
            unit: unit
        }

    },
    // DIMENSION * DIMENSION
    // DIMENSION / DIMENSION
    _mult: function(actor1, actor2, op){
        var unit, value;

        if(actor1.unit){
            unit = actor1.unit;
        }else{
            unit = actor2.unit;
        }

        if(op === '*'){ //+
            value = actor1.value * actor2.value;
        }else{ //-
            if(actor2.value === 0) this.error('can"t divid by zero');
            value = actor1.value / actor2.value;
        }
        return {
            type: 'DIMENSION',
            value: value,
            unit: unit
        }
    },
    _relate: function(left, right, op){
        var bool = {type: 'BOOLEAN'}
        if(left.type !== right.type || left.unit !== right.unit){
            bool.value = op === '!='
        }else{
            if(left.value > right.value){
                bool.value = op === '>' || op === '>=' || op === '!=';
            }
            if(left.value < right.value){
                bool.value = op === '<' || op === '<=' || op === '!=';
            }
            if(left.value == right.value){
                bool.value = op === '==' || op === '>=' || op === '<=';
            }
        }
        return bool;
    },

    // private function
    // inspect lookahead array
    _lookahead: function(){
        return this.lookahead.map(function(item){
            return item.type
        }).join(',')
    }




}


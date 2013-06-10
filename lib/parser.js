/**
 * lineno 每个node都要
 */



var tk = require('./tokenizer');
var tree = require('./node');
var _ = require('./helper/util');
var io = require('./helper/io');
var binop = require('./helper/binop');
var promise = require('./helper/promise');
var options = require('./helper/options');
var path = require('./helper/path');
var fs = require('fs');
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

var isDirectOperate = _.makePredicate('DIMENSION STRING BOOLEAN TEXT NULL');
var isRelationOp = _.makePredicate('== >= <= < > !=');
var isNeg = function(ll){
    return ll.type === 'DIMENSION' && ll.value < 0;
}

var isProbablyModulePath = function(path){
    return /^[-\w]/.test(path) && !(/:/.test(path)); 
}


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
module.exports = Parser;
exports.parse = function(input, options){
    if(typeof input === 'string'){
        input = tk.tokenize(input, options || {});
    }
    return new Parser(options).parse(input);
}

Parser.prototype = {
    // ===============
    // main 
    // ===============
    parse: function(tks){
        var p = new promise();
        if(typeof tks === 'string'){
            tks = tk.tokenize(tks);
        }
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
        this.promises = [];
        var ast = this.stylesheet();
        // callback
        if(this.promises.length){
            promise.when.apply(this, this.promises).done(function(){
                return p.resolve(ast);
            })
        }else{
            return p.resolve(ast);
        }
        return p;
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
        var ll;
        if(!(ll = this.eat.apply(this, arguments))){
            var ll = this.ll();
            // _.log(this.lookahead, this.ll(2));
            this.error('expect:"' + tokenType + '" -> got: "' + ll.type + '"');
        }else{
            return ll;
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
        var filename = this.options.filename;
        console.log(this.p);
        throw Error((filename? 'file:"' + filename + '"' : '') + msg + " on line:" + this.ll().lineno);
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
    stylesheet: function(block){
        var end = block? '}' : 'EOF';
        if(block) this.match('{');
        var node = new tree.Stylesheet();
        this.skip('WS');
        while(!this.eat(end)){
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
        if(la === 'FUNCTION'){
            node = this.fnCall();
            this.match(';')
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
    // 天然支持document、charset等等
    directive: function(){
        var name = this.ll().value.toLowerCase();
        var dhook = state.directives[name];
        if(dhook){
            // this.error('undefined atrule: "' + this.ll().value + '"')
            //@TODO add customer syntax
            console.log('has hook');
        }else{
            this.match('AT_KEYWORD');
            this.eat('WS')
            var value = this.valuesList();
            this.eat('WS');
            if(this.eat(';')){
                return new tree.Directive(name, value);
            }else{
                var block = this.block();
                return new tree.Directive(name, value, block);
            }
            this.error('invalid customer directive define');
        }
        
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
        return node;
    },
    // @import Ident?  url media_query_list
    // @import xx ()
    import: function(){
        var node, url, queryList,ll, self = this;
        this.match('AT_KEYWORD');
        this.match('WS');
        ll = this.ll();
        if(ll.type === 'URL' || ll.type === 'STRING'){
            url = ll;
            this.next();
        }else{
            this.error('expect URL or STRING' + ' got '+ ll.type);
        }
        this.eat('WS');
        if(!this.eat(';')){
            queryList = this.media_query_list();
            this.match(';')
        }
        var node = new tree.Import(url, queryList)
            ,extname = path.extname(url.value), 
            filename, stat, p;
        if(extname !== '.css'){
            p = this._import(url.value).done(function(ast){
                node.stylesheet = ast;
            })
            this.promises.push(p);
        }
        return node;
    },
    abstract: function(){
        var la, url, ruleset;
        this.match('AT_KEYWORD');
        this.eat('WS');
        if((la = this.la()) !== '{'){
            // @abstract 'test/url.mcss'
            if(url = this.eat('STRING', 'URL')){
                var node = new tree.Import(url);
                var p =this._import(url.value).done(function(ast){
                    node.stylesheet = ast.abstract();
                })
                this.promises.push(p);
                return node;
            }else{
                // @absctract tag .classname{
                //      .......
                // }
                ruleset = this.ruleset();
                ruleset.abstract = true;
                return ruleset;
            }
        // @abstarct {
        //   .......
        // }
        }else{

            var list = this.stylesheet(true)
                .abstract().list;
            return list;
        }
    },
    url: function(){
        return this.match('STRING', 'URL');
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
                this.eat('WS')
                alt = this.block();
            }
            if(ll.value === 'elseif'){
                alt = this.if();
            }
        }
        return new tree.IfStmt(test, block, alt);
    },
    // 'FOR' $item, $i of xx, xx xx,xx
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
            this.error('for statement need "of" but got:' + of.value)   
        }
        this.match('TEXT');
        list = this.valuesList();
        if(list.list.length <=1){
            this.error('@for statement need at least one element in list');
        }
        this.eat('WS');
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
        this.match('AT_KEYWORD');
        this.eat('WS');
        var list = this.media_query_list();
        this.skip('WS');
        var stylesheet = this.stylesheet(true);
        return new tree.Media(list, stylesheet)
    },
    // [<media_query>[',' <media_query>]*]?
    media_query_list: function(){
        var list = [];
        do{
            list.push(this.media_query()); 
        }while(this.eat(','))
        return list;
    },
    // [only | not]? <media_type> [and <expression>]* 
    // | <expression> [and <expression>]*
    media_query: function(){
        var expressions = [], ll, type = '';
        if(this.la() === '('){
            expressions.push(this.media_expression());
        }else{
            ll = this.ll();
            if(ll.value === 'only' || ll.value === 'not'){
                type = ll.value;
                this.next(1);
                this.match('WS');
                ll = this.ll();
            }
            this.match('TEXT');
            type += (type? ' ': '') + ll.value;
        }
        this.eat('WS');
        while( (ll = this.ll()).type === 'TEXT' || ll.type === 'FUNCTION' && ll.value === 'and'){
            this.next();            
            this.match('WS');
            expressions.push(this.media_expression());
            this.eat('WS')
        }
        return new tree.MediaQuery(type, expressions);
    },
    // '('<media_feature>[:<value>]?')'
    media_expression: function(){
        var feature,value
        this.match('(');
        this.eat('WS');
        feature = this.expression();
        if(this.eat(':')){
            value = this.expression();
        }
        this.eat('WS');
        this.match(')');
        return new tree.MediaExpression(feature, value);
    },
    // @font-face{font-family:name;src:<url>;sRules;}
    "font-face": function(){
        this.match('AT_KEYWORD');
        this.eat('WS');
        return new tree.FontFace(this.block());
    },
    keyframes: function(){
        this.match('AT_KEYWORD');
        this.eat('WS');
        var name = this.compoundIdent();
        this.eat('WS');
        this.match('{')
        this.eat('WS');
        var blocks = [];
        while(!this.eat('}')){
            blocks.push(this.keyframes_block()); 
        }
        return new tree.Keyframes(name, blocks);
    },
    keyframes_block: function(){
        var  step = this.ll(), block;
        this.match('IDENT', 'DIMENSION');
        this.eat('WS');
        block = this.block();
        this.eat('WS');
        return new tree.keyframesBlock(step, block);
    },
    page: function(){
        this.match('AT_KEYWORD');
        this.eat('WS');
        var selector = this.match('PSEUDO_CLASS').value;
        this.eat('WS');
        var block = this.block();
        return new tree.Page(selector, block);
    },
    debug: function(){
        this.match('AT_KEYWORD');
        this.match('WS');
        var value= this.valuesList();
        var node =new tree.Debug(value);
        this.match(';')
        return node;
    },
    // TODO: 对vain中的所有
    // @vain selectorList
    // @vain 'url' | url()
    // @vain block;
    vain: function(){
        var selector, block;
        this.match('AT_KEYWORD');
        this.eat('WS');
        if(this.la() !== '{'){
            selector = this.selectorList();
        }else{
            block = this.block();
        }
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
        this.eat('WS');
        node.block = this.block();
        return node;
    },
    block: function(){
        this.eat('WS');
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
    declaration: function(noEnd){
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
        if(node.property.value === 'filter'){
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
        if(!noEnd){
            if(this.la()!=='}'){
                this.match(';')
            }
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
        if(list.length === 1){
            return list[0]
        }else{
            return new tree.ValuesList(list);
        }
        
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
        var left = this.logicAndExpr(), ll, right;
        while((la = this.la()) === '||'){
            this.next();
            right = this.logicAndExpr();
            var bValue = tree.toBoolean(left)
            if(bValue !== null){
                if(bValue === false){
                    left = right
                }
            }else{
                left = new tree.Operator(la, left, right)
            }
            this.eat('WS');
        }
        return left;
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
            if(tree.isPrimary(left.type) && tree.isPrimary(right.type)){
                left = binop.relation(left, right, la)
            }else{
                left = new tree.Operator(la, left, right)
            }
            this.eat('WS');
        }
        return left;
    },
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
        var left = this.binop2(), right, la, ll;
        var ws;
        if(this.eat('WS')) ws = true;
        while((la = this.la()) === '+' 
                || la === '-' || isNeg(ll = this.ll())){
            if(la === 'DIMENSION'){
                // 10px-1px;
                if(!ws){
                    right = this.eat('DIMENSION');
                    la = '+';
                }
                // 10px -1px
                else return left;
            }else{
                this.next();
                this.eat('WS');
                right = this.binop2();
            }
            if(right.type === 'DIMENSION' 
                && left.type === 'DIMENSION'){
                left = binop[la](left, right);
            }else{
                left = new tree.Operator(la, left, right)
            }
            this.eat('WS');
        }
        return left;

    },
    // * / %
    binop2: function(){
        var left = this.unary(), right, la;
        var ws;
        if(this.eat('WS')) ws = true;
        while((la = this.la()) === '*' 
                || la === '/' || la === '%'){
            // 即一个空格也没有
            if(la == '/' && !ws && this.la(2) !== 'WS'){
                return left;
            }
            this.next();
            this.eat('WS');
            right = this.unary();
            if(right.type === 'DIMENSION' 
                && left.type === 'DIMENSION'){
                left = binop[la](left, right);
            }else{
                left = new tree.Operator(la, left, right)
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
                    this.next();
                    return ll
                }
                break;
            case '/':
                this.next();
                return ll;
            case '#{':
            case 'TEXT':
                return this.compoundIdent()
            case 'FUNCTION':
                return this.fnCall();
            case 'HASH':
                this.next();
                value = ll.value;
                if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)){
                    node = new tree.Color(value);
                }else{
                    node = new tree.Unknown(ll.value);
                }
                return node;
            // TODO 插值
            case 'STRING':
            case 'DIMENSION':
            case 'BOOLEAN':
            case 'VAR':
            case 'NULL':
            case 'URL':
                this.next()
                return ll;
            case '>':
            case '+':
            case '.':
            case '#':
            case '{':
            case ':':
            case '*':
            case 'PSEUDO_CLASS':
            case 'ATTRIBUTE':
                if(this.state(states.TRY_DECLARATION)){
                    this.error(errors.DECLARION_FAIL);
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
            node = this.assign(true);
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
        var ll = this.ll(),
            name = ll.value, args;
        this.match('FUNCTION', 'VAR');
        if(ll.args){
            return new tree.Call(name, ll.args)
        }
        this.eat('WS');
        this.match('(');
        this.enter(states.FUNCTION_CALL);
        args = this.valuesList();
        args = args.type === 'valueslist'? args.list : [args];
        this.leave(states.FUNCTION_CALL);
        this.match(')');
        return new tree.Call(name, args)
    },
    // stylus inspired feature;
    transparentCall: function(){
        var ll = this.ll();
        var name = ll.value;
        this.match('VAR');
        this.match(':');
        var args = this.valuesList().list;
        var node = new tree.Call(name, args)
        this.match(';')
        return node;
    },

    // private function
    // inspect lookahead array
    _lookahead: function(){
        return this.lookahead.map(function(item){
            return item.type
        }).join(',')
    },

    /**
     * pass a filename(any format, nec/reset.mcss, etc) get a promise to detect success
     * any atrule want to load other module will use this method
     * _import also has some operating to exec;
     * 
     * @param  {String} url       the file(path or url) to load
     * @return {promise}          the parse promise
     *                            the promise doneCallback will accpet a ast parsed by parser
     */
    _import: function(url){
        var pathes = this.get('pathes'),
            extname = path.extname(url);
        // // the promise passed to this.promises
        //     readyPromise = promise();

        // browser env is not support include
        if(!path.isFake && pathes.length && isProbablyModulePath(url.value)){

            var inModule = pathes.some(function(item){
                filename = path.join(item, url);
                try{
                    stat = fs.statSync(filename);
                    if(stat.isFile()) return true;
                }catch(e){}
            })
        }
        if(!inModule){
            //@TODO is abs
            if(/^\/|:\//.test(url)){//abs
                var filename = url;
            }else{//relative
                var base = path.dirname(this.options.filename);
                var filename = path.join(base, url);
            }
        }

        filename += (extname? '':'.mcss');
        var options = _.extend({filename: filename}, this.options);
        // beacuse  parser is stateless(all symbol & scope defined in interpret step)
        // mcss' require-chain's checking is veryeasy
        var _requires = this.get('_requires');
        if(_requires && ~_requires.indexOf(filename)){
            this.error('it is seems file:"' + filename + '" and file: "'+this.get('filename')+'" has Circular dependencies');
        }

        options._requires = _requires? 
            _.slice(_requires).push(this.get('filename')):
            [this.get('filename')];

            // @TODO 修改为只检查文件 io.get
        return io.parse(filename, options)
            .done(function(ast){
                if(!~state.requires.indexOf(filename)){
                    state.requires.push(filename);
                } 
            })
    }
}

options.mixTo(Parser);


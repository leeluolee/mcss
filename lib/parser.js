/**
 * http://dev.w3.org/csswg/css-syntax/#parsing   准绳
 * 组合media query  有时候设错的条件 导致重复
 * TODO:
 */


var tk = require('./tokenizer'),
    tree = require('./node/index'),
    color = require('./helper/color'),
    util = require('./helper/util');

var slice = [].slice;

var yy = {}; //namespace

var combos = ['WS', '>', '~', '+'];
var skipStart = 'WS NEWLINE COMMENT ;'; 

// 判断是否是Color关键词
var isColor = util.makePredicate("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen")
var isMcssAtKeyword = util.makePredicate('mixin extend');
var isMcssFutureAtKeyword = util.makePredicate('if else then end mixin extend css');

var isSkipStart = util.makePredicate(skipStart);
var isCombo = util.makePredicate(combos);
var isSelectorSep = util.makePredicate(combos.concat(['PSEUDO_CLASS', 'PSEUDO_ELEMENT', 'ATTRIBUTE', 'CLASS', 'HASH','&', 'IDENT', '*']));



// skip
var isRuleStartSkip = util.makePredicate('NEWLINE', '');


var yy = module.exports = function(input, options){
    return new Parser().parse(input, options);
}

function Parser(input, options){
    // this.parse(input, options)
}

Parser.prototype = {
    // ===============
    // main 
    // ===============
    parse: function(input, options){
        this.options = options || {};
        this.tokenizer = tk(input, util.extend(options||{}, {ignoreComment:true}));
        // Temporarily ll(3) parser
        // lookahead number = 3;
        this.lookahead = [this.tokenizer.lex(), this.tokenizer.lex(), this.tokenizer.lex()];
        this.p = 0;
        this.states = ['accept'];
        this.state='accept';
        // symbol table
        this.symtab = 


        return this.program();        
    },
    next: function(k){
        k = k || 1;
        this.p += k;//游标
        var offset = k - 3;
        if(offset > 0){ //如果超过了一轮
            while(offset--) this.tokenizer.lex();// discard这部分已经路过的token
        }else{
            for(var i = 0; i < k ; i++){
                this.lookahead[(this.p + 2 + i) % 3] = this.tokenizer.lex(); 
            }
        }
        // this.lookahead[now] = this.tokenizer.lex();
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
        if(!this.ignore(tokenType, val)){
            this.error('expect:' + tokenType + '->got: ' + ll.type);
        }
    },
    matcheNewLineOrSemeColon: function(){
        if(this.ignore(';')){
            return true;
        }else if(this.ignore('NEWLINE')){
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
    mark: function(){

    },
    release: function(){

    },
    // expect
    // some times we need to ignored some lookahead , etc. NEWLINE
    ignore: function(tokenType, val){
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
        throw Error(msg + " on line:" + this.tokenizer.lineno);
    },


    // parse Function
    // ===================
    // 1.main

    // 1. grammer
    // ---------------------------------------

    // program
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



    // program(topLevel)
    //  : WS      {skipWhiteSpace}
    //  | stmt EOF
    //  | 
    //  ;
    //           
    program: function(){
        var node = this.node = new tree.Program();

        while(this.la(1) !== 'EOF'){
            this.skipStart();
            node.body.push(this.stmt())
        }
        return node;
    },
    // statement
    // stmt
    //  : ruleset
    //  | directive
    //  | atrule
    //  ;
    //       
    stmt: function(){
        var tokenType = this.la(1);
        var result =  this.ruleset();/* || this.directive() || this.atrule();*/
        if(!result) this.error('parse Error: no statement matched');
        else{
           return result;
        }
    },

    // ruleset
    //  :  selectorlist '{' ruleList| '}'

    ruleset: function(){
        var node = new tree.RuleSet();
        // 1. 是Selector Sep 2 
        // 2. 在是IDENT(Selector Sep之一)时后续不接: 代表不是declaration //  &&(la !== 'IDENT'|| this.la(2) !== ':'
        // @changelog: 2 remove 这不需要
        if(!isSelectorSep(this.la(1))) return null;
        node.selector = this.selectorList();
        this.ignore('WS');
        this.match('{');
        this.skipStart();
        node.ruleList = this.ruleList();
        this.skipStart();
        this.match('}');
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
    // compoundSelector: function(){

    // },
    // simpleSelector: function(){

    // },

    // ruleList
    //  : declaration 
    //  : stmt
    //  ;
    ruleList: function(){
        var node = tree.RuleList();
        var la = this.la();
        while(true){
            this.skipStart();
        }
        return node;
    },
    // declaration
    //  : 
    //  | IDENT : compoundValue  // start with $
    //  ; 
    declaration: function(){
       var node = tree.Declaration(); 
       var ll1 = this.ll(1);
       var ll2 = this.ll(2);

       if(ll1.type = 'IDENT' && ll2.type == ':'){
            this.next(2);
            node.name = ll1.val;
       }
       var value = this.componentValues();
    },
    // css syntax compound value
    componentValues: function(){

    },
    // componentValue 
    //  : 
    // IDENT
    // AT-KEYWORD
    // HASH
    // STRING
    // URL
    // DELIM
    // NUMBER
    // PERCENTAGE
    // DIMENSION
    // UNICODE-RANGE
    // INCLUDE-MATCH
    // DASH-MATCH
    // PREFIX-MATCH
    // SUFFIX-MATCH
    // SUBSTRING-MATCH
    // WHITESPACE
                            // CDO @remove
                            // CDC @remove
                            // COLON  : @remove
                            // SEMICOLON     ; @remove
    // COMMA  ,
    // {} block    
    // () block         
                            // [] block  @remove
    // Function block

    componentValue: function(){

    },
    expression: function(){
        var tokenType = this.la();
    },

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

    }
}

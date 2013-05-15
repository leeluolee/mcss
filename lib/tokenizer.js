// ### TODO:
// 0. 允许回退
// 1. String Ident Word 允许插值 即{}
// 2. String Ident Word 允许
// 3. 如果是pesudo_class name 就直接匹配到()
// TODO: :  与pesudoclass


var util = require('./helper/util');
var bifs = Object.keys(require('./functions'));


// local var or util function
var slice = [].slice,
    _uid = 0,
    debug = true,
    tokenCache = {};
    uid = function(type, cached){
        _uid++;
        if(cached){
            tokenCache[type] = {type: _uid};
        }
        return _uid;
    },
    // detect keyword in word_list (@deprecated)
    toAssert = function(str){
        var arr = typeof str == "string" ? str.split(/\s+/) : str,
            regexp = new RegExp("^(?:" + arr.join("|") + ")$");

        return function(word){
          return regexp.test(word);
        }
    },
    // the more fast version
    toAssert2 = util.makePredicate;



// tokenizer function

exports.tokenize = function(input, options){
    return new Tokenizer(options).tokenize(input);
}
exports.Tokenizer = Tokenizer;


// create Token
function createToken(type, val, lineno){
    if(val === undefined){
        tokenCache[type] = {type: type}
    }
    // TODO remove
    var token = tokenCache[type] || {type: type, val: val}
    token.lineno = lineno;
    return token;
}

// Token Types
// ===========================================

// // inspectToken, get tokenName with TokenType(uid)
// tokenizer.inspect = function(tokenType){
//     var typeType = tokenType.type || tokenType;
//     for(var i in tokenizer){
//         if(typeof tokenizer[i] === 'number' && tokenizer[i] === tokenType) return i;
//     }
// }

// // BASE
// var EOF = tokenizer.EOF
// var WS = tokenizer.WS
// var NEWLINE = tokenizer.NEWLINE
// var COMMENT = tokenizer.COMMENT

// var IMPORTANT = tokenizer.IMPORTANT
// var IDENT = tokenizer.IDENT
// var AT_KEYWORD = tokenizer.AT_KEYWORD
// var SELECTOR = tokenizer.SELECTOR
// // var RGBA = tokenizer.RGBA
// // var RGB = tokenizer.RGB
// var COLOR = tokenizer.COLOR
// var DIMENSION = tokenizer.DIMENSION

// // Punctuator
// var PARENL = tokenizer.PARENL
// var PARENR = tokenizer.PARENR
// var COMMA = tokenizer.COMMA
// var BRACEL = tokenizer.BRACEL
// var BRACER = tokenizer.BRACER
// var SEMICOLON = tokenizer.SEMICOLON
// var BIT_AND = tokenizer.BIT_AND
// // beacuseof the pesudoSelector
// var COLON = tokenizer.COLON
// // AT KEYWORD

// // var IMPORT = tokenizer.IMPORT
// // var PAGE = tokenizer.PAGE
// // var MEDIA = tokenizer.MEDIA
// // var FONT_FACE = tokenizer.MEDIA
// var AT_KEYWORD = tokenizer.AT_KEYWORD
// var DIRECTIVE = tokenizer.DIRECTIVE
// var KEYFRAME = tokenizer.KEYFRAME


// var MIXIN = tokenizer.MIXIN
// var EXTEND = tokenizer.EXTEND


// var VARIABLE = tokenizer.VARIABLE


// // NESS KEYWORD

var isUnit = toAssert2("% em ex ch rem vw vh vmin vmax cm mm in pt pc px deg grad rad turn s ms Hz kHz dpi dpcm dppx");
// var isPseudoClass = toAssert2(["dir","lang","any-link", "link", "visited", "local-link","target", "scope", "current", "past", "future", "active", "hover", "focus", "active-drop", "valid-drop", "invalid-drop", "enabled", "disabled", "enabled", "disabled", "read-only", "read-write", "placeholder-shown", "default", "checked", "indeterminate", "valid", "invalid", "in-range", "out-of-range", "required", "optional", "root", "empty", "blank", "nth-child", "nth-last-child", "first-child", "last-child", "only-child", "nth-of-type", "nth-last-of-type", "first-of-type", "last-of-type", "only-of-type", "nth-match", "nth-last-match", 'nth-column', 'nth-last-column', 'not', 'matches', 'before', 'after', '-moz-placeholder']);
var isBifs = toAssert2(bifs.concat(['rgb', 'rgba', 'url', 'counter', 'attr', 'calc', 'min', 'max', 'cycle', 'linear-gradient', 'radial-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient']), true)
// color keywords



// alt keyword detect  @page   @import  @keyframe @media
function atKeyword(val){
    if(val === 'keyframe') return createToken(KEYFRAME)
    return tokenCache[val];
}


var $rules = [];
var $links = {};

var addRules = function(rules){
    $rules = $rules.concat(rules)
    var rule, reg, state, link, retain;

    for(var i = 0; i< $rules.length; i++){
        rule = $rules[i];
        reg = typeof rule.regexp !== 'string'? String(rule.regexp).slice(1, -1): rule.regexp;
        reg.replace(/\{(\w+)}/, function(all, micro){
            return String(macros[micro]);
        })
        if(!~reg.indexOf("^(?")){
            rule.regexp = new RegExp("^(?:" + reg + ")");
        }
        state = rule.state || 'init';
        link = $links[state] || ($links[state] = []);
        link.push(i);
    }
    return this;
}



var macros = {
    nmchar:  /[-\w$]/
}

// addRULEs;
addRules([
    {   
        // EOF
        regexp: /$/,
        action: function(){
            return 'EOF';
        }
    },
    {   //NEWLINE
        regexp: /(?:\r\n|[\n\r\f])[ \t]*/,
        action: function(){
            return 'NEWLINE';
        }
    },
  
    {   //Multiline Comment
        regexp: /\/\*([^\x00]+?)\*\//,
        action: function(yytext, comment){
            if(this.options.ignoreComment) return;
            this.yyval = comment;
            return 'COMMENT';
        }
    },
    {   //Sinle Line Comment
        regexp: /\/\/([^\n\r$]*)/,
        action: function(yytext, comment){
            if(this.options.ignoreComment) return;
            this.yyval = comment;
            return 'S_COMMENT'; //single Comment
        }
    },
    {   // @css atrule no parse
        reg: /@css[\t ]+{/,
        action: function(yytext){
        }
    },
    {
        // @  alt word or variable
        regexp: /@(-?[_A-Za-z][-_\w]*)/,
        action: function(yytext, val){
            this.yyval = val;
            return 'AT_KEYWORD'
        }
    },
    {   //Url http://dev.w3.org/csswg/css-syntax/#function-diagram
        regexp: /url[ \t]*\((['"]?)([^\r\n\f]*?)\1\)/,
        action: function(yytext, quote, url){
            this.yyval = url;
            return 'URL';
        }
    },
    {   //Function http://dev.w3.org/csswg/css-syntax/#function-diagram
        regexp: /(?:-?[_A-Za-z][-_\w]*)(?=[ \t]*\()/,
        action: function(yytext){
            this.yyval = yytext;
            return 'FUNCTION';
        }
    },
    {   //IDENT http://dev.w3.org/csswg/css-syntax/#ident-diagram
        // 即 -o-webkit-xx 是允许的
        regexp: /(?:-?[_A-Za-z\$][-_\w]*)/,
        action: function(yytext){
            this.yyval = yytext;
            return 'IDENT';
        }
    },
    {   
        // Dollar Ident
        // @MCSS 自有Token
        regexp: /\$[a-zA-Z][-\w]/,
        action: function(yytext){
            this.yyval = yytext;
            return 'DOLLAR_IDENT';
        }
    },
    {   //!important
        regexp: /![ \t]*important/,
        action: function(yytext){
            return 'IMPORTANT';
        }
    },
    {   // DIMENSION NUMBER + UNIT
        //
        regexp: /(-?(?:\d*\.\d+|\d+))(\w*|%)?/,
        action: function(yytext, val, unit){
            if(unit && !isUnit(unit)){
                this.error('Unexcept unit: "' + unit + '"');
            }
            this.yyval = {number: parseFloat(val), unit: unit};
            return 'DIMENSION'
        }
    },
    {   // pesudo-class
        regexp: ":([-_a-zA-Z][\\w\\u00A1-\\uFFFF-]*)" + //伪类名
            "(?:\\(" + //括号开始
            "([^\\(\\)]*" + //第一种无括号
            "|(?:" + //有括号(即伪类中仍有伪类并且是带括号的)
            "\\([^\\)]+\\)" + //括号部分
            /*"|[^\\(\\)]*" +*/ ")+)" + //关闭有括号
            "\\))",
        action: function(yytext, val){
            // false 使用其它方式再token一次
            if((~yytext.indexOf('(')) && isBifs(val)){
                return false
            }
            // if(!isPseudoClass(val)) return false;
            this.yyval = yytext;
            return 'PSEUDO_CLASS';
        }
    },
    {   // pesudo-element
        regexp: "::([-\\w\\u00A1-\\uFFFF]+)",
        action: function(yytext){
            this.yyval = yytext;
            return 'PSEUDO_ELEMENT';
        }
    },
    {   // attribute   [title=haha]
        regexp: "\\[\\s*(?:[\\w\\u00A1-\\uFFFF-]+)(?:([*^$|~!]?=)[\'\"]?(?:[^\'\"\\[]+)[\'\"]?)?\\s*\\]",
        action: function(yytext){
            this.yyval = yytext;
            return 'ATTRIBUTE';
        }
    },

    {   // RGBA, RGB, 这里注意与selector的区分
        // regexp: /#([0-9a-f]{3} [0-9a-f]{6})(?![#\*.\[:a-zA-Z])/,
        // action: function(yytext, val){
        //     this.yyval = val;
        //     return val.length === 3? 'RGB' : 'RGBA';
        // }
        regexp: /#([-\w\u0080-\uffff]+)/,
        action: function(yytext, val){
            this.yyval = yytext;
            return 'HASH';
        }
    },
    // {
    //     regexp: /\.([-\w\u0080-\uffff]+)/,
    //     action: function(yytext){
    //         this.yyval = yytext
    //         return 'CLASS';
    //     }
    // },
    {
        // attribute
        regexp: /\.([-\w\u0080-\uffff]+)/,
        action: function(yytext){
            this.yyval = yytext
            return 'CLASS';
        }
    },
    {   // String
        regexp: /(['"])([^\r\n\f]*?)\1/,
        action: function(yytext, quote, val){
            this.yyval = val || '';
            return 'STRING';
        }
    },
    {   // PUNCTUATORS
        regexp: /[\t ]*([{}();,:]|(?:->|[>=<!]?=)|[&><~\/])[\t ]*/,
        action: function(yytext, punctuator){
            return punctuator;
        }
    },
    {   // unSkip WS 
        regexp: /[-*!+\/]/,
        action: function(yytext){
            return yytext
        }
    },
    // {   
    //     // operator or connect || ~>+   
    //     regexp: /[ \t]*((?:[>=<!]?=)|[-&><~!+*\/])[ \t]*/,
    //     action: function(yytext, op){
    //         return op;
    //     }
    // },  
    {   //Space
        regexp: /[ \t]+/,
        action: function(){
            return 'WS';
        }
    }
    // {   // SELECTOR 模糊匹配，后期再利用[nes选择器的parser进行解析](https://github.com/leeluolee/nes)进行parse
    //     // 只有*，.home ,:first-child, [attr], #id  > ~ + &这几种可能的开头
    //     regexp: /[^{\n\r\f,]+/,
    //     action: function(yytext){
    //         this.yyval = yytext;
    //         return 'SELECTOR_SEP';
    //     }
    // }
    // sub state 
    // --------------------------------
]);



/**
 * Tokenizer Class
 * @param {[type]} input   [description]
 * @param {[type]} options [description]
 */
function Tokenizer(options){
    this.options = options || {};
    this.options.ignoreComment = true;
}



Tokenizer.prototype = {
    constructor: Tokenizer,
    tokenize: function(input){
        // @TODO: options
        //simplify newline token detect
        this.input = input
        // remained input
        this.remained = this.input;
        this.length = this.input.length;
        // line number @TODO:
        this.lineno = 1;

        this.states = ['init'];
        this.state = 'init';
        return this.pump()
    },
    // 依赖next
    lex: function(){
        var token = this.next();
        if (typeof token !== 'undefined') {
            // console.log(token)
            return token;
        } else {
            return this.lex();
        }
    },
    // 一次性输出所有tokens
    pump: function(){
        var tokens = [];
        while(t = this.lex()){
            tokens.push(t);
            if(t.type == 'EOF') break;
        }
        return tokens;
    },
    // get the latest state
    next: function(){
        var tmp, action, rule,
            tokenType, lines,
            state = this.state,
            rules = $rules,
            link = $links[state];
        if(!link) throw Error('no state: ' + state + ' defined');
        this.yyval = null;
        var len = link.length;
        for(var i = 0; i < len; i++){
            var rule = $rules[link[i]];
            tmp = this.remained.match(rule.regexp);
            if(tmp){
                action = rule.action;
                tokenType = action.apply(this, tmp);
                if(tokenType === false){
                    continue;
                }
                else break
            }
        }
        if(tmp){
            lines = tmp[0].match(/(?:\r\n|[\n\r\f]).*/g);
            if(lines) this.lineno += lines.length;
            // action = rule.action;
            // tokenType = action.apply(this, tmp);
            this.remained = this.remained.slice(tmp[0].length);
            if(tokenType) return createToken(tokenType, this.yyval, this.lineno);
        }else{
            this.error('Unrecognized')
        }
    },
    // TODO:
    pushState:function(condition){
        this.states.push(condition);
        this.state = condition;
    },
    // TODO:
    popState:function(){
        this.states.pop();
        this.state = this.states[this.states.length-1];
    },
    /**
     * [error description]
     * @return {[type]} [description]
     */
    error: function(message, options){
        var message = this._traceError(message);
        var error = new Error(message || "Lexical error");
        throw error
    },
    _traceError: function(message){
        var matchLength = this.length - this.remained.length;
        var offset = matchLength - 10;
        if(offset < 0) offset = 0;
        var pointer = matchLength - offset;
        var posMessage = this.input.slice(offset, offset + 20)
        // TODO: 加上trace info
        return 'Error on line ' + (this.lineno + 1) + " " +
            (message || '. Unrecognized input.') + "\n" + (offset === 0? '':'...') +
            posMessage + "...\n" + new Array(pointer + (offset === 0? 0 : 3) ).join(' ') + new Array(10).join("^");
    }
}





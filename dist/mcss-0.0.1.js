var mcss;
(function (modules) {
    var cache = {}, require = function (id) {
            var module = cache[id];
            if (!module) {
                module = cache[id] = {};
                var exports = module.exports = {};
                modules[id].call(exports, require, module, exports, window);
            }
            return module.exports;
        };
    mcss = require('0');
}({
    '0': function (require, module, exports, global) {
        var tokenizer = require('1');
        var parser = require('3');
        var translator = require('8');
        var util = require('2');
        var interpreter = require('i');
        exports.tokenizer = tokenizer;
        exports.parser = parser;
        exports.util = util;
        exports.translator = translator;
        exports.interpreter = interpreter;
    },
    '1': function (require, module, exports, global) {
        var util = require('2');
        var slice = [].slice, _uid = 0, debug = true, tokenCache = {};
        uid = function (type, cached) {
            _uid++;
            if (cached) {
                tokenCache[type] = { type: _uid };
            }
            return _uid;
        }, toAssert = function (str) {
            var arr = typeof str == 'string' ? str.split(/\s+/) : str, regexp = new RegExp('^(?:' + arr.join('|') + ')$');
            return function (word) {
                return regexp.test(word);
            };
        }, toAssert2 = util.makePredicate;
        var tokenizer = module.exports = function (input, options) {
                return new Tokenizer(input, options);
            };
        function createToken(type, val, lineno) {
            if (val === undefined) {
                tokenCache[type] = { type: type };
            }
            var token = tokenCache[type] || {
                    type: type,
                    val: val
                };
            token.lineno = lineno;
            return token;
        }
        var isUnit = toAssert2('% em ex ch rem vw vh vmin vmax cm mm in pt pc px deg grad rad turn s ms Hz kHz dpi dpcm dppx');
        function atKeyword(val) {
            if (val === 'keyframe')
                return createToken(KEYFRAME);
            return tokenCache[val];
        }
        var $rules = [];
        var $links = {};
        var addRules = tokenizer.addRules = function (rules) {
                $rules = $rules.concat(rules);
                var rule, reg, state, link, retain;
                for (var i = 0; i < $rules.length; i++) {
                    rule = $rules[i];
                    reg = typeof rule.regexp !== 'string' ? String(rule.regexp).slice(1, -1) : rule.regexp;
                    reg.replace(/\{(\w+)}/, function (all, micro) {
                        return String(macros[micro]);
                    });
                    if (!~reg.indexOf('^(?')) {
                        rule.regexp = new RegExp('^(?:' + reg + ')');
                    }
                    state = rule.state || 'init';
                    link = $links[state] || ($links[state] = []);
                    link.push(i);
                }
                return this;
            };
        var macros = { nmchar: /[-\w$]/ };
        addRules([
            {
                regexp: /$/,
                action: function () {
                    return 'EOF';
                }
            },
            {
                regexp: /(?:\r\n|[\n\r\f])[ \t]*/,
                action: function () {
                    return 'NEWLINE';
                }
            },
            {
                regexp: /\/\*([^\x00]+?)\*\//,
                action: function (yytext, comment) {
                    if (this.options.ignoreComment)
                        return;
                    this.yyval = comment;
                    return 'COMMENT';
                }
            },
            {
                regexp: /\/\/([^\n\r$]*)/,
                action: function (yytext, comment) {
                    if (this.options.ignoreComment)
                        return;
                    this.yyval = comment;
                    return 'S_COMMENT';
                }
            },
            {
                regexp: /@(-?[_A-Za-z][-_\w]*)/,
                action: function (yytext, val) {
                    this.yyval = val;
                    return 'AT_KEYWORD';
                }
            },
            {
                regexp: /url[ \t]*\((['"]?)([^\r\n\f]*?)\1\)/,
                action: function (yytext, quote, url) {
                    this.yyval = url;
                    return 'URI';
                }
            },
            {
                regexp: /(?:-?[_A-Za-z][-_\w]*)(?=[ \t]*\()/,
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'FUNCTION';
                }
            },
            {
                regexp: /(?:-?[_A-Za-z\$][-_\w]*)/,
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'IDENT';
                }
            },
            {
                regexp: /(?:-?[_A-Za-z][-_\w]*)/,
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'NAME';
                }
            },
            {
                regexp: /\$[a-zA-Z][-\w]/,
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'DOLLAR_IDENT';
                }
            },
            {
                regexp: /![ \t]*important/,
                action: function (yytext) {
                    return 'IMPORTANT';
                }
            },
            {
                regexp: /(-?(?:\d*\.\d+|\d+))(\w*|%)?/,
                action: function (yytext, val, unit) {
                    if (unit && !isUnit(unit)) {
                        this.error('Unexcept unit: "' + unit + '"');
                    }
                    this.yyval = {
                        number: parseFloat(val),
                        unit: unit
                    };
                    return 'DIMENSION';
                }
            },
            {
                regexp: ':([-_a-zA-Z][\\w\\u00A1-\\uFFFF-]*)' + '(?:\\(' + '([^\\(\\)]*' + '|(?:' + '\\([^\\)]+\\)' + '|[^\\(\\)]*' + ')+)' + '\\))?',
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'PSEUDO_CLASS';
                }
            },
            {
                regexp: '::([-\\w\\u00A1-\\uFFFF]+)',
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'PSEUDO_ELEMENT';
                }
            },
            {
                regexp: '\\[\\s*(?:[\\w\\u00A1-\\uFFFF-]+)(?:([*^$|~!]?=)[\'"]?(?:[^\'"\\[]+)[\'"]?)?\\s*\\]',
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'ATTRIBUTE';
                }
            },
            {
                regexp: /#([-\w\u0080-\uffff]+)/,
                action: function (yytext, val) {
                    this.yyval = yytext;
                    return 'HASH';
                }
            },
            {
                regexp: /\.([-\w\u0080-\uffff]+)/,
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'CLASS';
                }
            },
            {
                regexp: /(['"])([^\r\n\f]*?)\1/,
                action: function (yytext, quote, val) {
                    this.yyval = val || '';
                    return 'STRING';
                }
            },
            {
                regexp: /[-*!+\/]/,
                action: function (yytext) {
                    return yytext;
                }
            },
            {
                regexp: /[\t ]*([{}();,:]|(?:[>=<!]?=)|[&><~\/])[\t ]*/,
                action: function (yytext, punctuator) {
                    return punctuator;
                }
            },
            {
                regexp: /[ \t]+/,
                action: function () {
                    return 'WS';
                }
            }
        ]);
        function Tokenizer(input, options) {
            if (input)
                this.setInput(input, options);
        }
        Tokenizer.prototype = {
            constructor: Tokenizer,
            setInput: function (input, options) {
                this.options = options || {};
                this.input = input;
                this.remained = this.input;
                this.length = this.input.length;
                this.lineno = 1;
                this.states = ['init'];
                this.state = 'init';
                return this;
            },
            lex: function () {
                var token = this.next();
                if (typeof token !== 'undefined') {
                    return token;
                } else {
                    return this.lex();
                }
            },
            pump: function () {
                var tokens = [];
                while (t = this.lex()) {
                    tokens.push(t);
                    if (t.type == 'EOF')
                        break;
                }
                return tokens;
            },
            next: function () {
                var tmp, action, rule, tokenType, lines, state = this.state, rules = $rules, link = $links[state];
                if (!link)
                    throw Error('no state: ' + state + ' defined');
                this.yyval = null;
                var len = link.length;
                for (var i = 0; i < len; i++) {
                    var rule = $rules[link[i]];
                    tmp = this.remained.match(rule.regexp);
                    if (tmp)
                        break;
                }
                if (tmp) {
                    lines = tmp[0].match(/(?:\r\n|[\n\r\f]).*/g);
                    if (lines)
                        this.lineno += lines.length;
                    action = rule.action;
                    tokenType = action.apply(this, tmp);
                    this.remained = this.remained.slice(tmp[0].length);
                    if (tokenType)
                        return createToken(tokenType, this.yyval, this.lineno);
                } else {
                    this.error();
                }
            },
            pushState: function (condition) {
                this.states.push(condition);
                this.state = condition;
            },
            popState: function () {
                this.states.pop();
                this.state = this.states[this.states.length - 1];
            },
            error: function (message, options) {
                var message = this._traceError(message);
                var error = new Error(message || 'Lexical error');
                throw error;
            },
            _traceError: function (message) {
                var matchLength = this.length - this.remained.length;
                var offset = matchLength - 10;
                if (offset < 0)
                    offset = 0;
                var pointer = matchLength - offset;
                var posMessage = this.input.slice(offset, offset + 20);
                return 'Error on line ' + (this.lineno + 1) + ' ' + (message || '. Unrecognized input.') + '\n' + (offset === 0 ? '' : '...') + posMessage + '...\n' + new Array(pointer + (offset === 0 ? 0 : 3)).join(' ') + new Array(10).join('^');
            }
        };
    },
    '2': function (require, module, exports, global) {
        var _ = {};
        _.makePredicate = function (words) {
            if (typeof words === 'string') {
                words = words.split(' ');
            }
            var f = '', cats = [];
            out:
                for (var i = 0; i < words.length; ++i) {
                    for (var j = 0; j < cats.length; ++j)
                        if (cats[j][0].length == words[i].length) {
                            cats[j].push(words[i]);
                            continue out;
                        }
                    cats.push([words[i]]);
                }
            function compareTo(arr) {
                if (arr.length == 1)
                    return f += 'return str === \'' + arr[0] + '\';';
                f += 'switch(str){';
                for (var i = 0; i < arr.length; ++i)
                    f += 'case \'' + arr[i] + '\':';
                f += 'return true}return false;';
            }
            if (cats.length > 3) {
                cats.sort(function (a, b) {
                    return b.length - a.length;
                });
                f += 'switch(str.length){';
                for (var i = 0; i < cats.length; ++i) {
                    var cat = cats[i];
                    f += 'case ' + cat[0].length + ':';
                    compareTo(cat);
                }
                f += '}';
            } else {
                compareTo(words);
            }
            return new Function('str', f);
        };
        _.makePredicate2 = function (words) {
            if (typeof words !== 'string') {
                words = words.join(' ');
            }
            return function (word) {
                return ~words.indexOf(word);
            };
        };
        _.perf = function (fn, times, args) {
            var date = +new Date();
            for (var i = 0; i < times; i++) {
                fn.apply(this, args || []);
            }
            return +new Date() - date;
        };
        _.extend = function (o1, o2, override) {
            for (var j in o2) {
                if (o1[j] == null || override)
                    o1[j] = o2[j];
            }
            return o1;
        };
        _.log = function () {
            console.log.apply(console, arguments);
        };
        _.warn = function () {
            console.warn.apply(console, arguments);
        };
        _.error = function () {
            console.error.apply(console, arguments);
        };
        module.exports = _;
    },
    '3': function (require, module, exports, global) {
        var tk = require('1'), tree = require('4'), functions = require('5'), Color = require('6'), _ = require('2'), symtab = require('7'), perror = new Error(), test_t, slice = [].slice;
        var combos = [
                'WS',
                '>',
                '~',
                '+'
            ];
        var skipStart = 'WS NEWLINE COMMENT ;';
        var operators = '+ - * /';
        var isSkipStart = _.makePredicate(skipStart);
        var isCombo = _.makePredicate(combos);
        var isSelectorSep = _.makePredicate(combos.concat([
                'PSEUDO_CLASS',
                'PSEUDO_ELEMENT',
                'ATTRIBUTE',
                'CLASS',
                'HASH',
                '&',
                'IDENT',
                '*'
            ]));
        var isOperator = _.makePredicate(operators);
        var isColor = _.makePredicate('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen');
        var isMcssAtKeyword = _.makePredicate('mixin extend var');
        var isMcssFutureAtKeyword = _.makePredicate('if else css for');
        var isCssAtKeyword = _.makePredicate('import page keyframe media font-face charset');
        var isShorthandProp = _.makePredicate('background font margin border border-top border-right border-bottom border-left border-width border-color border-style transition padding list-style border-radius.');
        var isWSOrNewLine = _.makePredicate('WS NEWLINE');
        var isCommaOrParen = _.makePredicate(', )');
        var mayNotPsedudoClass = /^:-?[_A-Za-z][-_\w]*$/;
        var isBuildInFunction = function (name) {
            return !!biFunctions[name];
        };
        function Parser(input, options) {
            if (input)
                this.setInput(input, options);
        }
        exports.Parser = Parser;
        exports.parse = function (input, options) {
            var parser = new Parser(input, options);
            return parser.parse();
        };
        Parser.prototype = {
            parse: function (input, options) {
                return this.stylesheet();
            },
            setInput: function (input, options) {
                this.options = options || {};
                this.tokenizer = tk(input, _.extend(options || {}, { ignoreComment: true }));
                this.lookahead = this.tokenizer.pump();
                this.p = 0;
                this.length = this.lookahead.length;
                this.states = ['accept'];
                this.state = 'accept';
                this.scope = this.options.scope || new symtab.Scope();
                this.rulesets = [];
                this.marked = null;
                return this;
            },
            next: function (k) {
                k = k || 1;
                this.p += k;
            },
            pushState: function (condition) {
                this.states.push(condition);
                this.state = condition;
            },
            popState: function () {
                this.states.pop();
                this.state = this.states[this.states.length - 1];
            },
            match: function (tokenType, val) {
                if (!this.eat(tokenType, val)) {
                    var ll = this.ll();
                    this.error('expect:"' + tokenType + '" -> got: "' + ll.type + (ll.val ? String(ll.val) : '') + '"');
                }
            },
            expect: function (tokenType, val) {
            },
            matcheNewLineOrSemeColon: function () {
                if (this.eat(';')) {
                    return true;
                } else if (this.eat('NEWLINE')) {
                    return true;
                } else {
                    this.error('expect: "NEWLINE" or ";"' + '->got: ' + this.ll().type);
                }
            },
            ll: function (k) {
                k = k || 1;
                if (this.p + k > this.length) {
                    return this.lookahead[this.length - 1];
                }
                return this.lookahead[this.p + k - 1];
            },
            la: function (k) {
                return this.ll(k).type;
            },
            is: function (pos, tokenType) {
                return this.la(pos) === tokenType;
            },
            mark: function () {
                this.marked = this.p;
            },
            restore: function () {
                if (this.marked != undefined)
                    this.p = this.marked;
                this.marked = null;
            },
            eat: function (tokenType) {
                if (this.la() === tokenType) {
                    this.next();
                    return true;
                }
            },
            skip: function (type) {
                var skiped, la, test;
                while (true) {
                    la = this.la();
                    test = typeof type === 'string' ? type === la : type(la);
                    if (test) {
                        this.next();
                        skiped = true;
                    } else
                        break;
                }
                return skiped;
            },
            skipStart: function () {
                return this.skip(isSkipStart);
            },
            skipWSorNewlne: function () {
                return this.skip(isWSOrNewLine);
            },
            error: function (msg) {
                console.log(this.stylesheet, this.ll(-3), this.ll(-1), this.ll(1), this.ll(2));
                throw Error(msg + ' on line:' + this.ll().lineno);
            },
            down: function (ruleset) {
                if (ruleset)
                    this.rulesets.push(ruleset);
                this.scope = new symtab.Scope(this.scope);
            },
            up: function (ruleset) {
                if (ruleset)
                    this.rulesets.pop();
                this.scope = this.scope.getOuterScope();
            },
            concatSelector: function (selectorList) {
                var ss = this.rulesets;
                if (!ss.length)
                    return selectorList;
                var parentList = ss[ss.length - 1].selector, slist = selectorList.list, plist = parentList.list, slen = slist.length, plen = plist.length, sstring, pstring, rstring, s, p, res;
                var res = new tree.SelectorList();
                for (p = 0; p < plen; p++) {
                    pstring = plist[p].string;
                    for (s = 0; s < slen; s++) {
                        sstring = slist[s].string;
                        if (~sstring.indexOf('&')) {
                            rstring = sstring.replace(/&/g, pstring);
                        } else {
                            rstring = pstring + ' ' + sstring;
                        }
                        res.list.push(new tree.ComplexSelector(rstring));
                    }
                }
                return res;
            },
            stylesheet: function () {
                var node = new tree.Stylesheet();
                this.stylesheet = node;
                while (this.la(1) !== 'EOF') {
                    this.skipStart();
                    var stmt = this.stmt();
                    node.list.push(stmt);
                    this.skipStart();
                }
                return node;
            },
            stmt: function () {
                var tokenType = this.la(1);
                var ll = this.ll(), ll2 = this.ll(2), la = ll.type, la2 = ll2.type;
                if (la === 'AT_KEYWORD') {
                    return this.atrule();
                }
                if (la === 'IDENT') {
                    var start = ll.val.charAt(0);
                    if (start === '$')
                        return this.var(true);
                }
                if (isSelectorSep(la)) {
                    return this.ruleset(true);
                }
                this.error('invliad statementstart');
            },
            atrule: function () {
                var lv = this.ll().val.toLowerCase();
                var node;
                if (this[lv]) {
                    node = this[lv]();
                    return node;
                }
                ;
                return this.unkownAtRule();
            },
            var: function (type) {
                if (!type) {
                    this.next();
                    this.match('WS');
                }
                var node = new tree.Variable(), la, ll = this.ll();
                this.match('IDENT');
                this.match('WS');
                node.name = ll.val;
                node.value = this.componentValues();
                this.matcheNewLineOrSemeColon();
                this.scope.define(node.name, node);
                return node;
            },
            css: function () {
            },
            mixin: function () {
                this.match('AT_KEYWORD');
                this.match('WS');
                var name = this.ll().val;
                this.match('FUNCTION');
                var node = new tree.Mixin(name);
                this.eat('WS');
                node.formalParams = [];
                if (this.eat('(')) {
                    this.skipWSorNewlne();
                    if (this.la() !== ')') {
                        do {
                            node.formalParams.push(this.param());
                            this.skipWSorNewlne();
                        } while (this.eat(','));
                    }
                }
                this.match(')');
                this.skipWSorNewlne();
                this.down();
                node.scope = this.scope;
                node.block = this.block();
                this.up();
                this.scope.define(node.name, node);
                return node;
            },
            param: function () {
                var ll = this.ll();
                this.match('IDENT');
                return new tree.Param(ll.val);
            },
            extend: function () {
                this.match('AT_KEYWORD');
                this.match('WS');
                var ll = this.ll();
                var la = ll.type;
                var node;
                if (la === 'IDENT' || la === 'CLASS') {
                    var mixin = this.scope.resolve(ll.val);
                    if (!mixin) {
                        this.error('undefined mixin -> ' + ll.val);
                    }
                    if (mixin.refs === undefined) {
                        this.error('not a expected type mixin -> ' + ll.val);
                    } else {
                        this.next();
                        node = new tree.Extend();
                        node.mixin = mixin;
                        this.matcheNewLineOrSemeColon();
                        return node;
                    }
                }
                this.error('invalid extend at rule');
            },
            include: function () {
                var node = new tree.Include();
                this.match('AT_KEYWORD');
                this.match('WS');
                node.name = this.ll().val;
                this.match('FUNCTION');
                if (this.eat('(')) {
                    this.skipWSorNewlne();
                    if (this.la() !== ')') {
                        do {
                            node.params.push(this.componentValues(isCommaOrParen));
                            if (this.la() === ')')
                                break;
                        } while (this.eat(','));
                    }
                    this.match(')');
                }
                this.matcheNewLineOrSemeColon();
                node.scope = this.scope;
                return node;
            },
            import: function () {
            },
            media: function () {
            },
            media_query_list: function () {
            },
            media_query: function () {
            },
            'font-face': function () {
            },
            charset: function () {
            },
            keyframe: function () {
            },
            page: function () {
            },
            unknownAtRule: function () {
            },
            ruleset: function () {
                var node = new tree.RuleSet(), rule;
                node.selector = this.concatSelector(this.selectorList());
                this.skipWSorNewlne();
                this.down(node);
                node.block = this.block();
                this.up(node);
                return node;
            },
            block: function () {
                var node = new tree.Block();
                this.match('{');
                this.skipStart();
                while (this.la() !== '}') {
                    this.skipStart();
                    if (this.ll(1).type == '*' && this.ll(2).type == 'IDENT') {
                        this.ll(2).val = '*' + this.ll(2).val;
                        this.next();
                    }
                    var ll1 = this.ll(1);
                    var ll2 = this.ll(2);
                    if (ll1.type === 'IDENT' && (ll2.type === ':' || ll2.type == 'PSEUDO_CLASS')) {
                        try {
                            this.mark();
                            var declaration = this.declaration();
                            node.list.push(declaration);
                        } catch (_e) {
                            if (_e.code === 1987) {
                                this.restore();
                                node.list.push(this.stmt());
                            } else {
                                throw _e;
                            }
                        }
                    } else {
                        node.list.push(this.stmt());
                    }
                    this.skipStart();
                }
                this.match('}');
                return node;
            },
            selectorList: function () {
                var node = new tree.SelectorList();
                node.list.push(this.complexSelector());
                this.skipWSorNewlne();
                while (this.la() === ',') {
                    this.next();
                    this.skipWSorNewlne();
                    node.list.push(this.complexSelector());
                    this.skipWSorNewlne();
                }
                return node;
            },
            complexSelector: function () {
                var node = new tree.ComplexSelector();
                var selectorString = '';
                while (true) {
                    var ll = this.ll();
                    if (isSelectorSep(ll.type)) {
                        selectorString += ll.val || (ll.type === 'WS' ? ' ' : ll.type);
                        this.next();
                    } else {
                        break;
                    }
                }
                node.string = selectorString;
                return node;
            },
            declaration: function (checked) {
                var node = new tree.Declaration(), ll1 = this.ll(1), ll2 = this.ll(2);
                node.property = ll1.val;
                this.next(2);
                node.value = this.componentValues();
                this.matcheNewLineOrSemeColon();
                if (ll2.type !== ':')
                    node.value.list.unshift({
                        type: 'IDENT',
                        val: ll2.val.slice(1)
                    });
                return node;
            },
            componentValues: function (end) {
                if (end) {
                    var test = typeof end === 'string' ? function (type) {
                            type === end;
                        } : end;
                }
                var node = new tree.ComponentValues(), ll, la, i = 10;
                while (i++) {
                    ll = this.ll(1);
                    la = ll.type;
                    if (i > 100)
                        throw Error('dada');
                    if (la === 'IMPORTANT') {
                        this.next();
                        node.important = true;
                        this.matcheNewLineOrSemeColon();
                        break;
                    }
                    if (test && test(la) || (la === 'NEWLINE' || la === ';')) {
                        break;
                    } else {
                        var componentValue = this.componentValue();
                        if (componentValue instanceof tree.ComponentValues) {
                            node.list = node.list.concat(componentValue.list);
                        } else if (componentValue !== null)
                            node.list.push(componentValue);
                    }
                }
                return node;
            },
            componentValue: function () {
                var ll1 = this.ll(1);
                var node, val = ll1.val, res;
                switch (ll1.type) {
                case '{':
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
                default:
                    return this.expression();
                }
            },
            expression: function (prefix) {
                var ll = this.ll(1), la = ll.type, node;
                switch (ll.type) {
                case '(':
                    node = this.parenExpression();
                    break;
                case 'DIMENSION':
                    node = this.additive();
                    break;
                case '+':
                case '-':
                    if (this.ll(2) !== 'ws') {
                        node = this.expression(ll.type);
                    } else {
                        node = ll;
                    }
                case 'WS':
                case 'NEWLINE':
                    this.next();
                    node = this.expression();
                    break;
                case 'IDENT':
                case 'STRING':
                case 'RGBA':
                case 'URI':
                    this.next();
                    node = ll;
                    break;
                case 'HASH':
                    this.next();
                    val = ll.val;
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
                        node = new tree.RGBA(new Color(val));
                    } else {
                        node = new tree.Unknown(ll.val);
                    }
                    break;
                case 'FUNCTION':
                    this.next();
                    this.match('(');
                    var fn = functions[ll.val];
                    if (!fn) {
                        node = new tree.CssFunction(ll.val);
                        node.value = this.componentValues(')');
                        this.match(')');
                    } else {
                        var params = [];
                        this.skipWSorNewlne();
                        if (this.la() !== ')') {
                            do {
                                params.push(this.expression());
                            } while (this.la() === ',');
                        }
                        this.match(')');
                        node = fn.apply(this, params);
                        if (typeof node === 'string') {
                            node = new tree.Unknown(node);
                        }
                    }
                    break;
                default:
                    this.error('invalid expression start:' + ll.type);
                }
                if (node && node.type === 'DIMENSION') {
                    if (prefix === '-') {
                        node.val.number = 0 - node.val.number;
                    }
                }
                return node;
            },
            additive: function (options) {
                var left = this.multive(), right;
                this.eat('WS');
                var op = this.ll();
                if (op.type === '+' || op.type === '-') {
                    this.next();
                    this.eat('WS');
                    right = this.additive();
                    return this._add(left, right, op.type);
                } else {
                    return left;
                }
            },
            multive: function () {
                var left = this.primary(), right;
                var op = this.ll();
                if (op.type === '*' || op.type === '/') {
                    this.next();
                    right = this.multive();
                    return this._mult(left, right, op.type);
                } else {
                    return left;
                }
            },
            _add: function (d1, d2, op) {
                var val1 = d1.val, val2 = d2.val, unit, number;
                if (val1.unit) {
                    unit = val1.unit;
                } else {
                    unit = val2.unit;
                }
                if (op === '+') {
                    number = val1.number + val2.number;
                } else {
                    number = val1.number - val2.number;
                }
                return {
                    type: 'DIMENSION',
                    val: {
                        number: number,
                        unit: unit
                    }
                };
            },
            _mult: function (d1, d2, op) {
                var val1 = d1.val, val2 = d2.val, unit, number;
                if (val1.unit) {
                    unit = val1.unit;
                } else {
                    unit = val2.unit;
                }
                if (op === '*') {
                    number = val1.number * val2.number;
                } else {
                    if (val2.number === 0)
                        this.error('can"t divid by zero');
                    number = val1.number / val2.number;
                }
                return {
                    type: 'DIMENSION',
                    val: {
                        number: number,
                        unit: unit
                    }
                };
            },
            primary: function () {
                var ll = this.ll();
                if (ll.type === 'DIMENSION') {
                    this.next();
                    return ll;
                }
                if (ll.type === '(') {
                    this.next();
                    var d1 = this.additive();
                    this.match(')');
                    return d1;
                }
                this.error('invalid primary');
            },
            parenExpression: function () {
                this.match('(');
                var t = this.expression();
                this.match(')');
                return t;
            },
            _lookahead: function () {
                return this.lookahead.map(function (item) {
                    return item.type;
                }).join(',');
            }
        };
    },
    '4': function (require, module, exports, global) {
        function Stylesheet(list) {
            this.list = list || [];
        }
        Stylesheet.prototype.clone = function () {
            var clone = new Stylesheet();
            clone.list = cloneNode(this.list);
            return clone;
        };
        function SelectorList(list) {
            this.list = list || [];
        }
        SelectorList.prototype.clone = function () {
            var clone = new SelectorList();
            clone.list = cloneNode(this.list);
            return clone;
        };
        function ComplexSelector(string) {
            this.string = string;
        }
        ComplexSelector.prototype.clone = function () {
            var clone = new ComplexSelector();
            return clone;
        };
        function RuleSet(selector, block) {
            this.selector = selector;
            this.block = block;
        }
        RuleSet.prototype.remove = function (ruleset) {
        };
        RuleSet.prototype.clone = function () {
            var clone = new RuleSet(cloneNode(this.selector), cloneNode(this.block));
            return clone;
        };
        function Block(list) {
            this.list = list || [];
        }
        Block.prototype.clone = function () {
            var clone = new Block(cloneNode(this.list));
            return clone;
        };
        function Declaration(property, value) {
            this.property = property;
            this.value = value;
        }
        Declaration.prototype.clone = function () {
            var clone = new Declaration(this.property, cloneNode(this.value));
            return clone;
        };
        function ComponentValues() {
            this.list = [];
        }
        ComponentValues.prototype.clone = function () {
            var clone = new ComponentValues(cloneNode(this.list));
            return clone;
        };
        function FunctionCall(name, params) {
            this.params = params || [];
            this.name = name;
        }
        FunctionCall.prototype.clone = function () {
            var clone = new FunctionCall(this.name, cloneNode(this.params));
            return clone;
        };
        function Unknown(name) {
            this.name = name;
        }
        Unknown.prototype.clone = function () {
            var clone = new Unknown(this.name);
            return clone;
        };
        function RGBA(channels) {
            this.channels = channels || [];
        }
        RGBA.prototype.clone = function () {
            var clone = new RGBA(cloneNode(this.channels));
            return clone;
        };
        function Token(tk) {
            tk = tk || {};
            this.val = tk.val;
            this.type = tk.type;
        }
        function Variable(name, value, kind) {
            this.kind = kind || 'var';
            this.name = name;
            this.value = value || [];
        }
        function Mixin(name, params, block) {
            this.name = name;
            this.formalParams = params || [];
            this.block = block;
        }
        function Param(name, value) {
            this.name = name;
            this.default = value;
        }
        function Include(mixin, params) {
            this.name = name;
            this.params = params || [];
        }
        function Extend(mixin) {
            this.mixin = mixin;
        }
        function CssFunction(name, value) {
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
        function FontFace() {
        }
        function Media(name, mediaList) {
            this.name = name;
            this.media = mediaList;
        }
        function Import(href, mediaList, block) {
            this.href = href;
            this.media = mediaList;
            this.block = block;
        }
        function Page() {
        }
        function Charset() {
        }
        function NameSpace() {
        }
        exports.inspect = function (node) {
            return node.constructor.name.toLowerCase();
        };
        var cloneNode = exports.cloneNode = function (node) {
                if (node.clone)
                    return node.clone();
                if (Array.isArray(node))
                    return node.map(cloneNode);
                if (node.type)
                    return {
                        type: node.type,
                        val: node.val
                    };
                if (typeof node !== 'object')
                    return node;
            };
    },
    '5': function (require, module, exports, global) {
        var fs = null;
        var path = null;
        var slice = [].slice;
        var tree = require('4');
        var Color = require('6');
        exports.add = function () {
            return options.args.reduce(function (a, b) {
                return a + b;
            });
        };
        exports.base64 = function () {
            var dirname = options.dirname;
            if (!fs) {
                return 'url(' + options.args[0] + ')';
            } else {
            }
        };
        exports.u = function (string) {
            if (string.type !== 'STRING') {
                throw Error('mcss function "u" only accept string');
            }
            return string.val;
        };
        exports.lighen = function () {
        };
        exports.darken = function () {
        };
        var mediatypes = {
                '.eot': 'application/vnd.ms-fontobject',
                '.gif': 'image/gif',
                '.ico': 'image/vnd.microsoft.icon',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.otf': 'application/x-font-opentype',
                '.png': 'image/png',
                '.svg': 'image/svg+xml',
                '.ttf': 'application/x-font-ttf',
                '.webp': 'image/webp',
                '.woff': 'application/x-font-woff'
            };
        function converToBase64(imagePath) {
            imagePath = imagePath.replace(/[?#].*/g, '');
            var extname = path.extname(imagePath), stat, img;
            try {
                stat = fs.statSync(imagePath);
                if (stat.size > 4096) {
                    return false;
                }
                img = fs.readFileSync(imagePath, 'base64');
                return 'data:' + mediatypes[extname] + ';base64,' + img;
            } catch (e) {
                return false;
            }
        }
    },
    '6': function (require, module, exports, global) {
        'use strict';
        var Color = module.exports = function () {
                var str = 'string', Color = function Color(r, g, b, a) {
                        var color = this, args = arguments.length, parseHex = function (h) {
                                return parseInt(h, 16);
                            };
                        if (args < 3) {
                            if (typeof r === str) {
                                r = r.substr(r.indexOf('#') + 1);
                                var threeDigits = r.length === 3;
                                r = parseHex(r);
                                threeDigits && (r = (r & 3840) * 4352 | (r & 240) * 272 | (r & 15) * 17);
                            }
                            args === 2 && (a = g);
                            g = (r & 65280) / 256;
                            b = r & 255;
                            r = r >>> 16;
                        }
                        if (!(color instanceof Color)) {
                            return new Color(r, g, b, a);
                        }
                        this.channels = [
                            typeof r === str && parseHex(r) || r,
                            typeof g === str && parseHex(g) || g,
                            typeof b === str && parseHex(b) || b,
                            typeof a !== str && typeof a !== 'number' && 1 || typeof a === str && parseFloat(a) || a
                        ];
                    }, proto = Color.prototype, undef = 'undefined', lowerCase = 'toLowerCase', math = Math, colorDict;
                Color.RGBtoHSL = function (rgb) {
                    var r = rgb[0], g = rgb[1], b = rgb[2];
                    r /= 255;
                    g /= 255;
                    b /= 255;
                    var max = math.max(r, g, b), min = math.min(r, g, b), h, s, l = (max + min) / 2;
                    if (max === min) {
                        h = s = 0;
                    } else {
                        var d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        switch (max) {
                        case r:
                            h = (g - b) / d + (g < b ? 6 : 0);
                            break;
                        case g:
                            h = (b - r) / d + 2;
                            break;
                        case b:
                            h = (r - g) / d + 4;
                            break;
                        }
                        h /= 6;
                    }
                    return [
                        h,
                        s,
                        l
                    ];
                };
                Color.HSLtoRGB = function (hsl) {
                    var h = hsl[0], s = hsl[1], l = hsl[2], r, g, b, hue2rgb = function (p, q, t) {
                            if (t < 0) {
                                t += 1;
                            }
                            if (t > 1) {
                                t -= 1;
                            }
                            if (t < 1 / 6) {
                                return p + (q - p) * 6 * t;
                            }
                            if (t < 1 / 2) {
                                return q;
                            }
                            if (t < 2 / 3) {
                                return p + (q - p) * (2 / 3 - t) * 6;
                            }
                            return p;
                        };
                    if (s === 0) {
                        r = g = b = l;
                    } else {
                        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
                        r = hue2rgb(p, q, h + 1 / 3);
                        g = hue2rgb(p, q, h);
                        b = hue2rgb(p, q, h - 1 / 3);
                    }
                    return [
                        r * 255,
                        g * 255,
                        b * 255
                    ];
                };
                Color.rgb = function (r, g, b, a) {
                    return new Color(r, g, b, typeof a !== undef ? a : 1);
                };
                Color.hsl = function (h, s, l, a) {
                    var rgb = Color.HSLtoRGB([
                            h,
                            s,
                            l
                        ]), ceil = math.ceil;
                    return new Color(ceil(rgb[0]), ceil(rgb[1]), ceil(rgb[2]), typeof a !== undef ? a : 1);
                };
                Color.TO_STRING_METHOD = 'hexTriplet';
                Color.parse = function (color) {
                    color = color.replace(/^\s+/g, '')[lowerCase]();
                    if (color[0] === '#') {
                        return new Color(color);
                    }
                    var cssFn = color.substr(0, 3), i;
                    color = color.replace(/[^\d,.]/g, '').split(',');
                    i = color.length;
                    while (i--) {
                        color[i] = color[i] && parseFloat(color[i]) || 0;
                    }
                    switch (cssFn) {
                    case 'rgb':
                        return Color.rgb.apply(Color, color);
                    case 'hsl':
                        color[0] /= 360;
                        color[1] /= 100;
                        color[2] /= 100;
                        return Color.hsl.apply(Color, color);
                    }
                    return null;
                };
                Color.define = function (color, rgb) {
                    colorDict[color[lowerCase]()] = rgb;
                };
                Color.get = function (color) {
                    color = color[lowerCase]();
                    if (Object.prototype.hasOwnProperty.call(colorDict, color)) {
                        return Color.apply(null, [].concat(colorDict[color]));
                    }
                    return null;
                };
                Color.del = function (color) {
                    return delete colorDict[color[lowerCase]()];
                };
                Color.random = function (rangeStart, rangeEnd) {
                    typeof rangeStart === str && (rangeStart = Color.get(rangeStart)) && (rangeStart = rangeStart.getValue());
                    typeof rangeEnd === str && (rangeEnd = Color.get(rangeEnd)) && (rangeEnd = rangeEnd.getValue());
                    var floor = math.floor, random = math.random;
                    rangeEnd = (rangeEnd || 16777215) + 1;
                    if (!isNaN(rangeStart)) {
                        return new Color(floor(random() * (rangeEnd - rangeStart) + rangeStart));
                    }
                    return new Color(floor(random() * rangeEnd));
                };
                proto.toString = function () {
                    return this[Color.TO_STRING_METHOD]();
                };
                proto.valueOf = proto.getValue = function () {
                    var channels = this.channels;
                    return channels[0] * 65536 | channels[1] * 256 | channels[2];
                };
                proto.setValue = function (value) {
                    this.channels.splice(0, 3, value >>> 16, (value & 65280) / 256, value & 255);
                };
                proto.hexTriplet = '01'.substr(-1) === '1' ? function () {
                    return '#' + ('00000' + this.getValue().toString(16)).substr(-6);
                } : function () {
                    var str = this.getValue().toString(16);
                    return '#' + new Array(str.length < 6 ? 6 - str.length + 1 : 0).join('0') + str;
                };
                proto.css = function () {
                    var color = this;
                    return color.channels[3] === 1 ? color.hexTriplet() : color.rgba();
                };
                proto.rgbData = function () {
                    return this.channels.slice(0, 3);
                };
                proto.hslData = function () {
                    return Color.RGBtoHSL(this.rgbData());
                };
                proto.rgb = function () {
                    return 'rgb(' + this.rgbData().join(',') + ')';
                };
                proto.rgba = function () {
                    return 'rgba(' + this.channels.join(',') + ')';
                };
                proto.hsl = function () {
                    var hsl = this.hslData();
                    return 'hsl(' + hsl[0] * 360 + ',' + hsl[1] * 100 + '%,' + hsl[2] * 100 + '%)';
                };
                proto.hsla = function () {
                    var hsl = this.hslData();
                    return 'hsla(' + hsl[0] * 360 + ',' + hsl[1] * 100 + '%,' + hsl[2] * 100 + '%,' + this.channels[3] + ')';
                };
                return Color;
            }();
    },
    '7': function (require, module, exports, global) {
        var Symtable = exports.SymbolTable = function () {
            };
        var Scope = exports.Scope = function (parentScope) {
                this.parentScope = parentScope;
                this.symtable = {};
            };
        Scope.prototype = {
            getSpace: function () {
                return this.symtable;
            },
            resolve: function (name) {
                var scope = this;
                while (scope) {
                    var symbol = scope.symtable[name];
                    if (symbol)
                        return symbol;
                    else
                        scope = scope.parentScope;
                }
            },
            define: function (name, value) {
                this.symtable[name] = value;
                return this;
            },
            getOuterScope: function () {
                return this.parentScope;
            }
        };
    },
    '8': function (require, module, exports, global) {
        var Translator = require('9');
        var Parser = require('3');
        var hook = require('b');
        exports.translate = function (ast, options) {
            if (typeof ast == 'string') {
                ast = Parser.parse(ast);
            }
            ast = hook.hook(ast, options);
            return new Translator(options).translate(ast);
        };
    },
    '9': function (require, module, exports, global) {
        var Walker = require('a');
        var event = null;
        function Translator(options) {
            this.parser = parser;
            this.tokenizer = tokenizer;
        }
        var _ = Translator.prototype = new Walker();
        var walk = _.walk;
        _.translate = function (tree) {
            this.tree = tree;
            this.walk(tree);
            this.indent = 1;
        };
        _.walk_stylesheet = function (tree) {
            var cssText = '';
            var bodyText = this.walk(tree.body);
            console.log(bodyText.join('\n'));
        };
        _.walk_ruleset = function (tree) {
            var cssTexts = [this.walk(tree.selector)];
            cssTexts.push(this.walk(tree.block));
            return cssTexts.join('');
        };
        _.walk_selectorlist = function (tree) {
            return this.walk(tree.list).join(', ');
        };
        _.walk_complexselector = function (tree) {
            return tree.string;
        };
        _.walk_block = function (tree) {
            var text = '\t' + this.walk(tree.list).join('\n\t');
            return '{\n' + text + '\n}';
        };
        _.walk_componentvalues = function (tree) {
            var text = this.walk(tree.list).join(' ');
            return text;
        };
        _.walk_declaration = function (tree) {
            var text = tree.property;
            var value = this.walk(tree.value);
            return text + ': ' + value + ';';
        };
        _.walk_ident = function (tree) {
            return tree.val;
        };
        _.walk_string = function (tree) {
            return '"' + tree.val + '"';
        };
        _['walk_,'] = function (tree) {
            return ',';
        };
        _['walk_='] = function (tree) {
            return '=';
        };
        _.walk_unknown = function (tree) {
            return tree.name;
        };
        _.walk_cssfunction = function (tree) {
            return tree.name + '(' + this.walk(tree.value) + ')';
        };
        _.walk_uri = function (tree) {
            return 'url(' + tree.val + ')';
        };
        _.walk_rgba = function (tree) {
            return tree.color.css();
        };
        _.walk_dimension = function (tree) {
            var val = tree.val;
            return val.number + (val.unit ? val.unit : '');
        };
        _.walk_variable = function () {
            return '';
        };
        module.exports = Translator;
    },
    'a': function (require, module, exports, global) {
        var _ = require('2');
        var Walker = function () {
        };
        Walker.prototype = {
            constructor: Walker,
            walk: function (node) {
                if (Array.isArray(node)) {
                    return this._walkArray(node);
                } else {
                    return this._walk(node);
                }
            },
            walk_defaut: function (node) {
                if (node.list || node.body) {
                    return this.walk(node.list || node.body);
                } else if (node.type && this.walk_token) {
                    return this.walk_token(node);
                } else {
                    console.error('no "' + this._inspect(node) + '" walk defined');
                }
            },
            _walkArray: function (nodes) {
                var self = this;
                var res = [];
                nodes.forEach(function (node) {
                    if (node)
                        res.push(self._walk(node));
                });
                return res;
            },
            _walk: function (node) {
                var sign = this._inspect(node), name = 'walk_' + sign;
                if (this[name])
                    return this[name](node);
                else
                    return this.walk_defaut(node);
            },
            _inspect: function (node) {
                return node.type ? node.type.toLowerCase() : node.constructor.name.toLowerCase();
            },
            error: function (e) {
                throw e;
            }
        };
        module.exports = Walker;
    },
    'b': function (require, module, exports, global) {
        var Hook = require('c');
        exports.hook = function (ast, options) {
            new Hook(options).walk(ast);
            return ast;
        };
    },
    'c': function (require, module, exports, global) {
        var Walker = require('a');
        var Event = require('d');
        var hooks = require('e');
        function Hook(options) {
            options = options || {};
            this.load(options.hooks);
        }
        var _ = Hook.prototype = new Walker();
        Event.mixTo(_);
        var on = _.on;
        var walk = _._walk;
        _.load = function (names) {
            if (!names)
                return;
            var name;
            if (!(names instanceof Array)) {
                names = [names];
            }
            for (var i = 0, len = names.length; i < len; i++) {
                name = names[i];
                if (typeof name === 'string') {
                    this.on(hooks[name]);
                } else {
                    this.on(name);
                }
            }
        };
        _.on = function (name) {
            if (typeof name === 'string' && !~name.indexOf(':')) {
                name = name + ':up';
            }
            on.apply(this, arguments);
        };
        _._walk = function (tree) {
            var name = this._inspect(tree);
            if (name)
                this.trigger(name + ':' + 'down', tree);
            var res = walk.apply(this, arguments);
            if (name)
                this.trigger(name + ':' + 'up', tree);
            return res;
        };
        _.walk_stylesheet = function (tree) {
            this.walk(tree.body);
        };
        _.walk_ruleset = function (tree) {
            this.walk(tree.block);
        };
        _.walk_selectorlist = function (tree) {
            this.walk(tree.list);
        };
        _.walk_complexselector = function (tree) {
        };
        _.walk_block = function (tree) {
            this.walk(tree.list);
        };
        _.walk_componentvalues = function (tree) {
            this.walk(tree.list);
        };
        _.walk_declaration = function (tree) {
            this.walk(tree.value);
        };
        _.walk_ident = function (tree) {
            return tree.val;
        };
        _.walk_string = function (tree) {
            return '"' + tree.val + '"';
        };
        _['walk_,'] = function (tree) {
            return ',';
        };
        _['walk_='] = function (tree) {
            return '=';
        };
        _.walk_unknown = function (tree) {
            return tree.name;
        };
        _.walk_cssfunction = function (tree) {
            return tree.name + '(' + this.walk(tree.value) + ')';
        };
        _.walk_uri = function (tree) {
            return 'url(' + tree.val + ')';
        };
        _.walk_rgba = function (tree) {
            return tree.color.css();
        };
        _.walk_dimension = function (tree) {
            var val = tree.val;
            return val.number + (val.unit ? val.unit : '');
        };
        _.walk_variable = function () {
            return '';
        };
        module.exports = Hook;
    },
    'd': function (require, module, exports, global) {
        var slice = [].slice, ex = function (o1, o2, override) {
                for (var i in o2)
                    if (o1[i] == null || override) {
                        o1[i] = o2[i];
                    }
            };
        var API = {
                on: function (event, fn) {
                    if (typeof event === 'object') {
                        for (var i in event) {
                            this.on(i, event[i]);
                        }
                    } else {
                        var handles = this._handles || (this._handles = {}), calls = handles[event] || (handles[event] = []);
                        calls.push(fn);
                    }
                    return this;
                },
                off: function (event, fn) {
                    if (event)
                        this._handles = [];
                    if (!this._handles)
                        return;
                    var handles = this._handles, calls;
                    if (calls = handles[event]) {
                        if (!fn) {
                            handles[event] = [];
                            return this;
                        }
                        for (var i = 0, len = calls.length; i < len; i++) {
                            if (fn === calls[i]) {
                                calls.splice(i, 1);
                                return this;
                            }
                        }
                    }
                    return this;
                },
                trigger: function (event) {
                    var args = slice.call(arguments, 1), handles = this._handles, calls;
                    if (!handles || !(calls = handles[event]))
                        return this;
                    for (var i = 0, len = calls.length; i < len; i++) {
                        calls[i].apply(this, args);
                    }
                    return this;
                }
            };
        function Event(handles) {
            if (arguments.length)
                this.on.apply(this, arguments);
        }
        ;
        ex(Event.prototype, API);
        Event.mixTo = function (obj) {
            obj = typeof obj == 'function' ? obj.prototype : obj;
            ex(obj, API);
        };
        module.exports = Event;
    },
    'e': function (require, module, exports, global) {
        module.exports = {
            prefixr: require('f'),
            csscomb: require('h')
        };
    },
    'f': function (require, module, exports, global) {
        var prefixs = require('g').prefixs;
        module.exports = {
            block: function (tree) {
            }
        };
    },
    'g': function (require, module, exports, global) {
        exports.orders = {
            'position': 1,
            'z-index': 1,
            'top': 1,
            'right': 1,
            'bottom': 1,
            'left': 1,
            'display': 2,
            'visibility': 2,
            'float': 2,
            'clear': 2,
            'overflow': 2,
            'overflow-x': 2,
            'overflow-y': 2,
            '-ms-overflow-x': 2,
            '-ms-overflow-y': 2,
            'clip': 2,
            'zoom': 2,
            'flex-direction': 2,
            'flex-order': 2,
            'flex-pack': 2,
            'flex-align': 2,
            '-webkit-box-sizing': 3,
            '-moz-box-sizing': 3,
            'box-sizing': 3,
            'width': 3,
            'min-width': 3,
            'max-width': 3,
            'height': 3,
            'min-height': 3,
            'max-height': 3,
            'margin': 3,
            'margin-top': 3,
            'margin-right': 3,
            'margin-bottom': 3,
            'margin-left': 3,
            'padding': 3,
            'padding-top': 3,
            'padding-right': 3,
            'padding-bottom': 3,
            'padding-left': 3,
            'table-layout': 4,
            'empty-cells': 4,
            'caption-side': 4,
            'border-spacing': 4,
            'border-collapse': 6,
            'list-style': 4,
            'list-style-position': 4,
            'list-style-type': 4,
            'list-style-image': 4,
            'content': 5,
            'quotes': 5,
            'counter-reset': 5,
            'counter-increment': 5,
            'resize': 5,
            'cursor': 5,
            'nav-index': 5,
            'nav-up': 5,
            'nav-right': 5,
            'nav-down': 5,
            'nav-left': 5,
            '-webkit-transition': 5,
            '-moz-transition': 5,
            '-ms-transition': 5,
            '-o-transition': 5,
            'transition': 5,
            '-webkit-transition-delay': 5,
            '-moz-transition-delay': 5,
            '-ms-transition-delay': 5,
            '-o-transition-delay': 5,
            'transition-delay': 5,
            '-webkit-transition-timing-function': 5,
            '-moz-transition-timing-function': 5,
            '-ms-transition-timing-function': 5,
            '-o-transition-timing-function': 5,
            'transition-timing-function': 5,
            '-webkit-transition-duration': 5,
            '-moz-transition-duration': 5,
            '-ms-transition-duration': 5,
            '-o-transition-duration': 5,
            'transition-duration': 5,
            '-webkit-transition-property': 5,
            '-moz-transition-property': 5,
            '-ms-transition-property': 5,
            '-o-transition-property': 5,
            'transition-property': 5,
            '-webkit-transform': 5,
            '-moz-transform': 5,
            '-ms-transform': 5,
            '-o-transform': 5,
            'transform': 5,
            '-webkit-transform-origin': 5,
            '-moz-transform-origin': 5,
            '-ms-transform-origin': 5,
            '-o-transform-origin': 5,
            'transform-origin': 5,
            '-webkit-animation': 5,
            '-moz-animation': 5,
            '-ms-animation': 5,
            '-o-animation': 5,
            'animation': 5,
            '-webkit-animation-name': 5,
            '-moz-animation-name': 5,
            '-ms-animation-name': 5,
            '-o-animation-name': 5,
            'animation-name': 5,
            '-webkit-animation-duration': 5,
            '-moz-animation-duration': 5,
            '-ms-animation-duration': 5,
            '-o-animation-duration': 5,
            'animation-duration': 5,
            '-webkit-animation-play-state': 5,
            '-moz-animation-play-state': 5,
            '-ms-animation-play-state': 5,
            '-o-animation-play-state': 5,
            'animation-play-state': 5,
            '-webkit-animation-timing-function': 5,
            '-moz-animation-timing-function': 5,
            '-ms-animation-timing-function': 5,
            '-o-animation-timing-function': 5,
            'animation-timing-function': 5,
            '-webkit-animation-delay': 5,
            '-moz-animation-delay': 5,
            '-ms-animation-delay': 5,
            '-o-animation-delay': 5,
            'animation-delay': 5,
            '-webkit-animation-iteration-count': 5,
            '-moz-animation-iteration-count': 5,
            '-ms-animation-iteration-count': 5,
            '-o-animation-iteration-count': 5,
            'animation-iteration-count': 5,
            '-webkit-animation-direction': 5,
            '-moz-animation-direction': 5,
            '-ms-animation-direction': 5,
            '-o-animation-direction': 5,
            'animation-direction': 5,
            'text-align': 5,
            '-webkit-text-align-last': 5,
            '-moz-text-align-last': 5,
            '-ms-text-align-last': 5,
            'text-align-last': 5,
            'vertical-align': 5,
            'white-space': 5,
            'text-decoration': 5,
            'text-emphasis': 5,
            'text-emphasis-color': 5,
            'text-emphasis-style': 5,
            'text-emphasis-position': 5,
            'text-indent': 5,
            '-ms-text-justify': 5,
            'text-justify': 5,
            'text-transform': 5,
            'letter-spacing': 5,
            'word-spacing': 5,
            '-ms-writing-mode': 5,
            'text-outline': 5,
            'text-wrap': 5,
            'text-overflow': 5,
            '-ms-text-overflow': 5,
            'text-overflow-ellipsis': 5,
            'text-overflow-mode': 5,
            '-ms-word-wrap': 5,
            'word-wrap': 5,
            'word-break': 5,
            '-ms-word-break': 5,
            '-moz-tab-size': 5,
            '-o-tab-size': 5,
            'tab-size': 5,
            '-webkit-hyphens': 5,
            '-moz-hyphens': 5,
            'hyphens': 5,
            'pointer-events': 5,
            'opacity': 6,
            'filter:progid:DXImageTransform.Microsoft.Alpha(Opacity': 6,
            '-ms-filter:\'progid:DXImageTransform.Microsoft.Alpha': 6,
            '-ms-interpolation-mode': 6,
            'color': 6,
            'border': 6,
            'border-width': 6,
            'border-style': 6,
            'border-color': 6,
            'border-top': 6,
            'border-top-width': 6,
            'border-top-style': 6,
            'border-top-color': 6,
            'border-right': 6,
            'border-right-width': 6,
            'border-right-style': 6,
            'border-right-color': 6,
            'border-bottom': 6,
            'border-bottom-width': 6,
            'border-bottom-style': 6,
            'border-bottom-color': 6,
            'border-left': 6,
            'border-left-width': 6,
            'border-left-style': 6,
            'border-left-color': 6,
            '-webkit-border-radius': 6,
            '-moz-border-radius': 6,
            'border-radius': 6,
            '-webkit-border-top-left-radius': 6,
            '-moz-border-radius-topleft': 6,
            'border-top-left-radius': 6,
            '-webkit-border-top-right-radius': 6,
            '-moz-border-radius-topright': 6,
            'border-top-right-radius': 6,
            '-webkit-border-bottom-right-radius': 6,
            '-moz-border-radius-bottomright': 6,
            'border-bottom-right-radius': 6,
            '-webkit-border-bottom-left-radius': 6,
            '-moz-border-radius-bottomleft': 6,
            'border-bottom-left-radius': 6,
            '-webkit-border-image': 6,
            '-moz-border-image': 6,
            '-o-border-image': 6,
            'border-image': 6,
            '-webkit-border-image-source': 6,
            '-moz-border-image-source': 6,
            '-o-border-image-source': 6,
            'border-image-source': 6,
            '-webkit-border-image-slice': 6,
            '-moz-border-image-slice': 6,
            '-o-border-image-slice': 6,
            'border-image-slice': 6,
            '-webkit-border-image-width': 6,
            '-moz-border-image-width': 6,
            '-o-border-image-width': 6,
            'border-image-width': 6,
            '-webkit-border-image-outset': 6,
            '-moz-border-image-outset': 6,
            '-o-border-image-outset': 6,
            'border-image-outset': 6,
            '-webkit-border-image-repeat': 6,
            '-moz-border-image-repeat': 6,
            '-o-border-image-repeat': 6,
            'border-image-repeat': 6,
            'outline': 6,
            'outline-width': 6,
            'outline-style': 6,
            'outline-color': 6,
            'outline-offset': 6,
            'background': 6,
            'filter:progid:DXImageTransform.Microsoft.AlphaImageLoader': 6,
            'background-color': 6,
            'background-image': 6,
            'background-repeat': 6,
            'background-attachment': 6,
            'background-position': 6,
            'background-position-x': 6,
            '-ms-background-position-x': 6,
            'background-position-y': 6,
            '-ms-background-position-y': 6,
            'background-clip': 6,
            'background-origin': 6,
            '-webkit-background-size': 6,
            '-moz-background-size': 6,
            '-o-background-size': 6,
            'background-size': 6,
            'box-decoration-break': 6,
            '-webkit-box-shadow': 6,
            '-moz-box-shadow': 6,
            'box-shadow': 6,
            'filter:progid:DXImageTransform.Microsoft.gradient': 6,
            '-ms-filter:\'progid:DXImageTransform.Microsoft.gradient': 6,
            'text-shadow': 6,
            'font': 7,
            'font-family': 7,
            'font-size': 7,
            'font-weight': 7,
            'font-style': 7,
            'font-variant': 7,
            'font-size-adjust': 7,
            'font-stretch': 7,
            'font-effect': 7,
            'font-emphasize': 7,
            'font-emphasize-position': 7,
            'font-emphasize-style': 7,
            'font-smooth': 7,
            'line-height': 7
        };
    },
    'h': function (require, module, exports, global) {
        var orders = require('g').orders;
        module.exports = {
            'block': function (tree) {
                tree.list.sort(function (d1, d2) {
                    return (orders[d1.property] || 100) - (orders[d2.property] || 100);
                });
            }
        };
    },
    'i': function (require, module, exports, global) {
        var Interpreter = require('j');
        var Parser = require('3');
        var Hook = require('b');
        exports.interpret = function (ast, options) {
            if (typeof ast === 'string') {
                ast = Parser.parse(ast, options);
            }
            console.log(ast);
            return new Interpreter(options).interpret(ast);
        };
        exports.Interpreter = Interpreter;
    },
    'j': function (require, module, exports, global) {
        var Walker = require('a');
        var tree = require('4');
        var symtab = require('7');
        function Interpreter(options) {
        }
        ;
        var _ = Interpreter.prototype = new Walker();
        _.interpret = function (ast) {
            this.ast = ast;
            this.scope = ast.scope;
            this.istack = [];
            this.rulesetStack = [];
            this.walk(ast);
        };
        _.walk_stylesheet = function () {
            var node = new tree.Stylesheet();
        };
        _.walk_ruleset = function (ast) {
            this.walk(ast.block, ast);
        };
        _.walk_mixin = function (ast) {
        };
        _.walk_variable = function (tree) {
        };
        _.walk_include = function (tree) {
            this.enter(tree.scope);
            var mixin = this.scope.resolve(tree.name);
            if (!mixin)
                this.error('no ' + tree.name + 'defined');
            var includeScope = new symtab.Scope(), params = tree.params;
            for (var i = 0; i < params.length; i++) {
                includeScope.define();
            }
            this.istack.push(includeScope);
            var ast = tree.clone(this.walk(mixin.block));
            this.leave();
        };
        _.walk_extend = function (ast) {
        };
        _.walk_block = function (ast) {
            var block = new tree.Block();
            var list = ast.list;
            var res = [], r;
            for (var i = 0, len = list.length; i < list.length; i++) {
                if (list[i] && (r = this.walk(list[i])))
                    res.push(r);
            }
            return res;
        };
        _.walk_declaration = function (ast) {
        };
        _.walk_declaration = function () {
        };
        _.invoke_include = function () {
        };
        _.getScope = function (id) {
            var len, scope;
            if (len = this.istack.length) {
                if ((scope = this.istack[len - 1]) && scope.resolve(id)) {
                    return scope;
                }
            }
            if (this.scope.resolve(id)) {
                return this.scope;
            }
            return null;
        };
        _.peekStack = function () {
        };
        _.enter = function (scope) {
            if (!scope)
                this.error('no scope pass in enter');
            this.saveScope = this.scope;
            this.scope = scope;
        };
        _.leave = function () {
            this.scope = this.saveScope;
        };
        module.exports = Interpreter;
    }
}));
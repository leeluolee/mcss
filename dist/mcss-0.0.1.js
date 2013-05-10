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
        var parser = require('5');
        var translator = require('8');
        var util = require('2');
        exports.tokenizer = tokenizer;
        exports.parser = parser;
        exports.util = util;
        exports.translator = translator;
    },
    '1': function (require, module, exports, global) {
        var util = require('2');
        var mcssFunctions = require('3').names;
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
            if (!val) {
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
        var isMcssFunction = toAssert2(mcssFunctions);
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
                regexp: /url[ \t]*\((['"]?)([^\r\n\f]*)\1\)/,
                action: function (yytext, quote, url) {
                    this.yyval = url;
                    return 'URI';
                }
            },
            {
                regexp: /(?:-?[_A-Za-z][_\w]*)(?=[ \t]*\()/,
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
                regexp: /(-?(?:\d+\.\d+|\d+))(\w*|%)?/,
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
                regexp: ':([\\w\\u00A1-\\uFFFF-]+)' + '(?:\\(' + '([^\\(\\)]*' + '|(?:' + '\\([^\\)]+\\)' + '|[^\\(\\)]*' + ')+)' + '\\))?',
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
                regexp: /(['"])([^\r\n\f]*)\1/,
                action: function (yytext, quote, val) {
                    this.yyval = yytext;
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
        var fs = null;
        var path = null;
        var slice = [].slice;
        var tree = require('4');
        var functions = {
                add: function (options) {
                    return options.args.reduce(function (a, b) {
                        return a + b;
                    });
                },
                base64: function (options) {
                    var dirname = options.dirname;
                    if (!fs) {
                        return 'url(' + options.args[0] + ')';
                    } else {
                    }
                },
                u: function (string, options) {
                    return string;
                }
            };
        exports.functions = functions;
        exports.names = Object.keys(functions);
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
    '4': function (require, module, exports, global) {
        function Stylesheet() {
            this.body = [];
        }
        function SelectorList() {
            this.list = [];
        }
        function ComplexSelector() {
            this.string;
        }
        function RuleSet(selector, block) {
            this.selector = selector;
            this.block = block;
        }
        function Block(list) {
            this.list = list || [];
        }
        function Declaration(property, value) {
            this.property = property;
            this.value = value || [];
        }
        function ComponentValues() {
            this.list = [];
        }
        function FunctionCall(name, params) {
            this.params = params || [];
            this.name = name;
        }
        function Unrecognized(name) {
            this.name = name;
        }
        Unrecognized.prototype = {
            toString: function () {
                return this.name;
            }
        };
        function RGBA(color) {
            this.color = color;
        }
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
        function Mixin(name, params, body) {
            this.name = name;
            this.body = body;
            this.refs = [];
        }
        function Params(params) {
            this.list = params || [];
        }
        Params.prototype.isEmpty = function () {
            return this.list.length === 0;
        };
        function Param(name) {
            this.name = name;
        }
        function Include(mixin, args) {
            this.mixin = mixin;
            this.args = args || [];
        }
        function Extend(mixin) {
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
    },
    '5': function (require, module, exports, global) {
        var tk = require('1'), tree = require('4'), functions = require('3'), Color = require('6'), _ = require('2'), symtab = require('7'), slice = [].slice;
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
                this.lookahead = [
                    this.tokenizer.lex(),
                    this.tokenizer.lex(),
                    this.tokenizer.lex()
                ];
                this.p = 0;
                this.states = ['accept'];
                this.state = 'accept';
                this.scope = this.options.scope || new symtab.Scope();
                this.selectors = [];
                return this;
            },
            next: function (k) {
                k = k || 1;
                var cur = this.p;
                this.p += k;
                for (var i = 0; i < k; i++) {
                    this.lookahead[(cur + i) % 3] = this.tokenizer.lex();
                }
                this.skip('COMMENT');
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
                    this.error('expect: "NEWLINE" or ";"' + '->got: ' + ll.type);
                }
            },
            ll: function (k) {
                k = k || 1;
                if (k > 3)
                    this.error('max lookahead 3 tokens');
                return this.lookahead[(this.p + k - 1) % 3];
            },
            la: function (k) {
                return this.ll(k).type;
            },
            is: function (pos, tokenType) {
                return this.la(pos) === tokenType;
            },
            mark: function () {
            },
            release: function () {
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
                throw Error(msg + ' on line:' + this.ll().lineno);
            },
            down: function (selectorList) {
                if (selectorList)
                    this.selectors.push(selectorList);
                this.scope = new symtab.Scope(this.scope);
            },
            up: function (popSelector) {
                if (popSelector)
                    this.selectors.pop();
                this.scope = this.scope.getOuterScope();
            },
            stylesheet: function () {
                var node = new tree.Stylesheet();
                while (this.la(1) !== 'EOF') {
                    this.skipStart();
                    var stmt = this.stmt();
                    node.body.push(stmt);
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
                while (true) {
                    ll = this.ll(1);
                    la = ll.type;
                    if (la === 'NEWLINE' || la === ';') {
                        this.skipStart();
                        break;
                    } else {
                        node.value.push(this.componentValue());
                    }
                }
                this.scope.define(node.name, node);
                return node;
            },
            mixin: function () {
                this.match('AT_KEYWORD');
                this.match('WS');
                var ll = this.ll();
                var la = ll.type;
                this.match('IDENT');
                var node = new tree.Mixin();
                node.name = ll.val;
                this.eat('WS');
                if (this.la() === '(') {
                    node.params = this.params();
                }
                this.skipWSorNewlne();
                this.down();
                node.body = this.block();
                this.up();
                this.scope.define(node.name, node);
                return node;
            },
            params: function () {
                this.match('(');
                var node = new tree.Params();
                while (this.la() !== ')') {
                    node.list.push(this.param());
                    if (!this.eat(','))
                        break;
                }
                this.match(')');
                return node;
            },
            param: function () {
                var ll = this.ll();
                this.match('IDENT');
                return { name: ll.val };
            },
            arguments: function () {
            },
            css: function () {
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
                this.match('AT_KEYWORD', 'include');
                this.match('WS');
                var node = new tree.Include();
                var ll = this.ll(), la = ll.type;
                if (la === 'IDENT' || la === 'CLASS') {
                    var mixin = this.scope.resolve(ll.val);
                    if (!mixin || tree.inspect(mixin) !== 'mixin') {
                        this.error('invalid include atrule');
                    }
                } else {
                    this.error('invalid include atrule');
                }
                this.next();
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
                node.selector = this.selectorList();
                this.skipWSorNewlne();
                node.block = this.block(node.selector);
                return node;
            },
            block: function (selector) {
                var node = new tree.Block();
                this.match('{');
                this.down(selector);
                while (this.la() !== '}') {
                    this.skipStart();
                    var ll1 = this.ll(1);
                    var ll2 = this.ll(2);
                    if (ll1.type == 'IDENT' && ll2.type == ':' || ll1.type == '*' && ll2.type == 'IDENT' && this.ll(3).type === ':') {
                        node.list.push(this.declaration());
                    } else {
                        node.list.push(this.stmt());
                    }
                    this.skipStart();
                }
                this.match('}');
                this.up(selector);
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
                if (this.ll().type == '*') {
                    this.next();
                    this.ll(1).val = '*' + this.ll(1).val;
                }
                var node = new tree.Declaration(), ll1 = this.ll(1), ll2 = this.ll(2);
                if (checked || (this.ll(1).type = 'IDENT' && this.ll(2).type == ':')) {
                    node.property = ll1.val;
                    this.next(2);
                }
                node.value = this.componentValues();
                return node;
            },
            componentValues: function () {
                var node = new tree.ComponentValues(), ll, la;
                while (true) {
                    ll = this.ll(1);
                    la = ll.type;
                    if (la === 'IMPORTANT') {
                        this.next();
                        node.important = true;
                        this.matcheNewLineOrSemeColon();
                        break;
                    }
                    if (la === 'NEWLINE' || la === ';') {
                        this.next();
                        break;
                    } else {
                        var componentValue = this.componentValue();
                        if (componentValue !== null)
                            node.list.push(componentValue);
                    }
                }
                return node;
            },
            componentValue: function () {
                var ll1 = this.ll(1);
                var node, val = ll1.val, res;
                switch (ll1.type) {
                case 'IDENT':
                    this.next();
                    var ref = this.scope.resolve(ll1.val);
                    if (ref && ref.kind === 'var') {
                        return ref;
                    } else {
                        return ll1;
                    }
                case 'WS':
                    this.next();
                    return null;
                case 'RGBA':
                case 'STRING':
                case ',':
                case 'URI':
                    this.next();
                    return ll1;
                case 'FUNCTION':
                    this.match('(');
                    var params = [];
                    var fn = ll1.val;
                    while (this.la() != ')') {
                        node.params.push(this.expression());
                    }
                    this.match(')');
                    return node;
                case 'DIMENSION':
                case '(':
                    var node = this.additive();
                    return node;
                case 'HASH':
                    val = ll1.val;
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
                        node = new tree.RGBA(new Color(val));
                        this.next();
                        return node;
                    } else {
                        return tree.Unregniezed(ll1);
                    }
                    break;
                default:
                    this.error('Unregniezed component Value with Token start: ' + ll1.type);
                }
            },
            expression: function (prefix) {
                var ll = this.ll(1);
                var la = ll.type;
                switch (ll.type) {
                case '(':
                    var node = this.parenExpression();
                    break;
                case 'DIMENSION':
                    var node = this.additive();
                    break;
                case '+':
                case '-':
                    if (this.ll(2) !== 'ws') {
                        var node = this.expression(ll.type);
                    } else {
                        node = ll;
                    }
                case 'STRING':
                case 'RGBA':
                case 'function':
                    this.next();
                    return ll;
                default:
                }
                if (node && node.type === 'DIMENSION') {
                    if (prefix === '-') {
                        node.val.number = 0 - node.val.number;
                    }
                }
            },
            additive: function (options) {
                var left = this.multive(), right;
                var op = this.ll();
                if (op.type === '+' || op.type === '-') {
                    this.next();
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
            _addColor: function (c1, c2, op) {
            },
            _multColor: function (c1, dimension, op) {
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
            resolve: function (name) {
                var scope = this;
                while (scope) {
                    var symbol = scope.symtable[name];
                    if (symbol)
                        return symbol;
                    else
                        scope = scope.parentScope;
                }
                return this.symtable[name];
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
        exports.translate = function (tree, options) {
            return new Translator().translate(tree, options);
        };
    },
    '9': function (require, module, exports, global) {
        var Walker = require('a');
        function Translator() {
        }
        var _ = Translator.prototype = new Walker();
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
            var text = this.walk(tree.list).join('; ') + ';';
            return '{' + text + '}';
        };
        _.walk_componentvalues = function (tree) {
            var text = this.walk(tree.list).join(' ');
            return text;
        };
        _.walk_declaration = function (tree) {
            var text = tree.property;
            var value = this.walk(tree.value);
            return text + ': ' + value;
        };
        _.walk_ident = function (tree) {
            console.log(tree);
            return tree.val;
        };
        _.walk_string = function (tree) {
            return '"' + tree.val + '"';
        };
        _['walk_,'] = function (tree) {
            return ',';
        };
        _.walk_rgba = function (tree) {
        };
        _.walk_unknown = function (tree) {
        };
        _.walk_e = function () {
        };
        _.walk_uri = function (tree) {
            return 'url(' + tree.val + ')';
        };
        _.walk_rgba = function (tree) {
            console.log(tree.color);
            return tree.color.css();
        };
        _.walk_dimension = function (tree) {
            var val = tree.val;
            return val.number + (val.unit ? val.unit : '');
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
                    throw Error('no' + this._inspect(node) + ' specify node walker defined');
                }
            },
            _walkArray: function (nodes) {
                var self = this;
                return nodes.map(function (node) {
                    return self._walk(node);
                });
            },
            _walk: function (node) {
                var sign = this._inspect(node);
                var name = 'walk_' + sign;
                _.log(name, 'visit');
                if (this[name])
                    return this[name](node);
                else
                    return this.walk_defaut(node);
            },
            _inspect: function (node) {
                return node.type ? node.type.toLowerCase() : node.constructor.name.toLowerCase();
            }
        };
        module.exports = Walker;
    }
}));
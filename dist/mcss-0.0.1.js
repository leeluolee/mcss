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
        var parser = require('4');
        var util = require('2');
        exports.tokenizer = tokenizer;
        exports.parser = parser;
        exports.util = util;
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
        function createToken(type, val) {
            if (!val) {
                tokenCache[type] = { type: type };
            }
            var token = tokenCache[type] || {
                    type: type,
                    val: val
                };
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
                regexp: /(:-?[_A-Za-z][_\w]*)(?=[ \t]*\()/,
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
                regexp: /(-?(?:\d+\.\d+|\d+))(\w*)?/,
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
                regexp: '::([\\w\\u00A1-\\uFFFF-]+)',
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
                regexp: /[\t ]*([{}();,:]|(?:[>=<!]?=)|[-&><~+*\/])[\t ]*/,
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
                        return createToken(tokenType, this.yyval);
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
        module.exports = _;
    },
    '3': function (require, module, exports, global) {
        var fs = null;
        var path = null;
        var slice = [].slice;
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
        var tk = require('1'), tree = require('5'), color = require('6'), util = require('2'), biFunctions = null, symtab = require('7'), slice = [].slice;
        var combos = [
                'WS',
                '>',
                '~',
                '+'
            ];
        var skipStart = 'WS NEWLINE COMMENT ;';
        var operators = '+ - * /';
        var isColor = util.makePredicate('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen');
        var isMcssAtKeyword = util.makePredicate('mixin extend var');
        var isMcssFutureAtKeyword = util.makePredicate('if else css for');
        var isCssAtKeyword = util.makePredicate('import page keyframe media font-face charset');
        var isSkipStart = util.makePredicate(skipStart);
        var isCombo = util.makePredicate(combos);
        var isSelectorSep = util.makePredicate(combos.concat([
                'PSEUDO_CLASS',
                'PSEUDO_ELEMENT',
                'ATTRIBUTE',
                'CLASS',
                'HASH',
                '&',
                'IDENT',
                '*'
            ]));
        var isOperator = util.makePredicate(operators);
        var isBuildInFunction = function (name) {
            return !!biFunctions[name];
        };
        var yy = module.exports = function (input, options) {
                var parser = new Parser();
                return parser.setInput(input, options);
            };
        function Parser(input, options) {
        }
        Parser.prototype = {
            parse: function (input, options) {
                return this.stylesheet();
            },
            setInput: function (input, options) {
                this.options = options || {};
                this.tokenizer = tk(input, util.extend(options || {}, { ignoreComment: true }));
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
                var ll = this.ll();
                if (!this.eat(tokenType, val)) {
                    this.error('expect:"' + tokenType + '" -> got: "' + ll.type + '"');
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
            eat: function (tokenType, val) {
                var ll = this.ll();
                if (ll.type === tokenType && (!val || ll.val === val)) {
                    this.next();
                    return true;
                }
            },
            skip: function (type) {
                while (true) {
                    var la = this.la();
                    if (la === type)
                        this.next();
                    else
                        break;
                }
            },
            skipStart: function () {
                while (true) {
                    var la = this.la();
                    if (isSkipStart(la))
                        this.next();
                    else
                        break;
                }
            },
            error: function (msg) {
                console.log(this.tokenizer.remained);
                throw Error(msg + ' on line:' + this.tokenizer.lineno);
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
                var node = this.node = new tree.Stylesheet();
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
                var lv = this.ll().val;
                var node;
                if (this[lv])
                    return this[lv]();
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
                var node = new tree.Mixin();
                this.down();
                this.scope.define(node.name, node);
                this.up();
            },
            css: function () {
            },
            extend: function () {
                this.match('AT_KEYWORD', 'extend');
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
                        node = new exports.Extend();
                        return node;
                    }
                }
                this.error('invalid extend at rule');
            },
            include: function () {
                this.match('AT_KEYWORD', 'include');
                this.match('WS');
                var ll = this.ll(), la = ll.type;
                if (la === 'IDENT' || la === 'CLASS') {
                    this.scope.resolve(ll.val);
                }
                this.next();
                return {};
            },
            import: function () {
            },
            media: function () {
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
                this.down(node.selector);
                this.match('{');
                while (this.la() !== '}') {
                    this.skipStart();
                    var ll1 = this.ll(1);
                    var ll2 = this.ll(2);
                    if (ll1.type == 'IDENT' || ll2.type == ':') {
                        node.list.push(this.declaration(true));
                    } else {
                        node.list.push(this.stmt());
                    }
                    this.skipStart();
                }
                this.match('}');
                this.up(true);
                return node;
            },
            selectorList: function () {
                var node = new tree.SelectorList();
                node.list.push(this.complexSelector());
                while (this.la() === ',') {
                    this.next();
                    node.list.push(this.complexSelector());
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
                if (checked || (this.ll(1).type = 'IDENT' && this.ll(2).type == ':')) {
                    node.property = ll1.val;
                    this.next(2);
                }
                while (true) {
                    var ll = this.ll(1);
                    var la = ll.type;
                    if (la === 'IMPORTANT') {
                        this.next();
                        node.important = true;
                        this.matcheNewLineOrSemeColon();
                        break;
                    }
                    if (la === 'NEWLINE' || la === ';') {
                        break;
                    } else {
                        node.value.push(this.componentValue());
                    }
                }
                return node;
            },
            componentValue: function () {
                var ll1 = this.ll(1);
                var node, val, res;
                switch (ll1.type) {
                case 'IDENT':
                    var ref = this.scope.resolve(ll1.val);
                    if (ref && ref.kind === 'var') {
                        return ref;
                    } else {
                        var node = new tree.TokenNode(ll1);
                        this.next();
                        return node;
                    }
                case 'WS':
                case 'STRING':
                case ',':
                case 'URI':
                    var node = new tree.TokenNode(ll1);
                    this.next();
                    return node;
                case 'FUNCTION':
                    this.match('(');
                    var params = [];
                    while (this.la() != ')') {
                        node.params.push(this.expression());
                    }
                    this.match(')');
                    return node;
                case 'DIMENSION':
                case '(':
                    var node = this.additive();
                    console.log(node);
                    return node;
                case 'HASH':
                    if (ll1.type === HASH)
                        val = ll.val;
                    if (res = val.exec(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)) {
                    } else {
                        return tree.Unregniezed(ll1);
                    }
                    break;
                default:
                    this.error('Unregniezed component Value with Token start: ' + ll1.type);
                }
            },
            expression: function () {
                var ll = this.ll(1);
                var la = ll.type;
                switch (ll.type) {
                case 'DIMENSION':
                case 'RGBA':
                case '(':
                    var node = this.additive();
                    return tree.TokenNode(node);
                }
                this.error('invalid expression start');
            },
            additive: function (d1, d2) {
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
            functionBlock: function () {
            },
            parenExpression: function () {
                this.match('(');
                var t = this.expression();
                this.match(')');
                return t;
            },
            params: function () {
            },
            definition: function () {
            },
            _lookahead: function () {
                return this.lookahead.map(function (item) {
                    return item.type;
                }).join(',');
            }
        };
    },
    '5': function (require, module, exports, global) {
        function Stylesheet() {
            this.body = [];
        }
        function SelectorList() {
            this.list = [];
        }
        function ComplexSelector() {
            this.string;
        }
        function RuleSet() {
            this.list = [];
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
        function RGBA(red, green, blue, opacity) {
            this.red = red;
            this.green = green;
            this.blue = blue;
            this.opacity = opacity;
        }
        function TokenNode(tk) {
            tk = tk || {};
            this.val = tk.val;
            this.type = tk.type;
        }
        function Variable(name, value, kind) {
            this.kind = kind || 'var';
            this.name = name;
            this.value = value || [];
        }
        function Mixin(name, params, defaults, body) {
            this.name = name;
            this.defaults = defaults || [];
            this.body = body;
            this.refs = [];
        }
        function Include(name, params, defaults, body) {
        }
        function Extend(name, params, defaults, body) {
            this.mixin = mixin;
        }
        exports.Stylesheet = Stylesheet;
        exports.SelectorList = SelectorList;
        exports.ComplexSelector = ComplexSelector;
        exports.RuleSet = RuleSet;
        exports.Declaration = Declaration;
        exports.ComponentValues = ComponentValues;
        exports.FunctionCall = FunctionCall;
        exports.Unrecognized = Unrecognized;
        exports.Mixin = Mixin;
        exports.Include = Include;
        exports.Extend = Extend;
        exports.Variable = Variable;
        exports.TokenNode = TokenNode;
        exports.RGBA = RGBA;
        exports.inspect = function (node) {
            return node.constructor.name.toLowerCase();
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
                (Color.clearColors = function () {
                    colorDict = Color.prototype = {
                        transparent: [
                            0,
                            0,
                            0,
                            0
                        ]
                    };
                })();
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
        'use strict';
        (function () {
            var cssColors = {
                    aliceblue: 15792383,
                    antiquewhite: 16444375,
                    aqua: 65535,
                    aquamarine: 8388564,
                    azure: 15794175,
                    beige: 16119260,
                    bisque: 16770244,
                    black: 0,
                    blanchedalmond: 16772045,
                    blue: 255,
                    blueviolet: 9055202,
                    brown: 10824234,
                    burlywood: 14596231,
                    cadetblue: 6266528,
                    chartreuse: 8388352,
                    chocolate: 13789470,
                    coral: 16744272,
                    cornflowerblue: 6591981,
                    cornsilk: 16775388,
                    crimson: 14423100,
                    cyan: 65535,
                    darkblue: 139,
                    darkcyan: 35723,
                    darkgoldenrod: 12092939,
                    darkgray: 11119017,
                    darkgrey: 11119017,
                    darkgreen: 25600,
                    darkkhaki: 12433259,
                    darkmagenta: 9109643,
                    darkolivegreen: 5597999,
                    darkorange: 16747520,
                    darkorchid: 10040012,
                    darkred: 9109504,
                    darksalmon: 15308410,
                    darkseagreen: 9419919,
                    darkslateblue: 4734347,
                    darkslategray: 3100495,
                    darkslategrey: 3100495,
                    darkturquoise: 52945,
                    darkviolet: 9699539,
                    deeppink: 16716947,
                    deepskyblue: 49151,
                    dimgray: 6908265,
                    dimgrey: 6908265,
                    dodgerblue: 2003199,
                    firebrick: 11674146,
                    floralwhite: 16775920,
                    forestgreen: 2263842,
                    fuchsia: 16711935,
                    gainsboro: 14474460,
                    ghostwhite: 16316671,
                    gold: 16766720,
                    goldenrod: 14329120,
                    gray: 8421504,
                    grey: 8421504,
                    green: 32768,
                    greenyellow: 11403055,
                    honeydew: 15794160,
                    hotpink: 16738740,
                    indianred: 13458524,
                    indigo: 4915330,
                    ivory: 16777200,
                    khaki: 15787660,
                    lavender: 15132410,
                    lavenderblush: 16773365,
                    lawngreen: 8190976,
                    lemonchiffon: 16775885,
                    lightblue: 11393254,
                    lightcoral: 15761536,
                    lightcyan: 14745599,
                    lightgoldenrodyellow: 16448210,
                    lightgray: 13882323,
                    lightgrey: 13882323,
                    lightgreen: 9498256,
                    lightpink: 16758465,
                    lightsalmon: 16752762,
                    lightseagreen: 2142890,
                    lightskyblue: 8900346,
                    lightslategray: 7833753,
                    lightslategrey: 7833753,
                    lightsteelblue: 11584734,
                    lightyellow: 16777184,
                    lime: 65280,
                    limegreen: 3329330,
                    linen: 16445670,
                    magenta: 16711935,
                    maroon: 8388608,
                    mediumaquamarine: 6737322,
                    mediumblue: 205,
                    mediumorchid: 12211667,
                    mediumpurple: 9662680,
                    mediumseagreen: 3978097,
                    mediumslateblue: 8087790,
                    mediumspringgreen: 64154,
                    mediumturquoise: 4772300,
                    mediumvioletred: 13047173,
                    midnightblue: 1644912,
                    mintcream: 16121850,
                    mistyrose: 16770273,
                    moccasin: 16770229,
                    navajowhite: 16768685,
                    navy: 128,
                    oldlace: 16643558,
                    olive: 8421376,
                    olivedrab: 7048739,
                    orange: 16753920,
                    orangered: 16729344,
                    orchid: 14315734,
                    palegoldenrod: 15657130,
                    palegreen: 10025880,
                    paleturquoise: 11529966,
                    palevioletred: 14184595,
                    papayawhip: 16773077,
                    peachpuff: 16767673,
                    peru: 13468991,
                    pink: 16761035,
                    plum: 14524637,
                    powderblue: 11591910,
                    purple: 8388736,
                    red: 16711680,
                    rosybrown: 12357519,
                    royalblue: 4286945,
                    saddlebrown: 9127187,
                    salmon: 16416882,
                    sandybrown: 16032864,
                    seagreen: 3050327,
                    seashell: 16774638,
                    sienna: 10506797,
                    silver: 12632256,
                    skyblue: 8900331,
                    slateblue: 6970061,
                    slategray: 7372944,
                    slategrey: 7372944,
                    snow: 16775930,
                    springgreen: 65407,
                    steelblue: 4620980,
                    tan: 13808780,
                    teal: 32896,
                    thistle: 14204888,
                    tomato: 16737095,
                    turquoise: 4251856,
                    violet: 15631086,
                    wheat: 16113331,
                    white: 16777215,
                    whitesmoke: 16119285,
                    yellow: 16776960,
                    yellowgreen: 10145074
                }, color;
            for (color in cssColors) {
                if (cssColors.hasOwnProperty(color)) {
                    Color.define(color, cssColors[color]);
                }
            }
        }());
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
    }
}));
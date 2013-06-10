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
        var mcss = require('1');
        module.exports = mcss;
    },
    '1': function (require, module, exports, global) {
        var Parser = require('2');
        var Interpreter = require('g');
        var Translator = require('s');
        var tk = require('3');
        var promise = require('b');
        var _ = require('4');
        var io = require('a');
        var options = require('e');
        var state = require('c');
        function Mcss(options) {
            this.options = _.extend(options || {}, {
                pathes: [],
                format: 1
            });
        }
        var m = options.mixTo(Mcss);
        m.include = function (path) {
            this.get('pathes').push(path);
            return this;
        };
        m.tokenize = function (text) {
            return tk.tokenize(text, this.options);
        };
        m.parse = function (text) {
            var parser = new Parser(this.options);
            if (!text) {
                if (this.get('filename')) {
                    return io.parse(this.options.filename, this.options);
                }
                throw Error('text or filename is required');
            }
            return parser.parse(text);
        };
        m.interpret = function (text) {
            var interpreter = new Interpreter(this.options);
            var pr = promise();
            this.parse(text).done(function (ast) {
                pr.resolve(interpreter.interpret(ast));
            });
            return pr;
        };
        m.translate = function (text) {
            var translator = new Translator(this.options);
            var pr = promise();
            this.interpret(text).done(function (ast) {
                pr.resolve(translator.translate(ast));
            });
            return pr;
        };
        var mcss = module.exports = function (options) {
                return new Mcss(options);
            };
        mcss.Parser = Parser;
        mcss.Interpreter = Interpreter;
        mcss.Translator = Translator;
        mcss.Tokenizer = tk.Tokenizer;
        mcss.io = io;
        mcss.promise = promise;
        mcss._ = _;
        mcss.state = state;
    },
    '2': function (require, module, exports, global) {
        var tk = require('3');
        var tree = require('8');
        var _ = require('4');
        var io = require('a');
        var binop = require('d');
        var promise = require('b');
        var options = require('e');
        var path = require('6');
        var fs = null;
        var symtab = require('f');
        var state = require('c');
        var perror = new Error();
        var slice = [].slice;
        var errors = {
                INTERPOLATE_FAIL: 1,
                DECLARION_FAIL: 2
            };
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
                'TEXT',
                '*',
                '#',
                ':',
                '.',
                'compoundident'
            ]));
        var isOperator = _.makePredicate(operators);
        var isColor = _.makePredicate('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen');
        var isMcssAtKeyword = _.makePredicate('mixin extend var');
        var isMcssFutureAtKeyword = _.makePredicate('if else css for');
        var isCssAtKeyword = _.makePredicate('import page keyframe media font-face charset');
        var isShorthandProp = _.makePredicate('background font margin border border-top border-right border-bottom border-left border-width border-color border-style transition padding list-style border-radius.');
        var isWSOrNewLine = _.makePredicate('WS NEWLINE');
        var isCommaOrParen = _.makePredicate(', )');
        var isDirectOperate = _.makePredicate('DIMENSION STRING BOOLEAN TEXT NULL');
        var isRelationOp = _.makePredicate('== >= <= < > !=');
        var isNeg = function (ll) {
            return ll.type === 'DIMENSION' && ll.value < 0;
        };
        var isProbablyModulePath = function (path) {
            return /^[-\w]/.test(path) && !/:/.test(path);
        };
        var states = {
                'FILTER_DECLARATION': _.uid(),
                'TRY_DECLARATION': _.uid(),
                'TRY_INTERPOLATION': _.uid(),
                'FUNCTION_CALL': _.uid()
            };
        function Parser(options) {
            this.options = options || {};
        }
        module.exports = Parser;
        exports.parse = function (input, options) {
            if (typeof input === 'string') {
                input = tk.tokenize(input, options || {});
            }
            return new Parser(options).parse(input);
        };
        Parser.prototype = {
            parse: function (tks) {
                var p = new promise();
                if (typeof tks === 'string') {
                    tks = tk.tokenize(tks);
                }
                this.lookahead = tks;
                this.p = 0;
                this.length = this.lookahead.length;
                this._states = {};
                this.scope = this.options.scope || new symtab.Scope();
                this.marked = null;
                this.tasks = 1;
                this.promises = [];
                var ast = this.stylesheet();
                if (this.promises.length) {
                    promise.when.apply(this, this.promises).done(function () {
                        return p.resolve(ast);
                    });
                } else {
                    return p.resolve(ast);
                }
                return p;
            },
            state: function (state) {
                return this._states[state] === true;
            },
            enter: function (state) {
                this._states[state] = true;
            },
            leave: function (state) {
                this._states[state] = false;
            },
            next: function (k) {
                k = k || 1;
                this.p += k;
            },
            lookUpBefore: function (lookup, before) {
                var i = 1, la;
                while (i++) {
                    if ((la = this.la(i)) === lookup)
                        return true;
                    if (la === before || la === 'EOF' || la === '}') {
                        return false;
                    }
                }
                return false;
            },
            match: function (tokenType) {
                var ll;
                if (!(ll = this.eat.apply(this, arguments))) {
                    var ll = this.ll();
                    this.error('expect:"' + tokenType + '" -> got: "' + ll.type + '"');
                } else {
                    return ll;
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
                return this;
            },
            restore: function () {
                if (this.marked != undefined)
                    this.p = this.marked;
                this.marked = null;
                return this;
            },
            eat: function (tokenType) {
                var ll = this.ll();
                for (var i = 0, len = arguments.length; i < len; i++) {
                    if (ll.type === arguments[i]) {
                        this.next();
                        return ll;
                    }
                }
                return false;
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
                if (typeof msg === 'number') {
                    perror.code = msg;
                    throw perror;
                }
                var filename = this.options.filename;
                console.log(this.p);
                throw Error((filename ? 'file:"' + filename + '"' : '') + msg + ' on line:' + this.ll().lineno);
            },
            stylesheet: function (block) {
                var end = block ? '}' : 'EOF';
                if (block)
                    this.match('{');
                var node = new tree.Stylesheet();
                this.skip('WS');
                while (!this.eat(end)) {
                    this.skipStart();
                    var stmt = this.stmt();
                    if (stmt) {
                        node.list.push(stmt);
                    }
                    this.skipStart();
                }
                return node;
            },
            stmt: function () {
                var la = this.la(), node = false;
                if (la === 'AT_KEYWORD') {
                    node = this.atrule();
                }
                if (la === 'VAR') {
                    switch (this.la(2)) {
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
                        if (node.value.type !== 'func') {
                            this.match(';');
                        }
                        break;
                    default:
                        this.error('invalid squence after VARIABLE');
                    }
                }
                if (la === 'FUNCTION') {
                    node = this.fnCall();
                    this.match(';');
                }
                if (isSelectorSep(la)) {
                    node = this.ruleset(true);
                }
                if (node !== false) {
                    return node;
                }
                this.error('invalid statementstart');
            },
            atrule: function () {
                var lv = this.ll().value.toLowerCase();
                if (typeof this[lv] === 'function') {
                    return this[lv]();
                }
                return this.directive();
            },
            directive: function () {
                var name = this.ll().value.toLowerCase();
                var dhook = state.directives[name];
                if (dhook) {
                    console.log('has hook');
                } else {
                    this.match('AT_KEYWORD');
                    this.eat('WS');
                    var value = this.valuesList();
                    this.eat('WS');
                    if (this.eat(';')) {
                        return new tree.Directive(name, value);
                    } else {
                        var block = this.block();
                        return new tree.Directive(name, value, block);
                    }
                    this.error('invalid customer directive define');
                }
            },
            param: function () {
                var name = this.ll().value, dft, rest = false;
                this.match('VAR');
                if (this.eat('...')) {
                    rest = true;
                }
                if (this.eat('=')) {
                    if (rest)
                        this.error('reset params can"t has default params');
                    dft = this.values();
                }
                return new tree.Param(name, dft, rest);
            },
            extend: function () {
                this.match('AT_KEYWORD');
                this.match('WS');
                var node = new tree.Extend(this.selectorList());
                this.match(';');
                return node;
                this.error('invalid extend at rule');
            },
            return: function () {
                this.match('AT_KEYWORD');
                this.match('WS');
                var node = new tree.ReturnStmt(this.valuesList());
                this.skip('WS');
                this.match(';');
                return node;
            },
            import: function () {
                var node, url, queryList, ll, self = this;
                this.match('AT_KEYWORD');
                this.match('WS');
                ll = this.ll();
                if (ll.type === 'URL' || ll.type === 'STRING') {
                    url = ll;
                    this.next();
                } else {
                    this.error('expect URL or STRING' + ' got ' + ll.type);
                }
                this.eat('WS');
                if (!this.eat(';')) {
                    queryList = this.media_query_list();
                    this.match(';');
                }
                var node = new tree.Import(url, queryList), extname = path.extname(url.value), filename, stat, p;
                if (extname !== '.css') {
                    p = this._import(url.value).done(function (ast) {
                        node.stylesheet = ast;
                    });
                    this.promises.push(p);
                }
                return node;
            },
            abstract: function () {
                var la, url, ruleset;
                this.match('AT_KEYWORD');
                this.eat('WS');
                if ((la = this.la()) !== '{') {
                    if (url = this.eat('STRING', 'URL')) {
                        var node = new tree.Import(url);
                        var p = this._import(url.value).done(function (ast) {
                                node.stylesheet = ast.abstract();
                            });
                        this.promises.push(p);
                        return node;
                    } else {
                        ruleset = this.ruleset();
                        ruleset.abstract = true;
                        return ruleset;
                    }
                } else {
                    var list = this.stylesheet(true).abstract().list;
                    return list;
                }
            },
            url: function () {
                return this.match('STRING', 'URL');
            },
            if: function () {
                this.match('AT_KEYWORD');
                var test = this.expression(), block = this.block(), alt, ll;
                this.eat('WS');
                ll = this.ll();
                if (ll.type == 'AT_KEYWORD') {
                    if (ll.value === 'else') {
                        this.next();
                        this.eat('WS');
                        alt = this.block();
                    }
                    if (ll.value === 'elseif') {
                        alt = this.if();
                    }
                }
                return new tree.IfStmt(test, block, alt);
            },
            for: function () {
                var element, index, list, of, block;
                this.match('AT_KEYWORD');
                this.match('WS');
                element = this.ll().value;
                this.match('VAR');
                if (this.eat(',')) {
                    index = this.ll().value;
                    this.match('VAR');
                }
                this.match('WS');
                of = this.ll();
                if (of.value !== 'of') {
                    this.error('for statement need "of" but got:' + of.value);
                }
                this.match('TEXT');
                list = this.valuesList();
                if (list.list.length <= 1) {
                    this.error('@for statement need at least one element in list');
                }
                this.eat('WS');
                block = this.block();
                return new tree.ForStmt(element, index, list, block);
            },
            media: function () {
                this.match('AT_KEYWORD');
                this.eat('WS');
                var list = this.media_query_list();
                this.skip('WS');
                var stylesheet = this.stylesheet(true);
                return new tree.Media(list, stylesheet);
            },
            media_query_list: function () {
                var list = [];
                do {
                    list.push(this.media_query());
                } while (this.eat(','));
                return list;
            },
            media_query: function () {
                var expressions = [], ll, type = '';
                if (this.la() === '(') {
                    expressions.push(this.media_expression());
                } else {
                    ll = this.ll();
                    if (ll.value === 'only' || ll.value === 'not') {
                        type = ll.value;
                        this.next(1);
                        this.match('WS');
                        ll = this.ll();
                    }
                    this.match('TEXT');
                    type += (type ? ' ' : '') + ll.value;
                }
                this.eat('WS');
                while ((ll = this.ll()).type === 'TEXT' || ll.type === 'FUNCTION' && ll.value === 'and') {
                    this.next();
                    this.match('WS');
                    expressions.push(this.media_expression());
                    this.eat('WS');
                }
                return new tree.MediaQuery(type, expressions);
            },
            media_expression: function () {
                var feature, value;
                this.match('(');
                this.eat('WS');
                feature = this.expression();
                if (this.eat(':')) {
                    value = this.expression();
                }
                this.eat('WS');
                this.match(')');
                return new tree.MediaExpression(feature, value);
            },
            'font-face': function () {
                this.match('AT_KEYWORD');
                this.eat('WS');
                return new tree.FontFace(this.block());
            },
            keyframes: function () {
                this.match('AT_KEYWORD');
                this.eat('WS');
                var name = this.compoundIdent();
                this.eat('WS');
                this.match('{');
                this.eat('WS');
                var blocks = [];
                while (!this.eat('}')) {
                    blocks.push(this.keyframes_block());
                }
                return new tree.Keyframes(name, blocks);
            },
            keyframes_block: function () {
                var step = this.ll(), block;
                this.match('IDENT', 'DIMENSION');
                this.eat('WS');
                block = this.block();
                this.eat('WS');
                return new tree.keyframesBlock(step, block);
            },
            page: function () {
                this.match('AT_KEYWORD');
                this.eat('WS');
                var selector = this.match('PSEUDO_CLASS').value;
                this.eat('WS');
                var block = this.block();
                return new tree.Page(selector, block);
            },
            debug: function () {
                this.match('AT_KEYWORD');
                this.match('WS');
                var value = this.valuesList();
                var node = new tree.Debug(value);
                this.match(';');
                return node;
            },
            vain: function () {
                var selector, block;
                this.match('AT_KEYWORD');
                this.eat('WS');
                if (this.la() !== '{') {
                    selector = this.selectorList();
                } else {
                    block = this.block();
                }
            },
            ruleset: function () {
                var node = new tree.RuleSet(), rule;
                node.selector = this.selectorList();
                this.eat('WS');
                node.block = this.block();
                return node;
            },
            block: function () {
                this.eat('WS');
                var node = new tree.Block();
                this.match('{');
                this.skip('WS');
                while (this.la() !== '}') {
                    node.list.push(this.mark().declaration() || this.restore().stmt());
                    this.skip('WS');
                }
                this.match('}');
                return node;
            },
            selectorList: function () {
                var node = new tree.SelectorList();
                do {
                    node.list.push(this.complexSelector());
                } while (this.eat(','));
                return node;
            },
            complexSelector: function () {
                var node = new tree.ComplexSelector();
                var selectorString = '';
                var i = 0, ll, interpolation;
                while (true) {
                    ll = this.ll();
                    if (ll.type === '#{' && this.ll(2) !== '}') {
                        interpolation = this.interpolation();
                        if (interpolation) {
                            selectorString += '#{' + i++ + '}';
                            node.interpolations.push(interpolation);
                        } else {
                            break;
                        }
                    } else if (isSelectorSep(ll.type)) {
                        selectorString += ll.value || (ll.type === 'WS' ? ' ' : ll.type);
                        this.next();
                    } else {
                        break;
                    }
                }
                node.string = selectorString;
                return node;
            },
            declaration: function (noEnd) {
                var node = new tree.Declaration();
                var ll1 = this.ll(1), ll2 = this.ll(2);
                if (ll1.type === '*' && ll2.type == 'TEXT') {
                    this.next(1);
                    ll2.value = '*' + ll2.value;
                }
                node.property = this.compoundIdent();
                if (!node.property)
                    return;
                this.eat('WS');
                if (!this.eat(':'))
                    return;
                if (node.property.value === 'filter') {
                    this.enter(states.FILTER_DECLARATION);
                }
                this.enter(states.TRY_DECLARATION);
                try {
                    node.value = this.valuesList();
                    this.leave(states.TRY_DECLARATION);
                } catch (error) {
                    if (error.code === errors.DECLARION_FAIL)
                        return;
                    throw error;
                }
                if (this.eat('IMPORTANT')) {
                    node.important = true;
                }
                if (!noEnd) {
                    if (this.la() !== '}') {
                        this.match(';');
                    }
                }
                this.leave(states.FILTER_DECLARATION);
                return node;
            },
            valuesList: function () {
                var list = [], values;
                do {
                    values = this.values();
                    if (values)
                        list.push(values);
                    else
                        break;
                } while (this.eat(','));
                if (list.length === 1) {
                    return list[0];
                } else {
                    return new tree.ValuesList(list);
                }
            },
            values: function () {
                var list = [], value;
                while (true) {
                    value = this.value();
                    if (!value)
                        break;
                    if (value.type === 'values') {
                        list = list.concat(value.list);
                    } else {
                        list.push(value);
                    }
                }
                if (list.length === 1)
                    return list[0];
                return new tree.Values(list);
            },
            value: function () {
                this.eat('WS');
                return this.expression();
            },
            assign: function () {
                var name = this.ll().value, value, op, block, params = [], rest = 0;
                this.match('VAR');
                op = this.la();
                this.match('=', '?=');
                if (this.la() === '(' || this.la() === '{') {
                    if (this.eat('(')) {
                        this.eat('WS');
                        if (this.la() !== ')') {
                            do {
                                param = this.param();
                                if (param.rest)
                                    rest++;
                                params.push(param);
                            } while (this.eat(','));
                            if (rest >= 2)
                                this.error('can"t have more than 2 rest param');
                            this.eat('WS');
                        }
                        this.match(')');
                    }
                    block = this.block();
                    value = new tree.Func(name, params, block);
                } else {
                    value = this.valuesList();
                }
                return new tree.Assign(name, value, op === '?=' ? false : true);
            },
            expression: function () {
                this.eat('WS');
                if (this.la(2) === '...')
                    return this.range();
                return this.logicOrExpr();
            },
            logicOrExpr: function () {
                var left = this.logicAndExpr(), ll, right;
                while ((la = this.la()) === '||') {
                    this.next();
                    right = this.logicAndExpr();
                    var bValue = tree.toBoolean(left);
                    if (bValue !== null) {
                        if (bValue === false) {
                            left = right;
                        }
                    } else {
                        left = new tree.Operator(la, left, right);
                    }
                    this.eat('WS');
                }
                return left;
            },
            logicAndExpr: function () {
                var node = this.relationExpr(), ll, right;
                while ((la = this.la()) === '&&') {
                    this.next();
                    right = this.relationExpr();
                    var bValue = tree.toBoolean(node);
                    if (bValue !== null) {
                        if (bValue === true) {
                            node = right;
                        } else {
                            node = {
                                type: 'BOOLEAN',
                                value: false
                            };
                        }
                    } else {
                        node = new tree.Operator(la, node, right);
                    }
                    this.eat('WS');
                }
                return node;
            },
            relationExpr: function () {
                var left = this.binop1(), la, right;
                while (isRelationOp(la = this.la())) {
                    this.next();
                    this.eat('WS');
                    right = this.binop1();
                    if (tree.isPrimary(left.type) && tree.isPrimary(right.type)) {
                        left = binop.relation(left, right, la);
                    } else {
                        left = new tree.Operator(la, left, right);
                    }
                    this.eat('WS');
                }
                return left;
            },
            range: function () {
                var left = this.ll(), node = new tree.ValuesList(), right, lc, rc, reverse;
                this.match('DIMENSION');
                this.eat('...');
                right = this.ll();
                this.match(left.type);
                lc = left.value;
                rc = right.value;
                reverse = lc > rc;
                for (; lc != rc;) {
                    node.list.push({
                        type: left.type,
                        value: lc
                    });
                    if (reverse)
                        lc -= 1;
                    else
                        lc += 1;
                }
                node.list.push({
                    type: left.type,
                    value: lc
                });
                return node;
            },
            binop1: function () {
                var left = this.binop2(), right, la, ll;
                var ws;
                if (this.eat('WS'))
                    ws = true;
                while ((la = this.la()) === '+' || la === '-' || isNeg(ll = this.ll())) {
                    if (la === 'DIMENSION') {
                        if (!ws) {
                            right = this.eat('DIMENSION');
                            la = '+';
                        } else
                            return left;
                    } else {
                        this.next();
                        this.eat('WS');
                        right = this.binop2();
                    }
                    if (right.type === 'DIMENSION' && left.type === 'DIMENSION') {
                        left = binop[la](left, right);
                    } else {
                        left = new tree.Operator(la, left, right);
                    }
                    this.eat('WS');
                }
                return left;
            },
            binop2: function () {
                var left = this.unary(), right, la;
                var ws;
                if (this.eat('WS'))
                    ws = true;
                while ((la = this.la()) === '*' || la === '/' || la === '%') {
                    if (la == '/' && !ws && this.la(2) !== 'WS') {
                        return left;
                    }
                    this.next();
                    this.eat('WS');
                    right = this.unary();
                    if (right.type === 'DIMENSION' && left.type === 'DIMENSION') {
                        left = binop[la](left, right);
                    } else {
                        left = new tree.Operator(la, left, right);
                    }
                    this.eat('WS');
                }
                return left;
            },
            unary: function () {
                var la, operator, value;
                if ((la = this.la()) === '-' || la === '+') {
                    operator = la;
                    this.next();
                }
                value = this.primary();
                if (operator !== '-')
                    return value;
                if (value.type === 'DIMENSION') {
                    return {
                        type: 'DIMENSION',
                        value: -value.value,
                        unit: value.unit
                    };
                }
                return new tree.Unary(value, operator);
            },
            primary: function () {
                var ll = this.ll(), node;
                switch (ll.type) {
                case '(':
                    return this.parenExpr();
                case '=':
                    if (this.state(states.FILTER_DECLARATION) && this.state(states.FUNCTION_CALL)) {
                        this.next();
                        return ll;
                    }
                    break;
                case '/':
                    this.next();
                    return ll;
                case '#{':
                case 'TEXT':
                    return this.compoundIdent();
                case 'FUNCTION':
                    return this.fnCall();
                case 'HASH':
                    this.next();
                    value = ll.value;
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
                        node = new tree.Color(value);
                    } else {
                        node = new tree.Unknown(ll.value);
                    }
                    return node;
                case 'STRING':
                case 'DIMENSION':
                case 'BOOLEAN':
                case 'VAR':
                case 'NULL':
                case 'URL':
                    this.next();
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
                    if (this.state(states.TRY_DECLARATION)) {
                        this.error(errors.DECLARION_FAIL);
                        break;
                    }
                default:
                    return null;
                }
            },
            parenExpr: function () {
                this.match('(');
                this.eat('WS');
                if (this.la() === 'VAR' && (this.la(2) === '=' || this.la(2) === '?=')) {
                    node = this.assign(true);
                } else {
                    node = this.expression();
                }
                this.eat('WS');
                this.match(')');
                return node;
            },
            compoundIdent: function () {
                var list = [], ll, sep, node;
                while (true) {
                    ll = this.ll();
                    if (ll.type === '#{') {
                        sep = this.interpolation();
                        list.push(sep);
                    } else if (ll.type === 'TEXT') {
                        this.next();
                        list.push(ll.value);
                    } else
                        break;
                }
                if (!sep) {
                    return {
                        type: 'TEXT',
                        value: list[0]
                    };
                } else {
                    return new tree.CompoundIdent(list);
                }
            },
            interpolation: function () {
                var node;
                this.match('#{');
                node = this.valuesList();
                this.match('}');
                return node;
            },
            fnCall: function () {
                var ll = this.ll(), name = ll.value, args;
                this.match('FUNCTION', 'VAR');
                if (ll.args) {
                    return new tree.Call(name, ll.args);
                }
                this.eat('WS');
                this.match('(');
                this.enter(states.FUNCTION_CALL);
                args = this.valuesList();
                args = args.type === 'valueslist' ? args.list : [args];
                this.leave(states.FUNCTION_CALL);
                this.match(')');
                return new tree.Call(name, args);
            },
            transparentCall: function () {
                var ll = this.ll();
                var name = ll.value;
                this.match('VAR');
                this.match(':');
                var args = this.valuesList().list;
                var node = new tree.Call(name, args);
                this.match(';');
                return node;
            },
            _lookahead: function () {
                return this.lookahead.map(function (item) {
                    return item.type;
                }).join(',');
            },
            _import: function (url) {
                var pathes = this.get('pathes'), extname = path.extname(url);
                if (!path.isFake && pathes.length && isProbablyModulePath(url.value)) {
                    var inModule = pathes.some(function (item) {
                            filename = path.join(item, url);
                            try {
                                stat = fs.statSync(filename);
                                if (stat.isFile())
                                    return true;
                            } catch (e) {
                            }
                        });
                }
                if (!inModule) {
                    if (/^\/|:\//.test(url)) {
                        var filename = url;
                    } else {
                        var base = path.dirname(this.options.filename);
                        var filename = path.join(base, url);
                    }
                }
                filename += extname ? '' : '.mcss';
                var options = _.extend({ filename: filename }, this.options);
                var _requires = this.get('_requires');
                if (_requires && ~_requires.indexOf(filename)) {
                    this.error('it is seems file:"' + filename + '" and file: "' + this.get('filename') + '" has Circular dependencies');
                }
                options._requires = _requires ? _.slice(_requires).push(this.get('filename')) : [this.get('filename')];
                return io.parse(filename, options).done(function (ast) {
                    if (!~state.requires.indexOf(filename)) {
                        state.requires.push(filename);
                    }
                });
            }
        };
        options.mixTo(Parser);
    },
    '3': function (require, module, exports, global) {
        var util = require('4');
        var tree = require('8');
        var slice = [].slice;
        var $ = function () {
                var table = {};
                return function (name, pattern) {
                    if (!pattern) {
                        if (/^[a-zA-Z]+$/.test(name)) {
                            return table[name];
                        }
                        pattern = name;
                        name = null;
                    }
                    if (typeof pattern !== 'string') {
                        pattern = String(pattern).slice(1, -1);
                    }
                    pattern = pattern.replace(/\{(\w+)}/g, function (all, name) {
                        var p = table[name];
                        if (!p)
                            throw Error('no register pattern "' + name + '" before');
                        var pstart = p.charAt(0), pend = p.charAt(p.length - 1);
                        if (!(pstart === '[' && pend === ']') && !(pstart === '(' && pend === ')')) {
                            p = '(?:' + p + ')';
                        }
                        return p;
                    });
                    if (name)
                        table[name] = pattern;
                    return new RegExp(pattern);
                };
            }();
        var toAssert = function (str) {
            var arr = typeof str == 'string' ? str.split(/\s+/) : str, regexp = new RegExp('^(?:' + arr.join('|') + ')$');
            return function (word) {
                return regexp.test(word);
            };
        };
        var toAssert2 = util.makePredicate;
        function createToken(type, value, lineno) {
            var token = typeof type === 'object' ? type : {
                    type: type,
                    value: value
                };
            token.lineno = lineno;
            return token;
        }
        exports.tokenize = function (input, options) {
            return new Tokenizer(options).tokenize(input);
        };
        exports.Tokenizer = Tokenizer;
        exports.$ = $;
        exports.createToken = createToken;
        var isUnit = toAssert2('% em ex ch rem vw vh vmin vmax cm mm in pt pc px deg grad rad turn s ms Hz kHz dpi dpcm dppx');
        var isPseudoClassWithParen = toAssert2('current local-link nth-child nth-last-child nth-of-type nth-last-of-type nth-match nth-last-match column nth-column nth-last-column lang matches not', true);
        var MAX_ALLOWED_CODEPOINT = parseInt('10FFFF', 16);
        var REPLACEMENT_CHARACTER = parseInt('FFFD', 16);
        var $rules = [];
        var $links = {};
        var addRules = function (rules) {
            $rules = $rules.concat(rules);
            var rule, reg, state, link, retain;
            for (var i = 0; i < $rules.length; i++) {
                rule = $rules[i];
                reg = typeof rule.regexp !== 'string' ? String(rule.regexp).slice(1, -1) : rule.regexp;
                if (!~reg.indexOf('^(?')) {
                    rule.regexp = new RegExp('^(?:' + reg + ')');
                }
                state = rule.state || 'init';
                link = $links[state] || ($links[state] = []);
                link.push(i);
            }
            return this;
        };
        $('nl', /\r\n|[\r\f\n]/);
        $('w', /[ \t\r\n\f]/);
        $('d', /[0-9]/);
        $('nmchar', /[-a-z0-9\u00A1-\uFFFF]/);
        addRules([
            {
                regexp: /$/,
                action: function () {
                    return 'EOF';
                }
            },
            {
                regexp: /\/\*([^\x00]+?)\*\/|\/\/([^\n\r]*)/,
                action: function (yytext, mcomment, scomment) {
                    var isSingle = mcomment === undefined;
                    if (this.options.comment) {
                        this.options.comment({
                            type: isSingle ? 'singleline' : 'multiline',
                            content: isSingle ? scomment : mcomment
                        });
                    }
                }
            },
            {
                reg: /@css{w}*{/,
                action: function (yytext) {
                }
            },
            {
                regexp: /@(-?[_A-Za-z][-_\w]*)/,
                action: function (yytext, value) {
                    this.yyval = value;
                    return 'AT_KEYWORD';
                }
            },
            {
                regexp: $(/(url|url\-prefix|domain|regexp){w}*\({w}*['"]?([^\r\n\f]*?)['"]?{w}*\)/),
                action: function (yytext, name, url) {
                    this.yyval = url;
                    if (name === 'url')
                        return 'URL';
                    return {
                        type: 'FUNCTION',
                        value: name,
                        args: [{
                                type: 'STRING',
                                value: url
                            }]
                    };
                }
            },
            {
                regexp: $(/(?:[\$-]?[_A-Za-z][-_\w]*)(?={w}*\()/),
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'FUNCTION';
                }
            },
            {
                regexp: /\$(-?[_A-Za-z][-_\w]*)/,
                action: function (yytext, value) {
                    this.yyval = yytext;
                    return 'VAR';
                }
            },
            {
                regexp: /(?:-?[_A-Za-z][-_\w]*)/,
                action: function (yytext) {
                    if (yytext === 'false' || yytext === 'true') {
                        this.yyval = yytext === 'false' ? false : true;
                        return 'BOOLEAN';
                    }
                    if (yytext === 'null')
                        return 'NULL';
                    this.yyval = yytext;
                    return 'TEXT';
                }
            },
            {
                regexp: $(/!{w}*important/),
                action: function (yytext) {
                    return 'IMPORTANT';
                }
            },
            {
                regexp: $(/(-?(?:{d}*\.{d}+|{d}+))(\w*|%)?/),
                action: function (yytext, value, unit) {
                    if (unit && !isUnit(unit)) {
                        this.error('Unexcept unit: "' + unit + '"');
                    }
                    return {
                        type: 'DIMENSION',
                        value: parseFloat(value),
                        unit: unit
                    };
                }
            },
            {
                regexp: $(':([-_a-zA-Z]{nmchar}*)' + '(?:\\(' + '([^\\(\\)]*' + '|(?:' + '\\([^\\)]+\\)' + ')+)' + '\\))'),
                action: function (yytext, value) {
                    if (~yytext.indexOf('(') && !isPseudoClassWithParen(value)) {
                        return false;
                    }
                    this.yyval = yytext;
                    return 'PSEUDO_CLASS';
                }
            },
            {
                regexp: $('::({nmchar}+)'),
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'PSEUDO_ELEMENT';
                }
            },
            {
                regexp: $('\\[\\s*(?:{nmchar}+)(?:([*^$|~!]?=)[\'"]?(?:[^\'"\\[]+)[\'"]?)?\\s*\\]'),
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'ATTRIBUTE';
                }
            },
            {
                regexp: $(/#({nmchar}+)/),
                action: function (yytext, value) {
                    this.yyval = yytext;
                    return 'HASH';
                }
            },
            {
                regexp: $(/\\([0-9a-fA-F]{1,6})/),
                action: function (yytext, value) {
                    var hex = parseInt(value, 16);
                    if (hex > MAX_ALLOWED_CODEPOINT) {
                        hex = '\ufffd';
                    }
                    if (hex < 10) {
                        hex = '\\' + hex;
                    } else {
                        hex = String.fromCharCode(hex);
                    }
                    this.yyval = hex;
                    return 'TEXT';
                }
            },
            {
                regexp: $(/\.({nmchar}+)/),
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'CLASS';
                }
            },
            {
                regexp: /(['"])([^\r\n\f]*?)\1/,
                action: function (yytext, quote, value) {
                    this.yyval = value || '';
                    return 'STRING';
                }
            },
            {
                regexp: $(/{w}*([\{;,><]|&&|\|\||[\*\$\^~\|>=<!?]?=|\.\.\.){w}*/),
                action: function (yytext, punctuator) {
                    return punctuator;
                }
            },
            {
                regexp: $('WS', /{w}+/),
                action: function () {
                    return 'WS';
                }
            },
            {
                regexp: /(#\{|:|::|[#()\[\]&\.]|[\}%\-+*\/])/,
                action: function (yytext, punctuator) {
                    return punctuator;
                }
            }
        ]);
        function Tokenizer(options) {
            this.options = options || {};
            this.options.ignoreComment = true;
        }
        Tokenizer.prototype = {
            constructor: Tokenizer,
            tokenize: function (input) {
                this.input = input;
                this.remained = this.input;
                this.length = this.input.length;
                this.lineno = 1;
                this.states = ['init'];
                this.state = 'init';
                return this.pump();
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
                var tokens = [], t;
                var i = 0;
                while (t = this.lex()) {
                    i++;
                    tokens.push(t);
                    if (t.type == 'EOF')
                        break;
                }
                return tokens;
            },
            next: function () {
                var tmp, action, rule, token, tokenType, lines, state = this.state, rules = $rules, link = $links[state];
                if (!link)
                    throw Error('no state: ' + state + ' defined');
                this.yyval = null;
                var len = link.length;
                for (var i = 0; i < len; i++) {
                    var rule = $rules[link[i]];
                    tmp = this.remained.match(rule.regexp);
                    if (tmp) {
                        action = rule.action;
                        tokenType = action.apply(this, tmp);
                        if (tokenType === false) {
                            continue;
                        } else
                            break;
                    }
                }
                if (tmp) {
                    lines = tmp[0].match(/(?:\r\n|[\n\r\f]).*/g);
                    if (lines)
                        this.lineno += lines.length;
                    this.remained = this.remained.slice(tmp[0].length);
                    if (tokenType)
                        token = createToken(tokenType, this.yyval, this.lineno);
                    if (tokenType === 'WS') {
                        if (this._preIsWS) {
                            token = null;
                        }
                        this._preIsWS = true;
                    } else {
                        this._preIsWS = false;
                    }
                    return token;
                } else {
                    this.error('Unrecognized');
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
    '4': function (require, module, exports, global) {
        var _ = {};
        var slice = [].slice;
        var fs = null;
        var mkdirp = require('5');
        var path = require('6');
        var tmpl = require('7');
        var acceptError = tmpl('the "{{i}}" argument passed to this function only accept {{accept}}, but got "{{type}}"');
        var fp = Function.prototype, np = Number.prototype;
        function returnTrue() {
            return true;
        }
        fp.__accept = function (list) {
            var fn = this;
            if (!list || !list.length)
                return;
            var tlist = list.map(function (item) {
                    if (!item)
                        return returnTrue;
                    if (typeof item === 'function')
                        return item;
                    return _.makePredicate(item);
                });
            return function () {
                var args = _.slice(arguments);
                for (var i = args.length; i--;) {
                    if (!args[i])
                        continue;
                    var type = args[i].type;
                    var test = tlist[i];
                    if (test && !test(type)) {
                        throw Error(acceptError({
                            type: type,
                            accept: list[i] || 'h',
                            i: i
                        }));
                    }
                }
                return fn.apply(this, arguments);
            };
        };
        fp.__msetter = function () {
            var fn = this;
            return function (key, value) {
                if (typeof key === 'object') {
                    var args = _.slice(arguments, 1);
                    for (var i in key) {
                        fn.apply(this, [
                            i,
                            key[i]
                        ].concat(args));
                    }
                    return this;
                } else {
                    return fn.apply(this, arguments);
                }
            };
        };
        np.__limit = function (min, max) {
            return Math.min(max, Math.max(min, this));
        };
        _.makePredicate = function (words, prefix) {
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
                f += 'var prefix = ' + (prefix ? 'true' : 'false') + ';if(prefix) str = str.replace(/^-(?:\\w+)-/,\'\');switch(str.length){';
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
                if (j.charAt(0) === '_')
                    continue;
                if (o1[j] == null || override)
                    o1[j] = o2[j];
            }
            return o1;
        };
        _.copy = function (obj, keys) {
            var res = {};
            keys.forEach(function (key) {
                res[key] = obj[key];
            });
            return res;
        };
        _.debugger = 1;
        _.log = function () {
            if (_.debugger < 3)
                return;
            console.log.apply(console, arguments);
        };
        _.warn = function () {
            if (_.debugger < 2)
                return;
            console.warn.apply(console, arguments);
        };
        _.error = function () {
            if (_.debugger < 1)
                return;
            console.error.apply(console, arguments);
        };
        _.uuid = function (t) {
            var _uid = 1;
            t = t || '';
            return function () {
                return t + _uid++;
            };
        }, _.writeFile = function (fullpath, data, callback) {
            function write(cb) {
                fs.writeFile(fullpath, data, cb);
            }
            write(function (error) {
                if (!error)
                    return callback(null, fullpath, data);
                mkdirp(path.dirname(fullpath), 493, function (error) {
                    if (error)
                        return callback(error);
                    write(function (error) {
                        callback(error, fullpath, data);
                    });
                });
            });
        };
        _.flatten = function (array) {
            var res = [];
            _.slice(array).forEach(function (item, index) {
                if (!item)
                    return;
                if (Array.isArray(item)) {
                    res = res.concat(_.flatten(item));
                } else {
                    res.push(item);
                }
            });
            return res;
        };
        _.throttle = function (func, wait, immediate) {
            var context, args, result;
            var timeout = null;
            var previous = 0;
            var later = function () {
                previous = new Date();
                timeout = null;
                result = func.apply(context, args);
            };
            return function () {
                var now = new Date();
                if (!previous && immediate === false)
                    previous = now;
                var remaining = wait - (now - previous);
                context = this;
                args = arguments;
                if (remaining <= 0) {
                    clearTimeout(timeout);
                    timeout = null;
                    previous = now;
                    result = func.apply(context, args);
                } else if (!timeout) {
                    timeout = setTimeout(later, remaining);
                }
                return result;
            };
        };
        _.uid = _.uuid();
        _.merge = function (list, ast) {
            if (!ast)
                return;
            var type = ast.type;
            if (type === 'block' || type === 'stylesheet') {
                return _.merge(list, ast.list);
            }
            if (Array.isArray(ast)) {
                for (var i = 0, len = ast.length; i < len; i++) {
                    _.merge(list, ast[i]);
                }
            } else {
                list.push(ast);
            }
        };
        _.typeOf = function (obj) {
            return obj == null ? String(obj) : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
        };
        _.slice = function (arr, start, last) {
            return slice.call(arr, start, last);
        };
        _.watch = function (file, callback) {
            var isWin = process.platform === 'win32';
            if (isWin) {
                fs.watch(file, function (event) {
                    if (event === 'change')
                        callback(file);
                });
            } else {
                fs.watchFile(file, { interval: 200 }, function (curr, prev) {
                    if (curr.mtime > prev.mtime)
                        callback(file);
                });
            }
        };
        module.exports = _;
    },
    '5': function (require, module, exports, global) {
        var path = null;
        var fs = null;
        module.exports = mkdirP.mkdirp = mkdirP.mkdirP = mkdirP;
        function mkdirP(p, mode, f, made) {
            if (typeof mode === 'function' || mode === undefined) {
                f = mode;
                mode = 511 & ~process.umask();
            }
            if (!made)
                made = null;
            var cb = f || function () {
                };
            if (typeof mode === 'string')
                mode = parseInt(mode, 8);
            p = path.resolve(p);
            fs.mkdir(p, mode, function (er) {
                if (!er) {
                    made = made || p;
                    return cb(null, made);
                }
                switch (er.code) {
                case 'ENOENT':
                    mkdirP(path.dirname(p), mode, function (er, made) {
                        if (er)
                            cb(er, made);
                        else
                            mkdirP(p, mode, cb, made);
                    });
                    break;
                default:
                    fs.stat(p, function (er2, stat) {
                        if (er2 || !stat.isDirectory())
                            cb(er, made);
                        else
                            cb(null, made);
                    });
                    break;
                }
            });
        }
        mkdirP.sync = function sync(p, mode, made) {
            if (mode === undefined) {
                mode = 511 & ~process.umask();
            }
            if (!made)
                made = null;
            if (typeof mode === 'string')
                mode = parseInt(mode, 8);
            p = path.resolve(p);
            try {
                fs.mkdirSync(p, mode);
                made = made || p;
            } catch (err0) {
                switch (err0.code) {
                case 'ENOENT':
                    made = sync(path.dirname(p), mode, made);
                    sync(p, mode, made);
                    break;
                default:
                    var stat;
                    try {
                        stat = fs.statSync(p);
                    } catch (err1) {
                        throw err0;
                    }
                    if (!stat.isDirectory())
                        throw err0;
                    break;
                }
            }
            return made;
        };
    },
    '6': function (require, module, exports, global) {
        var syspath = null, slice = [].slice;
        if (syspath)
            module.exports = syspath;
        else {
            exports.fake = true;
            exports.join = join;
            exports.normalize = normalize;
            exports.dirname = dirname;
            exports.extname = extname;
            exports.isAbsolute = isAbsolute;
            var slice = [].slice;
            var DIRNAME_RE = /[^?#]*\//;
            var DOT_RE = /\/\.\//g;
            var MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g;
            var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//;
            var URI_END_RE = /\?|\.(?:css|mcss)$|\/$/;
            function dirname(path) {
                return path.match(DIRNAME_RE)[0];
            }
            function normalize(path) {
                path = path.replace(DOT_RE, '/');
                path = path.replace(MULTIPLE_SLASH_RE, '$1/');
                while (path.match(DOUBLE_DOT_RE)) {
                    path = path.replace(DOUBLE_DOT_RE, '/');
                }
                return path;
            }
            function join(url, url2) {
                var args = slice.call(arguments);
                var res = args.reduce(function (u1, u2) {
                        return u1 + '/' + u2;
                    });
                return normalize(res);
            }
            function extname(url) {
                var res = url.match(/(\.\w+)[^\/]*$/);
                if (res && res[1]) {
                    return res[1];
                }
                return '';
            }
            function isAbsolute(url) {
                return /^\/|:\//.test(url);
            }
        }
    },
    '7': function (require, module, exports, global) {
        function templayed(template, vars) {
            var get = function (path, i) {
                    i = 1;
                    path = path.replace(/\.\.\//g, function () {
                        i++;
                        return '';
                    });
                    var js = [
                            'vars[vars.length - ',
                            i,
                            ']'
                        ], keys = path == '.' ? [] : path.split('.'), j = 0;
                    for (j; j < keys.length; j++) {
                        js.push('.' + keys[j]);
                    }
                    ;
                    return js.join('');
                }, tag = function (template) {
                    return template.replace(/\{\{(!|&|\{)?\s*(.*?)\s*}}+/g, function (match, operator, context) {
                        if (operator == '!')
                            return '';
                        var i = inc++;
                        return [
                            '"; var o',
                            i,
                            ' = ',
                            get(context),
                            ', s',
                            i,
                            ' = (((typeof(o',
                            i,
                            ') == "function" ? o',
                            i,
                            '.call(vars[vars.length - 1]) : o',
                            i,
                            ') || "") + ""); s += ',
                            operator ? 's' + i : '(/[&"><]/.test(s' + i + ') ? s' + i + '.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/>/g,"&gt;").replace(/</g,"&lt;") : s' + i + ')',
                            ' + "'
                        ].join('');
                    });
                }, block = function (template) {
                    return tag(template.replace(/\{\{(\^|#)(.*?)}}(.*?)\{\{\/\2}}/g, function (match, operator, key, context) {
                        var i = inc++;
                        return [
                            '"; var o',
                            i,
                            ' = ',
                            get(key),
                            '; ',
                            (operator == '^' ? [
                                'if ((o',
                                i,
                                ' instanceof Array) ? !o',
                                i,
                                '.length : !o',
                                i,
                                ') { s += "',
                                block(context),
                                '"; } '
                            ] : [
                                'if (typeof(o',
                                i,
                                ') == "boolean" && o',
                                i,
                                ') { s += "',
                                block(context),
                                '"; } else if (o',
                                i,
                                ') { for (var i',
                                i,
                                ' = 0; i',
                                i,
                                ' < o',
                                i,
                                '.length; i',
                                i,
                                '++) { vars.push(o',
                                i,
                                '[i',
                                i,
                                ']); s += "',
                                block(context),
                                '"; vars.pop(); }}'
                            ]).join(''),
                            '; s += "'
                        ].join('');
                    }));
                }, inc = 0;
            return new Function('vars', 'vars = [vars], s = "' + block(template.replace(/"/g, '\\"').replace(/\n/g, '\\n')) + '"; return s;');
        }
        ;
        module.exports = templayed;
    },
    '8': function (require, module, exports, global) {
        var _ = require('4'), splice = [].splice, tk = require('3'), isPrimary = _.makePredicate('hash rgba dimension string boolean text null url');
        function Stylesheet(list) {
            this.type = 'stylesheet';
            this.list = list || [];
        }
        Stylesheet.prototype.clone = function () {
            var clone = new Stylesheet();
            clone.list = cloneNode(this.list);
            return clone;
        };
        Stylesheet.prototype.exclude = function () {
            var res = [], list = this.list, item;
            for (var len = list.length; len--;) {
                item = list[len];
                if (item.type === 'media') {
                    res.unshift(list.splice(len, 1)[0]);
                }
            }
            return res;
        };
        Stylesheet.prototype.abstract = function () {
            var list = this.list, i = list.length;
            for (; i--;) {
                ruleset = list[i];
                if (ruleset && ruleset.type == 'ruleset') {
                    ruleset.abstract = true;
                }
            }
            return this;
        };
        function SelectorList(list) {
            this.type = 'selectorlist';
            this.list = list || [];
        }
        SelectorList.prototype.clone = function () {
            var clone = new SelectorList(cloneNode(this.list));
            return clone;
        };
        SelectorList.prototype.len = function () {
            return this.list.length;
        };
        function ComplexSelector(string, interpolations) {
            this.type = 'complexselector';
            this.string = string;
            this.interpolations = interpolations || [];
        }
        ComplexSelector.prototype.clone = function () {
            var clone = new ComplexSelector(this.string, cloneNode(this.interpolations));
            return clone;
        };
        function RuleSet(selector, block, abstract) {
            this.type = 'ruleset';
            this.selector = selector;
            this.block = block;
            this.ref = [];
            this.abstract = abstract || false;
        }
        RuleSet.prototype.addRef = function (ruleset) {
            var alreadyHas = this.ref.some(function (item) {
                    return ruleset === item;
                });
            if (alreadyHas)
                return;
            this.ref.push(ruleset);
        };
        RuleSet.prototype.getSelectors = function () {
            if (this._selectors)
                return this._selectors;
            var selectors = this.selector.list;
            if (this.ref.length) {
                this.ref.forEach(function (ruleset) {
                    selectors = selectors.concat(ruleset.getSelectors());
                });
            }
            return this._selectors = selectors;
        };
        RuleSet.prototype.clone = function () {
            var clone = new RuleSet(cloneNode(this.selector), cloneNode(this.block), this.abstract);
            return clone;
        };
        function Block(list) {
            this.type = 'block';
            this.list = list || [];
        }
        Block.prototype.clone = function () {
            var clone = new Block(cloneNode(this.list));
            return clone;
        };
        Block.prototype.exclude = function () {
            var res = [], list = this.list, item;
            for (var len = list.length; len--;) {
                item = list[len];
                if (item.type !== 'declaration') {
                    res.unshift(list.splice(len, 1)[0]);
                }
            }
            return res;
        };
        function Call(name, arguments) {
            this.name = name;
            this.arguments = arguments;
        }
        Call.prototype.clone = function () {
            var clone = new Call(this.name, cloneNode(this.arguments));
            return clone;
        };
        function Declaration(property, value, important) {
            this.type = 'declaration';
            this.property = property;
            this.value = value;
            this.important = important || false;
        }
        Declaration.prototype.clone = function (name) {
            var clone = new Declaration(cloneNode(this.property), cloneNode(this.value), this.important);
            return clone;
        };
        function Values(list) {
            this.type = 'values';
            this.list = list || [];
        }
        Values.prototype.clone = function () {
            var clone = new Values(cloneNode(this.list));
            return clone;
        };
        Values.prototype.flatten = function () {
            var list = this.list, i = list.length, value;
            for (; i--;) {
                value = list[i];
                if (value.type = 'values') {
                    splice.apply(this, [
                        i,
                        1
                    ].concat(value.list));
                }
            }
        };
        function ValuesList(list) {
            this.type = 'valueslist';
            this.list = list || [];
        }
        ValuesList.prototype.clone = function () {
            var clone = new ValuesList(cloneNode(this.list));
            return clone;
        };
        ValuesList.prototype.flatten = function () {
            var list = this.list, i = list.length, values;
            for (; i--;) {
                values = list[i];
                if (values.type = 'valueslist') {
                    splice.apply(this, [
                        i,
                        1
                    ].concat(values.list));
                }
            }
        };
        ValuesList.prototype.first = function () {
            return this.list[0].list[0];
        };
        function Unknown(name) {
            this.type = 'unknown';
            this.name = name;
        }
        Unknown.prototype.clone = function () {
            var clone = new Unknown(this.name);
            return clone;
        };
        function Assign(name, value, override) {
            this.type = 'assign';
            this.name = name;
            this.value = value;
            this.override = override === undefined ? true : override;
        }
        Assign.prototype.clone = function (name) {
            var clone = new Assign(this.name, cloneNode(this.value), this.override);
            return clone;
        };
        function Func(name, params, block) {
            this.type = 'func';
            this.name = name;
            this.params = params || [];
            this.block = block;
        }
        Func.prototype.clone = function () {
            var clone = new Func(this.name, this.params, this.block);
            return clone;
        };
        function Param(name, dft, rest) {
            this.type = 'param';
            this.name = name;
            this.default = dft;
            this.rest = rest || false;
        }
        function Include(name, params) {
            this.type = 'include';
            this.name = name;
            this.params = params || [];
        }
        Include.prototype.clone = function () {
            var clone = new Include(this.name, this.params);
            return clone;
        };
        function Extend(selector) {
            this.type = 'extend';
            this.selector = selector;
        }
        Extend.prototype.clone = function () {
            var clone = new Extend(this.selector);
            return clone;
        };
        function Module(name, block) {
            this.type = 'module';
            this.block = block;
        }
        Module.prototype.clone = function () {
            var clone = new Module(this.name, cloneNode(this.block));
            return clone;
        };
        function Pointer(name, key) {
            this.type = 'pointer';
            this.name = name;
            this.key = key;
        }
        Pointer.prototype.clone = function () {
            var clone = new Pointer(this.name, this.key);
            return clone;
        };
        function Import(url, queryList, stylesheet) {
            this.type = 'import';
            this.url = url;
            this.queryList = queryList || [];
            this.stylesheet = stylesheet;
        }
        Import.prototype.clone = function () {
            var clone = new Import(this.url, this.queryList, this.promise);
            return clone;
        };
        function IfStmt(test, block, alt) {
            this.type = 'if';
            this.test = test;
            this.block = block;
            this.alt = alt;
        }
        IfStmt.prototype.clone = function () {
            var clone = new IfStmt(cloneNode(this.test), cloneNode(this.block), cloneNode(this.alt));
            return clone;
        };
        function ForStmt(element, index, list, block) {
            this.type = 'for';
            this.element = element;
            this.index = index;
            this.list = list;
            this.block = block;
        }
        ForStmt.prototype.clone = function () {
            var clone = new ForStmt(this.element, this.index, cloneNode(this.list), cloneNode(this.block));
            return clone;
        };
        function ReturnStmt(value) {
            this.type = 'return';
            this.value = value;
        }
        ReturnStmt.prototype.clone = function () {
            var clone = new ReturnStmt(cloneNode(this.value));
            return clone;
        };
        function CompoundIdent(list) {
            this.type = 'compoundident';
            this.list = list || [];
        }
        CompoundIdent.prototype.clone = function () {
            var clone = new CompoundIdent(cloneNode(this.list));
            return clone;
        };
        CompoundIdent.prototype.toString = function () {
            return this.list.join('');
        };
        function Dimension(value, unit) {
            this.type = 'dimension';
            this.value = value;
            this.unit = unit;
        }
        Dimension.prototype.clone = function () {
            var clone = new Dimension(this.value, this.unit);
            return clone;
        };
        Dimension.prototype.toString = function () {
            return '' + this.value + (this.unit || '');
        };
        function Operator(op, left, right) {
            this.type = 'operator';
            this.op = op;
            this.left = left;
            this.right = right;
        }
        Operator.prototype.clone = function () {
            var clone = new Operator(this.op, cloneNode(this.left), cloneNode(this.right));
            return clone;
        };
        Operator.prototype.toBoolean = function () {
        };
        Operator.toValue = function () {
        };
        function Range(left, right) {
            this.type = 'range';
            this.left = left;
            this.right = right;
        }
        Range.prototype.clone = function () {
            var clone = new Range(cloneNode(this.left), cloneNode(this.right));
            return clone;
        };
        function Unary(value, reverse) {
            this.value = value;
            this.reverse = !!reverse;
        }
        Unary.prototype.clone = function (value, reverse) {
            var clone = new Unary(value, reverse);
            return clone;
        };
        function Call(name, args) {
            this.type = 'call';
            this.name = name;
            this.args = args || [];
        }
        Call.prototype.clone = function () {
            var clone = new Call(this.name, cloneNode(this.args));
            return clone;
        };
        function FontFace(block) {
            this.type = 'fontface';
            this.block = block;
        }
        FontFace.prototype.clone = function () {
            var clone = new FontFace(param);
            return clone;
        };
        function Media(queryList, stylesheet) {
            this.type = 'media';
            this.queryList = queryList || [];
            this.stylesheet = stylesheet;
        }
        Media.prototype.clone = function () {
            var clone = new Media(cloneNode(this.list), cloneNode(this.stylesheet));
            return clone;
        };
        function MediaQuery(type, expressions) {
            this.type = 'mediaquery';
            this.mediaType = type;
            this.expressions = expressions || [];
        }
        MediaQuery.prototype.clone = function () {
            var clone = new MediaQuery(this.mediaType, cloneNode(this.list));
            return clone;
        };
        MediaQuery.prototype.equals = function (media) {
            var expressions = this.expressions, len = expressions.length, test, exp;
            if (!media)
                return false;
            if (this.mediaType !== media.mediaType) {
                return false;
            }
            if (len !== media.length) {
                return false;
            }
            for (; len--;) {
                exp = expressions[len - 1];
                test = media.expressions.some(function (exp2) {
                    return exp.equals(exp2);
                });
            }
        };
        function MediaExpression(feature, value) {
            this.type = 'mediaexpression';
            this.feature = feature;
            this.value = value;
        }
        MediaExpression.prototype.clone = function () {
            var clone = new MediaExpression(cloneNode(this.feature), cloneNode(this.value));
            return clone;
        };
        MediaExpression.prototype.equals = function (exp2) {
            return this.feature == exp2.feature && this.value === exp2.feature;
        };
        function Keyframes(name, blocks) {
            this.type = 'keyframes';
            this.blocks = blocks || [];
        }
        Keyframes.prototype.clone = function () {
            var clone = new Keyframes(cloneNode(this.blocks));
            return clone;
        };
        function KeyframesBlock(step, block) {
            this.type = 'keyframesblock';
            this.step = step;
            this.block = block;
        }
        KeyframesBlock.prototype.clone = function () {
            var clone = new KeyframesBlock(cloneNode(this.step), cloneNode(this.block));
            return clone;
        };
        function Page(selector, block) {
            this.type = 'page';
            this.selector = selector;
            this.block = block;
        }
        Page.prototype.clone = function () {
            var clone = new Page(this.selector, cloneNode(this.block));
            return clone;
        };
        function Debug(value) {
            this.type = 'debug';
            this.value = value;
        }
        Debug.prototype.clone = function () {
            var clone = new Debug(cloneNode(this.value));
            return clone;
        };
        function Directive(name, value, block) {
            this.type = 'directive';
            this.name = name;
            this.value = value;
            this.block = block;
        }
        Directive.prototype.clone = function () {
            var clone = new Directive(this.name, cloneNode(this.value), cloneNode(this.block));
            return clone;
        };
        Print.formats = {
            'd': function (value) {
                return parseInt(value, 10);
            },
            'f': function (value) {
                return parseFloat(value, 10);
            },
            'x': function (value) {
                return parseInt(value, 10).toString(16);
            },
            's': function (value) {
                return String(value);
            }
        };
        exports.Stylesheet = Stylesheet;
        exports.SelectorList = SelectorList;
        exports.ComplexSelector = ComplexSelector;
        exports.RuleSet = RuleSet;
        exports.Block = Block;
        exports.Declaration = Declaration;
        exports.ValuesList = ValuesList;
        exports.Values = Values;
        exports.Unknown = Unknown;
        exports.Func = Func;
        exports.Param = Param;
        exports.Include = Include;
        exports.Extend = Extend;
        exports.IfStmt = IfStmt;
        exports.ForStmt = ForStmt;
        exports.ReturnStmt = ReturnStmt;
        exports.Module = Module;
        exports.Debug = Debug;
        exports.Pointer = Pointer;
        exports.Range = Range;
        exports.Import = Import;
        exports.Page = Page;
        exports.Directive = Directive;
        exports.Color = require('9');
        exports.Assign = Assign;
        exports.Call = Call;
        exports.Operator = Operator;
        exports.CompoundIdent = CompoundIdent;
        exports.Media = Media;
        exports.MediaQuery = MediaQuery;
        exports.MediaExpression = MediaExpression;
        exports.Keyframes = Keyframes;
        exports.KeyframesBlock = KeyframesBlock;
        exports.inspect = function (node) {
            return node.type ? node.type.toLowerCase() : null;
        };
        var cloneNode = exports.cloneNode = function (node) {
                if (!node)
                    return node;
                if (node.clone)
                    return node.clone();
                if (Array.isArray(node))
                    return node.map(cloneNode);
                if (node.type) {
                    var res = {
                            type: node.type,
                            value: node.value
                        };
                    if (node.type === 'DIMENSION')
                        res.unit = node.unit;
                    return res;
                }
                if (typeof node !== 'object')
                    return node;
                else {
                    _.error(node);
                    throw Error('con"t clone node');
                }
            };
        exports.toStr = function (ast) {
            switch (ast.type) {
            case 'TEXT':
            case 'BOOLEAN':
            case 'NULL':
                return ast.value;
            case 'DIMENSION':
                var value = '' + ast.value + (ast.unit ? ast.unit : '');
                return value;
            case 'STRING':
                return ast.value;
            case 'RGBA':
                return ast.tocss();
            default:
                return ast.value;
            }
        };
        exports.toBoolean = function (node) {
            if (!node)
                return false;
            var type = exports.inspect(node);
            switch (type) {
            case 'dimension':
                return node.value != 0;
            case 'string':
            case 'text':
                return node.value.length !== '';
            case 'boolean':
                return node.value === true;
            case 'null':
                return false;
            case 'valueslist':
            case 'values':
                return node.list.length > 0;
            default:
                return false;
            }
        };
        exports.isPrimary = isPrimary;
        exports.isRelationOp = _.makePredicate('== >= <= < > !=');
        exports.convert = function (primary) {
            var type = _.typeOf(primary);
            var tType;
            switch (type) {
            case 'string':
                tType = 'STRING';
                break;
            case 'boolean':
                tType = 'BOOLEAN';
                break;
            case 'number':
                tType = 'DIMENSION';
                break;
            case 'undefined':
            case 'null':
                tType = 'NULL';
                break;
            case 'object':
                return primary;
            }
            if (tType)
                return tk.createToken(tType, primary);
            return primary;
        };
    },
    '9': function (require, module, exports, global) {
        var _ = require('4');
        function Color(channels, alpha) {
            this.type = 'color';
            if (typeof channels === 'string') {
                var string = channels.charAt(0) === '#' ? channels.slice(1) : channels;
                if (string.length === 6) {
                    channels = [
                        parseInt(string.substr(0, 2), 16),
                        parseInt(string.substr(2, 2), 16),
                        parseInt(string.substr(4, 2), 16)
                    ];
                } else {
                    var r = string.substr(0, 1);
                    var g = string.substr(1, 1);
                    var b = string.substr(2, 1);
                    channels = [
                        parseInt(r + r, 16),
                        parseInt(g + g, 16),
                        parseInt(b + b, 16)
                    ];
                }
            }
            this[0] = channels[0];
            this[1] = channels[1];
            this[2] = channels[2];
            this.alpha = alpha || 1;
        }
        var c = Color.prototype;
        c.toHSL = function () {
            return Color.rgb2hsl(this);
        };
        c.toCSS = function () {
            if (!this.alpha || this.alpha === 1) {
                return 'rgb(' + this[0] + ',' + this[1] + ',' + this[2] + ')';
            } else {
                return 'rgba(' + this[0] + ',' + this[1] + ',' + this[2] + ',' + this.alpha + ')';
            }
        };
        c.clone = function () {
            return new Color(this, this.alpha);
        };
        Color.rgb2hsl = function (rv, hv) {
            hv = hv || [];
            var r = rv[0] / 255, g = rv[1] / 255, b = rv[2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), h, s, l = (max + min) / 2, d;
            if (max == min) {
                h = s = 0;
            } else {
                var d = max - min;
                s = l >= 0.5 ? d / (2 - max - min) : d / (max + min);
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
            hv[0] = h * 360;
            hv[1] = s * 100;
            hv[2] = l * 100;
            return hv;
        };
        Color.hsl2rgb = function (hv, rv) {
            rv = rv || [];
            var r, g, b;
            h = hv[0] / 360, s = hv[1] / 100, l = hv[2] / 100;
            function hue2rgb(p, q, t) {
                if (t < 0)
                    t += 1;
                if (t > 1)
                    t -= 1;
                if (t < 1 / 6)
                    return p + (q - p) * 6 * t;
                if (t < 1 / 2)
                    return q;
                if (t < 2 / 3)
                    return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            }
            if (s === 0) {
                r = g = b = l;
            } else {
                var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                var p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }
            rv[0] = r * 255;
            rv[1] = g * 255;
            rv[2] = b * 255;
            return rv;
        };
        Color.limit = function (values) {
            values[0] = values[0].__limit(0, 255);
            values[1] = values[2].__limit(0, 255);
            values[2] = values[2].__limit(0, 255);
        };
        Color.hsl = function (channels, a) {
            return new Color(Color.hsl2rgb(channels), a);
        };
        Color.maps = {
            aliceblue: [
                240,
                248,
                255
            ],
            antiquewhite: [
                250,
                235,
                215
            ],
            aqua: [
                0,
                255,
                255
            ],
            aquamarine: [
                127,
                255,
                212
            ],
            azure: [
                240,
                255,
                255
            ],
            beige: [
                245,
                245,
                220
            ],
            bisque: [
                255,
                228,
                196
            ],
            black: [
                0,
                0,
                0
            ],
            blanchedalmond: [
                255,
                235,
                205
            ],
            blue: [
                0,
                0,
                255
            ],
            blueviolet: [
                138,
                43,
                226
            ],
            brown: [
                165,
                42,
                42
            ],
            burlywood: [
                222,
                184,
                135
            ],
            cadetblue: [
                95,
                158,
                160
            ],
            chartreuse: [
                127,
                255,
                0
            ],
            chocolate: [
                210,
                105,
                30
            ],
            coral: [
                255,
                127,
                80
            ],
            cornflowerblue: [
                100,
                149,
                237
            ],
            cornsilk: [
                255,
                248,
                220
            ],
            crimson: [
                220,
                20,
                60
            ],
            cyan: [
                0,
                255,
                255
            ],
            darkblue: [
                0,
                0,
                139
            ],
            darkcyan: [
                0,
                139,
                139
            ],
            darkgoldenrod: [
                184,
                134,
                11
            ],
            darkgray: [
                169,
                169,
                169
            ],
            darkgreen: [
                0,
                100,
                0
            ],
            darkgrey: [
                169,
                169,
                169
            ],
            darkkhaki: [
                189,
                183,
                107
            ],
            darkmagenta: [
                139,
                0,
                139
            ],
            darkolivegreen: [
                85,
                107,
                47
            ],
            darkorange: [
                255,
                140,
                0
            ],
            darkorchid: [
                153,
                50,
                204
            ],
            darkred: [
                139,
                0,
                0
            ],
            darksalmon: [
                233,
                150,
                122
            ],
            darkseagreen: [
                143,
                188,
                143
            ],
            darkslateblue: [
                72,
                61,
                139
            ],
            darkslategray: [
                47,
                79,
                79
            ],
            darkslategrey: [
                47,
                79,
                79
            ],
            darkturquoise: [
                0,
                206,
                209
            ],
            darkviolet: [
                148,
                0,
                211
            ],
            deeppink: [
                255,
                20,
                147
            ],
            deepskyblue: [
                0,
                191,
                255
            ],
            dimgray: [
                105,
                105,
                105
            ],
            dimgrey: [
                105,
                105,
                105
            ],
            dodgerblue: [
                30,
                144,
                255
            ],
            firebrick: [
                178,
                34,
                34
            ],
            floralwhite: [
                255,
                250,
                240
            ],
            forestgreen: [
                34,
                139,
                34
            ],
            fuchsia: [
                255,
                0,
                255
            ],
            gainsboro: [
                220,
                220,
                220
            ],
            ghostwhite: [
                248,
                248,
                255
            ],
            gold: [
                255,
                215,
                0
            ],
            goldenrod: [
                218,
                165,
                32
            ],
            gray: [
                128,
                128,
                128
            ],
            green: [
                0,
                128,
                0
            ],
            greenyellow: [
                173,
                255,
                47
            ],
            grey: [
                128,
                128,
                128
            ],
            honeydew: [
                240,
                255,
                240
            ],
            hotpink: [
                255,
                105,
                180
            ],
            indianred: [
                205,
                92,
                92
            ],
            indigo: [
                75,
                0,
                130
            ],
            ivory: [
                255,
                255,
                240
            ],
            khaki: [
                240,
                230,
                140
            ],
            lavender: [
                230,
                230,
                250
            ],
            lavenderblush: [
                255,
                240,
                245
            ],
            lawngreen: [
                124,
                252,
                0
            ],
            lemonchiffon: [
                255,
                250,
                205
            ],
            lightblue: [
                173,
                216,
                230
            ],
            lightcoral: [
                240,
                128,
                128
            ],
            lightcyan: [
                224,
                255,
                255
            ],
            lightgoldenrodyellow: [
                250,
                250,
                210
            ],
            lightgray: [
                211,
                211,
                211
            ],
            lightgreen: [
                144,
                238,
                144
            ],
            lightgrey: [
                211,
                211,
                211
            ],
            lightpink: [
                255,
                182,
                193
            ],
            lightsalmon: [
                255,
                160,
                122
            ],
            lightseagreen: [
                32,
                178,
                170
            ],
            lightskyblue: [
                135,
                206,
                250
            ],
            lightslategray: [
                119,
                136,
                153
            ],
            lightslategrey: [
                119,
                136,
                153
            ],
            lightsteelblue: [
                176,
                196,
                222
            ],
            lightyellow: [
                255,
                255,
                224
            ],
            lime: [
                0,
                255,
                0
            ],
            limegreen: [
                50,
                205,
                50
            ],
            linen: [
                250,
                240,
                230
            ],
            magenta: [
                255,
                0,
                255
            ],
            maroon: [
                128,
                0,
                0
            ],
            mediumaquamarine: [
                102,
                205,
                170
            ],
            mediumblue: [
                0,
                0,
                205
            ],
            mediumorchid: [
                186,
                85,
                211
            ],
            mediumpurple: [
                147,
                112,
                219
            ],
            mediumseagreen: [
                60,
                179,
                113
            ],
            mediumslateblue: [
                123,
                104,
                238
            ],
            mediumspringgreen: [
                0,
                250,
                154
            ],
            mediumturquoise: [
                72,
                209,
                204
            ],
            mediumvioletred: [
                199,
                21,
                133
            ],
            midnightblue: [
                25,
                25,
                112
            ],
            mintcream: [
                245,
                255,
                250
            ],
            mistyrose: [
                255,
                228,
                225
            ],
            moccasin: [
                255,
                228,
                181
            ],
            navajowhite: [
                255,
                222,
                173
            ],
            navy: [
                0,
                0,
                128
            ],
            oldlace: [
                253,
                245,
                230
            ],
            olive: [
                128,
                128,
                0
            ],
            olivedrab: [
                107,
                142,
                35
            ],
            orange: [
                255,
                165,
                0
            ],
            orangered: [
                255,
                69,
                0
            ],
            orchid: [
                218,
                112,
                214
            ],
            palegoldenrod: [
                238,
                232,
                170
            ],
            palegreen: [
                152,
                251,
                152
            ],
            paleturquoise: [
                175,
                238,
                238
            ],
            palevioletred: [
                219,
                112,
                147
            ],
            papayawhip: [
                255,
                239,
                213
            ],
            peachpuff: [
                255,
                218,
                185
            ],
            peru: [
                205,
                133,
                63
            ],
            pink: [
                255,
                192,
                203
            ],
            plum: [
                221,
                160,
                221
            ],
            powderblue: [
                176,
                224,
                230
            ],
            purple: [
                128,
                0,
                128
            ],
            red: [
                255,
                0,
                0
            ],
            rosybrown: [
                188,
                143,
                143
            ],
            royalblue: [
                65,
                105,
                225
            ],
            saddlebrown: [
                139,
                69,
                19
            ],
            salmon: [
                250,
                128,
                114
            ],
            sandybrown: [
                244,
                164,
                96
            ],
            seagreen: [
                46,
                139,
                87
            ],
            seashell: [
                255,
                245,
                238
            ],
            sienna: [
                160,
                82,
                45
            ],
            silver: [
                192,
                192,
                192
            ],
            skyblue: [
                135,
                206,
                235
            ],
            slateblue: [
                106,
                90,
                205
            ],
            slategray: [
                112,
                128,
                144
            ],
            slategrey: [
                112,
                128,
                144
            ],
            snow: [
                255,
                250,
                250
            ],
            springgreen: [
                0,
                255,
                127
            ],
            steelblue: [
                70,
                130,
                180
            ],
            tan: [
                210,
                180,
                140
            ],
            teal: [
                0,
                128,
                128
            ],
            thistle: [
                216,
                191,
                216
            ],
            tomato: [
                255,
                99,
                71
            ],
            turquoise: [
                64,
                224,
                208
            ],
            violet: [
                238,
                130,
                238
            ],
            wheat: [
                245,
                222,
                179
            ],
            white: [
                255,
                255,
                255
            ],
            whitesmoke: [
                245,
                245,
                245
            ],
            yellow: [
                255,
                255,
                0
            ],
            yellowgreen: [
                154,
                205,
                50
            ]
        };
        module.exports = Color;
    },
    'a': function (require, module, exports, global) {
        var fs = null;
        var path = null;
        var promise = require('b');
        var state = require('c');
        var parser = require('2');
        exports.get = function (path, options) {
            options = options || {};
            if (fs) {
                return file(path, 'utf8');
            } else {
                return http(path);
            }
        };
        exports.parse = function (path, options) {
            var p = promise();
            options.filename = path;
            exports.get(path).done(function (text) {
                parser.parse(text, options).always(p.resolve.bind(p));
            }).fail(function (error) {
                p.resolve();
                console.log('seems ' + path + ' is not exsit skiped');
            });
            return p;
        };
        var http = function (url) {
            var p = promise();
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4)
                    return;
                var status = xhr.status;
                if (status >= 200 && status < 300) {
                    p.resolve(xhr.responseText);
                } else {
                    p.reject(xhr);
                }
            };
            xhr.send();
            return p;
        };
        var file = function (path) {
            var p = promise();
            fs.readFile(path, 'utf8', function (error, content) {
                if (error)
                    return p.reject(error);
                p.resolve(content);
            });
            return p;
        };
    },
    'b': function (require, module, exports, global) {
        var slice = Array.prototype.slice, isFunction = function (fn) {
                return typeof fn == 'function';
            }, typeOf = function (obj) {
                return obj == null ? String(obj) : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
            }, extend = function (o1, o2) {
                for (var i in o2) {
                    if (o2.hasOwnProperty(i))
                        o1[i] = o2[i];
                }
            }, merge = function (o1, o2) {
                for (var i in o2) {
                    if (!o2.hasOwnProperty(i))
                        continue;
                    if (typeOf(o1[i]) === 'array' || typeOf(o2[i]) === 'array') {
                        console.log(o1, o2);
                        o1[i] = o1[i].concat(o2[i]);
                    } else {
                        o1[i] = o2[i];
                    }
                }
                return o1;
            }, states = {
                PENDING: 1,
                RESOLVED: 2,
                REJECTED: 3
            }, Promise = function () {
                this.state = states.PENDING;
                this.locked = false;
                this.args = [];
                this.doneCallbacks = [];
                this.failCallbacks = [];
                this.progressCallbacks = [];
            };
        extend(Promise.prototype, {
            lock: function () {
                this.locked = true;
                return this;
            },
            unlock: function () {
                this.locked = false;
                var method = {
                        2: 'resolve',
                        3: 'reject'
                    }[this.state];
                if (method)
                    this[method].apply(this, this.args);
                return this;
            },
            notify: function () {
                if (this.state !== states.PENDING)
                    return this;
                var fn, i = 0;
                if (this.locked)
                    return this;
                while ((fn = this.progressCallbacks[i++]) != null) {
                    fn.apply(this, arguments);
                }
                if (this.parent)
                    this.parent.sub--;
                return this;
            },
            reject: function () {
                if (this.state !== states.PENDING)
                    return this;
                var fn, args = this.args = slice.call(arguments);
                if (this.locked)
                    return this;
                while ((fn = this.failCallbacks.shift()) != null) {
                    fn.apply(this, arguments);
                }
                this.state = states.REJECTED;
                return this;
            },
            resolve: function () {
                if (this.state !== states.PENDING)
                    return this;
                var fn, args = this.args = slice.call(arguments);
                if (this.locked)
                    return this;
                while ((fn = this.doneCallbacks.shift()) != null) {
                    fn.apply(this, arguments);
                }
                this.state = states.RESOLVED;
                return this;
            },
            done: function (callback) {
                if (callback instanceof Promise) {
                    return this.done(function () {
                        var args = slice.call(arguments);
                        callback.resolve.apply(callback, args);
                    });
                }
                if (!isFunction(callback))
                    return this;
                if (!this._match(states.RESOLVED, callback)) {
                    this.doneCallbacks.push(callback.bind(this));
                }
                return this;
            },
            fail: function (callback) {
                if (callback instanceof Promise) {
                    return this.fail(function () {
                        var args = slice.call(arguments);
                        callback.reject.apply(callback, args);
                    });
                }
                if (!isFunction(callback))
                    return this;
                if (!this._match(states.REJECTED, callback)) {
                    this.failCallbacks.push(callback.bind(this));
                }
                return this;
            },
            progress: function (callback) {
                if (!isFunction(callback))
                    return this;
                this.progressCallbacks.push(callback);
                return this;
            },
            always: function (callback) {
                if (!isFunction(callback))
                    return this;
                return this.done(callback).fail(callback);
            },
            then: function (doneCallback, failCallback, finCallback) {
                if (!doneCallback) {
                    return this;
                }
                var promise = new Promise().lock();
                this.done(this._wraper(doneCallback, promise)).fail(failCallback).always(finCallback);
                return promise;
            },
            pipe: function () {
                return this;
            },
            promise: function () {
                return this;
            },
            _wraper: function (fn, promise) {
                var self = this;
                return function () {
                    var result = fn.apply(self, arguments);
                    if (result instanceof Promise) {
                        extend(result, promise);
                        result.unlock();
                    }
                };
            },
            _match: function (state, callback) {
                if (this.state == state) {
                    callback.apply(this, this.args);
                    return true;
                }
                return false;
            }
        });
        var promise = module.exports = function () {
                return new Promise();
            };
        extend(promise, {
            when: function () {
                var promises = slice.call(arguments), whenPromise = new Promise();
                whenPromise.waiting = promises.length;
                for (var i = 0, len = promises.length; i < len; i++) {
                    (function (i) {
                        promises[i].done(function () {
                            whenPromise.args[i] = typeOf(promises[i].args[0]) == 'array' ? promises[i].args[0] : promises[i].args;
                            if (!--whenPromise.waiting) {
                                whenPromise.resolve.apply(whenPromise, whenPromise.args);
                            }
                        });
                        promises[i].fail(function () {
                            whenPromise.reject(promises[i].args);
                        });
                    }(i));
                }
                return whenPromise;
            },
            not: function (p) {
                var result = new Promise();
                p.done(result.reject.bind(result)).fail(result.resolve.bind(result));
                return result;
            },
            or: function () {
                var promises = slice.call(arguments), not = promise.not, negatedPromises = promises.map(not);
                return promise.not(promise.when.apply(this, negatedPromises));
            },
            isPromise: function (promise) {
                return promise && promise instanceof Promise;
            }
        });
    },
    'c': function (require, module, exports, global) {
        var _ = {};
        _.debug = true;
        _.pathes = [];
        _.requires = [];
        _.directives = {
            'test': {
                accept: 'valueList',
                interpret: function (ast) {
                }
            }
        };
        module.exports = _;
    },
    'd': function (require, module, exports, global) {
        var _ = require('4');
        var tree = require('8');
        var $ = module.exports = {
                '+': function (left, right) {
                    var value = left.value + right.value;
                    var unit = left.unit || right.unit;
                    if (left.type === 'DIMENSION' && right.type === 'DIMENSION') {
                        if (left.unit && right.unit && left.unit !== right.unit)
                            _.warn('unmatched unit, forced 2rd unit equal with the 1st one');
                        return {
                            type: left.type,
                            value: value,
                            unit: unit
                        };
                    } else {
                        return {
                            type: left.type,
                            value: tree.toStr(left) + tree.toStr(right)
                        };
                    }
                }.__accept([
                    'TEXT DIMENSION STRING',
                    'TEXT DIMENSION STRING'
                ]),
                '-': function (left, right) {
                    var value = left.value - right.value;
                    var unit = left.unit || right.unit;
                    if (left.unit && right.unit && left.unit !== right.unit)
                        _.warn('unmatched unit, forced 2rd unit equal with the 1st one');
                    return {
                        type: left.type,
                        value: value,
                        unit: unit
                    };
                }.__accept([
                    'DIMENSION',
                    'DIMENSION'
                ]),
                '*': function (left, right) {
                    var value = left.value * right.value;
                    var unit = left.unit || right.unit;
                    if (left.unit && right.unit && left.unit !== right.unit)
                        _.warn('unmatched unit, forced 2rd unit equal with the 1st one');
                    return {
                        type: left.type,
                        value: value,
                        unit: unit
                    };
                }.__accept([
                    'DIMENSION',
                    'DIMENSION'
                ]),
                '/': function (left, right) {
                    if (right.value === 0)
                        throw 'Divid by zero' + right.lineno;
                    var value = left.value / right.value;
                    var unit = left.unit || right.unit;
                    if (left.unit && right.unit && left.unit !== right.unit)
                        _.warn('unmatched unit, forced 2rd unit equal with the 1st one');
                    return {
                        type: left.type,
                        value: value,
                        unit: unit
                    };
                }.__accept([
                    'DIMENSION',
                    'DIMENSION'
                ]),
                '%': function (left, right) {
                    if (left.type === 'STRING') {
                        var values = right.list || [right];
                        values.forEach(function () {
                        });
                    } else {
                        if (right.value === 0)
                            throw 'Divid by zero' + right.lineno;
                        var value = left.value % right.value;
                        var unit = left.unit || right.unit;
                        if (left.unit && right.unit && left.unit !== right.unit)
                            _.warn('unmatched unit, forced 2rd unit equal with the 1st one');
                        return {
                            type: left.type,
                            value: value,
                            unit: unit
                        };
                    }
                }.__accept(['DIMENSION STRING']),
                'relation': function (left, right, op) {
                    var bool = { type: 'BOOLEAN' };
                    if (left.type !== right.type) {
                        bool.value = op === '!=';
                    } else {
                        if (left.value > right.value) {
                            bool.value = op === '>' || op === '>=' || op === '!=';
                        }
                        if (left.value < right.value) {
                            bool.value = op === '<' || op === '<=' || op === '!=';
                        }
                        if (left.value == right.value) {
                            bool.value = op === '==' || op === '>=' || op === '<=';
                        }
                    }
                    return bool;
                },
                '&&': function (left, right) {
                    if (tree.isPrimary(left)) {
                        var bool = tree.toBoolean(left);
                        if (bool === false)
                            return {
                                type: 'BOOLEAN',
                                value: false
                            };
                        if (bool === true)
                            return right;
                    }
                },
                '||': function (left, right) {
                    if (tree.isPrimary(left)) {
                        var bool = tree.toBoolean(left);
                        if (bool === true)
                            return left;
                        if (bool === false)
                            return right;
                    }
                }
            };
    },
    'e': function (require, module, exports, global) {
        var _ = require('4');
        var API = {
                set: function (name, value) {
                    options = this.options || (this.options = {});
                    options[name] = value;
                    return this;
                }.__msetter(),
                get: function (name) {
                    options = this.options || (this.options = {});
                    return options[name];
                },
                has: function (name, value) {
                    if (!value)
                        return !!this.get(name);
                    return this.get(name) === value;
                },
                del: function (name) {
                    options = this.options || (this.options = {});
                    delete options[name];
                }
            };
        exports.mixTo = function (obj) {
            obj = typeof obj == 'function' ? obj.prototype : obj;
            return _.extend(obj, API);
        };
    },
    'f': function (require, module, exports, global) {
        var Symtable = exports.SymbolTable = function () {
            };
        var Scope = exports.Scope = function (parentScope) {
                this.parentScope = parentScope;
                this.symtable = {};
                this.isStruct = false;
            };
        Scope.prototype = {
            getSpace: function () {
                return this.symtable;
            },
            resolve: function (name, first) {
                var scope = this;
                while (scope) {
                    var symbol = scope.symtable[name];
                    if (symbol)
                        return symbol;
                    else {
                        if (first)
                            return;
                        scope = scope.parentScope;
                    }
                }
            },
            define: function (name, value) {
                this.symtable[name] = value;
                return this;
            },
            getOuterScope: function () {
                return this.parentScope;
            },
            toStruct: function () {
                var scope = new Scope();
                scope.isStruct = true;
                scope.symtable = this.symtable;
                return scope;
            }
        };
    },
    'g': function (require, module, exports, global) {
        var Interpreter = require('h');
        var Hook = require('l');
        module.exports = Interpreter;
    },
    'h': function (require, module, exports, global) {
        var Walker = require('i');
        var parser = require('2');
        var tree = require('8');
        var symtab = require('f');
        var state = require('j');
        var promise = require('b');
        var path = require('6');
        var u = require('4');
        var io = require('a');
        var binop = require('d');
        var functions = require('k');
        var color = require('9');
        function Interpreter(options) {
            this.options = options;
        }
        ;
        var _ = Interpreter.prototype = new Walker();
        state.mixTo(_);
        var errors = { 'RETURN': u.uid() };
        var states = { 'DECLARATION': u.uid() };
        _.ierror = new Error();
        _.interpret = function (ast) {
            this.ast = ast;
            this.scope = new symtab.Scope();
            this.istack = [];
            this.rulesets = [];
            this.medias = [];
            this.indent = 0;
            return this.walk(ast);
        };
        _.walk_default = function (ast) {
            return ast;
        };
        _.walk_stylesheet = function (ast) {
            var plist = ast.list, item;
            ast.list = [];
            for (ast.index = 0; !!plist[ast.index]; ast.index++) {
                if (item = this.walk(plist[ast.index])) {
                    u.merge(ast.list, item);
                }
            }
            return ast;
        };
        _.walk_directive = function (ast) {
            ast.value = this.walk(ast.value);
            if (ast.block)
                ast.block = this.walk(ast.block);
            return ast;
        };
        _.walk_ruleset = function (ast) {
            this.down(ast);
            var rawSelector = this.walk(ast.selector), values = ast.values, iscope, res = [];
            this.up(ast);
            var self = this;
            rawSelector.list.forEach(function (complex) {
                self.define(complex.string, ast);
            });
            if (ast.abstract) {
                rawSelector.list = [];
            }
            if (!values)
                ast.selector = this.concatSelector(rawSelector);
            if (values) {
                for (var i = 0, len = values.length; i < len; i++) {
                    iscope = new symtab.Scope();
                    this.push(iscope);
                    this.define('$i', {
                        type: 'DIMENSION',
                        value: i
                    });
                    this.define('$item', values[i]);
                    var block = ast.block.clone();
                    var selector = new tree.SelectorList([rawSelector.list[i]]);
                    var ruleset = new tree.RuleSet(selector, block);
                    res.push(this.walk(ruleset));
                    this.pop();
                }
            } else {
                this.down(ast);
                var block = this.walk(ast.block);
                this.up(ast);
                res = block.exclude();
                ast.block = block;
                if (res.length) {
                    res.unshift(ast);
                }
            }
            return res.length ? res : ast;
        };
        _.walk_selectorlist = function (ast) {
            var list = ast.list, len = list.length, self = this, res = [];
            if (len === 1) {
                this.enter('ACCEPT_LIST');
            }
            list = this.walk(list);
            if (Array.isArray(list[0])) {
                list = list[0];
            }
            ast.list = list;
            this.leave('ACCEPT_LIST');
            return ast;
        };
        _.walk_complexselector = function (ast) {
            var ruleset = this.rulesets[this.rulesets.length - 1];
            var interpolations = ast.interpolations, i, len = interpolations.length, valuesList;
            var values = [];
            for (i = 0; i < len; i++) {
                var value = this.walk(interpolations[i]);
                if (value.type === 'valueslist') {
                    if (ruleset.values || !this.state('ACCEPT_LIST')) {
                        this.error('con"t has (or more) interpolations in ComplexSelector');
                    } else {
                        ruleset.values = value.list;
                        values.push(null);
                    }
                } else {
                    values.push(this.toStr(value));
                }
            }
            ast.string = ast.string.replace(/#\{(\d+)}/g, function (all, index) {
                var value = values[parseInt(index)];
                if (typeof value === 'string') {
                    return value;
                } else {
                    return '#{interpolation}';
                }
            });
            if (valuesList = ruleset.values) {
                var res = [], toStr = this.toStr;
                for (var j = 0, jlen = valuesList.length; j < jlen; j++) {
                    var value = valuesList[j];
                    var string = ast.string.replace(/#\{interpolation}/, function () {
                            return toStr(value);
                        });
                    res.push(new tree.ComplexSelector(string));
                }
                return res;
            }
            return ast;
        };
        _.walk_operator = function (ast) {
            var left = this.walk(ast.left);
            var right = this.walk(ast.right);
            if (tree.isRelationOp(ast.op)) {
                return binop.relation.apply(this, [
                    left,
                    right,
                    ast.op
                ]);
            } else {
                return binop[ast.op].apply(this, [
                    left,
                    right
                ]);
            }
        };
        _.walk_assign = function (ast) {
            if (ast.override || !this.resolve(ast.name)) {
                var value = this.walk(ast.value);
                this.define(ast.name, value);
            }
        };
        _.walk_var = function (ast) {
            var symbol = this.resolve(ast.value);
            if (symbol)
                return symbol;
            else
                this.error('undefined variable: ' + ast.value);
        };
        _.walk_url = function (ast) {
            var self = this, symbol;
            ast.value = ast.value.replace(/#\{(\w+)}/g, function (all, name) {
                if (symbol = this.resolve(name)) {
                    return self.toStr(symbol);
                } else {
                    throw Error('not defined String interpolation');
                }
            });
            return ast;
        };
        _.walk_text = function (ast) {
            var chs = color.maps[ast.value];
            if (chs) {
                return new color(chs);
            } else {
                return ast;
            }
        };
        _.walk_string = function (ast) {
            var self = this, symbol;
            ast.value = ast.value.replace(/#\{(\w+)}/g, function (all, name) {
                if (symbol = this.resolve(name)) {
                    return self.toStr(symbol);
                } else {
                    throw Error('not defined String interpolation');
                }
            });
            return ast;
        };
        _.walk_debug = function (ast) {
            ast.value = this.walk(ast.value);
            return ast;
        };
        _.walk_if = function (ast) {
            var test = this.walk(ast.test);
            if (tree.toBoolean(test)) {
                return this.walk(ast.block);
            } else {
                return this.walk(ast.alt);
            }
        };
        _.walk_for = function (ast) {
            var list = ast.list.list, index = ast.index, element = ast.element, block, iscope, len, iscope = new symtab.Scope(), res = [];
            for (var i = 0, len = list.length; i < len; i++) {
                this.push(iscope);
                this.define(element, list[i]);
                if (index)
                    this.define(index, {
                        type: 'DIMENSION',
                        value: i
                    });
                block = this.walk(ast.block.clone());
                this.pop(iscope);
                res.push(block);
            }
            return res;
        };
        _.walk_call = function (ast) {
            var func = this.resolve(ast.name), iscope, params, args = this.walk(ast.args);
            ;
            if (!func || func.type !== 'func') {
                if (func = functions[ast.name]) {
                    var value = tree.convert(func.apply(this, args));
                    return value;
                } else {
                    if (ast.name.charAt(0) === '$')
                        this.error('no function "' + ast.name + '" founded');
                    else
                        return ast;
                }
            }
            iscope = new symtab.Scope();
            params = func.params;
            this.push(iscope);
            for (var i = 0, len = params.length; i < len; i++) {
                var param = params[i], arg = args[i];
                if (param.rest) {
                    var restNum = len - 1 - i;
                    var slicelen = args.length - restNum;
                    if (slicelen > i) {
                        var arg = new tree.ValuesList(args.slice(i, slicelen));
                        this.define(param.name, arg);
                    }
                } else {
                    var value = args[i] || param.default;
                    if (value)
                        this.define(param.name, value);
                }
            }
            if (args.length) {
                this.define('$arguments', new tree.ValuesList(args));
                if (this.state('DECLARATION')) {
                    this.define('$_dada');
                }
            }
            try {
                var prev = this.scope;
                this.scope = func.scope;
                var block = this.walk(func.block.clone());
            } catch (err) {
                this.scope = prev;
                this.pop(iscope);
                if (err.code === errors.RETURN) {
                    var value = tree.convert(err.value);
                    if (value.type === 'func' && iscope.resolve(value.name, true)) {
                        value.scope = iscope;
                        iscope.parentScope = this.scope;
                    }
                    return value;
                } else {
                    throw err;
                }
            }
            this.scope = prev;
            this.pop(iscope);
            return block;
        };
        _.walk_return = function (ast) {
            _.ierror.code = errors.RETURN;
            _.ierror.value = this.walk(ast.value);
            throw _.ierror;
        };
        _.walk_func = function (ast) {
            ast.params = this.walk(ast.params);
            ast.scope = this.scope;
            return ast;
        };
        _.walk_param = function (ast) {
            if (ast.default) {
                ast.default = this.walk(ast.default);
            }
            return ast;
        };
        _.walk_module = function (ast) {
            var block = this.walk(ast.block);
        };
        _.walk_componentvalues = function (ast) {
            var self = this;
            var list = [], tmp;
            ast.list.forEach(function (item) {
                if (tmp = self.walk(item)) {
                    var type = self._inspect(tmp);
                    if (type === 'variable') {
                        list = list.concat(tmp.value.list);
                    } else {
                        list.push(tmp);
                    }
                } else
                    list.push(item);
            });
            ast.list = list;
            return ast;
        };
        _.walk_extend = function (ast) {
            var ruleset = this.rulesets[this.rulesets.length - 1];
            if (!ruleset)
                this.error('can"t use @extend outside ruleset');
            var selector = this.walk(ast.selector);
            var self = this;
            selector.list.forEach(function (item) {
                var extend = self.resolve(item.string);
                if (extend) {
                    extend.addRef(ruleset);
                }
            });
        };
        _.walk_import = function (ast) {
            this.walk(ast.url);
            var url = ast.url;
            if (ast.stylesheet) {
                var queryList = ast.queryList;
                var stylesheet = ast.stylesheet;
                if (queryList.length) {
                    var media = new tree.Media(queryList, stylesheet);
                    return this.walk(media);
                } else {
                    var list = this.walk(stylesheet).list;
                    return list;
                }
            } else {
                return ast;
            }
        };
        _.walk_media = function (ast) {
            ast.queryList = this.walk(ast.queryList);
            this.concatMedia(ast);
            this.down(null, ast);
            this.walk(ast.stylesheet);
            this.up(null, ast);
            var res = ast.stylesheet.exclude();
            if (res.length) {
                res.unshift(ast);
            }
            return res.length ? res : ast;
        };
        _.walk_mediaquery = function (ast) {
            ast.expressions = this.walk(ast.expressions);
            return ast;
        };
        _.walk_mediaexpression = function (ast) {
            ast.feature = this.walk(ast.feature);
            ast.value = this.walk(ast.value);
            return ast;
        };
        _.walk_block = function (ast) {
            var list = ast.list;
            var res = [], r;
            for (var i = 0, len = list.length; i < list.length; i++) {
                if (list[i] && (r = this.walk(list[i]))) {
                    u.merge(res, r);
                }
            }
            ast.list = res;
            return ast;
        };
        _.walk_declaration = function (ast) {
            this.enter('DECLARATION');
            ast.property = this.walk(ast.property);
            ast.value = this.walk(ast.value);
            this.leave('DECLARATION');
            return ast;
        };
        _.walk_compoundident = function (ast) {
            var text = '', self = this;
            this.walk(ast.list).forEach(function (item) {
                text += typeof item === 'string' ? item : self.walk(item).value;
            });
            return {
                type: 'TEXT',
                value: text
            };
        };
        _.walk_valueslist = function (ast) {
            ast.list = this.walk(ast.list);
            return ast;
        };
        _.walk_values = function (ast) {
            ast.list = this.walk(ast.list);
            return ast;
        };
        _.down = function (ruleset, media) {
            if (ruleset)
                this.rulesets.push(ruleset);
            if (media)
                this.medias.push(media);
            this.scope = new symtab.Scope(this.scope);
        };
        _.up = function (ruleset, media) {
            if (ruleset)
                this.rulesets.pop();
            if (media)
                this.medias.pop();
            this.scope = this.scope.getOuterScope();
        };
        _.concatSelector = function (selectorList) {
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
        };
        _.concatMedia = function (media) {
            var ss = this.medias;
            if (!ss.length)
                return media;
            var slist = ss[ss.length - 1].queryList, mlist = media.queryList, queryList = [];
            var s, m, slen = slist.length, mlen = mlist.length, mm, sm, nm;
            for (m = 0; m < mlen; m++) {
                mm = mlist[m];
                for (s = 0; s < slen; s++) {
                    sm = slist[s];
                    nm = new tree.MediaQuery();
                    if (sm.mediaType && mm.mediaType)
                        continue;
                    nm.mediaType = sm.mediaType || mm.mediaType;
                    nm.expressions = sm.expressions.concat(mm.expressions);
                    queryList.push(nm);
                }
            }
            media.queryList = queryList;
            return media;
        };
        _.push = function (scope) {
            this.istack.push(scope);
        };
        _.pop = function () {
            this.istack.pop();
        };
        _.peek = function () {
            var len;
            if (len = this.istack.length)
                return this.istack[len - 1];
        };
        _.define = function (id, symbol) {
            var scope;
            if (scope = this.peek()) {
                scope.define(id, symbol);
            } else {
                if (!this.scope)
                    debugger;
                this.scope.define(id, symbol);
            }
        };
        _.resolve = function (id) {
            var scope, symbol;
            if ((scope = this.peek()) && (symbol = scope.resolve(id))) {
                return symbol;
            }
            return this.scope.resolve(id);
        };
        _.expect = function (ast, type) {
            if (!(this._inspect(ast) === type)) {
                throw Error('interpreter error! expect node: "' + type + '" got: "' + this._inspect(ast) + '"');
            }
        };
        _.error = function (msg) {
            throw Error(msg);
        };
        _.toStr = function (ast) {
            switch (ast.type) {
            case 'TEXT':
            case 'BOOLEAN':
            case 'NULL':
                return ast.value;
            case 'DIMENSION':
                var value = '' + ast.value + (ast.unit ? ast.unit : '');
                return value;
            case 'STRING':
                return this.walk(ast);
            default:
                return ast.value;
            }
        };
        module.exports = Interpreter;
    },
    'i': function (require, module, exports, global) {
        var _ = require('4');
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
                    _.warn('no "' + this._inspect(node) + '" walk defined');
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
                    return this.walk_default(node);
            },
            _inspect: function (node) {
                if (!node)
                    return null;
                return node.type ? node.type.toLowerCase() : null;
            },
            error: function (e) {
                throw e;
            }
        };
        module.exports = Walker;
    },
    'j': function (require, module, exports, global) {
        function ex(o1, o2, override) {
            for (var i in o2)
                if (o1[i] == null || override) {
                    o1[i] = o2[i];
                }
        }
        ;
        var API = {
                state: function (state) {
                    var _states = this._states || (this._states = []);
                    return _states.some(function (item) {
                        return item === state;
                    });
                },
                enter: function (state) {
                    var _states = this._states || (this._states = []);
                    _states.push(state);
                },
                leave: function (state) {
                    var _states = this._states || (this._states = []);
                    if (!state || state === _states[_states.length - 1])
                        _states.pop();
                }
            };
        exports.mixTo = function (obj) {
            obj = typeof obj == 'function' ? obj.prototype : obj;
            ex(obj, API);
        };
    },
    'k': function (require, module, exports, global) {
        var tree = require('8');
        var u = require('4');
        var tk = require('3');
        var _ = module.exports = {
                rgba: function (r, g, b, a) {
                    if (r.type === 'color') {
                        return new tree.Color(r, g && g.value);
                    } else {
                        return new tree.Color([
                            r.value,
                            g.value,
                            b.value
                        ], a && a.value);
                    }
                }.__accept([
                    'DIMENSION color',
                    'DIMENSION',
                    'DIMENSION',
                    'DIMENSION'
                ]),
                rgb: function () {
                    return _.rgba.apply(this, arguments);
                },
                hsla: function (h, s, l, a) {
                    return Color.hsl([
                        h.value,
                        s.value,
                        l.value
                    ], a && a.value);
                }.__accept([
                    'DIMENSION',
                    'DIMENSION',
                    'DIMENSION',
                    'DIMENSION'
                ]),
                hsl: function () {
                    return _.hsla.apply(this.arguments);
                },
                mix: function () {
                }.__accept([
                    'color',
                    'color'
                ]),
                abs: function (d) {
                }.__accept(['DIMENSION']),
                floor: function (d) {
                }.__accept(['DIMENSION']),
                round: function (d) {
                }.__accept(['DIMENSION']),
                ceil: function (d) {
                }.__accept(['DIMENSION']),
                max: function (d1, d2) {
                }.__accept(['DIMENSION']),
                min: function (d1, d2) {
                },
                typeof: function (node) {
                    return node.type.toLowerCase();
                },
                u: function (str) {
                    return {
                        type: 'STRING',
                        value: str.value,
                        lineno: str.lineno
                    };
                }.__accept(['STRING']),
                args: function (number) {
                    var arguments = this.resolve('$arguments'), arg;
                    if (!arguments) {
                        throw Error('the args() must be called in function block');
                    }
                    if (!number || number.type !== 'DIMENSION') {
                        throw Error('invalid arguments passed to args()');
                    }
                    if (arg = arguments.list[number.value]) {
                        return arg;
                    } else {
                        return { type: 'NULL' };
                    }
                }
            };
        _['-adjust'] = function (color, prop, weight, absolute) {
            var p = prop.value, key = channelsMap[p];
            var isAbsolute = tree.toBoolean(absolute);
            if (isRGBA(p)) {
                if (!weight)
                    return color[key];
                if (p === 'a' && weight.unit === '%') {
                    weight.unit = null;
                    weight.value /= 100;
                }
                if (weight.unit)
                    this.error('rgba adjust only accpet NUMBER');
                var clone = color.clone();
                if (isAbsolute) {
                    clone[key] = weight.value;
                } else {
                    clone[key] += weight.value;
                }
                return clone;
            }
            if (isHSL(p)) {
                var hsl = color.toHSL();
                if (!weight) {
                    switch (p) {
                    case 'saturation':
                    case 'lightness':
                        return {
                            type: 'DIMENSION',
                            value: hsl[key],
                            unit: '%'
                        };
                    }
                    return hsl[key];
                }
                if (isAbsolute) {
                    hsl[key] = weight.value;
                } else {
                    hsl[key] += weight.value;
                }
                return Color.hsl(hsl, color.alpha);
            }
            this.error('invalid adjust property ' + p + ' ' + color.lineno);
        }.__accept([
            'color',
            'STRING',
            'DIMENSION'
        ]);
        var RGBA_STR = 'red green blue alpha';
        var HSL_STR = 'hue saturation lightness';
        var isRGBA = u.makePredicate(RGBA_STR);
        var isHSL = u.makePredicate(HSL_STR);
        var channelsMap = {
                'hue': 0,
                'saturation': 1,
                'lightness': 2,
                'red': 0,
                'green': 1,
                'blue': 2,
                'alpha': 'alpha'
            };
        ;
        (RGBA_STR + ' ' + HSL_STR).split(' ').forEach(function (name) {
            var text = tk.createToken('STRING', name);
            _[name.charAt(0) + '-adjust'] = _[name] = function (color, amount, absolute) {
                return _['-adjust'].call(this, color, text, amount, absolute);
            };
        });
        delete _.alpha;
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
        var fixColor = function (number) {
            return number > 255 ? 255 : number < 0 ? 0 : number;
        };
        var fixChannels = function (channels) {
            channels[0] = fixColor(channels[0]);
            channels[1] = fixColor(channels[1]);
            channels[2] = fixColor(channels[2]);
            return channels;
        };
    },
    'l': function (require, module, exports, global) {
        var Hook = require('m');
        exports.hook = function (ast, options) {
            new Hook(options).walk(ast);
            return ast;
        };
    },
    'm': function (require, module, exports, global) {
        var Walker = require('i');
        var Event = require('n');
        var hooks = require('o');
        function Hook(options) {
            options = options || {};
            this.load(options.hooks);
            this.indent = 0;
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
            this.walk(tree.list);
        };
        _.walk_ruleset = function (tree) {
            this.indent++;
            this.walk(tree.block);
            this.indent--;
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
        };
        _['walk_,'] = function (tree) {
        };
        _['walk_='] = function (tree) {
        };
        _.walk_unknown = function (tree) {
            return tree.name;
        };
        _.walk_cssfunction = function (tree) {
        };
        _.walk_uri = function (tree) {
        };
        _.walk_rgba = function (tree) {
        };
        _.walk_dimension = function (tree) {
        };
        _.walk_variable = function () {
        };
        module.exports = Hook;
    },
    'n': function (require, module, exports, global) {
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
    'o': function (require, module, exports, global) {
        module.exports = {
            prefixr: require('p'),
            csscomb: require('r')
        };
    },
    'p': function (require, module, exports, global) {
        var prefixs = require('q').prefixs;
        var _ = require('4');
        var tree = require('8');
        var isTestProperties = _.makePredicate('border-radius transition');
        module.exports = {
            'block': function (tree) {
                var list = tree.list, len = list.length;
                for (; len--;) {
                    var declaration = list[len];
                    if (isTestProperties(declaration.property)) {
                        list.splice(len, 0, declaration.clone('-webkit-' + declaration.property), declaration.clone('-moz-' + declaration.property), declaration.clone('-mz-' + declaration.property), declaration.clone('-o-' + declaration.property));
                    }
                }
            }
        };
    },
    'q': function (require, module, exports, global) {
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
    'r': function (require, module, exports, global) {
        var orders = require('q').orders;
        module.exports = {
            'block': function (tree) {
                tree.list.sort(function (d1, d2) {
                    return (orders[d1.property] || 100) - (orders[d2.property] || 100);
                });
            }
        };
    },
    's': function (require, module, exports, global) {
        var Translator = require('t');
        module.exports = Translator;
    },
    't': function (require, module, exports, global) {
        var Walker = require('i');
        var tree = require('8');
        var u = require('4');
        var options = require('e');
        var tmpl = require('7');
        function Translator(options) {
            this.options = options || {};
        }
        var _ = Translator.prototype = new Walker();
        var walk = _.walk;
        options.mixTo(_);
        var formats = {
                COMMON: 1,
                COMPRESS: 2,
                ONELINE: 3
            };
        _.translate = function (ast) {
            this.ast = ast;
            this.level = 0;
            this.indent = this.get('indent') || '\t';
            this.newline = this.get('format') > 1 ? '' : '\n';
            return this.walk_stylesheet(ast, true);
        };
        _.walk_stylesheet = function (ast, blank) {
            return this.walk_block(ast, blank);
        };
        _.walk_ruleset = function (ast) {
            if (!ast.block.list.length)
                return '';
            var slist = ast.getSelectors();
            if (!slist.length)
                return '';
            var cssTexts = [this.walk(slist).join(',')];
            cssTexts.push(this.walk(ast.block));
            return cssTexts.join('');
        };
        _.walk_selectorlist = function (ast) {
            return this.walk(ast.list).join(',' + this.newline);
        };
        _.walk_complexselector = function (ast) {
            return ast.string;
        };
        _.walk_block = function (ast, blank) {
            this.level++;
            var indent = this.indents();
            var res = [];
            if (!blank)
                res.push('{');
            var list = ast.list;
            for (var i = 0, len = list.length; i < len; i++) {
                var item = this.walk(list[i]);
                if (item) {
                    if (list[i].type !== 'declaration' && this.has('format', 3)) {
                        item += '\n';
                    }
                    res.push(item);
                }
            }
            var str = res.join(this.newline + indent);
            this.level--;
            if (!blank) {
                str += this.newline + this.indents() + '}';
            }
            return str;
        };
        _.walk_valueslist = function (ast) {
            var text = this.walk(ast.list).join(',');
            return text;
        };
        _.walk_values = function (ast) {
            var text = this.walk(ast.list).join(' ');
            text = text.replace(/ \/ /g, '/');
            return text;
        };
        _.walk_import = function (ast) {
            var outport = [
                    '@import ',
                    this.walk_url(ast.url)
                ];
            if (ast.queryList && ast.queryList.length) {
                outport.push(this.walk(ast.queryList).join(','));
            }
            return outport.join(' ') + ';';
        };
        _.walk_debug = function (ast) {
            console.log('!debug: ' + this.walk(ast.value));
        };
        _.walk_media = function (ast) {
            var str = '@media ';
            str += this.walk(ast.queryList).join(',');
            str += this.walk_stylesheet(ast.stylesheet);
            return str;
        };
        _.walk_mediaquery = function (ast) {
            var outport = this.walk(ast.expressions);
            if (ast.mediaType)
                outport.unshift(ast.mediaType);
            return outport.join(' and ');
        };
        _.walk_mediaexpression = function (ast) {
            var str = '';
            str += this.walk(ast.feature);
            if (ast.value)
                str += ': ' + this.walk(ast.value);
            return '(' + str + ')';
        };
        var declaration_t = tmpl('{{property}}');
        _.walk_declaration = function (ast) {
            var text = this.walk(ast.property);
            var value = this.walk(ast.value);
            return text + ': ' + value + ';';
        };
        _.walk_string = function (ast) {
            return '"' + ast.value + '"';
        };
        _['walk_='] = function (ast) {
            return '=';
        };
        _['walk_/'] = function (ast) {
            return '/';
        };
        _.walk_unknown = function (ast) {
            return ast.name;
        };
        _.walk_url = function (ast) {
            return 'url("' + ast.value + '")';
        };
        _.walk_color = function (ast) {
            return ast.toCSS();
        };
        _.walk_directive = function (ast) {
            var str = '@' + ast.name + ' ';
            if (ast.value) {
                str += this.walk(ast.value);
            }
            if (ast.block) {
                str += this.walk(ast.block);
            }
            return str;
        };
        _.walk_call = function (ast) {
            return ast.name + '(' + this.walk(ast.args).join(',') + ')';
        };
        _.walk_default = function (ast) {
            if (!ast)
                return '';
            var str = tree.toStr(ast);
            if (typeof str !== 'string') {
                return '';
            }
            return str;
        };
        _.indents = function () {
            if (this.get('format') > 1) {
                return '';
            } else {
                return Array(this.level).join(this.indent);
            }
        };
        module.exports = Translator;
    }
}));
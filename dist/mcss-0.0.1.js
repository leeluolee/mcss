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
        function getLinks() {
        }
    },
    '1': function (require, module, exports, global) {
        var Parser = require('2');
        var Interpreter = require('i');
        var Translator = require('u');
        var tk = require('3');
        var promise = require('d');
        var _ = require('4');
        var io = require('h');
        var options = require('e');
        var state = require('g');
        var error = require('a');
        function Mcss(options) {
            this.options = _.extend(options, {
                imports: {},
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
            var options = this.options;
            var parser = new Parser(this.options);
            var fp, pr = promise();
            if (text === undefined) {
                if (this.get('filename')) {
                    fp = io.parse(this.options.filename, this.options);
                } else {
                    throw Error('text or filename is required');
                }
            } else {
                fp = parser.parse(text);
            }
            fp.always(pr);
            return pr;
        };
        m.interpret = function (text) {
            var options = this.options;
            var interpreter = new Interpreter(options);
            var pr = promise();
            this.parse(text).done(function (ast) {
                try {
                    ast = interpreter.interpret(ast);
                    pr.resolve(ast);
                } catch (e) {
                    pr.reject(e);
                }
            }).fail(pr);
            return pr;
        };
        m.translate = function (text) {
            var options = this.options;
            var translator = new Translator(options);
            var interpreter = new Interpreter(options);
            var pr = promise();
            this.parse(text).done(function (ast) {
                try {
                    ast = interpreter.interpret(ast);
                    pr.resolve(translator.translate(ast));
                } catch (e) {
                    pr.reject(e);
                }
            }).fail(pr);
            return pr;
        };
        var mcss = module.exports = function (options) {
                return new Mcss(options || {});
            };
        mcss.Parser = Parser;
        mcss.Interpreter = Interpreter;
        mcss.Translator = Translator;
        mcss.Tokenizer = tk.Tokenizer;
        mcss.io = io;
        mcss.promise = promise;
        mcss._ = _;
        mcss.state = state;
        mcss.error = error;
    },
    '2': function (require, module, exports, global) {
        module.exports = Parser;
        var tk = require('3');
        var tree = require('8');
        var _ = require('4');
        var binop = require('c');
        var promise = require('d');
        var options = require('e');
        var path = require('6');
        var fs = null;
        var symtab = require('f');
        var state = require('g');
        var error = require('a');
        var io = require('h');
        var perror = new Error();
        var slice = [].slice;
        var errors = {
                INTERPOLATE_FAIL: 1,
                DECLARION_FAIL: 2,
                FILE_NOT_FOUND: 3
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
        Parser.prototype = {
            parse: function (tks) {
                var p = new promise();
                if (typeof tks === 'string') {
                    var filename = this.get('filename');
                    if (filename && !this.get('imports')[filename]) {
                        this.get('imports')[filename] = tks;
                    }
                    tks = tk.tokenize(tks);
                }
                this.lookahead = tks;
                this.p = 0;
                this.length = this.lookahead.length;
                this._states = {};
                this._requires = [];
                this.scope = this.options.scope || new symtab.Scope();
                this.marked = null;
                this.promises = [];
                try {
                    var ast = this.stylesheet();
                } catch (e) {
                    return p.reject(e);
                }
                var self = this;
                if (this.promises.length) {
                    promise.when.apply(this, this.promises).done(function () {
                        return p.resolve(ast);
                    }).fail(function (err1) {
                        p.reject(err1);
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
                    this.error('expect:"' + tokenType + '" -> got: "' + ll.type + '"', ll.lineno);
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
            error: function (msg, ll) {
                if (typeof msg === 'number') {
                    perror.code = msg;
                    throw perror;
                }
                var lineno = ll.lineno || ll;
                throw new error.SyntaxError(msg, lineno, this.options);
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
                var ll = this.ll(), la = ll.type, node = false;
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
                        this.error('UNEXPECT token after VARIABLE', this.ll(2));
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
                this.error('INVALID statementstart', ll);
            },
            atrule: function () {
                var lv = this.ll().value.toLowerCase();
                if (typeof this[lv] === 'function') {
                    return this[lv]();
                }
                return this.directive();
            },
            directive: function () {
                var ll = this.ll();
                var name = ll.value.toLowerCase();
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
                    this.error('invalid customer directive define', ll);
                }
            },
            param: function () {
                var ll = this.ll(), name = ll.value, dft, rest = false;
                this.match('VAR');
                if (this.eat('...')) {
                    rest = true;
                }
                if (this.eat('=')) {
                    if (rest)
                        this.error('rest type param can"t have default params', ll);
                    dft = this.values();
                }
                return new tree.Param(name, dft, rest);
            },
            extend: function () {
                var ll = this.match('AT_KEYWORD');
                this.match('WS');
                var node = new tree.Extend(this.selectorList());
                node.lineno = ll.lineno;
                this.match(';');
                return node;
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
                    this.error('expect URL or STRING' + ' got ' + ll.type, ll.linno);
                }
                this.eat('WS');
                if (!this.eat(';')) {
                    queryList = this.media_query_list();
                    this.match(';');
                }
                var node = new tree.Import(url, queryList), extname = path.extname(url.value), filename, stat, p;
                if (extname !== '.css') {
                    p = this._import(url, node);
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
                        var p = this._import(url, node);
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
                    this.error('for statement need "of" but got:' + of.value, of.lineno);
                }
                this.match('TEXT');
                list = this.valuesList();
                if (list.list.length <= 1) {
                    this.error('@for statement need at least one element in list', of.lineno);
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
                node.lineno = node.list[0].lineno;
                return node;
            },
            complexSelector: function () {
                var node = new tree.ComplexSelector();
                var selectorString = '';
                var i = 0, ll, interpolation, start;
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
                node.lineno = ll.lineno;
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
                var ll = this.ll(), name = ll.value, value, op, block, params = [], rest = 0;
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
                                this.error('can"t have more than 2 rest param', ll.lineno);
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
                        left = binop.relation.call(this, left, right, la);
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
                        left = binop[la].call(this, left, right);
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
                        left = binop[la].call(this, left, right);
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
                var node = new tree.Call(name, args);
                node.lineno = ll.lineno;
                return node;
            },
            transparentCall: function () {
                var ll = this.ll();
                var name = ll.value;
                this.match('VAR');
                this.match(':');
                var args = this.valuesList().list;
                var node = new tree.Call(name, args);
                this.match(';');
                node.lineno = ll.lineno;
                return node;
            },
            _lookahead: function () {
                return this.lookahead.map(function (item) {
                    return item.type;
                }).join(',');
            },
            _import: function (url, node) {
                var pathes = this.get('pathes'), extname = path.extname(url.value);
                if (!path.isFake && pathes.length && isProbablyModulePath(url.value)) {
                    var inModule = pathes.some(function (item) {
                            filename = path.join(item, url.value);
                            try {
                                stat = fs.statSync(filename);
                                if (stat.isFile())
                                    return true;
                            } catch (e) {
                            }
                        });
                }
                if (!inModule) {
                    if (/^\/|:\//.test(url.value)) {
                        var filename = url.value;
                    } else {
                        var base = path.dirname(this.options.filename);
                        var filename = path.join(base, url.value);
                    }
                }
                filename += extname ? '' : '.mcss';
                var options = _.extend({ filename: filename }, this.options);
                var _requires = this.get('_requires');
                if (_requires && ~_requires.indexOf(filename)) {
                    this.error('it is seems file:"' + filename + '" and file: "' + this.get('filename') + '" has Circular dependencies', url.lineno);
                }
                options._requires = _requires ? _.slice(_requires).push(this.get('filename')) : [this.get('filename')];
                var pr = promise();
                var imports = this.get('imports'), text = imports[filename];
                if (typeof text === 'string') {
                    new Parser(options).parse(text).always(pr);
                } else {
                    io.get(filename).done(function (text) {
                        imports[filename] = text;
                        new Parser(options).parse(text).always(pr).fail(pr);
                    }).fail(function () {
                        var error = new error.SyntaxError(err1.filename + ' FILE NOT FOUND', url.lineno, this.options);
                        pr.reject(error);
                    });
                }
                return pr.done(function (ast) {
                    if (ast) {
                        node.stylesheet = ast.abstract();
                    }
                    node.filename = filename;
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
        var error = require('a');
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
                    this.error('Unexpect token');
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
            error: function (message, line) {
                line = line || this.line;
                throw new error.SyntaxError(message, line);
            }
        };
    },
    '4': function (require, module, exports, global) {
        var _ = {};
        var slice = [].slice;
        var fs = null;
        var mkdirp = require('5');
        var path = require('6');
        var tpl = require('7');
        var acceptError = tpl('the {i} argument passed to this function only accept {accept}, but got "{type}"');
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
        function tpl(template) {
            var i = 0;
            function get(p) {
                return p == '.' ? '' : '.' + p;
            }
            function replace(str) {
                var codes = [], pre = str;
                while (str = str.replace(/^\{\s*([\.-\w]*?)\s*}|\{#([\.-\w]*?)}([\s\S]*?)\{\/\2}|([^{]*)/, function (all, tagname, blockname, blockcontent, raw) {
                        if (raw)
                            codes.push([
                                's+="',
                                raw,
                                '";'
                            ].join(''));
                        else if (tagname)
                            codes.push([
                                's+=vars',
                                get(tagname),
                                '||"";'
                            ].join(''));
                        else if (blockname) {
                            var k = ++i;
                            codes.push([
                                'var o',
                                k,
                                '=vars',
                                get(blockname),
                                ';',
                                'o',
                                k,
                                ' = o',
                                k,
                                ' instanceof Array? o',
                                k,
                                ':[o',
                                k,
                                ']',
                                ';for(var i',
                                k,
                                '=0;i',
                                k,
                                '<o',
                                k,
                                '.length;i',
                                k,
                                '++)',
                                '{var tmp',
                                k,
                                '=vars; vars=o',
                                k,
                                '[i',
                                k,
                                ']; ',
                                replace(blockcontent),
                                'vars=tmp',
                                k,
                                '}'
                            ].join(''));
                        }
                        return '';
                    })) {
                    if (str === pre)
                        throw 'unexpect at \n' + str;
                    pre = str;
                }
                return codes.join('');
            }
            return new Function('vars', [
                'var s = "";',
                replace(template.replace(/\n/g, '\\n').replace(/"/g, '\\"')),
                'return s;'
            ].join(''));
        }
        ;
        module.exports = tpl;
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
        exports.null = function (lineno) {
            return {
                type: 'NULL',
                lineno: lineno
            };
        };
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
                            value: node.value,
                            lineno: node.lineno
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
        var tpl = require('7');
        var color = require('b');
        function McssError(message, line, options) {
            this.message = message;
            this.line = line;
            this.filename = options.filename;
            this.source = options.imports[options.filename];
        }
        McssError.prototype.__proto__ = Error.prototype;
        McssError.prototype.name = 'McssError';
        function SyntaxError(message, line, options) {
            this.message = message;
            this.line = line;
            this.filename = options.filename;
            this.source = options.imports[options.filename];
        }
        SyntaxError.prototype.__proto__ = Error.prototype;
        SyntaxError.prototype.name = 'SyntaxError';
        exports.McssError = McssError;
        exports.SyntaxError = SyntaxError;
        exports.isMcssError = function (error) {
            return error.filename && error.source;
        };
        exports.tpls = {
            'unexcept': tpl('expcept {expcept} but got {type}'),
            'syntaxerror': tpl('expcept {expcept} but got {type}'),
            'tperror': tpl('expcept {expcept} but got {type}'),
            'outportError': tpl([
                '{message}\n',
                'at {filename} ({line}: {column})',
                '{#lines}',
                '{mark}|{index} {line}',
                '{/lines}'
            ].join(''))
        };
        exports.format = function (error) {
            if (!exports.isMcssError(error)) {
                throw error;
            }
            var source = error.source, lines = source.split(/\r\n|[\r\f\n]/), pos = error.pos, message = error.message, line = error.line || 1, start = Math.max(1, line - 5);
            end = Math.min(lines.length, line + 4), res = [
                color(error.name + ' : ' + message, 'red', null, 'bold'),
                [
                    '\tat ',
                    error.filename,
                    ' :',
                    line
                ].join('')
            ];
            for (var i = start; i <= end; i++) {
                var cur = lines[i - 1], info;
                if (i === line) {
                    info = color('>>', 'red', null, 'bold') + color(getLineNum(i) + '| ' + cur, 'white', 'red');
                } else {
                    info = '  ' + getLineNum(i) + '| ' + cur;
                }
                res.push(info);
            }
            return res.join('\n');
        };
        function getLineNum(line) {
            return ('           ' + line).slice(-5) + '.';
        }
        var newline = /^[\n\f\r]/;
        function getLoc(pos, input) {
            var n = pos, column = -1, line;
            for (; n--;) {
                if (newline.test(input.charAt(n)) && n >= 0)
                    break;
                column++;
            }
            line = (input.slice(0, pos).match(/\r\n|[\r\f\n]/g) || '').length;
            return {
                line: line,
                column: column
            };
        }
    },
    'b': function (require, module, exports, global) {
        var colorToAnsi, colorify;
        colorToAnsi = {
            style: {
                normal: 0,
                bold: 1,
                underline: 4,
                blink: 5,
                strike: 9
            },
            fore: {
                black: 30,
                red: 31,
                green: 32,
                yellow: 33,
                blue: 34,
                magenta: 35,
                cyan: 36,
                white: 37,
                brightBlack: 90,
                brightRed: 91,
                brightGreen: 92,
                brightYellow: 99,
                brightBlue: 94,
                brightMagenta: 95,
                brightCyan: 96,
                brightWhite: 97
            },
            back: {
                black: 40,
                red: 41,
                green: 42,
                yellow: 43,
                blue: 44,
                magenta: 45,
                cyan: 46,
                white: 47,
                brightBlack: 100,
                brightRed: 101,
                brightGreen: 102,
                brightYellow: 103,
                brightBlue: 104,
                brightMagenta: 105,
                brightCyan: 106,
                brightWhite: 107
            }
        };
        module.exports = colorify = function (text, fore, back, style) {
            var attrCode, backCode, foreCode, octpfx, reset, result, suffix, _ref;
            if (style == null) {
                style = 'normal';
            }
            if (typeof fore !== 'string') {
                _ref = fore, fore = _ref.fore, back = _ref.back, style = _ref.style;
            }
            result = [];
            if (foreCode = colorToAnsi.fore[fore] || parseInt(fore)) {
                result.push(foreCode);
            }
            if (backCode = colorToAnsi.back[back] || parseInt(back)) {
                result.push(backCode);
            }
            if (attrCode = colorToAnsi.style[style] || parseInt(style)) {
                result.push(attrCode);
            }
            suffix = result.join(';');
            octpfx = '\x1b';
            reset = '' + octpfx + '[0m';
            return '' + octpfx + '[' + suffix + 'm' + text + reset;
        };
    },
    'c': function (require, module, exports, global) {
        var _ = require('4');
        var tree = require('8');
        var formats = {
                'd': function (value) {
                    return parseInt(value.value, 10).toString(10);
                },
                'f': function (value) {
                    return parseFloat(value.value, 10).toString(10);
                },
                'x': function (value) {
                    return parseInt(value.value, 10).toString(16);
                },
                'X': function (value) {
                    return parseInt(value.value, 10).toString(16).toUpperCase();
                },
                's': function (value) {
                    return tree.toStr(value);
                }
            };
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
                        var values = right.list || [right], index = 0;
                        left.value = left.value.replace(/\%(x|f|s|d|X)/g, function (all, format) {
                            var replace = values[index];
                            if (!replace)
                                return tree.null();
                            return formats[format](replace);
                            index++;
                        });
                        debugger;
                        return left;
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
    'd': function (require, module, exports, global) {
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
                if (!callback)
                    return this;
                return this.done(callback).fail(callback);
            },
            then: function (doneCallback, failCallback) {
                if (!doneCallback) {
                    return this;
                }
                var promise = new Promise().lock();
                this.done(this._wraper(doneCallback, promise)).fail(promise);
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
                        extend(promise, result);
                        promise.unlock();
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
                            whenPromise.reject.apply(whenPromise, promises[i].args);
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
                },
                add: function (name, item) {
                    options = this.options || (this.options = {});
                    if (!options[name])
                        options[name] = [];
                    var container = options[name];
                    if (container instanceof Array) {
                        container.push(item);
                    }
                    return this;
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
    'h': function (require, module, exports, global) {
        var fs = null;
        var path = null;
        var promise = require('d');
        var state = require('g');
        var Parser = require('2');
        exports.get = function (path, sync) {
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
                new Parser(options).parse(text).always(p);
            }).fail(p);
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
    'i': function (require, module, exports, global) {
        var Interpreter = require('j');
        var Hook = require('n');
        module.exports = Interpreter;
    },
    'j': function (require, module, exports, global) {
        var Walker = require('k');
        var parser = require('2');
        var tree = require('8');
        var symtab = require('f');
        var state = require('l');
        var promise = require('d');
        var path = require('6');
        var u = require('4');
        var io = require('h');
        var options = require('e');
        var binop = require('c');
        var functions = require('m');
        var color = require('9');
        var error = require('a');
        function Interpreter(options) {
            this.options = options;
        }
        ;
        var _ = Interpreter.prototype = new Walker();
        state.mixTo(_);
        options.mixTo(_);
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
            ast.lineno = rawSelector.lineno;
            ast.filename = this.get('filename');
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
                        this.error('con"t has more than 2 interpolations in ComplexSelector', ast);
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
                this.error('Undefined variable: ' + ast.value, ast);
        };
        _.walk_url = function (ast) {
            var self = this, symbol;
            ast.value = ast.value.replace(/#\{(\w+)}/g, function (all, name) {
                if (symbol = this.resolve(name)) {
                    return tree.toStr(symbol);
                } else {
                    this.error('Undefined ' + name + ' in interpolation', ast);
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
                    return tree.toStr(symbol);
                } else {
                    self.error('not defined String interpolation', ast);
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
                        this.error('undefined function: ' + ast.name, ast);
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
        _.walk_extend = function (ast) {
            var ruleset = this.rulesets[this.rulesets.length - 1];
            if (!ruleset)
                this.error('can not use @extend outside ruleset', ast);
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
                    var pre = this.get('filename');
                    this.set('filename', ast.filename);
                    var list = this.walk(stylesheet).list;
                    list.forEach(function () {
                    });
                    this.set('filename', pre);
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
                this.error('interpreter error! expect node: "' + type + '" got: "' + ast.type + '"', ast);
            }
        };
        _.error = function (msg, ll) {
            var lineno = ll.lineno || ll;
            throw new error.McssError(msg, lineno, this.options);
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
    'k': function (require, module, exports, global) {
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
    'l': function (require, module, exports, global) {
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
    'm': function (require, module, exports, global) {
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
    'n': function (require, module, exports, global) {
        var Hook = require('o');
        exports.hook = function (ast, options) {
            new Hook(options).walk(ast);
            return ast;
        };
    },
    'o': function (require, module, exports, global) {
        var Walker = require('k');
        var Event = require('p');
        var hooks = require('q');
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
    'p': function (require, module, exports, global) {
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
    'q': function (require, module, exports, global) {
        module.exports = {
            prefixr: require('r'),
            csscomb: require('t')
        };
    },
    'r': function (require, module, exports, global) {
        var prefixs = require('s').prefixs;
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
    's': function (require, module, exports, global) {
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
    't': function (require, module, exports, global) {
        var orders = require('s').orders;
        module.exports = {
            'block': function (tree) {
                tree.list.sort(function (d1, d2) {
                    return (orders[d1.property] || 100) - (orders[d2.property] || 100);
                });
            }
        };
    },
    'u': function (require, module, exports, global) {
        var Translator = require('v');
        module.exports = Translator;
    },
    'v': function (require, module, exports, global) {
        var Walker = require('k');
        var tree = require('8');
        var u = require('4');
        var options = require('e');
        var path = null;
        var buffer = require('w');
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
            this.buffer = buffer(this.options);
            this.level = 0;
            this.indent = this.get('indent') || '\t';
            this.newline = this.get('format') > 1 ? '' : '\n';
            this.walk_stylesheet(ast, true);
            var text = this.buffer.toString();
            if (path && this.options.sourceMap && this.options.dest) {
                var base64 = new Buffer(this.buffer.getMap()).toString('base64');
                text += '/*@ sourceMappingURL= ' + path.basename(this.get('dest'), '.css') + '.css.map */';
                u.writeFile(this.get('dest') + '.map', this.buffer.getMap(), function (err) {
                    if (err)
                        console.error('sourcemap wirte fail');
                });
            }
            return text;
        };
        _.walk_stylesheet = function (ast, blank) {
            this.walk_block(ast, blank);
        };
        _.walk_ruleset = function (ast) {
            var buffer = this.buffer;
            if (!ast.block.list.length)
                return false;
            var slist = ast.getSelectors();
            if (!slist.length)
                return false;
            buffer.addMap({
                line: ast.lineno - 1,
                source: ast.filename
            });
            buffer.add(this.walk(slist).join(','));
            this.walk(ast.block);
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
            var buffer = this.buffer;
            var res = [];
            if (!blank)
                buffer.add('{');
            var list = ast.list;
            for (var i = 0, len = list.length; i < len; i++) {
                buffer.add(this.newline + indent);
                var item = this.walk(list[i]);
                if (item !== false) {
                    if (list[i].type !== 'declaration' && this.has('format', 3)) {
                        buffer.add('\n');
                    }
                }
            }
            this.level--;
            if (!blank) {
                buffer.add(this.newline + this.indents() + '}');
            }
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
            this.buffer.add(outport.join(' ') + ';');
        };
        _.walk_debug = function (ast) {
            console.log('!debug: ' + this.walk(ast.value));
            return false;
        };
        _.walk_media = function (ast) {
            var str = '@media ';
            str += this.walk(ast.queryList).join(',');
            this.buffer.add(str);
            this.walk_stylesheet(ast.stylesheet);
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
        _.walk_declaration = function (ast) {
            var text = this.walk(ast.property);
            var value = this.walk(ast.value);
            this.buffer.add(text + ':' + value + ';');
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
            } else {
                str += ';';
            }
            this.buffer.add(str);
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
        _._getSassDebugInfo = function () {
            return '@media -sass-debug-info';
        };
        module.exports = Translator;
    },
    'w': function (require, module, exports, global) {
        var sourceMap = require('x');
        var path = null;
        module.exports = function (options) {
            var options = options || {};
            var buffers = [];
            var mapper = {};
            var generator = path && options.sourceMap ? new sourceMap.SourceMapGenerator({ file: path.basename(options.dest) }) : null;
            var lines = 1;
            var column = 1;
            var outport = '';
            return {
                add: function (content) {
                    if (options.sourceMap) {
                        var newline = (content.match(/\n/g) || '').length;
                        lines += newline;
                        var clen = content.length;
                        if (newline) {
                            column = clen - content.lastIndexOf('\n') - 1;
                        } else {
                            column += clen;
                        }
                    }
                    outport += content;
                },
                addMap: function (map) {
                    if (options.sourceMap) {
                        generator.addMapping({
                            generated: {
                                column: column,
                                line: lines
                            },
                            source: path.relative(path.dirname(options.dest), map.source),
                            original: {
                                column: 1,
                                line: map.line
                            }
                        });
                    }
                },
                toString: function () {
                    return outport;
                },
                getMap: function () {
                    if (!generator)
                        return null;
                    return generator.toString();
                }
            };
        };
    },
    'x': function (require, module, exports, global) {
        exports.SourceMapGenerator = require('y').SourceMapGenerator;
        exports.SourceMapConsumer = require('14').SourceMapConsumer;
        exports.SourceNode = require('16').SourceNode;
    },
    'y': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            var base64VLQ = require('10');
            var util = require('12');
            var ArraySet = require('13').ArraySet;
            function SourceMapGenerator(aArgs) {
                this._file = util.getArg(aArgs, 'file');
                this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
                this._sources = new ArraySet();
                this._names = new ArraySet();
                this._mappings = [];
                this._sourcesContents = null;
            }
            SourceMapGenerator.prototype._version = 3;
            SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
                var sourceRoot = aSourceMapConsumer.sourceRoot;
                var generator = new SourceMapGenerator({
                        file: aSourceMapConsumer.file,
                        sourceRoot: sourceRoot
                    });
                aSourceMapConsumer.eachMapping(function (mapping) {
                    var newMapping = {
                            generated: {
                                line: mapping.generatedLine,
                                column: mapping.generatedColumn
                            }
                        };
                    if (mapping.source) {
                        newMapping.source = mapping.source;
                        if (sourceRoot) {
                            newMapping.source = util.relative(sourceRoot, newMapping.source);
                        }
                        newMapping.original = {
                            line: mapping.originalLine,
                            column: mapping.originalColumn
                        };
                        if (mapping.name) {
                            newMapping.name = mapping.name;
                        }
                    }
                    generator.addMapping(newMapping);
                });
                aSourceMapConsumer.sources.forEach(function (sourceFile) {
                    var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                    if (content) {
                        generator.setSourceContent(sourceFile, content);
                    }
                });
                return generator;
            };
            SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
                var generated = util.getArg(aArgs, 'generated');
                var original = util.getArg(aArgs, 'original', null);
                var source = util.getArg(aArgs, 'source', null);
                var name = util.getArg(aArgs, 'name', null);
                this._validateMapping(generated, original, source, name);
                if (source && !this._sources.has(source)) {
                    this._sources.add(source);
                }
                if (name && !this._names.has(name)) {
                    this._names.add(name);
                }
                this._mappings.push({
                    generated: generated,
                    original: original,
                    source: source,
                    name: name
                });
            };
            SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
                var source = aSourceFile;
                if (this._sourceRoot) {
                    source = util.relative(this._sourceRoot, source);
                }
                if (aSourceContent !== null) {
                    if (!this._sourcesContents) {
                        this._sourcesContents = {};
                    }
                    this._sourcesContents[util.toSetString(source)] = aSourceContent;
                } else {
                    delete this._sourcesContents[util.toSetString(source)];
                    if (Object.keys(this._sourcesContents).length === 0) {
                        this._sourcesContents = null;
                    }
                }
            };
            SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile) {
                if (!aSourceFile) {
                    aSourceFile = aSourceMapConsumer.file;
                }
                var sourceRoot = this._sourceRoot;
                if (sourceRoot) {
                    aSourceFile = util.relative(sourceRoot, aSourceFile);
                }
                var newSources = new ArraySet();
                var newNames = new ArraySet();
                this._mappings.forEach(function (mapping) {
                    if (mapping.source === aSourceFile && mapping.original) {
                        var original = aSourceMapConsumer.originalPositionFor({
                                line: mapping.original.line,
                                column: mapping.original.column
                            });
                        if (original.source !== null) {
                            if (sourceRoot) {
                                mapping.source = util.relative(sourceRoot, original.source);
                            } else {
                                mapping.source = original.source;
                            }
                            mapping.original.line = original.line;
                            mapping.original.column = original.column;
                            if (original.name !== null && mapping.name !== null) {
                                mapping.name = original.name;
                            }
                        }
                    }
                    var source = mapping.source;
                    if (source && !newSources.has(source)) {
                        newSources.add(source);
                    }
                    var name = mapping.name;
                    if (name && !newNames.has(name)) {
                        newNames.add(name);
                    }
                }, this);
                this._sources = newSources;
                this._names = newNames;
                aSourceMapConsumer.sources.forEach(function (sourceFile) {
                    var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                    if (content) {
                        if (sourceRoot) {
                            sourceFile = util.relative(sourceRoot, sourceFile);
                        }
                        this.setSourceContent(sourceFile, content);
                    }
                }, this);
            };
            SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
                if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
                    return;
                } else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aOriginal && 'line' in aOriginal && 'column' in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
                    return;
                } else {
                    throw new Error('Invalid mapping.');
                }
            };
            function cmpLocation(loc1, loc2) {
                var cmp = (loc1 && loc1.line) - (loc2 && loc2.line);
                return cmp ? cmp : (loc1 && loc1.column) - (loc2 && loc2.column);
            }
            function strcmp(str1, str2) {
                str1 = str1 || '';
                str2 = str2 || '';
                return (str1 > str2) - (str1 < str2);
            }
            function cmpMapping(mappingA, mappingB) {
                return cmpLocation(mappingA.generated, mappingB.generated) || cmpLocation(mappingA.original, mappingB.original) || strcmp(mappingA.source, mappingB.source) || strcmp(mappingA.name, mappingB.name);
            }
            SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
                var previousGeneratedColumn = 0;
                var previousGeneratedLine = 1;
                var previousOriginalColumn = 0;
                var previousOriginalLine = 0;
                var previousName = 0;
                var previousSource = 0;
                var result = '';
                var mapping;
                this._mappings.sort(cmpMapping);
                for (var i = 0, len = this._mappings.length; i < len; i++) {
                    mapping = this._mappings[i];
                    if (mapping.generated.line !== previousGeneratedLine) {
                        previousGeneratedColumn = 0;
                        while (mapping.generated.line !== previousGeneratedLine) {
                            result += ';';
                            previousGeneratedLine++;
                        }
                    } else {
                        if (i > 0) {
                            if (!cmpMapping(mapping, this._mappings[i - 1])) {
                                continue;
                            }
                            result += ',';
                        }
                    }
                    result += base64VLQ.encode(mapping.generated.column - previousGeneratedColumn);
                    previousGeneratedColumn = mapping.generated.column;
                    if (mapping.source && mapping.original) {
                        result += base64VLQ.encode(this._sources.indexOf(mapping.source) - previousSource);
                        previousSource = this._sources.indexOf(mapping.source);
                        result += base64VLQ.encode(mapping.original.line - 1 - previousOriginalLine);
                        previousOriginalLine = mapping.original.line - 1;
                        result += base64VLQ.encode(mapping.original.column - previousOriginalColumn);
                        previousOriginalColumn = mapping.original.column;
                        if (mapping.name) {
                            result += base64VLQ.encode(this._names.indexOf(mapping.name) - previousName);
                            previousName = this._names.indexOf(mapping.name);
                        }
                    }
                }
                return result;
            };
            SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
                var map = {
                        version: this._version,
                        file: this._file,
                        sources: this._sources.toArray(),
                        names: this._names.toArray(),
                        mappings: this._serializeMappings()
                    };
                if (this._sourceRoot) {
                    map.sourceRoot = this._sourceRoot;
                }
                if (this._sourcesContents) {
                    map.sourcesContent = map.sources.map(function (source) {
                        if (map.sourceRoot) {
                            source = util.relative(map.sourceRoot, source);
                        }
                        return Object.prototype.hasOwnProperty.call(this._sourcesContents, util.toSetString(source)) ? this._sourcesContents[util.toSetString(source)] : null;
                    }, this);
                }
                return map;
            };
            SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
                return JSON.stringify(this);
            };
            exports.SourceMapGenerator = SourceMapGenerator;
        });
    },
    'z': function (require, module, exports, global) {
        'use strict';
        var path = null;
        function amdefine(module, require) {
            var defineCache = {}, loaderCache = {}, alreadyCalled = false, makeRequire, stringRequire;
            function trimDots(ary) {
                var i, part;
                for (i = 0; ary[i]; i += 1) {
                    part = ary[i];
                    if (part === '.') {
                        ary.splice(i, 1);
                        i -= 1;
                    } else if (part === '..') {
                        if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                            break;
                        } else if (i > 0) {
                            ary.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
            }
            function normalize(name, baseName) {
                var baseParts;
                if (name && name.charAt(0) === '.') {
                    if (baseName) {
                        baseParts = baseName.split('/');
                        baseParts = baseParts.slice(0, baseParts.length - 1);
                        baseParts = baseParts.concat(name.split('/'));
                        trimDots(baseParts);
                        name = baseParts.join('/');
                    }
                }
                return name;
            }
            function makeNormalize(relName) {
                return function (name) {
                    return normalize(name, relName);
                };
            }
            function makeLoad(id) {
                function load(value) {
                    loaderCache[id] = value;
                }
                load.fromText = function (id, text) {
                    throw new Error('amdefine does not implement load.fromText');
                };
                return load;
            }
            makeRequire = function (systemRequire, exports, module, relId) {
                function amdRequire(deps, callback) {
                    if (typeof deps === 'string') {
                        return stringRequire(systemRequire, exports, module, deps, relId);
                    } else {
                        deps = deps.map(function (depName) {
                            return stringRequire(systemRequire, exports, module, depName, relId);
                        });
                        process.nextTick(function () {
                            callback.apply(null, deps);
                        });
                    }
                }
                amdRequire.toUrl = function (filePath) {
                    if (filePath.indexOf('.') === 0) {
                        return normalize(filePath, path.dirname(module.filename));
                    } else {
                        return filePath;
                    }
                };
                return amdRequire;
            };
            require = require || function req() {
                return module.require.apply(module, arguments);
            };
            function runFactory(id, deps, factory) {
                var r, e, m, result;
                if (id) {
                    e = loaderCache[id] = {};
                    m = {
                        id: id,
                        uri: __filename,
                        exports: e
                    };
                    r = makeRequire(require, e, m, id);
                } else {
                    if (alreadyCalled) {
                        throw new Error('amdefine with no module ID cannot be called more than once per file.');
                    }
                    alreadyCalled = true;
                    e = module.exports;
                    m = module;
                    r = makeRequire(require, e, m, module.id);
                }
                if (deps) {
                    deps = deps.map(function (depName) {
                        return r(depName);
                    });
                }
                if (typeof factory === 'function') {
                    result = factory.apply(module.exports, deps);
                } else {
                    result = factory;
                }
                if (result !== undefined) {
                    m.exports = result;
                    if (id) {
                        loaderCache[id] = m.exports;
                    }
                }
            }
            stringRequire = function (systemRequire, exports, module, id, relId) {
                var index = id.indexOf('!'), originalId = id, prefix, plugin;
                if (index === -1) {
                    id = normalize(id, relId);
                    if (id === 'require') {
                        return makeRequire(systemRequire, exports, module, relId);
                    } else if (id === 'exports') {
                        return exports;
                    } else if (id === 'module') {
                        return module;
                    } else if (loaderCache.hasOwnProperty(id)) {
                        return loaderCache[id];
                    } else if (defineCache[id]) {
                        runFactory.apply(null, defineCache[id]);
                        return loaderCache[id];
                    } else {
                        if (systemRequire) {
                            return systemRequire(originalId);
                        } else {
                            throw new Error('No module with ID: ' + id);
                        }
                    }
                } else {
                    prefix = id.substring(0, index);
                    id = id.substring(index + 1, id.length);
                    plugin = stringRequire(systemRequire, exports, module, prefix, relId);
                    if (plugin.normalize) {
                        id = plugin.normalize(id, makeNormalize(relId));
                    } else {
                        id = normalize(id, relId);
                    }
                    if (loaderCache[id]) {
                        return loaderCache[id];
                    } else {
                        plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});
                        return loaderCache[id];
                    }
                }
            };
            function define(id, deps, factory) {
                if (Array.isArray(id)) {
                    factory = deps;
                    deps = id;
                    id = undefined;
                } else if (typeof id !== 'string') {
                    factory = id;
                    id = deps = undefined;
                }
                if (deps && !Array.isArray(deps)) {
                    factory = deps;
                    deps = undefined;
                }
                if (!deps) {
                    deps = [
                        'require',
                        'exports',
                        'module'
                    ];
                }
                if (id) {
                    defineCache[id] = [
                        id,
                        deps,
                        factory
                    ];
                } else {
                    runFactory(id, deps, factory);
                }
            }
            define.require = function (id) {
                if (loaderCache[id]) {
                    return loaderCache[id];
                }
                if (defineCache[id]) {
                    runFactory.apply(null, defineCache[id]);
                    return loaderCache[id];
                }
            };
            define.amd = {};
            return define;
        }
        module.exports = amdefine;
    },
    '10': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            var base64 = require('11');
            var VLQ_BASE_SHIFT = 5;
            var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
            var VLQ_BASE_MASK = VLQ_BASE - 1;
            var VLQ_CONTINUATION_BIT = VLQ_BASE;
            function toVLQSigned(aValue) {
                return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
            }
            function fromVLQSigned(aValue) {
                var isNegative = (aValue & 1) === 1;
                var shifted = aValue >> 1;
                return isNegative ? -shifted : shifted;
            }
            exports.encode = function base64VLQ_encode(aValue) {
                var encoded = '';
                var digit;
                var vlq = toVLQSigned(aValue);
                do {
                    digit = vlq & VLQ_BASE_MASK;
                    vlq >>>= VLQ_BASE_SHIFT;
                    if (vlq > 0) {
                        digit |= VLQ_CONTINUATION_BIT;
                    }
                    encoded += base64.encode(digit);
                } while (vlq > 0);
                return encoded;
            };
            exports.decode = function base64VLQ_decode(aStr) {
                var i = 0;
                var strLen = aStr.length;
                var result = 0;
                var shift = 0;
                var continuation, digit;
                do {
                    if (i >= strLen) {
                        throw new Error('Expected more digits in base 64 VLQ value.');
                    }
                    digit = base64.decode(aStr.charAt(i++));
                    continuation = !!(digit & VLQ_CONTINUATION_BIT);
                    digit &= VLQ_BASE_MASK;
                    result = result + (digit << shift);
                    shift += VLQ_BASE_SHIFT;
                } while (continuation);
                return {
                    value: fromVLQSigned(result),
                    rest: aStr.slice(i)
                };
            };
        });
    },
    '11': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            var charToIntMap = {};
            var intToCharMap = {};
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function (ch, index) {
                charToIntMap[ch] = index;
                intToCharMap[index] = ch;
            });
            exports.encode = function base64_encode(aNumber) {
                if (aNumber in intToCharMap) {
                    return intToCharMap[aNumber];
                }
                throw new TypeError('Must be between 0 and 63: ' + aNumber);
            };
            exports.decode = function base64_decode(aChar) {
                if (aChar in charToIntMap) {
                    return charToIntMap[aChar];
                }
                throw new TypeError('Not a valid base 64 digit: ' + aChar);
            };
        });
    },
    '12': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            function getArg(aArgs, aName, aDefaultValue) {
                if (aName in aArgs) {
                    return aArgs[aName];
                } else if (arguments.length === 3) {
                    return aDefaultValue;
                } else {
                    throw new Error('"' + aName + '" is a required argument.');
                }
            }
            exports.getArg = getArg;
            var urlRegexp = /([\w+\-.]+):\/\/((\w+:\w+)@)?([\w.]+)?(:(\d+))?(\S+)?/;
            function urlParse(aUrl) {
                var match = aUrl.match(urlRegexp);
                if (!match) {
                    return null;
                }
                return {
                    scheme: match[1],
                    auth: match[3],
                    host: match[4],
                    port: match[6],
                    path: match[7]
                };
            }
            function join(aRoot, aPath) {
                var url;
                if (aPath.match(urlRegexp)) {
                    return aPath;
                }
                if (aPath.charAt(0) === '/' && (url = urlParse(aRoot))) {
                    return aRoot.replace(url.path, '') + aPath;
                }
                return aRoot.replace(/\/$/, '') + '/' + aPath;
            }
            exports.join = join;
            function toSetString(aStr) {
                return '$' + aStr;
            }
            exports.toSetString = toSetString;
            function fromSetString(aStr) {
                return aStr.substr(1);
            }
            exports.fromSetString = fromSetString;
            function relative(aRoot, aPath) {
                aRoot = aRoot.replace(/\/$/, '');
                return aPath.indexOf(aRoot + '/') === 0 ? aPath.substr(aRoot.length + 1) : aPath;
            }
            exports.relative = relative;
        });
    },
    '13': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            var util = require('12');
            function ArraySet() {
                this._array = [];
                this._set = {};
            }
            ArraySet.fromArray = function ArraySet_fromArray(aArray) {
                var set = new ArraySet();
                for (var i = 0, len = aArray.length; i < len; i++) {
                    set.add(aArray[i]);
                }
                return set;
            };
            ArraySet.prototype.add = function ArraySet_add(aStr) {
                if (this.has(aStr)) {
                    return;
                }
                var idx = this._array.length;
                this._array.push(aStr);
                this._set[util.toSetString(aStr)] = idx;
            };
            ArraySet.prototype.has = function ArraySet_has(aStr) {
                return Object.prototype.hasOwnProperty.call(this._set, util.toSetString(aStr));
            };
            ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
                if (this.has(aStr)) {
                    return this._set[util.toSetString(aStr)];
                }
                throw new Error('"' + aStr + '" is not in the set.');
            };
            ArraySet.prototype.at = function ArraySet_at(aIdx) {
                if (aIdx >= 0 && aIdx < this._array.length) {
                    return this._array[aIdx];
                }
                throw new Error('No element indexed by ' + aIdx);
            };
            ArraySet.prototype.toArray = function ArraySet_toArray() {
                return this._array.slice();
            };
            exports.ArraySet = ArraySet;
        });
    },
    '14': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            var util = require('12');
            var binarySearch = require('15');
            var ArraySet = require('13').ArraySet;
            var base64VLQ = require('10');
            function SourceMapConsumer(aSourceMap) {
                var sourceMap = aSourceMap;
                if (typeof aSourceMap === 'string') {
                    sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
                }
                var version = util.getArg(sourceMap, 'version');
                var sources = util.getArg(sourceMap, 'sources');
                var names = util.getArg(sourceMap, 'names');
                var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
                var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
                var mappings = util.getArg(sourceMap, 'mappings');
                var file = util.getArg(sourceMap, 'file');
                if (version !== this._version) {
                    throw new Error('Unsupported version: ' + version);
                }
                this._names = ArraySet.fromArray(names);
                this._sources = ArraySet.fromArray(sources);
                this.sourceRoot = sourceRoot;
                this.sourcesContent = sourcesContent;
                this.file = file;
                this._generatedMappings = [];
                this._originalMappings = [];
                this._parseMappings(mappings, sourceRoot);
            }
            SourceMapConsumer.prototype._version = 3;
            Object.defineProperty(SourceMapConsumer.prototype, 'sources', {
                get: function () {
                    return this._sources.toArray().map(function (s) {
                        return this.sourceRoot ? util.join(this.sourceRoot, s) : s;
                    }, this);
                }
            });
            SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
                var generatedLine = 1;
                var previousGeneratedColumn = 0;
                var previousOriginalLine = 0;
                var previousOriginalColumn = 0;
                var previousSource = 0;
                var previousName = 0;
                var mappingSeparator = /^[,;]/;
                var str = aStr;
                var mapping;
                var temp;
                while (str.length > 0) {
                    if (str.charAt(0) === ';') {
                        generatedLine++;
                        str = str.slice(1);
                        previousGeneratedColumn = 0;
                    } else if (str.charAt(0) === ',') {
                        str = str.slice(1);
                    } else {
                        mapping = {};
                        mapping.generatedLine = generatedLine;
                        temp = base64VLQ.decode(str);
                        mapping.generatedColumn = previousGeneratedColumn + temp.value;
                        previousGeneratedColumn = mapping.generatedColumn;
                        str = temp.rest;
                        if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
                            temp = base64VLQ.decode(str);
                            mapping.source = this._sources.at(previousSource + temp.value);
                            previousSource += temp.value;
                            str = temp.rest;
                            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
                                throw new Error('Found a source, but no line and column');
                            }
                            temp = base64VLQ.decode(str);
                            mapping.originalLine = previousOriginalLine + temp.value;
                            previousOriginalLine = mapping.originalLine;
                            mapping.originalLine += 1;
                            str = temp.rest;
                            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
                                throw new Error('Found a source and line, but no column');
                            }
                            temp = base64VLQ.decode(str);
                            mapping.originalColumn = previousOriginalColumn + temp.value;
                            previousOriginalColumn = mapping.originalColumn;
                            str = temp.rest;
                            if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
                                temp = base64VLQ.decode(str);
                                mapping.name = this._names.at(previousName + temp.value);
                                previousName += temp.value;
                                str = temp.rest;
                            }
                        }
                        this._generatedMappings.push(mapping);
                        if (typeof mapping.originalLine === 'number') {
                            this._originalMappings.push(mapping);
                        }
                    }
                }
                this._originalMappings.sort(this._compareOriginalPositions);
            };
            SourceMapConsumer.prototype._compareOriginalPositions = function SourceMapConsumer_compareOriginalPositions(mappingA, mappingB) {
                if (mappingA.source > mappingB.source) {
                    return 1;
                } else if (mappingA.source < mappingB.source) {
                    return -1;
                } else {
                    var cmp = mappingA.originalLine - mappingB.originalLine;
                    return cmp === 0 ? mappingA.originalColumn - mappingB.originalColumn : cmp;
                }
            };
            SourceMapConsumer.prototype._compareGeneratedPositions = function SourceMapConsumer_compareGeneratedPositions(mappingA, mappingB) {
                var cmp = mappingA.generatedLine - mappingB.generatedLine;
                return cmp === 0 ? mappingA.generatedColumn - mappingB.generatedColumn : cmp;
            };
            SourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator) {
                if (aNeedle[aLineName] <= 0) {
                    throw new TypeError('Line must be greater than or equal to 1, got ' + aNeedle[aLineName]);
                }
                if (aNeedle[aColumnName] < 0) {
                    throw new TypeError('Column must be greater than or equal to 0, got ' + aNeedle[aColumnName]);
                }
                return binarySearch.search(aNeedle, aMappings, aComparator);
            };
            SourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
                var needle = {
                        generatedLine: util.getArg(aArgs, 'line'),
                        generatedColumn: util.getArg(aArgs, 'column')
                    };
                var mapping = this._findMapping(needle, this._generatedMappings, 'generatedLine', 'generatedColumn', this._compareGeneratedPositions);
                if (mapping) {
                    var source = util.getArg(mapping, 'source', null);
                    if (source && this.sourceRoot) {
                        source = util.join(this.sourceRoot, source);
                    }
                    return {
                        source: source,
                        line: util.getArg(mapping, 'originalLine', null),
                        column: util.getArg(mapping, 'originalColumn', null),
                        name: util.getArg(mapping, 'name', null)
                    };
                }
                return {
                    source: null,
                    line: null,
                    column: null,
                    name: null
                };
            };
            SourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource) {
                if (!this.sourcesContent) {
                    return null;
                }
                if (this.sourceRoot) {
                    var relativeUrl = util.relative(this.sourceRoot, aSource);
                    if (this._sources.has(relativeUrl)) {
                        return this.sourcesContent[this._sources.indexOf(relativeUrl)];
                    }
                }
                if (this._sources.has(aSource)) {
                    return this.sourcesContent[this._sources.indexOf(aSource)];
                }
                throw new Error('"' + aSource + '" is not in the SourceMap.');
            };
            SourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
                var needle = {
                        source: util.getArg(aArgs, 'source'),
                        originalLine: util.getArg(aArgs, 'line'),
                        originalColumn: util.getArg(aArgs, 'column')
                    };
                if (this.sourceRoot) {
                    needle.source = util.relative(this.sourceRoot, needle.source);
                }
                var mapping = this._findMapping(needle, this._originalMappings, 'originalLine', 'originalColumn', this._compareOriginalPositions);
                if (mapping) {
                    return {
                        line: util.getArg(mapping, 'generatedLine', null),
                        column: util.getArg(mapping, 'generatedColumn', null)
                    };
                }
                return {
                    line: null,
                    column: null
                };
            };
            SourceMapConsumer.GENERATED_ORDER = 1;
            SourceMapConsumer.ORIGINAL_ORDER = 2;
            SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
                var context = aContext || null;
                var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
                var mappings;
                switch (order) {
                case SourceMapConsumer.GENERATED_ORDER:
                    mappings = this._generatedMappings;
                    break;
                case SourceMapConsumer.ORIGINAL_ORDER:
                    mappings = this._originalMappings;
                    break;
                default:
                    throw new Error('Unknown order of iteration.');
                }
                var sourceRoot = this.sourceRoot;
                mappings.map(function (mapping) {
                    var source = mapping.source;
                    if (source && sourceRoot) {
                        source = util.join(sourceRoot, source);
                    }
                    return {
                        source: source,
                        generatedLine: mapping.generatedLine,
                        generatedColumn: mapping.generatedColumn,
                        originalLine: mapping.originalLine,
                        originalColumn: mapping.originalColumn,
                        name: mapping.name
                    };
                }).forEach(aCallback, context);
            };
            exports.SourceMapConsumer = SourceMapConsumer;
        });
    },
    '15': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
                var mid = Math.floor((aHigh - aLow) / 2) + aLow;
                var cmp = aCompare(aNeedle, aHaystack[mid]);
                if (cmp === 0) {
                    return aHaystack[mid];
                } else if (cmp > 0) {
                    if (aHigh - mid > 1) {
                        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
                    }
                    return aHaystack[mid];
                } else {
                    if (mid - aLow > 1) {
                        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
                    }
                    return aLow < 0 ? null : aHaystack[aLow];
                }
            }
            exports.search = function search(aNeedle, aHaystack, aCompare) {
                return aHaystack.length > 0 ? recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare) : null;
            };
        });
    },
    '16': function (require, module, exports, global) {
        if (typeof define !== 'function') {
            var define = require('z')(module);
        }
        define(function (require, exports, module) {
            var SourceMapGenerator = require('y').SourceMapGenerator;
            var util = require('12');
            function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
                this.children = [];
                this.sourceContents = {};
                this.line = aLine === undefined ? null : aLine;
                this.column = aColumn === undefined ? null : aColumn;
                this.source = aSource === undefined ? null : aSource;
                this.name = aName === undefined ? null : aName;
                if (aChunks != null)
                    this.add(aChunks);
            }
            SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer) {
                var node = new SourceNode();
                var remainingLines = aGeneratedCode.split('\n');
                var lastGeneratedLine = 1, lastGeneratedColumn = 0;
                var lastMapping = null;
                aSourceMapConsumer.eachMapping(function (mapping) {
                    if (lastMapping === null) {
                        while (lastGeneratedLine < mapping.generatedLine) {
                            node.add(remainingLines.shift() + '\n');
                            lastGeneratedLine++;
                        }
                        if (lastGeneratedColumn < mapping.generatedColumn) {
                            var nextLine = remainingLines[0];
                            node.add(nextLine.substr(0, mapping.generatedColumn));
                            remainingLines[0] = nextLine.substr(mapping.generatedColumn);
                            lastGeneratedColumn = mapping.generatedColumn;
                        }
                    } else {
                        if (lastGeneratedLine < mapping.generatedLine) {
                            var code = '';
                            do {
                                code += remainingLines.shift() + '\n';
                                lastGeneratedLine++;
                                lastGeneratedColumn = 0;
                            } while (lastGeneratedLine < mapping.generatedLine);
                            if (lastGeneratedColumn < mapping.generatedColumn) {
                                var nextLine = remainingLines[0];
                                code += nextLine.substr(0, mapping.generatedColumn);
                                remainingLines[0] = nextLine.substr(mapping.generatedColumn);
                                lastGeneratedColumn = mapping.generatedColumn;
                            }
                            addMappingWithCode(lastMapping, code);
                        } else {
                            var nextLine = remainingLines[0];
                            var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
                            remainingLines[0] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
                            lastGeneratedColumn = mapping.generatedColumn;
                            addMappingWithCode(lastMapping, code);
                        }
                    }
                    lastMapping = mapping;
                }, this);
                addMappingWithCode(lastMapping, remainingLines.join('\n'));
                aSourceMapConsumer.sources.forEach(function (sourceFile) {
                    var content = aSourceMapConsumer.sourceContentFor(sourceFile);
                    if (content) {
                        node.setSourceContent(sourceFile, content);
                    }
                });
                return node;
                function addMappingWithCode(mapping, code) {
                    if (mapping.source === undefined) {
                        node.add(code);
                    } else {
                        node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, mapping.source, code, mapping.name));
                    }
                }
            };
            SourceNode.prototype.add = function SourceNode_add(aChunk) {
                if (Array.isArray(aChunk)) {
                    aChunk.forEach(function (chunk) {
                        this.add(chunk);
                    }, this);
                } else if (aChunk instanceof SourceNode || typeof aChunk === 'string') {
                    if (aChunk) {
                        this.children.push(aChunk);
                    }
                } else {
                    throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got ' + aChunk);
                }
                return this;
            };
            SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
                if (Array.isArray(aChunk)) {
                    for (var i = aChunk.length - 1; i >= 0; i--) {
                        this.prepend(aChunk[i]);
                    }
                } else if (aChunk instanceof SourceNode || typeof aChunk === 'string') {
                    this.children.unshift(aChunk);
                } else {
                    throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got ' + aChunk);
                }
                return this;
            };
            SourceNode.prototype.walk = function SourceNode_walk(aFn) {
                this.children.forEach(function (chunk) {
                    if (chunk instanceof SourceNode) {
                        chunk.walk(aFn);
                    } else {
                        if (chunk !== '') {
                            aFn(chunk, {
                                source: this.source,
                                line: this.line,
                                column: this.column,
                                name: this.name
                            });
                        }
                    }
                }, this);
            };
            SourceNode.prototype.join = function SourceNode_join(aSep) {
                var newChildren;
                var i;
                var len = this.children.length;
                if (len > 0) {
                    newChildren = [];
                    for (i = 0; i < len - 1; i++) {
                        newChildren.push(this.children[i]);
                        newChildren.push(aSep);
                    }
                    newChildren.push(this.children[i]);
                    this.children = newChildren;
                }
                return this;
            };
            SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
                var lastChild = this.children[this.children.length - 1];
                if (lastChild instanceof SourceNode) {
                    lastChild.replaceRight(aPattern, aReplacement);
                } else if (typeof lastChild === 'string') {
                    this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
                } else {
                    this.children.push(''.replace(aPattern, aReplacement));
                }
                return this;
            };
            SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
                this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
            };
            SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
                this.children.forEach(function (chunk) {
                    if (chunk instanceof SourceNode) {
                        chunk.walkSourceContents(aFn);
                    }
                }, this);
                Object.keys(this.sourceContents).forEach(function (sourceFileKey) {
                    aFn(util.fromSetString(sourceFileKey), this.sourceContents[sourceFileKey]);
                }, this);
            };
            SourceNode.prototype.toString = function SourceNode_toString() {
                var str = '';
                this.walk(function (chunk) {
                    str += chunk;
                });
                return str;
            };
            SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
                var generated = {
                        code: '',
                        line: 1,
                        column: 0
                    };
                var map = new SourceMapGenerator(aArgs);
                var sourceMappingActive = false;
                this.walk(function (chunk, original) {
                    generated.code += chunk;
                    if (original.source !== null && original.line !== null && original.column !== null) {
                        map.addMapping({
                            source: original.source,
                            original: {
                                line: original.line,
                                column: original.column
                            },
                            generated: {
                                line: generated.line,
                                column: generated.column
                            },
                            name: original.name
                        });
                        sourceMappingActive = true;
                    } else if (sourceMappingActive) {
                        map.addMapping({
                            generated: {
                                line: generated.line,
                                column: generated.column
                            }
                        });
                        sourceMappingActive = false;
                    }
                    chunk.split('').forEach(function (ch) {
                        if (ch === '\n') {
                            generated.line++;
                            generated.column = 0;
                        } else {
                            generated.column++;
                        }
                    });
                });
                this.walkSourceContents(function (sourceFile, sourceContent) {
                    map.setSourceContent(sourceFile, sourceContent);
                });
                return {
                    code: generated.code,
                    map: map
                };
            };
            exports.SourceNode = SourceNode;
        });
    }
}));
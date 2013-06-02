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
        var Interpreter = require('a');
        var Translator = require('n');
        var _ = require('4');
        var defaults = {
                minify: false,
                o_folder: 'css',
                i_folder: 'mcss'
            };
        var parse = exports.parse = function (text, options, callback) {
                if (typeof text === 'object') {
                    options = text;
                    callback = options;
                    text = null;
                }
                var parser = new Parser(options);
                parser.parse(text, callback);
            };
        var interpret = exports.interpret = function (text, options, callback) {
                if (typeof text === 'object') {
                    options = text;
                    callback = options;
                    text = null;
                }
                var interpreter = new Interpreter(options);
                parse(text, options, function (err, ast) {
                    if (err)
                        return callback(err);
                    callback(null, interpreter.interpret(ast));
                });
            };
        var translate = exports.translate = function (text, options, callback) {
                if (typeof text === 'object') {
                    options = text;
                    callback = options;
                    text = null;
                }
                if (!text) {
                }
                if (!callback && options.outport)
                    callback = function (err, text) {
                        fs.writeFileSync(options.outport, text, 'utf8');
                    };
                var translator = new Translator(options);
                interpret(text, options, function (err, ast) {
                    if (err)
                        return callback(err);
                    callback(null, translator.translate(ast));
                });
            };
    },
    '2': function (require, module, exports, global) {
        var tk = require('3');
        var tree = require('5');
        var _ = require('4');
        var io = require('6');
        var binop = require('8');
        var symtab = require('9');
        var state = require('7');
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
        var isDirectOperate = _.makePredicate('RGBA DIMENSION STRING BOOLEAN TEXT NULL');
        var isRelationOp = _.makePredicate('== >= <= < > !=');
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
        exports.parse = function (input, options, callback) {
            if (typeof input === 'string') {
                input = tk.tokenize(input, options || {});
            }
            return new Parser(options).parse(input, callback);
        };
        Parser.prototype = {
            parse: function (tks, callback) {
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
                this.callback = callback;
                this.ast = this.stylesheet();
                this._complete();
            },
            _complete: function () {
                this.tasks--;
                if (this.tasks == 0) {
                    this.callback(null, this.ast);
                }
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
                console.log(this.ast, this);
                throw Error(msg + ' on line:' + this.ll().lineno);
            },
            stylesheet: function (block) {
                var end = block ? '}' : 'EOF';
                if (block)
                    this.match('{');
                var node = new tree.Stylesheet();
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
                var node, url, queryList, ll;
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
                return new tree.Import(url, queryList);
            },
            module: function () {
                var node = new tree.Module(), url;
                this.match('AT_KEYWORD');
                this.eat('WS');
                if (this.la() !== '{') {
                    url = this.url();
                }
                if (url) {
                    io.register({
                        url: url,
                        node: node,
                        key: 'block'
                    });
                } else {
                    node.block = this.block();
                }
                return node;
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
                var block = this.stylesheet(true);
                return new tree.Media(list, block);
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
                this.match(':');
                value = this.expression();
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
                var expression = this.expression();
                var node = new tree.Debug(expression);
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
                var left = this.binop2(), right, la;
                this.eat('WS');
                while ((la = this.la()) === '+' || this.la() === '-') {
                    this.next();
                    this.eat('WS');
                    right = this.binop2();
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
                this.eat('WS');
                while ((la = this.la()) === '*' || la === '/' || la === '%') {
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
                case '#{':
                case 'TEXT':
                    return this.compoundIdent();
                case 'FUNCTION':
                    return this.fnCall();
                case 'HASH':
                    this.next();
                    value = ll.value;
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
                        node = new tree.RGBA(value);
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
                case ':':
                case '*':
                case 'PSEUDO_CLASS':
                case 'ATTRIBUTE':
                    if (this.state(states.TRY_DECLARATION)) {
                        _.error(errors.DECLARION_FAIL);
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
            _add: function (actor1, actor2, op) {
                var value, unit;
                if (actor1.unit) {
                    unit = actor1.unit;
                } else {
                    unit = actor2.unit;
                }
                if (op === '+') {
                    value = actor1.value + actor2.value;
                } else {
                    value = actor1.value - actor2.value;
                }
                return {
                    type: 'DIMENSION',
                    value: value,
                    unit: unit
                };
            },
            _mult: function (actor1, actor2, op) {
                var unit, value;
                if (actor1.unit) {
                    unit = actor1.unit;
                } else {
                    unit = actor2.unit;
                }
                if (op === '*') {
                    value = actor1.value * actor2.value;
                } else {
                    if (actor2.value === 0)
                        this.error('can"t divid by zero');
                    value = actor1.value / actor2.value;
                }
                return {
                    type: 'DIMENSION',
                    value: value,
                    unit: unit
                };
            },
            _lookahead: function () {
                return this.lookahead.map(function (item) {
                    return item.type;
                }).join(',');
            }
        };
    },
    '3': function (require, module, exports, global) {
        var util = require('4');
        var tree = require('5');
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
                regexp: /\/\*([^\x00]+?)\*\/|\/\/([^\n\r$]*)/,
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
                        value: parseInt(value),
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
        console.log($(/\.({nmchar}+)/));
    },
    '4': function (require, module, exports, global) {
        var _ = {};
        _.debugger = 1;
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
                if (o1[j] == null || override)
                    o1[j] = o2[j];
            }
            return o1;
        };
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
        _.processUrl = function () {
        };
        module.exports = _;
    },
    '5': function (require, module, exports, global) {
        var _ = require('4'), splice = [].splice, isPrimary = _.makePredicate('hash rgba dimension string boolean text null url');
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
        function RuleSet(selector, block) {
            this.type = 'ruleset';
            this.selector = selector;
            this.block = block;
            this.ref = [];
        }
        RuleSet.prototype.remove = function (ruleset) {
        };
        RuleSet.prototype.clone = function () {
            var clone = new RuleSet(cloneNode(this.selector), cloneNode(this.block));
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
        function RGBA(channels) {
            this.type = 'RGBA';
            if (typeof channels === 'string') {
                var string = channels.charAt(0) === '#' ? channels.slice(1) : channels;
                if (string.length === 6) {
                    channels = [
                        parseInt(string.substr(0, 2), 16),
                        parseInt(string.substr(2, 2), 16),
                        parseInt(string.substr(4, 2), 16),
                        1
                    ];
                } else {
                    var r = string.substr(0, 1);
                    var g = string.substr(1, 1);
                    var b = string.substr(2, 1);
                    channels = [
                        parseInt(r + r, 16),
                        parseInt(g + g, 16),
                        parseInt(b + b, 16),
                        1
                    ];
                }
            }
            this.channels = channels || [];
        }
        RGBA.prototype.clone = function () {
            var clone = new RGBA(cloneNode(this.channels));
            return clone;
        };
        RGBA.prototype.tocss = function () {
            var chs = this.channels;
            if (chs[3] === 1 || chs[3] === undefined) {
                return 'rgb(' + chs[0] + ',' + chs[1] + ',' + chs[2] + ')';
            }
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
        function Import(url, queryList) {
            this.type = 'import';
            this.url = url;
            this.queryList = queryList || [];
        }
        Import.prototype.clone = function () {
            var clone = new Import(this.url, this.queryList);
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
        function Media(queryList, block) {
            this.type = 'media';
            this.queryList = queryList || [];
            this.block = block;
        }
        Media.prototype.clone = function () {
            var clone = new Media(cloneNode(this.list), cloneNode(this.block));
            return clone;
        };
        function MediaQuery(type, expressions) {
            this.type = 'mediaquery';
            this.meidaType = type;
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
        function Debug(expression) {
            this.type = 'debug';
            this.expression = expression;
        }
        Debug.prototype.clone = function () {
            var clone = new Debug(cloneNode(this.expression));
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
        exports.RGBA = RGBA;
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
                return this.walk(ast);
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
            default:
                return true;
            }
        };
        exports.isPrimary = isPrimary;
        exports.isRelationOp = _.makePredicate('== >= <= < > !=');
    },
    '6': function (require, module, exports, global) {
        var fs = null;
        var path = null;
        var state = require('7');
        exports.get = function (path, callback) {
            if (fs) {
                fs.readFile(path, 'utf8', callback);
            } else {
                http(path, callback);
            }
        };
        exports.join = function () {
            for (var i = 0; i < len; i++) {
                var sep = arguments[i];
            }
        };
        var http = function (url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onreadystatechange = function (e) {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    callback(null, xhr.responseText);
                }
            };
            xhr.send();
        };
    },
    '7': function (require, module, exports, global) {
        var _ = {};
        _.debug = true;
        _.files = [];
        _.directives = {
            'test': {
                accept: 'valueList',
                interpret: function (ast) {
                }
            }
        };
        module.exports = _;
    },
    '8': function (require, module, exports, global) {
        var _ = require('4');
        var tree = require('5');
        Function.prototype.op_accept = function (list) {
            var test = typeof list === 'function' ? list : _.makePredicate(list);
            var fn = this;
            return function (left, right) {
                if (!test(tree.inspect(left)) || !test(tree.inspect(right))) {
                    console.log(left, right, tree.inspect(left));
                    throw Error('invalid actors to operation' + right.lineno);
                }
                return fn.apply(this, arguments);
            };
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
                }.op_accept([
                    'text',
                    'dimension',
                    'string'
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
                }.op_accept(['dimension']),
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
                }.op_accept(['dimension']),
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
                }.op_accept(['dimension']),
                '%': function (left, right) {
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
                }.op_accept(['dimension']),
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
                }.op_accept(tree.isPrimary),
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
    '9': function (require, module, exports, global) {
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
            resolve: function (name) {
                var scope = this;
                while (scope) {
                    var symbol = scope.symtable[name];
                    if (symbol)
                        return symbol;
                    else {
                        if (this.isStruct)
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
    'a': function (require, module, exports, global) {
        var Interpreter = require('b');
        var Hook = require('g');
        module.exports = Interpreter;
    },
    'b': function (require, module, exports, global) {
        var Walker = require('c');
        var tree = require('5');
        var symtab = require('9');
        var state = require('d');
        var u = require('4');
        var binop = require('8');
        var functions = require('e');
        var color = require('f');
        function Interpreter(options) {
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
            var res = this.walk(ast);
            return res;
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
            var value = this.walk(ast.expression);
            console.log(tree.toStr(value));
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
            var func = this.resolve(ast.name), iscope, params, args;
            if (!func || func.type !== 'func') {
                if (func = functions[ast.name]) {
                    return func.apply(this, ast.args);
                } else {
                    if (ast.name.charAt(0) === '$')
                        this.error('no function "' + ast.name + '" founded');
                    else
                        return ast;
                }
            }
            iscope = new symtab.Scope();
            params = func.params;
            args = this.walk(ast.args);
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
                var block = this.walk(func.block.clone());
            } catch (err) {
                this.pop(iscope);
                if (err.code === errors.RETURN) {
                    return err.value;
                } else {
                    throw err;
                }
            }
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
                    extend.ref.push(ruleset);
                }
            });
        };
        _.walk_import = function (ast) {
            console.log(ast);
        };
        _.walk_media = function (ast) {
            ast.queryList = this.walk(ast.queryList);
            this.concatMedia(ast);
            this.down(null, ast);
            this.walk(ast.block);
            this.up(null, ast);
            var res = ast.block.exclude();
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
            media.queryList = slist.concat(mlist);
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
    'c': function (require, module, exports, global) {
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
    'd': function (require, module, exports, global) {
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
    'e': function (require, module, exports, global) {
        var tree = require('5');
        var _ = require('4');
        var fixColor = function (number) {
            return number > 255 ? 255 : number < 0 ? 0 : number;
        };
        var fixChannels = function (channels) {
            channels[0] = fixColor(channels[0]);
            channels[1] = fixColor(channels[1]);
            channels[2] = fixColor(channels[2]);
            return channels;
        };
        module.exports = {
            lighten: function (rgba, percent) {
                if (!percent || percent.unit !== '%') {
                    this.error('the 2rd argument must be a percent like "10%"');
                }
                var chs = rgba.channels;
                var rate = 1 + percent.value / 100;
                var channels = fixChannels([
                        chs[0] * rate,
                        chs[1] * rate,
                        chs[2] * rate,
                        chs[3]
                    ]);
                return new tree.RGBA(channels);
            },
            darken: function (rgba, percent) {
                if (!percent || percent.unit !== '%') {
                    this.error('the 2rd argument must be a percent like "10%"');
                }
                var chs = rgba.channels;
                var rate = 1 + percent.value / 100;
                var channels = fixChannels([
                        chs[0] * rate,
                        chs[1] * rate,
                        chs[2] * rate,
                        chs[3]
                    ]);
                return new tree.RGBA(channels);
            },
            red: function (rgba) {
                return rgba.channels[0];
            },
            green: function (rgba) {
                return rgba.channels[1];
            },
            blue: function (rgba) {
                return rgba.channels[2];
            },
            alpha: function (rgba) {
                return rgba.channels[3];
            },
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
    },
    'f': function (require, module, exports, global) {
        module.exports = {
            hsl2rgb: function () {
            }
        };
    },
    'g': function (require, module, exports, global) {
        var Hook = require('h');
        exports.hook = function (ast, options) {
            new Hook(options).walk(ast);
            return ast;
        };
    },
    'h': function (require, module, exports, global) {
        var Walker = require('c');
        var Event = require('i');
        var hooks = require('j');
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
    'i': function (require, module, exports, global) {
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
    'j': function (require, module, exports, global) {
        module.exports = {
            prefixr: require('k'),
            csscomb: require('m')
        };
    },
    'k': function (require, module, exports, global) {
        var prefixs = require('l').prefixs;
        var _ = require('4');
        var tree = require('5');
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
    'l': function (require, module, exports, global) {
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
    'm': function (require, module, exports, global) {
        var orders = require('l').orders;
        module.exports = {
            'block': function (tree) {
                tree.list.sort(function (d1, d2) {
                    return (orders[d1.property] || 100) - (orders[d2.property] || 100);
                });
            }
        };
    },
    'n': function (require, module, exports, global) {
        var Translator = require('o');
        module.exports = Translator;
    },
    'o': function (require, module, exports, global) {
        var Walker = require('c');
        var tree = require('5');
        function Translator(options) {
            this.options = options || {};
        }
        var _ = Translator.prototype = new Walker();
        var walk = _.walk;
        _.translate = function (ast, callback) {
            this.ast = ast;
            this.indent = 1;
            return this.walk(ast);
        };
        _.walk_stylesheet = function (ast) {
            var cssText = '';
            var bodyText = this.walk(ast.list);
            return bodyText.join('\n');
        };
        _.walk_ruleset = function (ast) {
            var cssTexts = [this.walk(ast.selector)];
            cssTexts.push(this.walk(ast.block));
            return cssTexts.join('');
        };
        _.walk_selectorlist = function (ast) {
            return this.walk(ast.list).join(',\n');
        };
        _.walk_complexselector = function (ast) {
            return ast.string;
        };
        _.walk_block = function (ast) {
            var res = ['{\n'], rulesets = [], self = this;
            ast.list.forEach(function (sast) {
                if (tree.inspect(sast) === 'ruleset')
                    rulesets.push(sast);
                else
                    res.push('\t' + self.walk(sast) + '\n');
            });
            res.push('}\n');
            rulesets.forEach(function (ruleset) {
                res.push(self.walk(ruleset));
            });
            var text = res.join('');
            return text;
        };
        _.walk_componentvalues = function (ast) {
            var text = this.walk(ast.list).join(' ');
            return text;
        };
        _.walk_values = function () {
        };
        _.walk_declaration = function (ast) {
            var text = ast.property;
            var value = this.walk(ast.value);
            return text + ': ' + value + ';';
        };
        _.walk_ident = function (ast) {
            return ast.val;
        };
        _.walk_string = function (ast) {
            return '"' + ast.val + '"';
        };
        _['walk_,'] = function (ast) {
            return ',';
        };
        _['walk_='] = function (ast) {
            return '=';
        };
        _.walk_unknown = function (ast) {
            return ast.name;
        };
        _.walk_cssfunction = function (ast) {
            return ast.name + '(' + this.walk(ast.value) + ')';
        };
        _.walk_module = function () {
            return '';
        };
        _.walk_uri = function (ast) {
            return 'url(' + ast.val + ')';
        };
        _.walk_rgba = function (ast) {
            return ast.tocss();
        };
        _.walk_dimension = function (ast) {
            var val = ast.val;
            return val.number + (val.unit ? val.unit : '');
        };
        _.walk_variable = function () {
            return '';
        };
        module.exports = Translator;
    }
}));
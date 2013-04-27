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
        var parser = null;
        var util = require('2');
        exports.tokenizer = tokenizer;
        exports.parser = parser;
        exports.util = util;
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
        var isAtKeyWord = toAssert2('keyframe media page import font-face');
        var isNessKeyWord = toAssert2('mixin extend if each');
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
                    if (!~reg.indexOf('^(?')) {
                        rule.regexp = new RegExp('^(?:' + reg + ')');
                    }
                    state = rule.state || 'init';
                    link = $links[state] || ($links[state] = []);
                    link.push(i);
                }
                return this;
            };
        var cleanReg;
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
                regexp: /@([-_A-Za-z][-\w]*)/,
                action: function (yytext, val) {
                    if (isNessKeyWord(val) || isAtKeyWord(val)) {
                        return val.toUpperCase();
                    } else {
                        this.error('Unrecognized @ word');
                    }
                }
            },
            {
                regexp: /([\$_A-Za-z][-\w]*)/,
                action: function (yytext) {
                    this.yyval = yytext;
                    return 'IDENT';
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
                    this.yyval = val.trim();
                    return 'STRING';
                }
            },
            {
                regexp: /([{}();,:])[\t ]*/,
                action: function (yytext, punctuator) {
                    return punctuator;
                }
            },
            {
                regexp: /[ \t]*((?:[>=<!]?=)|[-&><~!+*\/])[ \t]*/,
                action: function (yytext, op) {
                    return op;
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
        exports.makePredicate = function (words) {
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
        exports.makePredicate2 = function (words) {
            if (typeof words !== 'string') {
                words = words.join(' ');
            }
            return function (word) {
                return ~words.indexOf(word);
            };
        };
        exports.perf = function (fn, times, args) {
            var date = +new Date();
            for (var i = 0; i < times; i++) {
                fn.apply(this, args || []);
            }
            return +new Date() - date;
        };
        exports.extend = function (o1, o2, override) {
            for (var j in o2) {
                if (o1[j] == null || override)
                    o1[j] = o2[j];
            }
            return o1;
        };
    }
}));
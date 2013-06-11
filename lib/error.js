
var tpl = require('../helper/tpl');

var e = module.exports = {};
function SyntaxError(message, node){
    this.message = message;
    this.line = node.line;
}

SyntaxError.prototype.__proto__ = Error.prototype;
SyntaxError.prototype.name = 'SyntaxError';




e.tpls = {
    'unexcept': tpl('expcept {{expcept}} but got {type}'),
    'syntaxerror': tpl('expcept {{expcept}} but got {type}')
}

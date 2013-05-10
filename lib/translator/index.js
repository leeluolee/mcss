var Translator = require('./translator');

exports.translate = function(tree, options){
    return new Translator().translate(tree, options)
}

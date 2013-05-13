var prefixs = require('../../helper/properties').prefixs;
var _ = require('../../helper/util');
var fake = _.makePredicate('border-radius transition');

module.exports = {
    // 只访问一个节点
    block: function(tree){
        tree.list.forEach(function(declaration){

        })
    }
}
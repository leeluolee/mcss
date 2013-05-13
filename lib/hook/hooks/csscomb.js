var orders = require('../../helper/properties').orders;

module.exports = {
    'block':function(tree){
        tree.list.sort(function(d1, d2){
            return (orders[d1.property] || 100) - (orders[d2.property] || 100);
        })
    }
}
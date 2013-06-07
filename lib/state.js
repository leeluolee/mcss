// 全局状态控制, 可能在多次实例间共享的状态
var _ = {};

_.debug = true;

_.pathes = [];

/**
 * imported file fullpath use for watcher
 */
_.requires = [];


_.directives = {
    'test':{
        accept: 'valueList',
        interpret: function(ast){
            
        }
    }
}


module.exports = _;
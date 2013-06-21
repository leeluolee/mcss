var mcss = require('../');
var path = require('path');
//每次生成都修改后缀
var instance = mcss({
    filename: path.join(__dirname, 'mcss/_large.mcss'),
    walkers: [{
        'url': function(ast){
            ast.value += '?timestamp=' + Date.now();
        }
    }]
})

// 获取节点
instance.interpret().done(function(ast){
    // the ast is changed
})

// 或输出修改后的css
instance.translate().done(function(cssContent){
    // the cssContent is changed
})

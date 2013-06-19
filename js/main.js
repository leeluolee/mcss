!function(){
    var $ = function(selector){
        return document.querySelector(selector);
    }
    var input = CodeMirror.fromTextArea($('.m-editor .input textarea'), {
        mode: 'css',
        tabSize: 2,
        theme: 'solarized',
        autofocus: true,
        dragDrop: false,
        lineNumbers: true,
        extraKeys: {
            Tab: function(cm) {
                var spaces = new Array(cm.getOption("indentUnit") + 1).join(" ")
                cm.replaceSelection(spaces, "end", "+input")
            }
        }
    })

    var outport = CodeMirror($('.m-editor .outport'), {
        mode: 'css',
        theme: 'solarized',
        tabSize: 2,
        readOnly: 'nocursor',
        lineNumbers: true
    })

    var compile = function(value){
        mcss({
            filename: '/index.html'
        }).translate(value).done(function(css){
            outport.setValue(css)
        }).fail(function(error){
            mcss.error.format(error);
            outport.setValue(error.message);
        })
    }
    var timer = null;
    input.on('change', function(){
        var value = input.getValue();
        clearTimeout(timer)
        timer = setTimeout(compile.bind(null,value), 600)
    })
    compile(input.getValue());

}()

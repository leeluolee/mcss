(function(){

    var $tooltip = $('.tooltip');
    var input = CodeMirror.fromTextArea($('.m-editor .input textarea')[0], {
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

    var outport = CodeMirror($('.m-editor .outport')[0], {
        mode: 'css',
        theme: 'solarized',
        tabSize: 2,
        readOnly: 'nocursor',
        lineNumbers: true
    })
    var compile = function(value){
        mcss({
            filename: '/index.html'
        }).translate(value)
        .done(function(css){
            outport.setValue(css)
            if(input.state.activeLine){
                clearActiveLine(input);
            }
        }).fail(function(error){
            outport.setValue(error.name + ' : ' + error.message);
            updateActiveLine(input, error);
        })
    }
    var timer = null;
    input.on('change', function(cm){
        var value = input.getValue();
        clearTimeout(timer);
        timer = setTimeout(compile.bind(null,value), 600)
    })
    compile(input.getValue());

    // activeLine
    input.state.activeLine = null;
    var WRAP_CLASS = "CodeMirror-error";
    var BACK_CLASS = "CodeMirror-error-background";
    function clearActiveLine(cm) {
        cm.removeLineClass(cm.state.activeLine, "wrap", WRAP_CLASS);
        cm.removeLineClass(cm.state.activeLine, "background", BACK_CLASS);
    }

    function updateActiveLine(cm, error) {
        var line = cm.getLineHandle(error.line -1);
        // if (cm.state.activeLine == line) return;
        if(cm.state.activeLine) clearActiveLine(cm);
        cm.addLineClass(line, "wrap", WRAP_CLASS);
        cm.addLineClass(line, "background", BACK_CLASS);
        // cm.addLineWidget(line, $tooltip[0]);
        // $tooltip.find('.inner').text(error.name + ':' +error.message);
        // $tooltip.addClass('in');
        cm.state.activeLine = line;
    }

})();

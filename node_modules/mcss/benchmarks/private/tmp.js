  // {   // punctor can ignore 'WS'
  //       regexp: $('skipedPunctor',/{w}*([\{};,:><\-+\*]|->|[\*\$\^~\|>=<!]?=|\.\.\.?){w}*/),
  //       action: function(yytext, punctuator){
  //           return punctuator;
  //       }

  //   }

        // switch(ll.type){
        //     case 'VAR':
        //     case '(':
        //     case 'DIMENSION':
        //         node = this.binop2();
        //         break;
        //     case '+':
        //     case '-':
        //         var actor = this.ll();
        //         this.next();
        //         this.eat('WS');
        //         if(this.ll(2)!=='ws'){
        //             node = this.expression(ll.type)
        //         }else{
        //             node = ll;
        //         }
        //         break;
        //     case 'WS':
        //         this.next();
        //         node = this.expression();
        //         break;
        //     case 'IDENT':
        //         if(this.ll(2).type == '->'){
        //             node = this.pointer();
        //             break;
        //         } 
        //     case 'STRING':
        //     case 'RGBA':
        //     case 'URL':
        //         this.next();
        //         node = ll;
        //         break;
        //     case 'HASH':
        //         this.next();
        //         value = ll.value;
        //         if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)){
        //             node = new tree.RGBA(value);
        //         }else{
        //             node = new tree.Unknown(ll.value);
        //         }
        //         break;
        //     case 'FUNCTION':
        //         this.next();
        //         this.match('(');
        //         var fn = functions[ll.value];
        //         if(!fn){
        //             // then means css function
        //             node = new tree.CssFunction(ll.value);
        //             node.value = this.componentValues(')');
        //             this.match(')')
        //         }else{
        //             var params = [];
        //             this.skipWSorNewlne();
        //             if(this.la() !== ')'){
        //                 do{
        //                     params.push(this.expression());
        //                 }while(this.la() === ',')
        //             }
        //             this.match(')');
        //             node = fn.apply(this, params);
        //             // 所有函数如果返回了字符串 都认为是要原样输出，否则应返回node 参与计算
        //             if(typeof node === 'string'){
        //                 node = new tree.Unknown(node);
        //             }
        //         }
        //         break; 
        //     default:
        //         perror.code = 1987;
        //         throw perror;
        // }
        // return node;
// // block 外围插值
// // declaration 插值
// // componentValues 插值
// interpolate: function(){
//     var node;
//     this.match('INTERPOLATION');
//     var ll = this.ll();
//     if(ll.type === 'DIMENSION' && this.la(2) === '..'){
//         node = this.range();
//     }
//     if((ll.type === 'DIMENSION' || ll.type === 'IDENT')){
//         if(this.la(2) !== ','){
//             node = ll;
//         }else{
//             node = this.list();
//         }
//     }
//     this.match('}')
//     return node;
// },


// simple  expression adaptor
// --------------------------

// priority 2 binop
// binop2: function(){
//     var left = this.binop1(), right, node;
//     this.eat('WS');
//     var op = this.ll();
//     switch(op.type){
//         case '+':
//         case '-':
//             this.next();
//             this.eat('WS');
//             right = this.binop1();
//             // if the primary type (Dimension RGBA etc)
//             if(isDirectOperate(right.type) && isDirectOperate(left.type)){
//                 return this._add(left, right, op.type);
//             }else{
//                 return new tree.Operator(op.type, left, right)
//             }
//         case '==':
//         case '>=':
//         case '<=':
//         case '>':
//         case '<':
//         case '!=':
//             this.next();
//             this.eat('WS');
//             right = this.binop2();
//             // if the primary type (Dimension RGBA etc)
//             if(isDirectOperate(right.type) && isDirectOperate(left.type)){
//                 return this._logicOp(left, right, op.type);
//             }else{
//                 return new tree.Operator(op.type, left, right)
//             }
//             this.next();
//             this.eat('WS');
//             right = this.binop1();
//             // if the primary type (Dimension RGBA etc)
//             if(isDirectOperate(right.type) && isDirectOperate(left.type)){
//                 return this._logicOp(left, right, op.type);
//             }else{
//                 return new tree.Operator(op.type, left, right)
//             }

//         default: 
//             return left;
//     }
// },
// // priority 1 binop
// binop1: function(){
//     var left = this.primary(), right;
//     this.eat('WS');
//     var op = this.ll();
//     if(op.type === '*' || op.type === '/'){
//         this.next();
//         this.eat('WS');
//         right = this.binop1();
//         // 这里要加入
//         if(isDirectOperate(right.type) && isDirectOperate(left.type)){
//             return this._mult(left, right, op.type);
//         }else{
//             return new tree.Operator(op.type, left, right)
//         }
//     }else{
//         return left;
//     }
// },

//
// primary: function(){
//     var ll = this.ll();
//     if(ll.type === '('){
//         this.next();
//         var d1 = this.expression();
//         this.match(')')
//         return d1;
//     }else{
//         d1= this.ll();
//         this.next();
//         return d1;
//     }
// },

// DIMENSION + DIMENSION
// DIMENSION - DIMENSION
// 单位永远以第一个为准
//@TODO 以后再修改为token流
// next: function(k){
//     k = k || 1;
//     // var cur = this.p,
//     //     marked = this.marked;
//     // this.p += k;//游标
//     // // var offset = k - 3;
//     // // if(offset > 0){ //如果超过了一轮
//     // //     while(offset--) this.tokenizer.lex();// discard这部分已经路过的token
//     // // }else{
//     // for(var i = 0; i < k ; i++){
//     //     var lex = marked === null && this.markstack.length? this.markstack.shift(): this.tokenizer.lex(); 
//     //     this.lookahead[(cur + i /* + 3*/ ) % 3] = lex;
//     //     if(marked !== null){
//     //         this.markstack.push(lex);
//     //     }
//     // }
//     // // }
// },
//      _
// ----------------------
//
    // range: function(){
    //     var left = this.ll(),
    //         node = new tree.Values(),
    //         right, lc, rc, reverse;
    //     this.match('DIMENSION')
    //     this.eat('..');
    //     right = this.ll();
    //     this.match(left.type);
    //     lc = left.value;
    //     rc = right.value;
    //     reverse = lc > rc;

    //     for(; lc != rc ;){
    //         node.list.push({
    //             type: left.type,
    //             value: lc
    //         })
    //         if(reverse)  lc -= 1
    //         else lc += 1
    //     }
    //     node.list.push({
    //         type: left.type,
    //         value: lc
    //     })
    //     return node;
    // },

    // type: 
    //  0 - defaults atkeyword start
    //  1 - $dollarIdent start
    // var: function(type){
    //     if(!type){
    //         this.next();
    //         this.match('WS');
    //     }
    //     var node = new tree.Variable(), 
    //         la, ll=this.ll();
    //     this.match('IDENT');
    //     this.match('WS');
    //     // this.markstack;
    //     // this.next(3);
    //     // var haha = this.ll()
    //     node.name = ll.value;
    //     node.value = this.componentValues();
    //     this.matcheNewLineOrSemeColon();
    //     return node;
    // },
    // mixin: function(){
    //     this.match('AT_KEYWORD');
    //     this.match('WS');
    //     var name = this.ll().value,
    //         params = [], param, block, rest = 0;

    //     if(!this.eat('FUNCTION') && !this.eat('IDENT')){
    //         this.error('expected FUNCTION or IDENT');
    //     }
    //     this.eat('WS');
    //     if(this.eat('(')){
    //         this.eat('WS');
    //         if(this.la() !== ')'){
    //             do{
    //                 param = this.param();
    //                 if(param.rest) rest ++;
    //                 params.push(param);
    //             }while(this.eat(','))
    //             if(rest >=2) this.error('can"t have more than 2 rest param');
    //             this.eat('WS');
    //         }
    //     }
    //     this.match(')');
    //     block = this.block();
    //     return new tree.Mixin(name, params, block);
    // },


    include: function(){
        var node = new tree.Include();
        this.match('AT_KEYWORD');
        this.match('WS');
        var ll = this.ll();
        if(ll.type ==='FUNCTION') ll.type = 'IDENT';
        node.name = this.expression();
        if(this.eat('(')){
            this.skipWSorNewlne();
            if(this.la() !== ')'){
                do{
                    node.params.push(this.componentValues(isCommaOrParen));
                    if(this.la() === ')') break;
                }while(this.eat(','))
            }
            this.match(')');
        }
        this.matcheNewLineOrSemeColon();
        node.scope = this.scope;
        return  node;
    },

    import: function(){
        var node = new tree.Import(),ll;
        this.match('AT_KEYWORD');
        this.match('WS');
        ll = this.ll();
        if(ll.type === 'URL' || ll.type === 'STRING'){
            node.url = ll.value;
            this.next()
        }else{
            this.error('expect URL or STRING' + ' got '+ ll.type);
        }
        this.eat('WS');
        // @TODO media query
        this.matcheNewLineOrSemeColon();
        var uid = _.uid();
        this.tasks += 1;
        var self = this;
        io.get(node.url, function(error, text){
            exports.parse(text, {}, function(err, ast){
                var list = self.ast.list, len = list.length;
                if(ast.list.length){
                    for(var i = 0; i < len; i++){
                        if(list[i] === uid){
                            var args;
                            if(node.assign){
                                var tmp = [new tree.Module(node.assign, 
                                        new tree.Block(ast.list))]


                            }else{
                                tmp = ast.list
                            }
                            args = [i,1].concat(tmp);
                            list.splice.apply(list, args);
                            break;
                        }
                    }
                }
                self._complete();
            })
        })

        return uid;
    },

    pointer: function(){
        var name = this.ll().value;
        var node = new tree.Pointer(name)
        this.match('IDENT');
        this.match('->');
        node.key = this.ll().value;
        if(!this.eat('IDENT') && !this.eat('FUNCTION')){
            this.error('invalid pointer')
        }
        // 1级够用 @TODO: 增加多极  加入parent即可
        // while(this.eat('->')){
        //     node.list.push(this.ll());
        //     this.match('IDENT');
        // }
        return node;
    },


// _.walk_include = function(ast){
//     var func;
//     var mixin = this.walk(ast.name), 
//         res, iscope, params;

//     if(!mixin) this.error('no ' + ast.name + ' defined');
//     this.expect(mixin, 'mixin')

//     iscope = new symtab.Scope();
//     params = this.walk(ast.params);

//     this.push(iscope);
//     var list = []
//     for(var i = 0 ; i < params.length; i++){
//         var formalName = (mixin.formalParams[i] && mixin.formalParams[i].name),def;
//         if(!params[i]){
//             continue;
//         }
//         if(i !== 0){
//             list.push({type:','});
//         }
//         list = list.concat(params[i].list);
//         // component values   ||  mixin
//         if(formalName){
//             this.define(formalName, new tree.Variable(formalName, params[i]))
//         }
//     }
//     this.define('arguments', new tree.Variable('arguments', 
//             new tree.ComponentValues(list)
//         ))
//     // console.log(this.resolve('arguments'), ast.name)
//     var block = tree.cloneNode(mixin.block);
//     ast = this.walk(block);
//     this.pop()
//     return ast;
// }


// /**
//  * -> 读取模块内信息
//  * @return {[type]} [description]
//  */
// _.walk_pointer = function(ast){
//     var module = this.resolve(ast.name);
//     if(!module) this.error('undefined module: "'+ast.name+'"')
//     this.expect(module, 'module')
//     var scope = module.scope;
//     var node = scope.resolve(ast.key);
//     if(!node) this.error('not "' + ast.key +'" in module:"'+ast.name+'"')
//     return node;
// }

    // module: function(){
    //     var node = new tree.Module(), url;
    //     this.match('AT_KEYWORD');
    //     this.eat('WS')
    //     if(this.la() !== '{'){// means url
    //         url = this.url();
    //     }
    //     if(url) {
    //         io.register({
    //             url: url,
    //             node: node,
    //             key: 'block'
    //         })
    //     }else{
    //         node.block = this.block();
    //     }
    //     return node;
    // },




// function RGBA(channels){
//     this.type = 'RGBA';
//     if(typeof channels === 'string'){
//         var string = channels.charAt(0) === '#'? channels.slice(1) : channels;
//         if (string.length === 6) {
//             channels = [
//                 parseInt(string.substr(0, 2), 16), 
//                 parseInt(string.substr(2, 2), 16), 
//                 parseInt(string.substr(4, 2), 16),
//                 1
//             ];
//         }else {
//             var r = string.substr(0, 1);
//             var g = string.substr(1, 1);
//             var b = string.substr(2, 1);
//             channels = [
//                 parseInt(r + r, 16), 
//                 parseInt(g + g, 16), 
//                 parseInt(b + b, 16), 
//                 1
//             ];
//         }
//     }
//     this.channels = channels || [];
// }

// RGBA.prototype.clone = function(){
//     var clone = new RGBA(cloneNode(this.channels));
//     return clone;
// }
// RGBA.prototype.tocss = function(){
//     var chs = this.channels;
//     console.log(chs)
//     if(chs[3] === 1 || chs[3] === undefined){
//         return 'rgb(' + chs[0] + ',' + chs[1] + ',' + chs[2] + ')';
//     }else{
//         return 'rgba(' + chs[0] + ',' + chs[1] + ',' + chs[2] + ',' + chs[3] +')';
//     }
// }

    // _add: function(actor1, actor2, op){
    //     var value, unit;

    //     if(actor1.unit){
    //         unit = actor1.unit;
    //     }else{
    //         unit = actor2.unit;
    //     }
    //     if(op === '+'){ //+
    //         value = actor1.value + actor2.value;
    //     }else{ //-
    //         value = actor1.value -actor2.value;
    //     }
    //     return {
    //         type: 'DIMENSION',
    //         value: value,
    //         unit: unit
    //     }

    // },
    // // DIMENSION * DIMENSION
    // // DIMENSION / DIMENSION
    // _mult: function(actor1, actor2, op){
    //     var unit, value;

    //     if(actor1.unit){
    //         unit = actor1.unit;
    //     }else{
    //         unit = actor2.unit;
    //     }

    //     if(op === '*'){ //+
    //         value = actor1.value * actor2.value;
    //     }else{ //-
    //         if(actor2.value === 0) this.error('can"t divid by zero');
    //         value = actor1.value / actor2.value;
    //     }
    //     return {
    //         type: 'DIMENSION',
    //         value: value,
    //         unit: unit
    //     }
    // },



    var render = new Function("vars", 'return "' + tag(block(template/*.replace(/"/g, '\\"').replace(/\n/g, '\\n')*/)) + '";');
    return vars === undefined ? render: render(vars);
    var get = function(path, i) {
      i = 1; path = path.replace(/\.\.\//g, function() { i++; return ''; });
      var js = ['vars[vars.length - ', i, ']'], keys = (path == "." ? [] : path.split(".")), j = 0;
      for (j; j < keys.length; j++) { js.push('.' + keys[j]); };
      return js.join('');
    }, tag = function(template) {
      return template.replace(/\{\{(!|&|\{)?\s*(.*?)\s*}}+/g, function(match, operator, context) {
        if (operator == "!") return '';
        var i = inc++;
        return ['"; var o', i, ' = ', get(context), ', s', i, ' = (((typeof(o', i, ') == "function" ? o', i, '.call(vars[vars.length - 1]) : o', i, ') || "") + ""); s += ',
          (operator ? ('s' + i) : '(/[&"><]/.test(s' + i + ') ? s' + i + '.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/>/g,"&gt;").replace(/</g,"&lt;") : s' + i + ')'), ' + "'
        ].join('');
      });
    }, block = function(template) {
      return tag(template.replace(/\{\{(\^|#)(.*?)}}(.*?)\{\{\/\2}}/g, function(match, operator, key, context) {
        var i = inc++;
        return ['"; var o', i, ' = ', get(key), '; ',
          (operator == "^" ?
            ['if ((o', i, ' instanceof Array) ? !o', i, '.length : !o', i, ') { s += "', block(context), '"; } '] :
            ['if (typeof(o', i, ') == "boolean" && o', i, ') { s += "', block(context), '"; } else if (o', i, ') { for (var i', i, ' = 0; i', i, ' < o',
              i, '.length; i', i, '++) { vars.push(o', i, '[i', i, ']); s += "', block(context), '"; vars.pop(); }}']
          ).join(''), '; s += "'].join('');
      }));
    }, inc = 0;

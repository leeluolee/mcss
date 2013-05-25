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

/**
 * #Symtable
 * 
 */



 var Symtable = exports.SymbolTable =  function(){

 }



/**
 * ## TODO:
 * 
 * 1. Global
 * 2. Local
 * 3. Struct
 * 4. AtMethod Scope
 */

 var Scope = exports.Scope = function(parentScope){
    // this.scopeName = scopeName;
    this.parentScope = parentScope;
    this.symtable = {};
 }

 Scope.prototype = {
    resolve: function(name){
        var scope = this;
        while(scope){
            var symbol = scope.symtable[name];
            if(symbol) return symbol;
            else scope = scope.parentScope;
        }
        return this.symtable[name];
    },
    define: function(name, value){
        this.symtable[name] = value;
        return this;
    },
    getOuterScope: function(){
        return this.parentScope;
    }
 }


 // Struct symblo{
 //     type: variable| mixin
 //     name: name
 //     value: node;
 // }
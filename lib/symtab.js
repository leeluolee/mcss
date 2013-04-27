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

 var Scope = exports.Scope = function(scopeName, parentScope){
    this.parentScope = parentScope;
    var symtable = new Symtable();
 }

 Scope.prototype = {
    resolve: function(name){
        this.symtable.resolve();
    },
    define: function(){
        this.symtable.define();
    },
    getOuterScope: function(){
        return this.parentScope;
    }
 }
/* Exclusive operation ownership. A stale completion cannot release a newer job. */
(function(root){
class Operations {
 constructor(){this.current=null;this.listeners=new Set()}
 get busy(){return this.current!==null}
 get state(){return this.current?.state||'idle'}
 emit(){for(const fn of this.listeners)fn({state:this.state,busy:this.busy})}
 subscribe(fn){this.listeners.add(fn);fn({state:this.state,busy:this.busy});return ()=>this.listeners.delete(fn)}
 begin(state){if(this.busy)throw Error('請先完成目前作業。');const token=Symbol(state);this.current={token,state};this.emit();let ended=false;return {set:next=>{if(!ended&&this.current?.token===token){this.current.state=next;this.emit()}},end:()=>{if(ended)return;ended=true;if(this.current?.token===token){this.current=null;this.emit()}}}}
}
root.ClassCastOperations=new Operations();root.ClassCastOperationsClass=Operations;if(typeof module!=='undefined')module.exports=Operations;
})(globalThis);

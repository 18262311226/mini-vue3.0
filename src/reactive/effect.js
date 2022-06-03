import {ITERATE_KEY} from './reactive'

let activeEffect = null //当前要执行的副作用函数
let effectStack = [] //存放副作用函数栈

//副作用函数
export function effect(fn, options = {}){
    let effectfn = function (){
        cleanup(effectfn)
        activeEffect = effectfn
        effectStack.push(effectfn)
        const res = fn() //执行回调
        effectStack.pop() //当前副作用函数执行操作完成，将栈顶元素删除
        activeEffect = effectStack[effectStack.length - 1] //将栈顶的副作用函数设为当前
        return res //返回副作用函数执行结果，方便computed，watch使用
    }
    effectfn.options = options
    effectfn.deps = []
    if(!options.lazy){ //是否延迟执行
        effectfn()
    }
    return effectfn //返回effectfn，方便手动执行
}

//清空对应得副作用函数
function cleanup(effectfn){
    for(let i = 0;i<effectfn.deps.length;i++){
        let deps = effectfn.deps[i]
        deps.delete(effectfn)
    }
    effectfn.deps.length = 0
}

//副作用函数桶
let bucket = new WeakMap()

//用于收集对于属性的副作用函数
export function track(target,key){
    if(!activeEffect){ //没有副作用函数则直接跳出
        return
    }
    let depsMap = bucket.get(target) //取出对应的响应式对象
    if(!depsMap){
        bucket.set(target, depsMap = new Map()) //没有的话，则创建一个以target为key的map对象用来存储
    }

    let deps = depsMap.get(key) //获取以对象上key作为存储的set数据
    if(!deps){
        depsMap.set(key, deps = new Set()) //没有的话同样进行创建
    }

    deps.add(activeEffect) //将副作用函数存储到该set数据里
    activeEffect.deps.push(deps) //同样该副作用函数也要添加这个set
}


//用于触发对应属性的副作用函数
export function trigger(target,key,type, value){
    let depsMap = bucket.get(target)
    if(!depsMap){
        return
    }
    let effects = depsMap.get(key) //拿到所有副作用函数
    let effectsToRun = new Set() //用来存储所有要执行的副作用函数

    effects && effects.forEach(effectfn => {
        if(effectfn !== activeEffect){ //要执行的副作用函数和当前副作用函数不是同一个进行添加
            effectsToRun.add(effectfn)
        }
    })

    //是添加或者删除操作
    if(type === 'ADD' || type === 'DELETE'){
        let iterateEffects = depsMap.get(ITERATE_KEY) //拿到对应的副作用函数
        iterateEffects && iterateEffects.forEach(effectfn => {
            if(effectfn !== activeEffect){
                effectsToRun.add(effectfn)
            }
        })
    }

    //拿到对数组length进行操作的
    if(type === 'ADD' && Array.isArray(target)){
        let lengthEffects = depsMap.get('length')
        lengthEffects && lengthEffects.forEach(effectfn => {
            if(effectfn !== activeEffect){
                effectsToRun.add(effectfn)
            }
        })
    }

    //拿到对数组下标或长度进行操作的
    if(Array.isArray(target) && key === 'length'){
        depsMap.forEach((effects,key)=>{
            if(key <= value){
                effects.forEac(effectfn => {
                    if(effectfn !== activeEffect){
                        effectsToRun.add(effectfn)
                    }
                })
            }
        })
    }
    
    //将副作用函数依次执行
    effectsToRun.forEach(effectfn => {
        if(effectfn.options.scheduler){
            effectfn.options.scheduler(effectfn)
        }else{
            effectfn()
        }
    })
}
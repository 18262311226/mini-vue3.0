'use strict';

let activeEffect = null; //当前要执行的副作用函数
let effectStack = []; //存放副作用函数栈

//副作用函数
function effect(fn, options){
    let effectfn = function (){
        cleanup(effectfn);
        activeEffect = effectfn;
        effectStack.push(effectfn);
        const res = fn(); //执行回调
        effectStack.pop(); //当前副作用函数执行操作完成，将栈顶元素删除
        activeEffect = effectStack[effectStack.length - 1]; //将栈顶的副作用函数设为当前
        return res //返回副作用函数执行结果，方便computed，watch使用
    };
    effectfn.options = options;
    effectfn.deps = [];
    if(!options.lazy){ //是否延迟执行
        effectfn();
    }
    return effectfn //返回effectfn，方便手动执行
}

//清空对应得副作用函数
function cleanup(effectfn){
    for(let i = 0;i<effectfn.deps.length;i++){
        let deps = effectfn.deps[i];
        deps.delete(effectfn);
    }
    effectfn.deps.length = 0;
}

//副作用函数桶
let bucket = new WeakMap();

//用于收集对于属性的副作用函数
function track(target,key){
    if(!activeEffect){ //没有副作用函数则直接跳出
        return
    }
    let depsMap = bucket.get(target); //取出对应的响应式对象
    if(!depsMap){
        bucket.set(target, depsMap = new Map()); //没有的话，则创建一个以target为key的map对象用来存储
    }

    let deps = depsMap.get(key); //获取以对象上key作为存储的set数据
    if(!deps){
        depsMap.set(key, deps = new Set()); //没有的话同样进行创建
    }

    deps.add(activeEffect); //将副作用函数存储到该set数据里
    activeEffect.deps.push(deps); //同样该副作用函数也要添加这个set
}


//用于触发对应属性的副作用函数
function trigger(target,key,type, value){
    let depsMap = bucket.get(target);
    if(!depsMap){
        return
    }
    let effects = depsMap.get(key); //拿到所有副作用函数
    let effectsToRun = new Set(); //用来存储所有要执行的副作用函数

    effects && effects.forEach(effectfn => {
        if(effectfn !== activeEffect){ //要执行的副作用函数和当前副作用函数不是同一个进行添加
            effectsToRun.add(effectfn);
        }
    });

    //是添加或者删除操作
    if(type === 'ADD' || type === 'DELETE'){
        let iterateEffects = depsMap.get(ITERATE_KEY); //拿到对应的副作用函数
        iterateEffects && iterateEffects.forEach(effectfn => {
            if(effectfn !== activeEffect){
                effectsToRun.add(effectfn);
            }
        });
    }

    //拿到对数组length进行操作的
    if(type === 'ADD' && Array.isArray(target)){
        let lengthEffects = depsMap.get('length');
        lengthEffects && lengthEffects.forEach(effectfn => {
            if(effectfn !== activeEffect){
                effectsToRun.add(effectfn);
            }
        });
    }

    //拿到对数组下标或长度进行操作的
    if(Array.isArray(target) && key === 'length'){
        depsMap.forEach((effects,key)=>{
            if(key <= value){
                effects.forEac(effectfn => {
                    if(effectfn !== activeEffect){
                        effectsToRun.add(effectfn);
                    }
                });
            }
        });
    }
    
    //将副作用函数依次执行
    effectsToRun.forEach(effectfn => {
        if(effectfn.options.scheduler){
            effectfn.options.scheduler(effectfn);
        }else {
            effectfn();
        }
    });
}

let proxys = new Set();
const ITERATE_KEY = Symbol();

//创建响应式数据
function createReactive(obj, isShallow = false, isReadyonly = false){
    //判断是否式对象且不为null
    if(obj == null || typeof obj !== 'object'){
        throw new Error('is not a Object')
    }

    //判断该对象是否已经是响应式数据
    if(proxys.has(obj)){
        return
    }

    //创建代理对象
    let proxy = new Proxy(obj, {
        get(target,key){
            if(key === 'raw'){
                return target
            }

            //不是只读数据，则收集副作用函数
            if(!isReadyonly){
                track(target,key, receiver); 
            }

            const res = Reflect.get(target, key, receiver);

            //是浅响应式数据则直接返回该数据，不做处理
            if(isShallow){
                return res
            }

            if(typeof res === 'object' && res !== null){//如果是该数据还是对象，则对他进行处理
                return isReadyonly ? readonly(res) : reactive(res) //判断舒服只读，如果是则将它转换为只读数据 不是则继续递归转换为响应式
            }

            return res
        },
        set(target,key,value,receiver){            //只读属性则直接给警告，程序不向下执行
            if(isReadyonly){
                console.warn(`属性 ${key} 是只读的`);
                return true
            }

            //判断数据是否为数组，如果是则判断下标是否小于数组长度，小于则是设置，反之添加， 不是数组，就当对象处理，判断key存不存在，不存在则是添加，反之就是设置
            const type = Array.isArray(target) ? Number(key) < target.length  ? 'SET' : 'ADD' : Object.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';
            let oldVal = target[key]; //拿到老值

            const res = Reflect.set(target, key, value, receiver);

            if(target === receiver.key){
                //值不相同才进行触发副作用函数
                if(oldVal !== value && (oldVal === oldVal || value === value)){
                    trigger(target,key,type,value);
                }
            }
            
            return res
        },
        deleteProperty(target, key){
            //判断属性是否存在
            const hasKey = Object.hasOwnProperty.call(target, key);

            if(isReadyonly){
                console.warn(`属性 ${key} 是只读的`);
                return true
            }

            const res =  Reflect.deleteProperty(target, key); //删除属性

            if(hasKey && res){//属性存在且删除成功才触发副作用函数
                trigger(target, key, 'DELETE');
            }

            return res
        },
        has(target,key){//对 in 操作符进行监听
            track(target,key);
            return Reflect.has(target,key)
        },
        ownKeys(target){ //for in 操作进行监听
            track(target, ITERATE_KEY);
            return Reflect.ownKeys(target)
        }
    });

    proxys.add(proxy); //添加到set中，方便进行判断数据是否已是响应式数据

    return proxy //返回代理对象
}

//创建深响应式数据
function reactive(obj){
    return createReactive(obj)
}

//创建浅响应式数据
function shallowReactive(obj){
    return createReactive(obj, true)
}

//创建只读响应式数据
function readonly(obj){
    return createReactive(obj, false, true)
}

const Text = Symbol(); //文本节点
const Fragment = Symbol();

function normalizeClass(data){
    let str = '';
    let arr = [];
    if(!Array.isArray(data)){
        arr.push(data);
    }else {
        arr = data;
    }
    for(let i = 0;i < arr.length;i++){
        let value = arr[i];
        if(typeof value === 'string'){
            if(i < arr.length - 1){
                str += value + ' ';
            }else {
                str += value; 
            }
        }else {
            for(let key in value){
                if(value[key]){
                    str += key + ' ';
                }
            }
        }
    }
    return str
}

const queue = new Set();
let isFlushing = false;
const p = Promise.resolve();

function QueueJob(job){
    queue.add(job);
    if(!isFlushing){
        isFlushing = true;
        p.then(() => {
            try{
                queue.forEach(job => job());
            }finally{
                isFlushing = true;
                queue.length = 0;
            }
        });
    }
}

function resolveProps(options, propsData){
    const props = {};
    const attrs = {};

    for(let key in propsData){
        if(key in options){
            props[key] = propsData[key];
        }else {
            attrs[key] = propsData[key];
        }
    }

    return [props, attrs]
}

function mountComponent(vnode, container, anchor){
    const componentOptions = vnode.type;
    const {render, data, setup, props: propsOption, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated} = componentOptions;

    beforeCreate && beforeCreate();

    const state = data ? reactive(data()) : null;
    const [props, attrs] = resolveProps(propsOption, vnode.props);

    const instance = {
        state,
        props: shallowReactive(props),
        isMounted: false,
        subTree: null
    };

    function emit(event, ...payload){

    }

    const setupContext = { attrs, emit };
    const setupResult = setup(shallowReactive(props), setupContext);
    let setupState = null;

    if(typeof setupResult === 'function'){
        if(render){
            console.error('setup返回渲染函数，render选项将被忽略');
        }

        render = setupResult;
    }else {
        setupState = setupContext;
    }

    vnode.component = instance;

    const renderContext = new Proxy(instance, {
        get(t, k, r){
            const {state, props} = t;
            if(state && k in state){
                return state[k]
            }else if(k in props){
                return props[k]
            }else if(setupState && k in setupState){
                return setupState[k]
            }else {
                console.error('不存在');
            }
        },
        set(t, k, v, r){
            const {state, props} = t;
            if(state && k in state){
                state[k] = v;
            }else if(k in props){
                props[k] = v;
            }else if(setupState && k in setupState){
                setupState[k] = v;
            }else {
                console.error('不存在');
            }
        }
    });

    created && created.call(renderContext);

    effect(()=>{
        const subTree = render.call(state, state);
        if(!instance.isMounted){
            beforeMount && beforeMount.call(renderContext);

            patch(null, subTree, container, anchor);

            instance.isMounted = true;
            mounted && mounted.call(renderContext);
        }else {
            beforeUpdate && beforeUpdate.call(renderContext);

            patch(instance.subTree, subTree, container, anchor);

            updated && updated.call(renderContext);
        }
        instance.subTree = subTree;
    },{
        scheduler: QueueJob
    });
}

function hasPropsChange(prevProps, nextProps){
    const nextKey = Object.keys(nextProps);

    if(nextKey.length !== Object.keys(prevProps).length){
        return true
    }

    for(let i = 0;i < nextKey.length;i++){
        const key = nextKey[i];
        if(nextProps[key] !== prevProps[key]){
            return true
        }
    }

    return false
}

function patchComponent(n1, n2, anchor){
    const instance = (n2.component = n1.component);

    const {props} = instance;

    if(hasPropsChange(n1.props, n2.props)){
        const [nextProps] = resolveProps(n2.type.props, n2.props);

        for(let k in nextProps){
            props[k] = nextProps[k];
        }

        for(let k in props){
            if(!(k in nextProps)){
                delete props[k];
            }
        }
    }
}

function createRender(){
    function patch(n1, n2, container, anchor){
        if(n1 && n1.type !== n2.type){
            unmount(n1);
            n1 = null;
        }

        const {type} = n2;
        if(typeof type === 'string'){
            if(!n1){
                mountElement(n2, container, anchor);
            }else {
                patchElement(n1, n2);
            }
        }else if(type === Text){
            if(!n1){
                const el = n2.el = createTextNode(n2.children);
                insert(container, el);
            }else {
                const el = n2.el = n1.el;
                if(n2.children !== n1.children){
                    setText(el, n2.children);
                }
            }
        }else if(type === Fragment){
            if(!n1){
                n2.children.forEach(c => patch(null, c, container));
            }else {
                patchChildren(n1, n2, container);
            }
        }else if(typeof type === 'object'){
            if(!n1){
                mountComponent(n2, container, anchor);
            }else {
                patchComponent(n1, n2);
            }
        }else;
        
    }

    //挂载
    function mountElement(vnode, container,anchor){
        let el = vnode.el = createElement(vnode.type);

        if(typeof vnode.children === 'string'){
            setElementText(el,vnode.children);
        }else {
            vnode.children.forEach(child => {
                patch(null,child,el,anchor);
            });
        }
        
        if(vnode.props){
            for(let key in vnode.props){
                patchProps(el,key, null, vnode.props[key]);
            }
        }

        insert(el, container,anchor);
    }

    //对比虚拟dom
    function patchElement(n1, n2){
        const el = n2.el = n1.el;
        const oldProps = n1.props || {};
        const newProps = n2.props || {};

        for(let key in newProps){
            if(newProps[key] !== oldProps[key]){
                patchProps(el,key, oldProps[key], newProps[key]);
            }
        }

        for(let key in oldProps){
            if(!(key in newProps)){
                patchProps(el,key,oldProps[key], null);
            }
        }

        patchChildren(n1,n2,el);
    }

    function patchChildren(n1,n2,container){
        if(typeof n2.children === 'string'){
            if(Array.isArray(n1.children)){
                n1.children.forEach(c => unmount(c));
            }

            setElementText(container, n2.children);
        }else if(Array.isArray(n2.children)){
            const oldChildren = n1.children;
            const newChildren = n2.children;

            const oldLen = oldChildren.length;
            const newLen = newChildren.length;
            const commonLen = Math.min(oldLen,newLen);
            if(oldChildren[0].key && newChildren[0].key){
                patchKeyedChildren(n1, n2, container);
            }else {
                for(let i = 0;i < commonLen;i++){
                    patch(oldChildren[i], newChildren[i]);
                }

                if(newLen > oldLen){
                    for(let i = commonLen;i < newLen;i++){
                        patch(null, newChildren[i], container);
                    }
                }else if(newLen < oldLen){
                    for(let i = commonLen;i < oldLen;i++){
                        unmount(oldChildren[i]);
                    }
                }
            }
        }else {
            if(Array.isArray(n1.children)){
                n1.children.forEach(c => unmount(c));
            }else if(typeof n1.children === 'string'){
                setElementText(container, '');
            }
        }
    }

    //快速diff算法
    function patchKeyedChildren(n1, n2, container){
        const newChildren = n2.children;
        const oldChildren = n1.children;

        let j = 0;
        let oldVNode = oldChildren[j];
        let newVNode = newChildren[j];

        while(oldVNode.key === newVNode.key){
            patch(oldVNode, newVNode, container);
            j++;
            oldVNode = oldChildren[j];
            newVNode = newChildren[j];
        }

        let oldEnd = oldChildren.length - 1;
        let newEnd = newChildren.length - 1;

        oldVNode = oldChildren[oldEnd];
        newVNode = newChildren[newEnd];

        while(oldVNode.key === newVNode.key){
            patch(oldVNode, newVNode, container);
            oldEnd--;
            newEnd--;
            oldVNode = oldChildren[oldEnd];
            newVNode = newChildren[newEnd];
        }

        if(j <= newEnd && j > oldEnd){
            const anchorIndex = newEnd + 1;
            const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;

            while(j <= newEnd){
                patch(null, newChildren[j++], container, anchor);
            }
        }else if(j > newEnd && j <= oldEnd){
            while(j <= oldEnd){
                unmount(oldChildren[j++]);
            }
        }else {
            const count = newEnd + j + 1;
            const source = new Array(count);
            source.fill(-1);

            const oldStart = j;
            const newStart = j;

            const keyIndex = {};
            let moved = false;
            let pos = 0;
            for(let i = newStart;i <= newEnd;i++){
                keyIndex[newChildren[i].key] = i;
            }

            let patched = 0;

            for(let i = oldStart;i <= oldEnd;i++){
                oldVNode = oldChildren[i];
                if(patched <= count){
                    const k = keyIndex[oldVNode.key];
                    if(k !== 'undefined'){
                        newVNode = newChildren[k];
                        patch(oldVNode, newVNode, container);
                        patched++;
                        source[k - newStart] = i;
                        if(k < pos){
                            moved = true;
                        }else {
                            pos = k;
                        }
                    }else {
                        unmount(oldVNode);
                    }
                }else {
                    unmount(oldVNode);
                }
            }

            if(moved){
                const seq = getSequence(source);
                let s = seq.length - 1;
                let i = count - 1;

                for(i;i >= 0;i--){
                    if(source[i] === -1){
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        const nextPos = pos + 1;
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        patch(null, newVNode, container, anchor);
                    }else if(i !== seq[s]){
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        const nextPos = pos + 1;
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        insert(newVNode.el, container, anchor);
                    }else {
                        s--;
                    }
                }
            }
        }
    }

    //最长上升子序列算法
    function getSequence(arr){
        const p = arr.slice();
        const result = [0];
        let i,j,u,v,c;
        const len = arr.length;

        for(i = 0;i < len;i++){
            const arrI = arr[i];

            if(arrI !== 0){
                j = result[result.length - 1];
                if(arr[j] < arrI){
                    p[i] = j;
                    result.push(i);
                    continue
                }

                u = 0;
                v = result.length - 1;

                while(u < v){
                    c = ((u + v) / 2) | 0;
                    if(arr[result[c]] < arrI){
                        u = c + 1;
                    }else {
                        v = c;
                    }
                }

                if(arrI < arr[result[u]]){
                    if(u > 0){
                        p[i] = result[u - 1];
                    }
                    result[u] = i;
                }
            }
        }

        u = result.length;
        v = result[u - 1];

        while(u-- > 0){
            result[u] = v;
            v = p[v];
        }

        return result
    }

    //卸载
    function unmount(vnode){
        if(vnode.type === Fragment){
            vnode.children.forEach(c => unmount(c));
            return
        }

        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
    }

    //更新属性
    function patchProps(el, key, prevValue, nextValue){
        if(/^on/.test(key)){
            let invokers = el._vei || (el._vei = {});
            let invoker = invokers[key];
            const name = key.slice(2).toLowerCase();
            if(nextValue){
                if(!invoker){
                    invoker = el._vei[key] = (e) => {
                        if(e.timeStamp < invoker.attached) return
                        if(Array.isArray(invoker.value)){
                            invoker.value.forEach(fn => fn(e));
                        }else {
                            invoker.value(e);
                        }
                    };
                    invoker.value = nextValue;
                    invoker.attached = Performance.now();
                    el.addEventListener(name, invoker);
                }else {
                    invoker.value = nextValue;
                }
            }else if(invoker){
                el.removeEventListener(name, invoker);
            }
        }else if(key === 'class'){
            el.className = nextValue || '';
        }else if(shouldSetAsProps(el,key)){
            let type = typeof el[key];
            if(type === 'boolean' && value === ''){
                el[key] = true;
            }else {
                el[key] = nextValue;
            }
        }else {
           el.setAttribute(key, nextValue); 
        }
    }

    function render(vnode, container){
        if(vnode){
            patch(container._vnode, vnode, container);
        }else {
            if(container._vnode){
                unmount(container._vnode);
            }
        }

        container._vnode = vnode;
    }

    return {
        render
    }
}

function shouldSetAsProps(el, key, value){
    if(key === 'form' && el.tagName === 'INPUT'){
        return false
    }
    
    return key in el
}

function createElement(tag){
    return document.createElement(tag)
}

function setElementText(el, text){
    el.textContent = text;
}

function insert(el, parent, anchor = null){
    parent.insertBefore(el, anchor);
}

function createTextNode(text){
    return document.createTextNode(text)
}

function setText(el,text){
    el.nodeValue = text;
}

const renderer = createRender();

({
    type: 'div',
    props:{
        id: 'foo'
    },
    children: [
        {
            type: 'p',
            props:{
                class: normalizeClass([
                    'zoo',
                    {
                        bar: true,
                        foo: false
                    }
                ])
            },
            children: 'hello'
        }
    ]
});

({
    type: 'div',
    props:{
        id: 'foo',
        class:normalizeClass({
            zoo: true
        })
    },
    children: [
        {
            type: 'p',
            props:{
                class: normalizeClass([
                    'zoo',
                    {
                        bar: true,
                        foo: false,
                        go: true
                    }
                ])
            },
            children: 'hello'
        }
    ]
});

let vnode4 = {
    type: 'div',
    children:[
        {type: 'p', children: 'p1', key: 1},
        {type: 'p', children: 'p2', key: 2},
        {type: 'p', children: 'p3', key: 3}
    ]
};

let vnode5 = {
    type: 'div',
    children:[
        {type: 'div', props: {class: 'bar'}, children: 'p3', key: 3},
        {type: 'p', children: 'p1', key: 1},
        {type: 'p', children: 'p2', key: 2},
        {type: 'p', children: 'p4', key: 4}
    ]
};

renderer.render(vnode4, document.querySelector('#app'));


setTimeout(() => {
    renderer.render(vnode5, document.querySelector('#app'));
},2000);

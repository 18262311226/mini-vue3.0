import { reactive } from "./reactive/reactive";
import {computed} from './reactive/computed'
import {watch} from './reactive/watch'
import {ref} from './reactive/ref'
import {createRender} from './runtime/renderer'
import { normalizeClass } from "./runtime/vnode";

const renderer = createRender()
let vnode = {
    type: 'div',
    children: [
        {
            type: 'p',
            children: 'hello'
        }
    ]
}

let vnode1 = {
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
}

let vnode2 = {
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
}

let vnode3 = {
    type: 'div',
    props:{
        onClick: () => {
            console.log('click')
        },
        onContextmenu: () => {
            alert('2121')
        }
    },
    children: 'text'
}

let vnode4 = {
    type: 'div',
    children:[
        {type: 'p', children: 'p1', key: 1},
        {type: 'p', children: 'p2', key: 2},
        {type: 'p', children: 'p3', key: 3}
    ]
}

let vnode5 = {
    type: 'div',
    children:[
        {type: 'div', props: {class: 'bar'}, children: 'p3', key: 3},
        {type: 'p', children: 'p1', key: 1},
        {type: 'p', children: 'p2', key: 2},
        {type: 'p', children: 'p4', key: 4}
    ]
}

renderer.render(vnode4, document.querySelector('#app'))


setTimeout(() => {
    renderer.render(vnode5, document.querySelector('#app'))
},2000)

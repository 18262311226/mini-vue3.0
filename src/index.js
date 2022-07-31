import { reactive } from "./reactive/reactive";
import {computed} from './reactive/computed'
import {watch} from './reactive/watch'
import {ref} from './reactive/ref'
import {createRender} from './runtime/renderer'
import { normalizeClass } from "./runtime/vnode";
import {compile} from './compile/compile'

const renderer = createRender()

let template = `13233<a></a>`

const root = compile(template)
console.log(root)

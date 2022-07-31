import { parse } from './parse.js'

export function compile (template) {
    let ast = parse(template)

    return ast
}

console.log(compile("a3321<a></a>"))
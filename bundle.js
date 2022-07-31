'use strict';

Promise.resolve();

let NodeType = {
    TEXT: 1
};

function createParseContext(template){
    return {
        line: 1, //行
        column: 1, //列
        offset: 0, //偏移量
        source: template,
        originalSource: template
    }
}

function isEnd (context) {
    const source = context.source;
    return !source
}

function getCursor (context) {
    let {line, column, offset} = context;
    return {
        line,
        column,
        offset
    }
}

function advancePositionWithMutation (context, source, endIndex) {
    let lineCount = 0;
    let linePos = -1;

    for (let index = 0; index < endIndex; i++) {
        if (source.charCodeAt(i) === 10) {
            lineCount++;
            linePos = i;
        }
    }
    context.line += lineCount;
    context.column = linePos == -1 ? context.column + endIndex : endIndex - linePos;
}

function advanceBy (context, endIndex) {
    let source = context.source;
    advancePositionWithMutation(context, source, endIndex);

    context.source = source.slice(endIndex);
}

function parseTextData (context, endIndex) {
    const rawText = context.source.slice(0,endIndex);
    advanceBy(context, endIndex);

    return rawText
}

function getSelection (context, start, end = "") {
    end = end || getCursor(context);

    return {
        start,
        end,
        source: context.originalSource.slice(start, end)
    }
}

function parseText (context) {
    let endTokens = ["<", "{{"];
    let endIndex = context.source.length;

    for (let i = 0;i < endTokens.length;i++) {
        let index = context.source.indexOf(endTokens[i], 1);
        
        if (index != -1 && endIndex > index) {
            endIndex = index;
        }
    }

    let start = getCursor(context); // 创建行列信息
    //取内容
    let content = parseTextData(context, endIndex);
    //获取结束的位置

    return {
        type: NodeType.TEXT,
        content: content,
        loc: getSelection(context, start)
    }
}

function parse (template) {
    const context = createParseContext(template);

    let nodes = [];
    while (!isEnd(context)) {
        let node;
        let source = context.source;
        if (source.startsWith("{{")) ;else if (source[0] === "<") ;

        if (!nodes) {
            node = parseText(context);
        }

        nodes.push(node);
    }

    return nodes
}

function compile (template) {
    let ast = parse(template);

    return ast
}

let template = `13233<a></a>`;

const root = compile(template);
console.log(root);

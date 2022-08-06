let NodeType = {
    TEXT: 1
}

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
    const source = context.source
    if (context.source.startsWith("</")) {
        return true
    }
    return !source
}

function getCursor (context) {
    let {line, column, offset} = context
    return {
        line,
        column,
        offset
    }
}

function advancePositionWithMutation (context, source, endIndex) {
    let lineCount = 0
    let linePos = -1

    for (let i = 0; i < endIndex; i++) {
        if (source.charCodeAt(i) === 10) {
            lineCount++
            linePos = i
        }
    }
    context.line += lineCount
    context.offset += endIndex
    context.column = linePos == -1 ? context.column + endIndex : endIndex - linePos
}

function advanceBy (context, endIndex) {
    let source = context.source
    advancePositionWithMutation(context, source, endIndex)

    context.source = source.slice(endIndex)
}

function advanceBySpaces (context) {
    let match = /^[ \t\r\n]+/.exec(context.source)
    if(match){
        advanceBy(context, match[0].length)
    }
}

function parseTextData (context, endIndex) {
    const rawText = context.source.slice(0,endIndex)
    advanceBy(context, endIndex)

    return rawText
}

function getSelection (context, start, end) {
    end = end || getCursor(context)

    return {
        start,
        end,
        source: context.originalSource.slice(start.offset, end.offset)
    }
}

function parseText (context) {
    let endTokens = ["<", "{{"]
    let endIndex = context.source.length

    for (let i = 0;i < endTokens.length;i++) {
        let index = context.source.indexOf(endTokens[i], 1)
        
        if (index != -1 && endIndex > index) {
            endIndex = index
        }
    }

    let start = getCursor(context) // 创建行列信息
    //取内容
    let content = parseTextData(context, endIndex)
    //获取结束的位置
    return {
        type: NodeType.TEXT,
        content: content,
        loc: getSelection(context, start)
    }
}

function parseInterpolation (context) {
    const start = getCursor(context)
    const closeIndex = context.source.indexOf("}}", "{{".length)

    advanceBy(context, 2)

    const innerStart = getCursor(context)
    const innerEnd = getCursor(context)

    const rawContextLength = closeIndex - 2
    let preContent = parseTextData(context, rawContextLength)
    let content = preContent.trim()
    let startOffset = preContent.indexOf(content)

    if(startOffset > 0) {
        advancePositionWithMutation(innerStart, preContent, startOffset)
    }

    let endOffset = startOffset - content.length
    advancePositionWithMutation(innerEnd, preContent, endOffset)
    advanceBy(context, 2)

    return {
        type: NodeType.INTERPOLATION,
        content: {
            type: NodeType.SIMPLE_EXPRESSION,
            content,
            loc: getSelection(context, innerStart, innerEnd)
        },
        loc: getSelection(context, start)
    }
}

function parseAttributeValue (context) {
    const start = getCursor(context)

    let quote = context.source[0]
    let content
    if (quote == '"' || quote == "'") {
        advanceBy(context, 1)
        const endIndex = context.source.indexOf(quote)
        content = parseTextData(context,endIndex)
        advanceBy(context, 1)
    }

    return {
        content,
        loc: getSelection(context, start)
    }
}

function parseAttribute (context) {
    const start = getCursor(context)
    let match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)
    let name = match[0]

    advanceBy(context, name.length)
    advanceBySpaces(context)
    advanceBy(context, 1)

    let value = parseAttributeValue(context)

    return {
        type: NodeType.ATTRIBUTE,
        name,
        value: {
            type: NodeType.TEXT,
            ...value
        },
        loc: getSelection(context, start)
    }
}

function parseAttributes (context) {
    const props = []

    while (context.source.length > 0 && !context.source.startsWith(">")) {
        const prop = parseAttribute(context)
        props.push(prop)
        advanceBySpaces(context)
    }


    return props
}

function parseTag (context) {
    const start = getCursor(context)

    const match = /^<\/?([a-z][^ \t\r\n/>]*)/.exec(context.source)
    const tag = match[1]

    advanceBy(context, match[0].length)
    advanceBySpaces(context)

    let props = parseAttributes(context)

    let isSelfClosing = context.source.startsWith("/>")

    advanceBy(context, isSelfClosing ? 2 : 1)

    return {
        type: NodeType.ELEMENT,
        tag,
        isSelfClosing,
        children: [],
        loc: getSelection(context, start)
    }
}

function parseElement (context) {
    let ele = parseTag(context)

    let children = parseChildren(context)

    if (context.source.startsWith("</")) {
        parseTag(context)
    }

    ele.loc = getSelection(context, ele.loc.start)
    ele.children = children

    return ele
}

function parseChildren (context) {
    let nodes = []
    while (!isEnd(context)) {
        let node
        let source = context.source
        if (source.startsWith("{{")) {
            node = parseInterpolation(context)
        }else if (source[0] === "<") {
            node = parseElement(context)
        }

        if (!node) {
            node = parseText(context)
        }

        nodes.push(node)
        break
    }

    return nodes
}

function parse (template) {
    const context = createParseContext(template)

    return parseChildren(context)
}

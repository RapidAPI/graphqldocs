import {
  DynamicString,
  DynamicStringComponent,
  DynamicValue,
  GraphQLDynamicValueType,
  GraphQLVariablesType,
  Paw,
} from 'types/paw.d'
import qs from 'qs'
import { format } from 'graphql-formatter'
import config from '../paw.config'

export type DynamicStringComponentPairType = [
  DynamicStringComponent,
  DynamicStringComponent,
]

const { identifier, title, inputs, fileExtensions } = config

function parseJson<T>(value: string) {
  /**
   * Inactive Object key:values are commented inside a string with `/* ... *\/`
   * which will always fail to JSON parse thus not returning an accurate output
   *
   * The regex on works on matching `/* ... *\/`, when a key is disabled in
   * a nested object, the comment  gets nested as well, since the regex doesn't
   * catch that, calling Json parse will aiways fail.
   */
  const regex = /(\/\*(?:(?!\/\*|\*\/)[\s\S])*\*\/|(\/\*|\*\/))/g
  const content = value.replace(regex, '')
  try {
    return JSON.parse(content)
  } catch (error: unknown) {
    return value
  }
}

function template(
  language: string,
  content: string,
  title: string = 'More info',
  collapsed: boolean = false,
): string {
  let tmpl = ''
  tmpl += '```' + language + '\n'
  tmpl += content
  tmpl += '\n```'
  if (collapsed) {
    let wrap = '\n<details>\n'
    wrap += `<summary>${title}</summary>\n\n`
    wrap += tmpl
    wrap += '\n</details>\n\n'
    return wrap
  }
  return tmpl
}

export default class GraphQLDocGenerator implements Paw.Generator {
  public static title = title
  public static inputs = inputs
  public static identifier = identifier
  public static languageHighlighter = 'markdown'
  public static fileExtension = 'md'
  public static fileExtensions = [...fileExtensions]

  private ctx!: Paw.Context

  private requestHeaderRegx = [
    /(<!--.?request:headers(:collapsed)?.?-->)/gm,
    /(<!--.?request:headers.?-->)/gm,
    /(<!--.?request:headers:collapsed.?-->)/gm,
  ]

  private requestParamsRegx = [
    /(<!--.?request:(urlparameters|urlparams)(:collapsed)?.?-->)/g,
    /(<!--.?request:(urlparameters|urlparams)?.?-->)/g,
    /(<!--.?request:(urlparameters|urlparams):collapsed.?-->)/g,
  ]

  private requestBodyRegx = [
    /(<!--.?request:body(:collapsed)?.?-->)/g,
    /(<!--.?request:body.?-->)/g,
    /(<!--.?request:body(:collapsed)?.?-->)/g,
  ]

  private responseHeadersRegx = [
    /(<!--.?response:headers(:collapsed)?.?-->)/g,
    /(<!--.?response:headers.?-->)/g,
    /(<!--.?response:headers:collapsed.?-->)/gm,
  ]

  private responseBodyRegx = [
    /(<!--.?response:body(:collapsed)?.?-->)/gm,
    /(<!--.?response:body.?-->)/gm,
    /(<!--.?response:body:collapsed.?-->)/gm,
  ]

  public generate(
    context: Paw.Context,
    requests: Paw.Request[],
    options: Paw.ExtensionOption,
  ): string {
    this.ctx = context

    const document = `# ${context.document.name}\n\n`
    let subdocs: string[] = []

    if (requests.length === 1) {
      subdocs = requests.map((request: Paw.Request): string =>
        this.buildRequestDoc(request, context.user as Paw.UserInfo),
      )
      return subdocs.join('\n')
    }

    const rootRequests = context
      .getRootRequests()
      .map((i) => this.buildRequestDoc(i, context.user as Paw.UserInfo))

    const rootGroups = context
      .getRootGroups()
      .map((i) => this.buildRequestGroup(i, context.user as Paw.UserInfo))
      .join('\n')

    return [document, rootRequests, rootGroups].join('\n')
  }

  private buildRequestGroup(
    group: Paw.RequestGroup,
    user: Paw.UserInfo,
  ): string {
    const children = group
      .getChildren()
      .map((item: Paw.RequestGroup | Paw.Request) => {
        if (Object.prototype.hasOwnProperty.call(item, 'getChildren')) {
          return this.buildRequestGroup(item as Paw.RequestGroup, user)
        }

        const req = item as Paw.Request
        if (req && req.method) {
          return this.buildRequestDoc(req, user)
        }
      })
      .join('\n')

    return [`\n## ${group.name}\n`, children].join('\n')
  }

  private buildRequestDoc(request: Paw.Request, user: Paw.UserInfo): string {
    const updateText = `\n<small>Last updated [date], by [user].</small>`
    const isDescriptionEmpty =
      request.description.trim().length === 0 ||
      !/(<!--.?.*.?-->)/gm.test(request.description)

    if (isDescriptionEmpty) {
      let defaultDoc = `### ${request.name}\n`

      defaultDoc += `\n${request.description}\n`

      defaultDoc += '\n#### Request\n'
      defaultDoc += this.insertRequestHeaders(request, true)
      defaultDoc += this.insertRequestQueryParams(request, true)
      defaultDoc += this.insertRequestBody(request, true)

      if (request.getLastExchange()) {
        defaultDoc += '\n#### Response\n'
        defaultDoc += this.insertResponseHeaders(request, true)
        defaultDoc += this.insertResponseBody(request, true)
      }

      defaultDoc += '\n---\n'
      defaultDoc += updateText
        .replace(/(\[date\])/g, new Date().toUTCString())
        .replace(/(\[user\])/g, (user.username as string) || '')
      return defaultDoc.replace(/\n\s*\n/g, '\n\n')
    }

    let customDoc = `### ${request.name}\n\n`

    customDoc += request.description.slice()

    if (this.requestHeaderRegx[0].test(customDoc)) {
      if (this.requestHeaderRegx[1].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestHeaderRegx[1],
          this.insertRequestHeaders(request, false),
        )
      }

      if (this.requestHeaderRegx[2].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestHeaderRegx[2],
          this.insertRequestHeaders(request, true),
        )
      }
    }

    if (this.requestParamsRegx[0].test(customDoc)) {
      if (this.requestParamsRegx[1].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestParamsRegx[1],
          this.insertRequestQueryParams(request, false),
        )
      }

      if (this.requestParamsRegx[2].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestParamsRegx[2],
          this.insertRequestQueryParams(request, true),
        )
      }
    }

    if (this.requestBodyRegx[0].test(customDoc)) {
      if (this.requestBodyRegx[1].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestBodyRegx[1],
          this.insertRequestBody(request, false),
        )
      }

      if (this.requestBodyRegx[2].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestParamsRegx[2],
          this.insertRequestBody(request, true),
        )
      }
    }

    if (this.requestBodyRegx[0].test(customDoc)) {
      if (this.requestBodyRegx[1].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestBodyRegx[1],
          this.insertRequestBody(request, false),
        )
      }

      if (this.requestBodyRegx[2].test(customDoc)) {
        customDoc = customDoc.replace(
          this.requestParamsRegx[2],
          this.insertRequestBody(request, true),
        )
      }
    }

    if (this.responseHeadersRegx[0].test(customDoc)) {
      if (this.responseHeadersRegx[1].test(customDoc)) {
        customDoc = customDoc.replace(
          this.responseHeadersRegx[1],
          this.insertResponseHeaders(request, false),
        )
      }

      if (this.responseHeadersRegx[2].test(customDoc)) {
        customDoc = customDoc.replace(
          this.responseHeadersRegx[2],
          this.insertResponseHeaders(request, true),
        )
      }
    }

    if (this.responseBodyRegx[0].test(customDoc)) {
      if (this.responseBodyRegx[1].test(customDoc)) {
        customDoc = customDoc.replace(
          this.responseBodyRegx[1],
          this.insertResponseBody(request, false),
        )

        console.log(customDoc)
      }

      if (this.responseBodyRegx[2].test(customDoc)) {
        customDoc = customDoc.replace(
          this.responseBodyRegx[2],
          this.insertResponseBody(request, true),
        )
      }
    }

    return customDoc.replace(/\n\s*\n/g, '\n\n')
  }

  private insertRequestHeaders(
    request: Paw.Request,
    collapsed: boolean = false,
  ): string {
    const headers = request.getHeaders(false)
    const format = Object.keys(headers)
      .map((name: string) => `${name}:  ${(headers[name] as string).trim()}\n`)
      .join('')
      .trim()
    const tmpl = `${template(
      'text',
      format || 'null',
      'Request Headers',
      collapsed,
    )}`
    return tmpl
  }

  private insertRequestQueryParams(
    request: Paw.Request,
    collapsed: boolean = false,
  ): string {
    const queryparams = request.getUrlParameters(false)
    return template(
      'text',
      qs.stringify(queryparams) || 'Empty URL Parameters',
      'Request URL Parameters',
      collapsed,
    )
  }

  private insertRequestBody(
    request: Paw.Request,
    collapsed: boolean = false,
  ): string {
    const title = 'Request Body'
    const requestBody = request.getBody(true) as DynamicString | null

    if (!requestBody || requestBody.components.length === 0) {
      return template('text', 'Empty Body', title, collapsed)
    }

    const body = requestBody.components[0] as DynamicValue
    if (body.type === 'com.luckymarmot.JSONDynamicValue') {
      return template(
        'json',
        body.getEvaluatedString() || 'null',
        title,
        collapsed,
      )
    }

    if (body.type === 'com.luckymarmot.BodyFormKeyValueDynamicValue') {
      return template('text', body.getEvaluatedString() || '', title, collapsed)
    }

    if (body.type === 'com.luckymarmot.GraphQLDynamicValue') {
      const gqlQuery =
        body.gqlQuery.components.length > 0 ? body.gqlQuery.components[0] : '{}'
      return this.graphQLCodeBlock(
        gqlQuery,
        this.getGqlValues(body.gqlVariables),
        collapsed,
      )
    }

    return ''
  }

  private insertResponseHeaders(
    request: Paw.Request,
    collapsed: boolean = false,
  ): string {
    let content = ''
    const httpExchange = request.getLastExchange()

    if (!httpExchange) return ''

    const headers = httpExchange.responseHeaders
    const format = Object.keys(headers)
      .map((name: string) => `${name}:  ${(headers[name] as string).trim()}\n`)
      .join('')

    content += `Request URL: ${httpExchange.requestUrl}`
    content += `\nStatus Code: ${httpExchange.responseStatusLine}`
    content += '\n\n'
    content += format

    if (collapsed) {
      return template('text', content, 'Response Headers', collapsed)
    }

    return content
  }

  private insertResponseBody(
    request: Paw.Request,
    collapsed: boolean = false,
  ): string {
    let content = ''
    const httpExchange = request.getLastExchange()

    if (!httpExchange) return ''

    try {
      const body = httpExchange.responseBody
      const parsedBody = JSON.parse(body)

      if (collapsed) {
        return template(
          'json',
          JSON.stringify(parsedBody, null, 2),
          'Response Body',
          collapsed,
        )
      }

      return parsedBody
    } catch (err: unknown) {
      return content
    }
  }

  private graphQLCodeBlock(
    query: string,
    variables: string,
    collapsed: boolean = false,
  ): string {
    let title = 'GraphQL:'
    let content = ''

    if (variables) {
      content +=
        template('json', variables, title.concat(' Variables'), collapsed) +
        '\n\n'
    }

    if (/(query)/g.test(query)) {
      content +=
        template('graphql', format(query), title.concat(' Query'), collapsed) +
        '\n\n'
    }

    if (/(mutation)/g.test(query)) {
      content +=
        template(
          'graphql',
          format(query),
          title.concat(' Mutation'),
          collapsed,
        ) + '\n\n'
    }

    return content + '\n'
  }

  private getDynamicValues(
    data:
      | Array<GraphQLDynamicValueType>
      | GraphQLDynamicValueType
      | Record<string, GraphQLDynamicValueType>,
  ): string | Record<string, unknown> | Array<unknown> {
    const hasProp = Object.prototype.hasOwnProperty

    if (Array.isArray(data)) {
      return [...data].map((i) => this.getDynamicValues(i)).join('')
    }

    if (
      hasProp.call(data, 'identifier') &&
      hasProp.call(data, 'data') &&
      hasProp.call(data, 'uuid')
    ) {
      return this.dynamicValueToString(data as GraphQLDynamicValueType)
    }

    return data
  }

  private parseToJs(data: any): any {
    if (typeof data === 'object' && !Array.isArray(data)) {
      const obj = Object.keys(data).map((key) => {
        if (data[key] && typeof data[key] === 'object') {
          return [key, this.parseToJs(data[key])]
        }

        if (data[key] && typeof data[key] === 'string') {
          return [key, this.getDynamicValues(parseJson(data[key]))]
        }

        return [key, data[key]]
      })
      return Object.fromEntries(obj)
    }

    if (typeof data === 'object' && Array.isArray(data)) {
      return [...data].map((item) => {
        if (typeof item === 'object') {
          return this.parseToJs(item)
        }
        if (typeof item === 'string') {
          return this.getDynamicValues(parseJson(item))
        }
        return item
      })
    }
    return data
  }

  private getGqlValues(variables: GraphQLVariablesType): string {
    if (typeof variables !== 'string') {
      return ''
    }

    try {
      const vars = parseJson(variables)
      const cmps: Array<DynamicStringComponentPairType> = Object.keys(vars)
        .map((key) => [key, vars[key]])
        .map(([key, value]: DynamicStringComponentPairType) => [
          typeof key === 'string'
            ? this.getDynamicValues(parseJson<GraphQLVariablesType>(key))
            : key,
          typeof value === 'string'
            ? this.getDynamicValues(parseJson<GraphQLVariablesType>(value))
            : value,
        ]) as Array<DynamicStringComponentPairType>
      const output = this.parseToJs(Object.fromEntries(cmps))
      return Object.keys(output).length > 0
        ? JSON.stringify(output, null, 2)
        : ''
    } catch (err: unknown) {
      return (err as Error).message
    }
  }

  private dynamicValueToString(data: GraphQLDynamicValueType | string): string {
    const context = this.ctx

    if (typeof data === 'string') {
      return data
    }

    switch (data.identifier) {
      case 'com.luckymarmot.EnvironmentVariableDynamicValue':
        const env = context.getEnvironmentVariableById(
          data.data.environmentVariable,
        ) as Paw.EnvironmentVariable
        return (env.getCurrentValue(false) as string) || 'null'

      case 'com.luckymarmot.HashDynamicValue':
        return '[HashDynamicValue is not yet supported.]'

      case 'com.luckymarmot.AmazonS3HeaderDynamicValue':
        return '[AmazonS3HeaderDynamicValue is not yet supported.]'

      case 'com.luckymarmot.CompressionDynamicValue':
        return '[CompressionDynamicValue is not yet supported.]'

      case 'com.luckymarmot.EscapeSequenceDynamicValue':
        return '[EscapeSequenceDynamicValue is not yet supported.]'

      case 'com.luckymarmot.HMACDynamicValue':
        return '[HMACDynamicValue is not yet supported.]'

      case 'com.luckymarmot.BasicAuthDynamicValue':
        return '[BasicAuthDynamicValue is not yet supported.]'

      case 'com.luckymarmot.CustomDynamicValue':
        return '[CustomDynamicValue is not yet supported.]'

      case 'com.luckymarmot.CustomDynamicValue':
        return '[CustomDynamicValue is not yet supported.]'

      case 'com.luckymarmot.JSONDynamicValue':
        return '[JSONDynamicValue is not yet supported.]'

      case 'com.luckymarmot.RequestVariableDynamicValue':
        return '[RequestVariableDynamicValue is not yet supported.]'

      case 'com.luckymarmot.LocalValueDynamicValue ':
        return '[LocalValueDynamicValue  is not yet supported.]'

      default:
        return data.identifier
    }
  }
}

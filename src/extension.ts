import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'
import 'dotenv/config'

const MODEL = 'gpt-3.5-turbo'
const OPEN_API_KEY = 'OPEN_API_KEY'
const QUERY_START =
    'from now on only respond in json. the response MUST be formatted in json with only the following property: regex. The job to respond to is:  regex find '
const QUERY_END =
    'Remember you must provide only json with a property of regex, absolutely no additional text or explanation'

const ask = (name: string) => {
    return vscode.window.showInputBox({ prompt: `Enter ${name}`, ignoreFocusOut: true })
}

async function checkOpenAPICredentials(context: vscode.ExtensionContext) {
    const key = await context.secrets.get(OPEN_API_KEY)
    if (!key) {
        const apiKey = await ask(
            'Please enter a valid personal OpenAPI key from https://platform.openai.com/account/api-keys'
        )

        if (!apiKey?.length) {
            vscode.window.showErrorMessage('You must enter a valid OpenAPI key')
        } else {
            context.secrets.store(OPEN_API_KEY, apiKey)
        }
    }

    const configuration = new Configuration({
        apiKey: await context.secrets.get(OPEN_API_KEY)
    })

    return new OpenAIApi(configuration)
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('easy-regex.easyRegex', async () => {
        const openai = await checkOpenAPICredentials(context)

        // Get the active text editor
        const editor = vscode.window.activeTextEditor

        if (editor) {
            const selection = editor.selection

            if (!selection || selection.isEmpty) {
                vscode.window.showErrorMessage('You must select something')
            }

            const selectionRange = new vscode.Range(
                selection.start.line,
                selection.start.character,
                selection.end.line,
                selection.end.character
            )

            const highlighted = editor.document.getText(selectionRange)

            const searchQuery = await vscode.window.showInputBox({
                placeHolder: 'What are you trying to match?',
                prompt: 'Enter Search Query'
            })

            if (searchQuery === '') {
                vscode.window.showErrorMessage('A search query is mandatory to execute this action')
            }

            if (searchQuery !== undefined) {
                vscode.window.showInformationMessage(`Searching for ${searchQuery}...`)

                //TODO: find a way to store these in actual env vars
                const content = QUERY_START + `${searchQuery} in this string '${highlighted}'` + QUERY_END

                const chatCompletion = await openai.createChatCompletion({
                    model: MODEL,
                    messages: [{ role: 'user', content }]
                })

                const final = chatCompletion.data.choices[0]?.message?.content

                if (final) {
                    try {
                        const regexObj = JSON.parse(final)

                        vscode.window.showInformationMessage(regexObj.regex)

                        const decorationType = vscode.window.createTextEditorDecorationType({
                            backgroundColor: 'green',
                            border: '1px solid white'
                        })

                        let decorationsArray: vscode.DecorationOptions[] = []

                        let matches = highlighted.matchAll(regexObj.regex)

                        const matchAll = [...matches]

                        matchAll.forEach((match) => {
                            if (match !== null && match.index !== undefined) {
                                const start = selection.start.character + match.index
                                const range = new vscode.Range(
                                    selection.start.line,
                                    start,
                                    selection.end.line,
                                    start + match[0].length
                                )

                                const decoration = { range }

                                decorationsArray.push(decoration)
                            }
                        })

                        editor.setDecorations(decorationType, decorationsArray)

                        vscode.workspace.onDidChangeTextDocument((e) => {
                            decorationType.dispose()
                        })
                    } catch (error) {
                        if (error) {
                            vscode.window.showErrorMessage(String(error))
                        } else {
                            vscode.window.showWarningMessage(
                                `Did not find a result for "${searchQuery}". Please try again or update the query and try again.`
                            )
                        }
                    }
                }
            }
        }
    })

    context.subscriptions.push(disposable)
}

export function deactivate() {}

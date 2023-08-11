import * as vscode from 'vscode'
import { Configuration, OpenAIApi } from 'openai'
import 'dotenv/config'

const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY
})

const openai = new OpenAIApi(configuration)

const MODEL = 'gpt-3.5-turbo'

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('easy-regex.easyRegex', async () => {
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

				const content =
					process.env.QUERY_START + `${searchQuery} in this string '${highlighted}'` + process.env.QUERY_END

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
						const lines = highlighted.split('\n')

						for (let line = 0; line < lines.length; line++) {
							let matches = lines[line].matchAll(regexObj.regex)

							const matchAll = [...matches]

							matchAll.forEach((match) => {
								if (match !== null && match.index !== undefined) {
									let range = new vscode.Range(
										new vscode.Position(line, match.index),
										new vscode.Position(line, match.index + match[0].length)
									)

									let decoration = { range }

									decorationsArray.push(decoration)
								}
							})
						}

						editor.setDecorations(decorationType, decorationsArray)

						vscode.workspace.onDidChangeTextDocument((e) => {
							decorationType.dispose()
						})
					} catch (error) {
						vscode.window.showWarningMessage(
							`Did not find a result for "${searchQuery}". Please try again or update the query and try again.`
						)
					}
				}
			}
		}
	})

	context.subscriptions.push(disposable)
}

export function deactivate() {}

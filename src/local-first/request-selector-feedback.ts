/**
 * Cheap first-line project-selector syntax feedback for local-only requests (OL-055 S3.3): it verifies the parse BEFORE the
 * expensive Worker/Engine accept, so a selector mistyped onto the first command line is corrected at routing time instead of
 * consuming a model turn and an outbound acknowledgement. It never weakens the accepted grammar — `projectIdFromRequest` stays
 * the sole parser — and it stays silent for a request that shows no selector intent at all.
 */
import { projectIdFromRequest } from './project-workspaces.ts'

// The accepted first-line grammars, verbatim from the parsers that authorize a project: the explicit selector and the
// new-project request. A check here that a parse succeeds must use the same expression, never a looser one.
const EXPLICIT_ID = /^(?:\/project\s+|项目\s*[:：]\s*)([a-z0-9][a-z0-9_-]{0,63})\s*$/
const NEW_PROJECT_ID = /^(?:\/new-project\s+|新建项目\s*[:：]\s*)([a-z0-9][a-z0-9_-]{0,63})\s*$/
const INTENT = /^\s*(?:\/project|\/new-project|项目\s*[:：]|新建项目\s*[:：])/
const firstLine = (text: string): string => text.split(/\r?\n/, 1)[0]?.trim() ?? ''

/** True when the first line shows the person meant to name a project, whether or not the syntax is accepted. */
export function hasSelectorIntent(text: string): boolean {
  return INTENT.test(firstLine(text))
}

/** True only when the first line parses as an accepted project selector or new-project request. */
export function selectorParses(text: string): boolean {
  return !!projectIdFromRequest(text) || NEW_PROJECT_ID.test(firstLine(text))
}

/**
 * The bilingual correction for a request whose first line intends a project selector but does not parse, or `undefined` when the
 * parse succeeds or no selector is intended. The examples are the exact accepted grammar.
 */
export function selectorFeedback(text: string): string | undefined {
  const first = firstLine(text)
  if (!hasSelectorIntent(text)) return undefined
  if (selectorParses(text)) return undefined
  // The common mistake in OL-054: the selector and the request share the first line, so nothing parses.
  if (/^(?:\/project|项目\s*[:：])\s*[a-z0-9][a-z0-9_-]{0,63}\s+\S/.test(first))
    return '选择器必须独占第一行，请求从第二行开始。示例：\n/project demo-app\n修复错字\nThe selector must be alone on the first line and the request starts on the next line. Example: /project demo-app, then Fix the typo.'
  return '项目标识无效：第一行选择器只接受小写字母、数字、下划线或连字符，不超过 64 个字符，且请求从第二行开始。示例：\n/project demo-app\n修复错字\nInvalid project ID: the first-line selector accepts only lowercase letters, digits, underscore or hyphen, up to 64 characters, and the request starts on the next line. Example: /project demo-app, then Fix the typo.'
}

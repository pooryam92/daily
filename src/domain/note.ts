const CODE_FENCE = /^\s*(?:```|~~~)/
const RULE_OR_UNDERLINE = /^\s*([-*_=])(\s*\1){2,}\s*$/

const QUOTE = /^\s*>\s*/
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/
const CHECK_BOX = /^\[[ xX]\]\s+/
const HEADING = /^#{1,6}\s+/

const LINK = /!?\[([^\]]*)\]\([^)]*\)/g
const STRONG = /(?:\*\*|__)(.+?)(?:\*\*|__)/g
const EMPHASIS = /[*_](.+?)[*_]/g
const STRIKE = /~~(.+?)~~/g
const CODE = /`([^`]*)`/g
const ESCAPED_CHARACTER = /\\([\\`*_{}[\]()#+\-.!>~|])/g
const HIDDEN = '\u0000'

/** Marks at the start of a line, outermost first. */
const BLOCK_MARKS = [QUOTE, LIST_ITEM, CHECK_BOX, HEADING]
const INLINE_MARKS = [LINK, STRONG, EMPHASIS, STRIKE, CODE]

function stripBlockMarks(line: string): string {
  return BLOCK_MARKS.reduce((text, mark) => text.replace(mark, ''), line)
}

/** An escaped character is not a mark, so it is hidden while the marks are stripped. */
function stripInlineMarks(line: string): string {
  const escaped: string[] = []
  const hidden = line.replace(ESCAPED_CHARACTER, (_mark, character: string) => {
    escaped.push(character)
    return HIDDEN
  })
  const stripped = INLINE_MARKS.reduce((text, mark) => text.replace(mark, '$1'), hidden)
  return stripped.replaceAll(HIDDEN, () => escaped.shift() ?? '')
}

function wordsOf(line: string): string {
  if (RULE_OR_UNDERLINE.test(line)) return ''
  return stripInlineMarks(stripBlockMarks(line)).trim()
}

/**
 * The line a row shows for its note: the first line with words on it, without its Markdown marks.
 * A line of code is shown as it is.
 */
export function noteExcerpt(note: string): string {
  let inCode = false
  for (const line of note.split('\n')) {
    if (CODE_FENCE.test(line)) {
      inCode = !inCode
      continue
    }
    const words = inCode ? line.trim() : wordsOf(line)
    if (words !== '') return words
  }
  return ''
}

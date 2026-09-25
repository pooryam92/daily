import { describe, expect, it } from 'vitest'
import { noteExcerpt } from './note'

describe('noteExcerpt', () => {
  it('is the first line', () => {
    expect(noteExcerpt('Call the dentist\n\nAsk about the wisdom tooth.')).toBe('Call the dentist')
  })

  it('skips blank lines, rules and heading underlines', () => {
    expect(noteExcerpt('\n   \n---\nCall the dentist')).toBe('Call the dentist')
    expect(noteExcerpt('===\nCall the dentist')).toBe('Call the dentist')
  })

  it('strips heading, list, quote and check marks', () => {
    expect(noteExcerpt('## Plan')).toBe('Plan')
    expect(noteExcerpt('- Buy milk')).toBe('Buy milk')
    expect(noteExcerpt('1. Buy milk')).toBe('Buy milk')
    expect(noteExcerpt('> Buy milk')).toBe('Buy milk')
    expect(noteExcerpt('- [x] Buy milk')).toBe('Buy milk')
    expect(noteExcerpt('* [ ] Buy milk')).toBe('Buy milk')
    expect(noteExcerpt('> - [ ] Buy milk')).toBe('Buy milk')
  })

  it('strips inline marks and keeps link text', () => {
    expect(noteExcerpt('**Bold** and _italic_ and ~~gone~~ and `code`')).toBe(
      'Bold and italic and gone and code'
    )
    expect(noteExcerpt('See [the design](https://example.com) first')).toBe('See the design first')
  })

  it('reads an escaped mark as the character', () => {
    expect(noteExcerpt(String.raw`A \*star\* and 2 \* 3`)).toBe('A *star* and 2 * 3')
  })

  it('shows a line of code as it is and never a fence', () => {
    expect(noteExcerpt('```ts\nlet _count = a * b\n```')).toBe('let _count = a * b')
    expect(noteExcerpt('~~~\n~~~\n_After_')).toBe('After')
  })

  it('is empty for an empty note', () => {
    expect(noteExcerpt('')).toBe('')
    expect(noteExcerpt('\n\n')).toBe('')
  })
})

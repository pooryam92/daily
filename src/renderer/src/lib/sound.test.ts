import { describe, expect, it } from 'vitest'
import type { Todo } from '@shared/todo'
import { cueFor, nextStep, STREAK_WINDOW_MS, tickFrequency } from './sound'

const milk: Todo = { id: 'milk', text: 'Buy milk', status: 'open' }
const taxes: Todo = { id: 'taxes', text: 'Do taxes', status: 'open' }

describe('cueFor', () => {
  it('sounds like the mark that was clicked', () => {
    expect(cueFor([milk, taxes], 'milk', 'done')).toBe('done')
    expect(cueFor([milk, taxes], 'milk', 'dropped')).toBe('dropped')
  })

  it('is silent when a todo is reopened', () => {
    expect(cueFor([{ ...milk, status: 'done' }, taxes], 'milk', 'done')).toBeNull()
  })

  it('sounds like the new mark when a todo goes from done to dropped', () => {
    expect(cueFor([{ ...milk, status: 'done' }, taxes], 'milk', 'dropped')).toBe('dropped')
  })

  it('chimes when the last open todo is resolved, with either mark', () => {
    expect(cueFor([milk, { ...taxes, status: 'dropped' }], 'milk', 'done')).toBe('cleared')
    expect(cueFor([milk, { ...taxes, status: 'done' }], 'milk', 'dropped')).toBe('cleared')
    expect(cueFor([milk], 'milk', 'done')).toBe('cleared')
  })

  it('does not chime again when a cleared day changes a mark', () => {
    const done: Todo = { ...milk, status: 'done' }
    expect(cueFor([done, { ...taxes, status: 'done' }], 'milk', 'dropped')).toBe('dropped')
  })

  it('is silent for a todo that is not there', () => {
    expect(cueFor([milk], 'gone', 'done')).toBeNull()
  })
})

describe('nextStep', () => {
  it('climbs while checks follow each other', () => {
    expect(nextStep(0, 500)).toBe(1)
    expect(nextStep(3, STREAK_WINDOW_MS)).toBe(4)
  })

  it('starts over after a pause, and on the first check', () => {
    expect(nextStep(3, STREAK_WINDOW_MS + 1)).toBe(0)
    expect(nextStep(-1, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('tickFrequency', () => {
  it('rises along a pentatonic scale', () => {
    const semitones = [0, 1, 2, 3, 4, 5].map((step) =>
      Math.round(12 * Math.log2(tickFrequency(step) / 659.25))
    )
    expect(semitones).toEqual([0, 2, 4, 7, 9, 12])
  })

  it('stays at the top of the scale', () => {
    expect(tickFrequency(40)).toBe(tickFrequency(5))
    expect(tickFrequency(5)).toBeCloseTo(2 * tickFrequency(0))
  })
})

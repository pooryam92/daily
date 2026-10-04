import { describe, expect, it } from 'vitest'
import type { Todo } from '@/domain/todo'
import { cueFor, nextStep, STREAK_WINDOW_MS, tickFrequency } from './sound'

const milk: Todo = { id: 'milk', text: 'Buy milk', status: 'open' }
const taxes: Todo = { id: 'taxes', text: 'Do taxes', status: 'open' }

describe('cueFor', () => {
  it('ticks when a todo is checked', () => {
    expect(cueFor([milk, taxes], 'milk')).toBe('done')
  })

  it('is silent when a todo is reopened', () => {
    expect(cueFor([{ ...milk, status: 'done' }, taxes], 'milk')).toBeNull()
  })

  it('chimes when the last open todo is checked', () => {
    expect(cueFor([milk, { ...taxes, status: 'done' }], 'milk')).toBe('cleared')
    expect(cueFor([milk], 'milk')).toBe('cleared')
  })

  it('is silent for a todo that is not there', () => {
    expect(cueFor([milk], 'gone')).toBeNull()
  })

  describe('on a step', () => {
    const oats: Todo = { id: 'oats', text: 'Oat milk', status: 'open' }
    const shopping: Todo = { id: 'shopping', text: 'Shopping', status: 'open', steps: [oats] }

    it('ticks when a step is checked', () => {
      expect(cueFor([shopping, taxes], 'oats')).toBe('done')
    })

    it('ticks, never chimes, when the last open step is checked on an otherwise cleared day', () => {
      expect(cueFor([{ ...shopping, status: 'done' }], 'oats')).toBe('done')
      expect(cueFor([shopping], 'oats')).toBe('done')
    })

    it('is silent when a step is reopened', () => {
      expect(cueFor([{ ...shopping, steps: [{ ...oats, status: 'done' }] }], 'oats')).toBeNull()
    })

    it('leaves the rule for the parent as it is: its open steps do not keep the day from clearing', () => {
      expect(cueFor([shopping, { ...taxes, status: 'done' }], 'shopping')).toBe('cleared')
      expect(cueFor([shopping, taxes], 'shopping')).toBe('done')
    })
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

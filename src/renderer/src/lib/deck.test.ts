import { describe, expect, it } from 'vitest'
import { deckTransform, deckZIndex, flipAfterDrag, resistDrag } from './deck'

describe('deckTransform', () => {
  it('leaves the card in front where it is', () => {
    expect(deckTransform(0)).toBe('translateX(calc(0% + 0 * var(--peek))) scale(1)')
  })

  it('moves the day after out to the right by the peek, plus what scaling took off', () => {
    expect(deckTransform(1)).toBe('translateX(calc(4% + 1 * var(--peek))) scale(0.92)')
  })

  it('mirrors the day before', () => {
    expect(deckTransform(-1)).toBe('translateX(calc(-4% + -1 * var(--peek))) scale(0.92)')
  })

  it('keeps cards further out behind the first one: smaller, not further out', () => {
    expect(deckTransform(2)).toBe('translateX(calc(8% + 1 * var(--peek))) scale(0.84)')
  })
})

describe('deckZIndex', () => {
  it('puts the card nearest the front on top', () => {
    expect(deckZIndex(0)).toBeGreaterThan(deckZIndex(1))
    expect(deckZIndex(-1)).toBeGreaterThan(deckZIndex(-2))
    expect(deckZIndex(1)).toBe(deckZIndex(-1))
  })

  it('swaps two cards halfway through a flip', () => {
    expect(deckZIndex(0.4)).toBeGreaterThan(deckZIndex(-0.6))
    expect(deckZIndex(0.6)).toBeLessThan(deckZIndex(-0.4))
  })
})

describe('resistDrag', () => {
  it('follows the pointer up to one day', () => {
    expect(resistDrag(0.3)).toBe(0.3)
    expect(resistDrag(-1)).toBe(-1)
  })

  it('gives less and less past one day, and never half a day more', () => {
    const near = resistDrag(1.5) - 1
    const far = resistDrag(3) - 1
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(0.5)
    expect(far).toBeGreaterThan(near)
    expect(resistDrag(1000)).toBeLessThan(1.5)
    expect(resistDrag(-3)).toBe(-resistDrag(3))
  })
})

describe('flipAfterDrag', () => {
  it('goes back after a short, slow drag', () => {
    expect(flipAfterDrag(0.3, 0.05)).toBe(0)
    expect(flipAfterDrag(0, 0)).toBe(0)
  })

  it('flips past halfway', () => {
    expect(flipAfterDrag(0.5, 0)).toBe(1)
    expect(flipAfterDrag(-0.7, 0)).toBe(-1)
  })

  it('flips on a flick, however short', () => {
    expect(flipAfterDrag(0.1, 0.2)).toBe(1)
    expect(flipAfterDrag(-0.1, -0.2)).toBe(-1)
  })

  it('is cancelled by a flick back against the drag', () => {
    expect(flipAfterDrag(0.8, -0.2)).toBe(0)
  })
})

import type { ResolvedStatus, Todo } from '@shared/todo'

/*
 * The app's three sounds, synthesised with Web Audio: no samples, no library. They are off unless
 * switched on in the settings. The reasoning is in docs/DESIGN.md §10; every value here is a
 * starting point to tune by ear.
 */

export type SoundCue = 'done' | 'dropped' | 'cleared'

/**
 * What a click on a mark sounds like. Reopening a todo is silent. The click that resolves the last
 * open todo gets the chime instead of its own sound, whichever mark it was: the day is cleared
 * either way.
 */
export function cueFor(todos: readonly Todo[], id: string, status: ResolvedStatus): SoundCue | null {
  const todo = todos.find((candidate) => candidate.id === id)
  if (todo === undefined || todo.status === status) return null
  // Only resolving the last open todo clears the day; changing a mark on a cleared day does not.
  const clears = todo.status === 'open' && todos.every((other) => other.id === id || other.status !== 'open')
  return clears ? 'cleared' : status
}

/** Checks that follow each other within this time continue the rising scale. */
export const STREAK_WINDOW_MS = 4000

/** Where in the scale the next tick is: one step up if it follows the last one soon enough, else back to the start. */
export function nextStep(step: number, sinceLastMs: number): number {
  return sinceLastMs <= STREAK_WINDOW_MS ? step + 1 : 0
}

/** A major pentatonic scale has no semitone steps, so any run of its notes sounds consonant. */
const PENTATONIC = [0, 2, 4, 7, 9] as const
const TICK_BASE_HZ = 659.25 // E5
/** The scale stops rising an octave up (E6, 1319 Hz): higher than that, a tick turns shrill. */
const TOP_STEP = 5

/** The pitch of a tick: it climbs the scale over consecutive checks and stays at the top. */
export function tickFrequency(step: number): number {
  const capped = Math.min(Math.max(step, 0), TOP_STEP)
  const semitones =
    12 * Math.floor(capped / PENTATONIC.length) + (PENTATONIC[capped % PENTATONIC.length] ?? 0)
  return TICK_BASE_HZ * 2 ** (semitones / 12)
}

interface Note {
  readonly frequency: number
  /** Seconds after the cue starts. */
  readonly delay?: number
  readonly gain: number
  /** Seconds until the note has died away. */
  readonly decay: number
  /** The pitch the note slides to while it decays. */
  readonly glideTo?: number
  /** How much of the octave above is mixed in: more of it makes a note brighter. */
  readonly brightness?: number
}

/** Quiet on purpose: the more often a sound plays, the less of it there should be. */
const MASTER_GAIN = 0.25

/** A warmer, longer C major arpeggio: the one sound that is allowed to linger. */
const CHIME: readonly Note[] = [523.25, 659.25, 783.99, 1046.5].map((frequency, index) => ({
  frequency,
  delay: index * 0.07,
  gain: 0.4,
  decay: 0.9,
  brightness: 0.12
}))

/** Lower and softer than the tick, sliding down a little: a release, and never an error tone. */
const DROP: Note = { frequency: 246.94, glideTo: 220, gain: 0.45, decay: 0.2 }

let output: { readonly context: AudioContext; readonly master: GainNode } | null = null
let step = -1
let lastTickAt = Number.NEGATIVE_INFINITY

function getOutput(): NonNullable<typeof output> {
  if (output === null) {
    const context = new AudioContext()
    const master = context.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(context.destination)
    output = { context, master }
  }
  return output
}

/** A sine with a fast attack and an exponential decay: a soft, mallet-like pluck. */
function pluck({ context, master }: NonNullable<typeof output>, note: Note): void {
  const start = context.currentTime + (note.delay ?? 0)
  const partials = [
    { ratio: 1, gain: note.gain, decay: note.decay },
    { ratio: 2, gain: note.gain * (note.brightness ?? 0), decay: note.decay / 2 }
  ]
  for (const partial of partials) {
    if (partial.gain === 0) continue
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.frequency.setValueAtTime(note.frequency * partial.ratio, start)
    if (note.glideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(note.glideTo * partial.ratio, start + partial.decay)
    }
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(partial.gain, start + 0.004)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + partial.decay)
    oscillator.connect(envelope).connect(master)
    oscillator.start(start)
    oscillator.stop(start + partial.decay + 0.02)
  }
}

export function play(cue: SoundCue): void {
  const out = getOutput()
  // Chromium suspends a context that was created before the first click.
  if (out.context.state === 'suspended') void out.context.resume()

  switch (cue) {
    case 'done': {
      const now = performance.now()
      step = nextStep(step, now - lastTickAt)
      lastTickAt = now
      pluck(out, { frequency: tickFrequency(step), gain: 0.5, decay: 0.16, brightness: 0.2 })
      return
    }
    case 'dropped':
      pluck(out, DROP)
      return
    case 'cleared':
      // The next run of checks starts from the bottom of the scale again.
      lastTickAt = Number.NEGATIVE_INFINITY
      CHIME.forEach((note) => {
        pluck(out, note)
      })
  }
}

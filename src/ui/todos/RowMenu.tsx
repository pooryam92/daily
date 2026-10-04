import { CSPProvider } from '@base-ui/react/csp-provider'
import { Menu } from '@base-ui/react/menu'
import { Tooltip } from '@base-ui/react/tooltip'
import {
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ChevronDown,
  ChevronRight,
  ListPlus,
  Trash2
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { createContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { MoveTarget } from '../day/copy'
import styles from './RowMenu.module.css'

/**
 * How a row's menu was opened: by Shift+F10 or the context menu key on the row, at the row's end, or by
 * a right-click, at the pointer.
 */
export type RowMenuOpen =
  { readonly from: 'keys' } | { readonly from: 'point'; readonly x: number; readonly y: number }

/**
 * How long after opening a scroll is still the list bringing the row's end into view, not the user, and how
 * soon each step of that smooth scroll follows the last (a frame is 16ms).
 */
const SETTLING_MS = 300
const SETTLING_GAP_MS = 100

/** Whether the rows' card is the one in front: a card that leaves the front closes its menu. */
export const RowMenusFront = createContext(true)

/** How long the pointer rests on a row's button before its name shows. */
const TIP_DELAY_MS = 400

/**
 * Where the rows of a card keep their menus and their buttons' names. The built page's CSP allows no
 * inline <style>; Base UI works without the ones it would add.
 */
export function RowMenus({ front, children }: { readonly front: boolean; readonly children: ReactNode }) {
  return (
    <CSPProvider disableStyleElements>
      <Tooltip.Provider delay={TIP_DELAY_MS}>
        <RowMenusFront value={front}>{children}</RowMenusFront>
      </Tooltip.Provider>
    </CSPProvider>
  )
}

type MoveTo = Pick<MoveTarget, 'name' | 'direction'>

/** A move's icon, on the row's button and in its menu: on to tomorrow, or up to the line that is today. */
export function MoveIcon({ to, ...props }: Omit<LucideProps, 'to'> & { readonly to: MoveTo }) {
  const Icon =
    to.name === 'tomorrow' ? ArrowRight : to.direction === 'next' ? ArrowRightToLine : ArrowLeftToLine
  return <Icon {...props} />
}

/** What a row's menu offers. A step, and a done todo, only go away. */
interface RowMenuActions {
  readonly onStep?: () => void
  readonly move?: MoveTo & { readonly onMove: () => void }
  readonly fold?: { readonly folded: boolean; readonly onToggle: () => void }
  readonly onDelete: () => void
}

interface RowMenuProps extends RowMenuActions {
  readonly text: string
  /** The row: the menu opens at its end from the keyboard, and stays inside its card. */
  readonly row: HTMLElement | null
  readonly open: RowMenuOpen | null
  readonly onOpen: (open: RowMenuOpen | null) => void
}

/**
 * The text of the row a removed row hands the keyboard to: the next one at its level, else the one
 * before; for a step, else its todo; else the field that adds a todo. Rows still fading out do not count.
 */
export function nextFocus(row: HTMLElement): HTMLElement | null {
  const item = row.parentElement
  const list = item?.parentElement
  if (item == null || list == null) return null
  const rows = [...list.querySelectorAll<HTMLElement>(':scope > li[data-todo]:not([data-leaving])')]
  const at = rows.indexOf(item)
  const textOf = (li: HTMLElement | undefined): HTMLElement | null =>
    li?.querySelector<HTMLElement>(':scope > [data-row] [data-todo-text]') ?? null
  const near = textOf(rows[at + 1]) ?? (at > 0 ? textOf(rows[at - 1]) : null)
  if (near !== null) return near
  const parent = list.closest<HTMLElement>('li[data-todo]')
  if (parent !== null) return textOf(parent)
  return item.closest('section')?.querySelector<HTMLElement>('[aria-label="Add a todo"]') ?? null
}

/**
 * Puts the keyboard on `target` in the next frame, once an open menu no longer keeps the page out of reach,
 * unless it has moved on: only if it is nowhere, on the menu, or in a row going away (`left`).
 */
function focusSoon(target: HTMLElement | null, left?: HTMLElement | null): void {
  requestAnimationFrame(() => {
    const focused = document.activeElement
    const lost =
      focused === null ||
      focused === document.body ||
      !focused.isConnected ||
      focused.closest('[role="menu"]') !== null ||
      left?.contains(focused) === true
    if (target?.isConnected === true && lost) target.focus()
  })
}

/**
 * In the next frame, puts the keyboard where Tab from the row's text would go, or for Shift+Tab (`back`) on
 * the row's box: one back from the text, even when a fold arrow comes before the box.
 */
function tabOn(row: HTMLElement | null, back: boolean): void {
  requestAnimationFrame(() => {
    const text = row?.querySelector<HTMLElement>('[data-todo-text]')
    if (text == null) return
    const box = row?.querySelector<HTMLElement>('input[type="checkbox"]')
    if (back && box != null) {
      box.focus()
      return
    }
    const reachable = [
      ...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')
    ].filter(
      (element) =>
        element.tabIndex >= 0 &&
        !element.matches(':disabled') &&
        element.closest('[inert]') === null &&
        element.checkVisibility({ visibilityProperty: true })
    )
    const at = reachable.indexOf(text)
    ;((at === -1 ? undefined : reachable[back ? at - 1 : at + 1]) ?? text).focus()
  })
}

/** Does what takes a row away and, from the keyboard, hands the keyboard on (`nextFocus`). */
export function leaveRow(row: HTMLElement | null, fromKeys: boolean, action: () => void): void {
  const next = row === null || !fromKeys ? null : nextFocus(row)
  action()
  if (fromKeys) focusSoon(next, row)
}

/**
 * The row's buttons, and folding its steps, as a menu opened by right-click or Shift+F10 (TodoItem.tsx).
 * It closes once the card loses attention: the window blurs, the list scrolls, or another day comes forward.
 */
export function RowMenu({ text, row, open, onOpen, onStep, move, fold, onDelete }: RowMenuProps) {
  const popup = useRef<HTMLDivElement>(null)
  // Whether an item is picked by a key: Base UI's item click does not say.
  const picking = useRef(false)
  // Where the keyboard was when Shift+F10 opened the menu, to go back to.
  const before = useRef<HTMLElement | null>(null)

  const isOpen = open !== null
  // How it was last opened, for where the keyboard goes once it has closed (and `open` is gone).
  const opened = useRef<RowMenuOpen['from'] | null>(null)
  const from = open?.from
  useEffect(() => {
    if (from !== undefined) opened.current = from
  }, [from])
  useEffect(() => {
    if (!isOpen) return
    // The list may still be scrolling the row into view when the menu opens. That scroll, and every
    // step of it that follows closely on the last, is let be; only a later one closes the menu.
    let settling = performance.now() + SETTLING_MS
    const close = (event: Event): void => {
      const now = performance.now()
      if (event.type === 'scroll' && now < settling) {
        settling = now + SETTLING_GAP_MS
        return
      }
      onOpen(null)
    }
    window.addEventListener('blur', close)
    document.addEventListener('scroll', close, { capture: true })
    return () => {
      window.removeEventListener('blur', close)
      document.removeEventListener('scroll', close, { capture: true })
    }
  }, [isOpen, onOpen])

  const fromKeys = open?.from === 'keys'
  useEffect(() => {
    picking.current = fromKeys
    if (!fromKeys) return
    before.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => {
      popup.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [fromKeys])

  const x = open?.from === 'point' ? open.x : undefined
  const y = open?.from === 'point' ? open.y : undefined
  const point = useMemo(
    () =>
      x === undefined || y === undefined
        ? undefined
        : { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) },
    [x, y]
  )

  const back = (): void => {
    focusSoon(
      opened.current === 'keys'
        ? before.current
        : (row?.querySelector<HTMLElement>('[data-todo-text]') ?? null)
    )
  }

  return (
    <Menu.Root
      open={isOpen}
      onOpenChange={(next, details) => {
        if (next) return
        onOpen(null)
        // An item places the keyboard itself, and Tab has taken it on.
        if (details.reason !== 'item-press' && details.reason !== 'focus-out') back()
      }}
    >
      <Menu.Portal className={styles.portal}>
        <Menu.Positioner
          className={styles.positioner}
          anchor={point ?? row}
          side="bottom"
          align={point === undefined ? 'end' : 'start'}
          sideOffset={point === undefined ? 4 : 2}
          // It stays inside the card, turning up over the row where there is no room below.
          collisionBoundary={row?.closest('section') ?? 'clipping-ancestors'}
        >
          <Menu.Popup
            ref={popup}
            className={styles.popup}
            onKeyDownCapture={() => {
              picking.current = true
            }}
            onPointerDownCapture={() => {
              picking.current = false
            }}
            onKeyDown={(event) => {
              // Left and right mean nothing in this menu, and must not turn the deck to another day under it.
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.preventDefault()
              // Tab closes it and goes on from the row's text, as if the menu had not been there.
              if (event.key === 'Tab') {
                event.preventDefault()
                onOpen(null)
                tabOn(row, event.shiftKey)
              }
            }}
            finalFocus={false}
          >
            {onStep !== undefined && (
              <Menu.Item
                className={styles.item}
                aria-label={`Add a step to ${text}`}
                // The step editor takes the keyboard itself.
                onClick={onStep}
              >
                <ListPlus className={styles.icon} size={14} aria-hidden="true" />
                Add a step
              </Menu.Item>
            )}
            {move !== undefined && (
              <Menu.Item
                className={styles.item}
                aria-label={`Move to ${move.name}: ${text}`}
                onClick={() => {
                  leaveRow(row, picking.current, move.onMove)
                }}
              >
                <MoveIcon to={move} className={styles.icon} size={14} aria-hidden="true" />
                Move to {move.name}
              </Menu.Item>
            )}
            {fold !== undefined && (
              <Menu.Item
                className={styles.item}
                aria-label={`${fold.folded ? 'Show' : 'Hide'} steps of ${text}`}
                onClick={() => {
                  fold.onToggle()
                  back()
                }}
              >
                {fold.folded ? (
                  <ChevronDown className={styles.icon} size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight className={styles.icon} size={14} aria-hidden="true" />
                )}
                {fold.folded ? 'Show steps' : 'Hide steps'}
              </Menu.Item>
            )}
            {(onStep !== undefined || move !== undefined || fold !== undefined) && (
              <Menu.Separator className={styles.rule} />
            )}
            <Menu.Item
              className={[styles.item, styles.delete].join(' ')}
              aria-label={`Delete ${text}`}
              onClick={() => {
                leaveRow(row, picking.current, onDelete)
              }}
            >
              <Trash2 className={styles.icon} size={14} aria-hidden="true" />
              Delete
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

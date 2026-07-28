import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/**
 * A portal-rendered, anchored popover. Renders to document.body with fixed
 * positioning so it can never be clipped by a scroll container or overflow.
 * Prefers opening below the anchor, flips above when there isn't room, and
 * clamps to the viewport on both axes. Stays glued to the anchor on scroll.
 */
export function Popover({
  anchorEl,
  onClose,
  width = 256,
  maxHeight = 320,
  align = 'left',
  children,
}: {
  anchorEl: HTMLElement | null
  onClose: () => void
  width?: number
  maxHeight?: number
  align?: 'left' | 'right'
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({
    top: -9999,
    left: -9999,
    w: width,
    mh: maxHeight,
  })

  const reposition = () => {
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    const w = Math.min(width, window.innerWidth - 16)
    const mh = Math.min(maxHeight, window.innerHeight - 16)
    let top = r.bottom + 6
    if (top + mh > window.innerHeight - 8) {
      const above = r.top - 6 - mh
      top = above >= 8 ? above : Math.max(8, window.innerHeight - mh - 8)
    }
    let left = align === 'right' ? r.right - w : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    setPos({ top, left, w, mh })
  }

  useLayoutEffect(() => {
    reposition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl])

  useEffect(() => {
    const onScroll = () => reposition()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        ref.current &&
        !ref.current.contains(t) &&
        anchorEl &&
        !anchorEl.contains(t)
      )
        onClose()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorEl, onClose])

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.w,
        maxHeight: pos.mh,
      }}
      className="z-[70] flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-e2 animate-fade-in"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

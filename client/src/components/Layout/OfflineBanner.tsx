/**
 * OfflineBanner — persistent top bar indicating connectivity + sync state.
 *
 * States:
 *   offline + N queued  →  amber bar "Offline — N changes queued"
 *   offline + 0 queued  →  amber bar "Offline"
 *   online  + N pending →  blue bar  "Syncing N changes…"
 *   online  + 0 pending →  hidden
 */
import React, { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { mutationQueue } from '../../sync/mutationQueue'

const POLL_MS = 3_000

export default function OfflineBanner(): React.ReactElement | null {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const onOnline  = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function poll() {
      const n = await mutationQueue.pendingCount()
      if (!cancelled) setPendingCount(n)
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const hidden = isOnline && pendingCount === 0
  if (hidden) return null

  const offline = !isOnline
  const bg    = offline ? '#92400e' : '#1e40af'
  const text  = '#fff'

  const label = offline
    ? pendingCount > 0
      ? `Offline — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued`
      : 'Offline'
    : `Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}…`

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: bg,
        color: text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: '6px',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {offline
        ? <WifiOff size={14} />
        : <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
      }
      {label}
    </div>
  )
}

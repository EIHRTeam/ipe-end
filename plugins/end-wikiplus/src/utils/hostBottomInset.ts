import { pluginRuntimeDebug } from '@plugin/utils/debug'

const HOST_BOTTOM_INSET_VAR = '--endwiki-host-bottom-inset'

const HOST_BOTTOM_OVERLAY_SELECTORS = [
  '.q-footer',
  '.q-layout__section--marginal.fixed-bottom',
] as const

function isVisibleBottomOverlay(element: HTMLElement) {
  const view = element.ownerDocument.defaultView
  if (!view) {
    return false
  }

  const style = view.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }
  if (Number.parseFloat(style.opacity || '1') === 0) {
    return false
  }
  if (style.position !== 'fixed' && style.position !== 'sticky') {
    return false
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function measureHostBottomInset(doc: Document) {
  const view = doc.defaultView
  if (!view) {
    return 0
  }

  const viewportBottom = view.innerHeight
  let maxBottomInset = 0

  for (const selector of HOST_BOTTOM_OVERLAY_SELECTORS) {
    const nodes = doc.querySelectorAll<HTMLElement>(selector)
    for (const node of nodes) {
      if (!isVisibleBottomOverlay(node)) {
        continue
      }

      const rect = node.getBoundingClientRect()
      if (rect.bottom < viewportBottom - 1) {
        continue
      }

      const overlap = Math.min(rect.height, Math.max(0, viewportBottom - rect.top))
      maxBottomInset = Math.max(maxBottomInset, Math.round(overlap))
    }
  }

  return maxBottomInset
}

export function installHostBottomInsetSync(doc: Document = document) {
  const view = doc.defaultView
  const body = doc.body
  if (!view || !body) {
    return () => {}
  }

  let frameId = 0
  let lastInset = -1

  const applyInset = () => {
    const nextInset = measureHostBottomInset(doc)
    if (nextInset === lastInset) {
      return
    }

    lastInset = nextInset
    body.style.setProperty(HOST_BOTTOM_INSET_VAR, `${nextInset}px`)
    pluginRuntimeDebug.debug('layout', '宿主底部避让高度已更新', {
      bottomInset: nextInset,
    })
  }

  const scheduleInsetSync = () => {
    if (frameId) {
      return
    }

    frameId = view.requestAnimationFrame(() => {
      frameId = 0
      applyInset()
    })
  }

  const onViewportChange = () => {
    scheduleInsetSync()
  }

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          onViewportChange()
        })
      : null
  resizeObserver?.observe(doc.documentElement)
  resizeObserver?.observe(body)

  const mutationObserver =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
          onViewportChange()
        })
      : null
  mutationObserver?.observe(body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  })

  view.addEventListener('resize', onViewportChange, { passive: true })
  view.addEventListener('orientationchange', onViewportChange)
  view.addEventListener('pageshow', onViewportChange)

  const visualViewport = view.visualViewport
  visualViewport?.addEventListener('resize', onViewportChange, { passive: true })
  visualViewport?.addEventListener('scroll', onViewportChange, { passive: true })

  scheduleInsetSync()
  const bootSyncTimerA = view.setTimeout(scheduleInsetSync, 120)
  const bootSyncTimerB = view.setTimeout(scheduleInsetSync, 600)

  return () => {
    if (frameId) {
      view.cancelAnimationFrame(frameId)
      frameId = 0
    }

    view.clearTimeout(bootSyncTimerA)
    view.clearTimeout(bootSyncTimerB)
    mutationObserver?.disconnect()
    resizeObserver?.disconnect()

    view.removeEventListener('resize', onViewportChange)
    view.removeEventListener('orientationchange', onViewportChange)
    view.removeEventListener('pageshow', onViewportChange)
    visualViewport?.removeEventListener('resize', onViewportChange)
    visualViewport?.removeEventListener('scroll', onViewportChange)

    body.style.removeProperty(HOST_BOTTOM_INSET_VAR)
  }
}

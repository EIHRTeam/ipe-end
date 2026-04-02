import { capabilityByKey, type CapabilityStatus } from '@plugin/constants/capabilities'

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string
    text?: string
    html?: string
    attrs?: Record<string, string>
  } = {},
  children: Array<Node | null | undefined> = []
) {
  const element = document.createElement(tag)
  if (options.className) {
    element.className = options.className
  }
  if (options.text != null) {
    element.textContent = options.text
  }
  if (options.html != null) {
    element.innerHTML = options.html
  }
  Object.entries(options.attrs || {}).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })
  children.filter(Boolean).forEach((child) => {
    element.appendChild(child!)
  })
  return element
}

export function createCapabilityBadge(key: string) {
  const capability = capabilityByKey(key)
  const status = capability?.status || 'unsupported'
  const label = capability ? `${capability.label} · ${status}` : key
  return createElement(
    'span',
    {
      className: `endwiki-ipe-badge endwiki-ipe-badge--${status}`,
      text: label,
    },
  )
}

export function createSectionTitle(title: string, description?: string) {
  const titleNode = createElement('div', { className: 'endwiki-ipe-stack' }, [
    createElement('strong', { text: title }),
    description ? createElement('p', { className: 'endwiki-ipe-muted', text: description }) : null,
  ])
  return titleNode
}

export function createStatusText(status: CapabilityStatus, summary: string) {
  return createElement('p', {
    className: `endwiki-ipe-muted endwiki-ipe-status endwiki-ipe-status--${status}`,
    text: summary,
  })
}

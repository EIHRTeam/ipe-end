export type CapabilityStatus = 'supported' | 'partial' | 'unsupported'

export interface CapabilityDescriptor {
  key: string
  label: string
  status: CapabilityStatus
  summary: string
}

export const CAPABILITY_MATRIX: CapabilityDescriptor[] = [
  {
    key: 'quick-edit',
    label: 'Quick Edit',
    status: 'supported',
    summary: 'Edits Endfield Wiki⁺ item JSON through host wiki.update-info / submit / draft-clear APIs.',
  },
  {
    key: 'quick-diff',
    label: 'Quick Diff',
    status: 'partial',
    summary: 'Shows a local JSON diff inside the modal, not the old MediaWiki compare page.',
  },
  {
    key: 'quick-preview',
    label: 'Quick Preview',
    status: 'unsupported',
    summary: 'The host does not expose a preview or render API for draft JSON yet.',
  },
  {
    key: 'plugin-store',
    label: 'Plugin Store',
    status: 'partial',
    summary: 'Shows local host-loaded plugins and disables remote registry installation flows.',
  },
]

export function capabilityByKey(key: string): CapabilityDescriptor | undefined {
  return CAPABILITY_MATRIX.find((entry) => entry.key === key)
}

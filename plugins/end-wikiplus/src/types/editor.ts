export interface QuickEditUiState {
  itemId: string | null
  itemName: string | null
  lang: string
  originalSource: string
  getCurrentSource(): string
  getCommitMessage(): string
}

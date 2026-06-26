import { IconUpload } from '@/components/Icon'
import { Inject, InPageEdit } from '@/InPageEdit'
import BasePlugin from '@/plugins/BasePlugin'
import {
  createWikiplusImageResolver,
  createWikiplusUploadClient,
  type SerializedUploadImage,
} from '@EIHRTeam/wiki-upload-wikiplus'

type QueueItemStatus = 'queued' | 'uploading' | 'success' | 'error' | 'unsupported'

interface QueueItem {
  id: string
  file: File
  previewUrl: string | null
  status: QueueItemStatus
  message: string
  uploadedUrl?: string
  width?: number
  height?: number
  format?: string
  size?: number
}

interface SessionState {
  status: 'checking' | 'ready' | 'blocked' | 'error'
  message: string
  nickname: string
}

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickUpload: EndWikiQuickUploadPlugin
  }
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${
    units[unitIndex]
  }`
}

function isProbablyImageFile(file: File) {
  if ((file.type || '').startsWith('image/')) {
    return true
  }
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif|ico)$/i.test(file.name || '')
}

async function serializeImageFile(file: File): Promise<SerializedUploadImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read the selected image as base64.'))
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read the selected image.'))
    reader.readAsDataURL(file)
  })
  const dataBase64 = dataUrl.split(',', 2)[1] || ''
  if (!dataBase64) {
    throw new Error('Failed to extract base64 payload from the selected image.')
  }
  return {
    name: file.name || 'image',
    type: file.type || 'image/png',
    size: file.size,
    dataBase64,
  }
}

async function copyText(value: string) {
  if (!value.trim()) return false
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to execCommand fallback.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

function collectErrorMessages(error: unknown) {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (current instanceof Error) {
      if (current.message) {
        messages.push(current.message)
      }
      current = (current as Error & { cause?: unknown }).cause
      continue
    }
    if (typeof current === 'string') {
      messages.push(current)
      break
    }
    if (current && typeof current === 'object') {
      const maybeMessage = 'message' in current ? (current as { message?: unknown }).message : ''
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        messages.push(maybeMessage)
      }
      current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined
      continue
    }
    break
  }

  return [...new Set(messages.filter((message) => message.trim().length > 0))]
}

@Inject(['bridge', 'modal', 'toolbox', '$'])
export class EndWikiQuickUploadPlugin extends BasePlugin {
  constructor(public ctx: any) {
    super(ctx, {}, 'endwiki-quick-upload')
    this.ctx.set('quickUpload', this)
  }

  protected start() {
    this.ctx.inject(['toolbox'], (ctx: InPageEdit) => {
      ctx.toolbox.addButton({
        id: 'quick-upload',
        group: 'group2',
        index: 98,
        icon: <IconUpload />,
        tooltip: () => this.ctx.$`Upload Files`,
        onClick: (event: Event) => {
          event.preventDefault()
          void this.showModal()
        },
      })

      this.addDisposeHandler((disposeCtx) => {
        disposeCtx.toolbox.removeButton('quick-upload')
      })
    })
  }

  private resolveUploadHostContext() {
    const host = this.ctx.bridge?.host
    if (!host?.auth?.getSession || !host?.wiki?.stageImageFile || !host?.wiki?.uploadImageByUrl) {
      return null
    }

    return {
      auth: {
        getSession: () => host.auth!.getSession(),
      },
      wiki: {
        stageImageFile: (args: SerializedUploadImage) => host.wiki.stageImageFile(args),
        uploadImageByUrl: (args: { url: string; kind?: string }) =>
          host.wiki.uploadImageByUrl(args),
      },
    }
  }

  private notify(type: 'success' | 'warning' | 'error' | 'info', title: string, content: unknown) {
    this.ctx.modal.notify(type, {
      title,
      content,
      closeAfter: type === 'success' ? 2500 : 7000,
    })
  }

  async showModal() {
    const { $ } = this.ctx
    const uploadHost = this.resolveUploadHostContext()
    const uploadClient = uploadHost ? createWikiplusUploadClient(uploadHost) : null
    const imageResolver = uploadHost ? createWikiplusImageResolver(uploadHost) : null

    let items: QueueItem[] = []
    let selectedId: string | null = null
    let isUploading = false
    let sessionState: SessionState = uploadHost
      ? {
          status: 'checking',
          message: $`Checking the host SKLand session...`,
          nickname: '',
        }
      : {
          status: 'error',
          message: $`The host upload bridge is not available.`,
          nickname: '',
        }

    const modal = this.ctx.modal.show({
      className: 'endwiki-quickUpload compact-buttons',
      sizeClass: 'mediumToLarge',
      center: false,
      title: $`Upload Files`,
      content: $`Upload Files`,
      outSideClose: false,
      beforeClose: () => {
        if (isUploading) {
          this.notify(
            'warning',
            $`Upload in progress`,
            <p>{$`Please wait for the current upload batch to finish.`}</p>
          )
          return false
        }
        return true
      },
    })

    const ui = {
      banner: null as HTMLElement | null,
      dropZone: null as HTMLElement | null,
      fileInput: null as HTMLInputElement | null,
      list: null as HTMLElement | null,
      preview: null as HTMLElement | null,
      uploadBtn: null as HTMLButtonElement | null,
      copyBtn: null as HTMLButtonElement | null,
      addBtn: null as HTMLButtonElement | null,
    }

    const revokeItemPreview = (item: QueueItem) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl)
      }
    }

    const cleanupPreviews = () => {
      items.forEach(revokeItemPreview)
    }

    const getSelectedItem = () => items.find((item) => item.id === selectedId) || null

    const updateItem = (id: string, patch: Partial<QueueItem>) => {
      items = items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }

    const setSelected = (id: string | null) => {
      selectedId = id
      renderList()
      renderPreview()
    }

    const removeItem = (id: string) => {
      const target = items.find((item) => item.id === id)
      if (target) {
        revokeItemPreview(target)
      }
      items = items.filter((item) => item.id !== id)
      if (selectedId === id) {
        selectedId = items[0]?.id || null
      }
      renderList()
      renderPreview()
    }

    const addFiles = (files: File[]) => {
      if (!files.length) return
      const addedItems = files.map<QueueItem>((file) => {
        const supported = isProbablyImageFile(file)
        return {
          id: `upload_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: supported ? URL.createObjectURL(file) : null,
          status: supported ? 'queued' : 'unsupported',
          message: supported
            ? $`Ready to upload through the host bridge.`
            : $`Only image files are supported in this phase.`,
        }
      })

      items = [...items, ...addedItems]
      selectedId ||= addedItems[0]?.id || null
      renderList()
      renderPreview()
    }

    const refreshSessionState = async () => {
      if (!uploadHost) return
      sessionState = {
        status: 'checking',
        message: $`Checking the host SKLand session...`,
        nickname: '',
      }
      renderBanner()

      try {
        const result = await uploadHost.auth.getSession()
        if (!result.ok) {
          sessionState = {
            status: 'error',
            message: result.error.message || $`Failed to read the host SKLand session.`,
            nickname: '',
          }
          renderBanner()
          renderFooter()
          return
        }

        if (!result.data.hasSession || result.data.credentialSource !== 'account') {
          sessionState = {
            status: 'blocked',
            message: $`Sign in to a SKLand account in the host app before uploading.`,
            nickname: '',
          }
          renderBanner()
          renderFooter()
          return
        }

        sessionState = {
          status: 'ready',
          message: $`Upload bridge is ready.`,
          nickname: result.data.wikiProfileNickname || '',
        }
        renderBanner()
        renderFooter()
      } catch (error) {
        sessionState = {
          status: 'error',
          message: collectErrorMessages(error)[0] || $`Failed to read the host SKLand session.`,
          nickname: '',
        }
        renderBanner()
        renderFooter()
      }
    }

    const summarizeCounts = () => {
      let queued = 0
      let success = 0
      let error = 0
      let unsupported = 0
      for (const item of items) {
        if (item.status === 'queued') queued += 1
        if (item.status === 'success') success += 1
        if (item.status === 'error') error += 1
        if (item.status === 'unsupported') unsupported += 1
      }
      return { queued, success, error, unsupported }
    }

    const getStatusLabel = (status: QueueItemStatus) => {
      switch (status) {
        case 'queued':
          return $`Queued`
        case 'uploading':
          return $`Uploading`
        case 'success':
          return $`Uploaded`
        case 'error':
          return $`Failed`
        case 'unsupported':
          return $`Unsupported`
        default:
          return status
      }
    }

    const getStatusTone = (status: QueueItemStatus) => {
      switch (status) {
        case 'success':
          return 'is-success'
        case 'error':
          return 'is-danger'
        case 'unsupported':
          return 'is-warning'
        case 'uploading':
          return 'is-info'
        default:
          return ''
      }
    }

    const describeUploadError = (error: unknown) => {
      const messages = collectErrorMessages(error)
      if (!messages.length) {
        return $`Upload failed with an unknown error.`
      }
      return messages.join('\n')
    }

    const copyUploadedUrl = async (item: QueueItem) => {
      if (!item.uploadedUrl) return
      const copied = await copyText(item.uploadedUrl)
      if (copied) {
        this.notify('success', $`URL Copied`, <p>{item.uploadedUrl}</p>)
        return
      }
      this.notify(
        'error',
        $`Copy Failed`,
        <p>{$`The browser clipboard API is unavailable in the current host runtime.`}</p>
      )
    }

    const copyAllUploadedUrls = async () => {
      const urls = items.map((item) => item.uploadedUrl || '').filter((value) => value.length > 0)
      if (!urls.length) {
        this.notify(
          'info',
          $`No uploaded URLs`,
          <p>{$`Upload at least one image before copying URLs.`}</p>
        )
        return
      }
      const copied = await copyText(urls.join('\n'))
      if (copied) {
        this.notify(
          'success',
          $`URLs Copied`,
          <p>{$`Copied all successful upload URLs to the clipboard.`}</p>
        )
        return
      }
      this.notify(
        'error',
        $`Copy Failed`,
        <p>{$`The browser clipboard API is unavailable in the current host runtime.`}</p>
      )
    }

    const uploadOne = async (itemId: string) => {
      const item = items.find((entry) => entry.id === itemId)
      if (!item || item.status === 'unsupported') {
        return
      }
      if (!uploadClient || !imageResolver) {
        updateItem(itemId, {
          status: 'error',
          message: $`The host upload bridge is not available.`,
        })
        renderList()
        renderPreview()
        return
      }
      if (sessionState.status !== 'ready') {
        this.notify('warning', $`Session Required`, <p>{sessionState.message}</p>)
        return
      }

      updateItem(itemId, {
        status: 'uploading',
        message: $`Uploading through the host bridge...`,
      })
      renderList()
      renderPreview()

      try {
        const serialized = await serializeImageFile(item.file)
        const result = await uploadClient.uploadWithResolver(serialized, imageResolver)
        updateItem(itemId, {
          status: 'success',
          uploadedUrl: result.url,
          width: result.width,
          height: result.height,
          format: result.format,
          size: result.size,
          message: $`Upload completed. Copy the final wiki URL from this row or the preview panel.`,
        })
      } catch (error) {
        updateItem(itemId, {
          status: 'error',
          message: describeUploadError(error),
        })
      }

      renderList()
      renderPreview()
      renderFooter()
    }

    const runBatchUpload = async (mode: 'queued' | 'retry') => {
      if (isUploading) return
      if (sessionState.status !== 'ready') {
        this.notify('warning', $`Session Required`, <p>{sessionState.message}</p>)
        return
      }
      const candidates = items.filter((item) =>
        mode === 'queued' ? item.status === 'queued' : item.status === 'error'
      )
      if (!candidates.length) {
        return
      }

      isUploading = true
      renderFooter()
      renderList()
      try {
        for (const item of candidates) {
          await uploadOne(item.id)
        }
      } finally {
        isUploading = false
        renderFooter()
        renderList()
        renderPreview()
      }
    }

    const setButtonDisabled = (button: HTMLButtonElement | null, disabled: boolean) => {
      if (!button) return
      button.toggleAttribute('disabled', disabled)
      button.classList.toggle('is-disabled', disabled)
    }

    const renderBanner = () => {
      if (!ui.banner) return

      ui.dropZone?.classList.toggle('is-disabled', sessionState.status !== 'ready')

      const toneClass =
        sessionState.status === 'ready'
          ? 'is-success'
          : sessionState.status === 'checking'
            ? 'is-info'
            : sessionState.status === 'blocked'
              ? 'is-warning'
              : 'is-danger'
      const accountText =
        sessionState.status === 'ready' && sessionState.nickname
          ? `${$`Signed in as`}: ${sessionState.nickname}`
          : sessionState.message

      ui.banner.innerHTML = ''
      ui.banner.append(
        (
          <div className={`endwiki-uploadPanel__notice ${toneClass}`}>
            <div className="endwiki-uploadPanel__noticeBody">
              <strong>{$`Upload Bridge`}</strong>
              <p>{accountText}</p>
              <p>{$`The button says "file", but phase 1 only uploads image files. Other files stay in the queue as unsupported.`}</p>
            </div>
            <button
              type="button"
              className="endwiki-uploadPanel__secondaryButton"
              onClick={() => {
                void refreshSessionState()
              }}
            >
              {$`Refresh Session`}
            </button>
          </div>
        ) as HTMLElement
      )
    }

    const renderList = () => {
      if (!ui.list) return
      const counts = summarizeCounts()

      ui.list.innerHTML = ''
      if (!items.length) {
        ui.list.append(
          (
            <div className="endwiki-uploadPanel__empty">
              <strong>{$`No files selected`}</strong>
              <p>{$`Choose or drop files to start building an upload queue.`}</p>
            </div>
          ) as HTMLElement
        )
        renderFooter()
        return
      }

      const list = (
        <div className="endwiki-uploadPanel__queueBody">
          <div className="endwiki-uploadPanel__queueMeta">
            <span>
              {$`Queued`}: {counts.queued}
            </span>
            <span>
              {$`Uploaded`}: {counts.success}
            </span>
            <span>
              {$`Failed`}: {counts.error}
            </span>
            <span>
              {$`Unsupported`}: {counts.unsupported}
            </span>
          </div>
          <ul className="endwiki-uploadPanel__queueList" />
        </div>
      ) as HTMLElement
      const listRoot = list.querySelector('ul') as HTMLUListElement

      for (const item of items) {
        const active = item.id === selectedId
        listRoot.append(
          (
            <li
              className={`endwiki-uploadPanel__queueItem${active ? ' is-active' : ''}`}
              onClick={() => setSelected(item.id)}
            >
              <div className="endwiki-uploadPanel__queueTop">
                <div className="endwiki-uploadPanel__fileSummary">
                  <strong>{item.file.name}</strong>
                  <span>{formatFileSize(item.file.size)}</span>
                </div>
                <span className={`endwiki-uploadPanel__status ${getStatusTone(item.status)}`}>
                  {getStatusLabel(item.status)}
                </span>
              </div>
              <div className="endwiki-uploadPanel__queueMessage">{item.message}</div>
              <div className="endwiki-uploadPanel__queueActions">
                {item.status === 'success' ? (
                  <button
                    type="button"
                    className="endwiki-uploadPanel__inlineButton is-primary"
                    onClick={(event) => {
                      event.stopPropagation()
                      void copyUploadedUrl(item)
                    }}
                  >
                    {$`Copy URL`}
                  </button>
                ) : null}
                {item.status === 'error' ? (
                  <button
                    type="button"
                    className="endwiki-uploadPanel__inlineButton"
                    onClick={(event) => {
                      event.stopPropagation()
                      void uploadOne(item.id)
                    }}
                  >
                    {$`Retry`}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="endwiki-uploadPanel__inlineButton"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeItem(item.id)
                  }}
                >
                  {$`Remove`}
                </button>
              </div>
            </li>
          ) as HTMLElement
        )
      }

      ui.list.append(list)
      renderFooter()
    }

    const renderPreview = () => {
      if (!ui.preview) return
      ui.preview.innerHTML = ''

      const item = getSelectedItem()
      if (!item) {
        ui.preview.append(
          (
            <div className="endwiki-uploadPanel__previewPlaceholder">
              <IconUpload />
              <p>{$`Select a queue item to inspect its preview and upload result.`}</p>
            </div>
          ) as HTMLElement
        )
        return
      }

      const previewMedia =
        item.previewUrl && isProbablyImageFile(item.file) ? (
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="endwiki-uploadPanel__previewImage"
          />
        ) : (
          <div className="endwiki-uploadPanel__previewPlaceholder is-compact">
            <IconUpload />
            <p>{$`No image preview available`}</p>
          </div>
        )

      ui.preview.append(
        (
          <div className="endwiki-uploadPanel__previewCard">
            <div className="endwiki-uploadPanel__previewTop">
              <div>
                <strong>{item.file.name}</strong>
                <p>{item.file.type || $`Unknown type`}</p>
              </div>
              <span className={`endwiki-uploadPanel__status ${getStatusTone(item.status)}`}>
                {getStatusLabel(item.status)}
              </span>
            </div>
            <div className="endwiki-uploadPanel__previewMedia">{previewMedia}</div>
            <div className="endwiki-uploadPanel__previewMeta">
              <span>{formatFileSize(item.file.size)}</span>
              {item.width && item.height ? (
                <span>
                  {item.width} × {item.height}
                </span>
              ) : null}
              {item.format ? <span>{item.format}</span> : null}
            </div>
            <div className="endwiki-uploadPanel__previewMessage">{item.message}</div>
            {item.uploadedUrl ? (
              <label className="endwiki-uploadPanel__field">
                <span>{$`Uploaded URL`}</span>
                <div className="endwiki-uploadPanel__copyField">
                  <input type="text" readOnly value={item.uploadedUrl} />
                  <button
                    type="button"
                    className="endwiki-uploadPanel__inlineButton is-primary"
                    onClick={() => {
                      void copyUploadedUrl(item)
                    }}
                  >
                    {$`Copy URL`}
                  </button>
                </div>
              </label>
            ) : null}
          </div>
        ) as HTMLElement
      )
    }

    const renderFooter = () => {
      const counts = summarizeCounts()
      const uploadLabel = counts.queued > 0 ? $`Upload queued` : $`Retry failed`

      modal.setButtons([
        {
          id: 'endwiki-upload-close',
          label: $`Close`,
          className: 'is-text',
          method: () => modal.close(),
        },
        {
          id: 'endwiki-upload-add',
          label: $`Choose Files`,
          className: 'is-text',
          method: () => {
            ui.fileInput?.click()
          },
        },
        {
          id: 'endwiki-upload-run',
          label: isUploading ? $`Uploading...` : uploadLabel,
          className: 'is-text',
          method: () => {
            if (isUploading) return
            if (counts.queued > 0) {
              void runBatchUpload('queued')
              return
            }
            if (counts.error > 0) {
              void runBatchUpload('retry')
            }
          },
        },
        {
          id: 'endwiki-upload-copy',
          label: $`Copy successful URLs`,
          className: 'is-primary is-ghost',
          method: () => {
            void copyAllUploadedUrls()
          },
        },
      ])

      queueMicrotask(() => {
        const modalWindow = modal.get$window()
        ui.addBtn = modalWindow.querySelector('#endwiki-upload-add') as HTMLButtonElement | null
        ui.uploadBtn = modalWindow.querySelector('#endwiki-upload-run') as HTMLButtonElement | null
        ui.copyBtn = modalWindow.querySelector('#endwiki-upload-copy') as HTMLButtonElement | null

        setButtonDisabled(ui.addBtn, sessionState.status === 'checking' || isUploading)
        setButtonDisabled(
          ui.uploadBtn,
          isUploading ||
            sessionState.status !== 'ready' ||
            (counts.queued === 0 && counts.error === 0)
        )
        setButtonDisabled(ui.copyBtn, counts.success === 0)
      })
    }

    const content = (
      <section className="endwiki-uploadPanel">
        <input
          type="file"
          multiple
          style={{ display: 'none' }}
          ref={(node: HTMLInputElement | null) => {
            ui.fileInput = node
          }}
          onChange={(event: Event) => {
            if (sessionState.status !== 'ready') {
              return
            }
            const target = event.target as HTMLInputElement
            addFiles([...(target.files || [])])
            target.value = ''
          }}
        />
        <div
          ref={(node: HTMLElement | null) => {
            ui.banner = node
          }}
        />
        <div
          className="endwiki-uploadPanel__dropZone"
          ref={(node: HTMLElement | null) => {
            ui.dropZone = node
          }}
          onDragOver={(event: DragEvent) => {
            if (sessionState.status !== 'ready') return
            event.preventDefault()
            ui.dropZone?.classList.add('is-dragover')
          }}
          onDragLeave={() => {
            ui.dropZone?.classList.remove('is-dragover')
          }}
          onDrop={(event: DragEvent) => {
            ui.dropZone?.classList.remove('is-dragover')
            if (sessionState.status !== 'ready') return
            event.preventDefault()
            addFiles([...(event.dataTransfer?.files || [])])
          }}
        >
          <div className="endwiki-uploadPanel__dropContent">
            <IconUpload />
            <strong>{$`Choose or drop files`}</strong>
            <p>{$`Image upload is live now. Non-image files will stay in the queue as unsupported placeholders.`}</p>
            <button
              type="button"
              className="endwiki-uploadPanel__primaryButton"
              onClick={() => {
                if (sessionState.status !== 'ready') {
                  return
                }
                ui.fileInput?.click()
              }}
            >
              {$`Choose Files`}
            </button>
          </div>
        </div>
        <div className="endwiki-uploadPanel__layout">
          <section className="endwiki-uploadPanel__column">
            <div className="endwiki-uploadPanel__sectionTitle">{$`Upload Queue`}</div>
            <div
              ref={(node: HTMLElement | null) => {
                ui.list = node
              }}
            />
          </section>
          <section className="endwiki-uploadPanel__column">
            <div className="endwiki-uploadPanel__sectionTitle">{$`Preview & Result`}</div>
            <div
              ref={(node: HTMLElement | null) => {
                ui.preview = node
              }}
            />
          </section>
        </div>
      </section>
    ) as HTMLElement

    modal.setContent(content)
    renderBanner()
    renderList()
    renderPreview()
    renderFooter()

    modal.on(modal.Event.Close, () => {
      cleanupPreviews()
    })

    void refreshSessionState()

    return modal
  }
}

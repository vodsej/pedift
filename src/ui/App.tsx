import { useCallback, useEffect, useState } from 'preact/hooks'
import { Landing, type QuickToolId } from './Landing'
import { Workspace } from './Workspace'
import { ToastHost } from './components/ToastHost'
import { PasswordDialog } from './PasswordDialog'
import { MergeWizard } from './quicktools/MergeWizard'
import { ImagesToPdfWizard } from './quicktools/ImagesToPdfWizard'
import { CompressWizard } from './quicktools/CompressWizard'
import { ProtectWizard } from './quicktools/ProtectWizard'
import { useTheme } from './theme'
import { toast } from './toast'
import { friendlyMessage, PdfError } from '../core/errors'
import { EditorDocument } from '../core/document'
import { RenderRegistry } from '../render/registry'
import { probeEncryptionSupport } from '../core/crypto'
import { openFileAsSession } from './openFlow'
import { isPdfFile } from '../io/fileio'
import { t } from '../strings/en'

const LARGE_FILE_BYTES = 100 * 1024 * 1024

interface PasswordPrompt {
  wrong: boolean
  resolve: (password: string | null) => void
}

interface Session {
  editor: EditorDocument
  registry: RenderRegistry
  fileName: string
}

export function App() {
  const [theme, toggleTheme] = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [opening, setOpening] = useState(false)
  const [prompt, setPrompt] = useState<PasswordPrompt | null>(null)
  const [quickTool, setQuickTool] = useState<QuickToolId | null>(null)
  const [protectSupported, setProtectSupported] = useState(true)

  // Phase-1 encryption spike, in-browser: gate protect/unprotect on a real probe.
  useEffect(() => {
    probeEncryptionSupport().then(setProtectSupported).catch(() => setProtectSupported(false))
  }, [])

  const requestPassword = useCallback(
    (wrong: boolean) =>
      new Promise<string | null>((resolve) => setPrompt({ wrong, resolve })),
    [],
  )

  const openFile = useCallback(
    async (file: File) => {
      if (file.size > LARGE_FILE_BYTES) {
        toast.info(t.toasts.largeFileWarning(Math.round(file.size / 1024 / 1024)))
      }
      setOpening(true)
      try {
        const opened = await openFileAsSession(file, { requestPassword })
        const editor = await EditorDocument.open(opened.bytes, opened.fileName, opened.password)
        const registry = new RenderRegistry((id) => editor.getSource(id))
        registry.seed('original', opened.opened)
        setSession((prev) => {
          if (prev) void prev.registry.destroy()
          return { editor, registry, fileName: opened.fileName }
        })
        toast.success(t.toasts.opened(opened.fileName))
      } catch (err) {
        const e = err instanceof PdfError ? err : null
        const cancelled = e ? e.kind === 'encrypted' || e.kind === 'wrong-password' : false
        if (!cancelled) toast.error(friendlyMessage(err))
      } finally {
        setOpening(false)
        setPrompt(null)
      }
    },
    [requestPassword],
  )

  const closeSession = useCallback(() => {
    setSession((prev) => {
      if (prev) void prev.registry.destroy()
      return null
    })
  }, [])

  // Accept a PDF dropped anywhere on the landing screen.
  useEffect(() => {
    if (session) return
    const onOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer?.files?.[0]
      if (f && isPdfFile(f)) void openFile(f)
    }
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [session, openFile])

  return (
    <>
      {session ? (
        <Workspace
          editor={session.editor}
          registry={session.registry}
          fileName={session.fileName}
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={closeSession}
          protectSupported={protectSupported}
        />
      ) : (
        <Landing
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenFile={openFile}
          opening={opening}
          onQuickTool={setQuickTool}
        />
      )}

      {prompt && (
        <PasswordDialog
          wrong={prompt.wrong}
          onSubmit={(pw) => {
            prompt.resolve(pw)
            setPrompt(null)
          }}
          onCancel={() => {
            prompt.resolve(null)
            setPrompt(null)
          }}
        />
      )}

      {quickTool === 'merge' && <MergeWizard onClose={() => setQuickTool(null)} />}
      {quickTool === 'images' && <ImagesToPdfWizard onClose={() => setQuickTool(null)} />}
      {quickTool === 'compress' && <CompressWizard onClose={() => setQuickTool(null)} />}
      {quickTool === 'protect' && (
        <ProtectWizard supported={protectSupported} onClose={() => setQuickTool(null)} />
      )}

      <ToastHost />
    </>
  )
}

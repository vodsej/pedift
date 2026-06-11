import { useCallback, useState } from 'preact/hooks'
import { Landing, type QuickToolId } from './Landing'
import { Workspace } from './Workspace'
import { ToastHost } from './components/ToastHost'
import { PasswordDialog } from './PasswordDialog'
import { MergeWizard } from './quicktools/MergeWizard'
import { ImagesToPdfWizard } from './quicktools/ImagesToPdfWizard'
import { useTheme } from './theme'
import { toast } from './toast'
import { friendlyMessage, PdfError } from '../core/errors'
import { EditorDocument } from '../core/document'
import { RenderRegistry } from '../render/registry'
import { openFileAsSession } from './openFlow'
import { t } from '../strings/en'

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

  const requestPassword = useCallback(
    (wrong: boolean) =>
      new Promise<string | null>((resolve) => setPrompt({ wrong, resolve })),
    [],
  )

  const openFile = useCallback(
    async (file: File) => {
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

      <ToastHost />
    </>
  )
}

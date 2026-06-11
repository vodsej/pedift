import { useCallback, useState } from 'preact/hooks'
import { Landing } from './Landing'
import { Workspace } from './Workspace'
import { ToastHost } from './components/ToastHost'
import { PasswordDialog } from './PasswordDialog'
import { useTheme } from './theme'
import { toast } from './toast'
import { friendlyMessage, PdfError } from '../core/errors'
import { destroyPdf } from '../render/pdfjs'
import { openFileAsSession, type OpenedSession } from './openFlow'
import { t } from '../strings/en'

interface PasswordPrompt {
  wrong: boolean
  resolve: (password: string | null) => void
}

export function App() {
  const [theme, toggleTheme] = useTheme()
  const [session, setSession] = useState<OpenedSession | null>(null)
  const [opening, setOpening] = useState(false)
  const [prompt, setPrompt] = useState<PasswordPrompt | null>(null)

  const requestPassword = useCallback(
    (wrong: boolean) =>
      new Promise<string | null>((resolve) => {
        setPrompt({ wrong, resolve })
      }),
    [],
  )

  const openFile = useCallback(
    async (file: File) => {
      setOpening(true)
      try {
        const next = await openFileAsSession(file, { requestPassword })
        setSession((prev) => {
          if (prev) void destroyPdf(prev.opened.document)
          return next
        })
        toast.success(t.toasts.opened(next.fileName))
      } catch (err) {
        // We always supply a password handler, so an escaping encrypted/wrong-password
        // error means the user cancelled the prompt — stay silent in that case.
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
      if (prev) void destroyPdf(prev.opened.document)
      return null
    })
  }, [])

  return (
    <>
      {session ? (
        <Workspace
          session={session}
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

      <ToastHost />
    </>
  )
}

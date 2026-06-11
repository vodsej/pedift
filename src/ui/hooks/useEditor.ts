import { useEffect, useState } from 'preact/hooks'
import type { EditorDocument } from '../../core/document'

/** Re-renders the component whenever the editor's state changes (undo/redo/edits). */
export function useEditorState(editor: EditorDocument): EditorDocument {
  const [, setTick] = useState(0)
  useEffect(() => editor.subscribe(() => setTick((n) => n + 1)), [editor])
  return editor
}

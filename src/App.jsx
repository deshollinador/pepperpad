import { useState, useEffect } from 'react'
import NoteList from './components/NoteList'
import NoteDetail from './components/NoteDetail'
import { initialNotes } from './data/initialData'

function App() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('pepperpad-notes')
    return saved ? JSON.parse(saved) : initialNotes
  })
  const [selectedNote, setSelectedNote] = useState(null)

  useEffect(() => {
    localStorage.setItem('pepperpad-notes', JSON.stringify(notes))
  }, [notes])

  const createNote = () => {
    const newNote = {
      id: Date.now().toString(),
      templateType: 'simple',
      title: 'Nueva nota',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks: []
    }
    setNotes([newNote, ...notes])
    setSelectedNote(newNote)
  }

  const updateNote = (updatedNote) => {
    setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n))
    setSelectedNote(updatedNote)
  }

  const deleteNote = (noteId) => {
    setNotes(notes.filter(n => n.id !== noteId))
    setSelectedNote(null)
  }

  const duplicateNote = (note) => {
    const duplicated = {
      ...note,
      id: Date.now().toString(),
      title: note.title + ' (copia)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setNotes([duplicated, ...notes])
  }

  return (
    <div>
      {selectedNote ? (
        <NoteDetail
          note={selectedNote}
          onBack={() => setSelectedNote(null)}
          onUpdate={updateNote}
          onDelete={deleteNote}
        />
      ) : (
        <NoteList
          notes={notes}
          onSelectNote={setSelectedNote}
          onCreateNote={createNote}
          onDeleteNote={deleteNote}
          onDuplicateNote={duplicateNote}
        />
      )}
    </div>
  )
}

export default App
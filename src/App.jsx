// src/App.jsx
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
      title: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks: [
        {
          id: Date.now().toString() + '-block',
          title: '',
          body: '',
          attributes: [],
          children: [],
          collapsed: false,
          order: 0
        }
      ]
    }
    setNotes([newNote, ...notes])
    setSelectedNote(newNote)
  }

  const updateNote = (updatedNote) => {
    const updated = { ...updatedNote, updatedAt: new Date().toISOString() }
    setNotes(notes.map(n => n.id === updated.id ? updated : n))
    setSelectedNote(updated)
  }

  const deleteNote = (noteId) => {
    setNotes(notes.filter(n => n.id !== noteId))
    setSelectedNote(null)
  }

  const duplicateNote = (note) => {
    const duplicated = {
      ...note,
      id: Date.now().toString(),
      title: note.title ? note.title + ' (copia)' : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setNotes([duplicated, ...notes])
  }

  const handleBack = (note) => {
    const isEmpty = !note.title.trim() &&
      note.blocks.every(b =>
        !b.title.trim() && !b.body.trim() &&
        (b.children || []).every(c => !c.title.trim() && !c.body.trim())
      )

    if (isEmpty) {
      deleteNote(note.id)
    } else {
      setSelectedNote(null)
    }
  }

  return (
    <div>
      {selectedNote ? (
        <NoteDetail
          note={selectedNote}
          onBack={handleBack}
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
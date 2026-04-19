// src/App.jsx
import { useState, useEffect } from 'react'
import NoteList from './components/NoteList'
import NoteDetail from './components/NoteDetail'

function App() {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('pepperpad-notes')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedNote, setSelectedNote] = useState(null)

  useEffect(() => {
    localStorage.setItem('pepperpad-notes', JSON.stringify(notes))
  }, [notes])

  const createNote = () => {
    const newNote = {
      id: Date.now().toString(),
      isStructured: false,
      title: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    setNotes(prev => [newNote, ...prev])
    setSelectedNote(newNote)
  }

  const updateNote = (updatedNote) => {
    const updated = { ...updatedNote, updatedAt: Date.now() }
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    setSelectedNote(updated)
  }

  const deleteNote = (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId))
    setSelectedNote(null)
  }

  const duplicateNote = (note) => {
    const duplicated = {
      ...note,
      id: Date.now().toString(),
      title: note.title ? note.title + ' (copia)' : '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setNotes(prev => [duplicated, ...prev])
  }

  const handleBack = (note) => {
    const isBlockEmpty = (b) =>
      !b.title?.trim() && !b.body?.trim() && (b.attributes || []).length === 0

    const cleanedBlocks = note.blocks.filter(b => !isBlockEmpty(b))
    const finalBlocks = cleanedBlocks.length > 0 ? cleanedBlocks : note.blocks.slice(0, 1)
    const finalNote = { ...note, blocks: finalBlocks }

    const isEmpty = !finalNote.title.trim() &&
      finalNote.blocks.every(b =>
        !b.title?.trim() && !b.body?.trim() &&
        (b.children || []).every(c => !c.title?.trim() && !c.body?.trim())
      )

    if (isEmpty) {
      deleteNote(finalNote.id)
    } else {
      setNotes(prev => prev.map(n => n.id === finalNote.id ? { ...finalNote, updatedAt: Date.now() } : n))
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

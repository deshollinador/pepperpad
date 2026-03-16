import { useState } from 'react'
import NoteList from './components/NoteList'
import NoteDetail from './components/NoteDetail'

function App() {
  const [selectedNote, setSelectedNote] = useState(null)

  return (
    <div>
      {selectedNote ? (
        <NoteDetail
          note={selectedNote}
          onBack={() => setSelectedNote(null)}
        />
      ) : (
        <NoteList onSelectNote={setSelectedNote} />
      )}
    </div>
  )
}

export default App
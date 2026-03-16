import { useState } from 'react'
import { initialNotes } from '../data/initialData'

function NoteList({ onSelectNote }) {
  const [notes] = useState(initialNotes)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Buscar..."
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            fontSize: '16px',
            outline: 'none'
          }}
        />
      </div>

      <div>
        {notes.map(note => (
          <div
            key={note.id}
            onClick={() => onSelectNote(note)}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid var(--color-border)',
              cursor: 'pointer'
            }}
          >
            <span>{note.title}</span>
          </div>
        ))}
      </div>

      <button
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: 'var(--color-text)',
          color: 'var(--color-bg)',
          fontSize: '28px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        +
      </button>
    </div>
  )
}

export default NoteList
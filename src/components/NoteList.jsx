import { useState } from 'react'

function NoteList({ notes, onSelectNote, onCreateNote }) {
  const [search, setSearch] = useState('')

  const filtered = notes.filter(note =>
    note.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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
        {filtered.map(note => (
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
        onClick={onCreateNote}
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
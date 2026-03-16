import { useState } from 'react'

function NoteList({ notes, onSelectNote, onCreateNote, onDeleteNote, onDuplicateNote }) {
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState(null)

  const filtered = notes.filter(note =>
    note.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleLongPress = (note, e) => {
    e.preventDefault()
    setContextMenu(note.id)
  }

  const handleDelete = (note) => {
    if (window.confirm('¿Eliminar esta nota?')) {
      onDeleteNote(note.id)
    }
    setContextMenu(null)
  }

  const handleDuplicate = (note) => {
    onDuplicateNote(note)
    setContextMenu(null)
  }

  return (
    <div onClick={() => setContextMenu(null)}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <span style={{
          fontSize: '20px',
          fontWeight: 'bold',
          letterSpacing: '0.5px'
        }}>
          <span>PEPPER</span><span style={{ fontWeight: '400' }}>PAD</span>
        </span>

        <button style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '20px',
          color: 'var(--color-text-light)'
        }}>
          ☰
        </button>
      </div>

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
            onClick={() => contextMenu ? setContextMenu(null) : onSelectNote(note)}
            onContextMenu={e => handleLongPress(note, e)}
            style={{
              padding: '12px 0',
              borderBottom: '1px solid var(--color-border)',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <span>{note.title}</span>

            {contextMenu === note.id && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  right: '0',
                  top: '0',
                  background: 'white',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  minWidth: '160px'
                }}
              >
                <div
                  onClick={() => handleDuplicate(note)}
                  style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Duplicar
                </div>
                <div
                  onClick={() => handleDelete(note)}
                  style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
                >
                  Eliminar
                </div>
              </div>
            )}
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
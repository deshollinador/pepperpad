import { useState } from 'react'

function Block({ block, onChange, onDelete, onDuplicate }) {
  const [collapsed, setCollapsed] = useState(true)
  const [contextMenu, setContextMenu] = useState(false)

  const handleLongPress = (e) => {
    e.preventDefault()
    setContextMenu(true)
  }

  return (
    <div
      style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 0', position: 'relative' }}
      onClick={() => setContextMenu(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          type="text"
          value={block.title}
          onChange={e => onChange({ ...block, title: e.target.value })}
          onContextMenu={handleLongPress}
          placeholder="Título del bloque"
          style={{
            border: 'none',
            fontSize: '16px',
            outline: 'none',
            fontFamily: 'var(--font-main)',
            width: '100%'
          }}
        />
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '18px', paddingLeft: '8px' }}
        >
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {!collapsed && (
        <textarea
          value={block.body}
          onChange={e => onChange({ ...block, body: e.target.value })}
          placeholder="Escribe algo..."
          style={{
            marginTop: '8px',
            width: '100%',
            minHeight: '80px',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-main)',
            fontSize: '14px',
            color: 'var(--color-text-light)',
            resize: 'none'
          }}
        />
      )}

      {contextMenu && (
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
            onClick={() => {
              onDuplicate(block)
              setContextMenu(false)
            }}
            style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}
          >
            Duplicar bloque
          </div>
          <div
            onClick={() => {
              if (window.confirm('¿Eliminar este bloque?')) {
                onDelete(block.id)
              }
              setContextMenu(false)
            }}
            style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
          >
            Eliminar bloque
          </div>
        </div>
      )}
    </div>
  )
}

function NoteDetail({ note, onBack, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(note.blocks)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    onUpdate({ ...note, title: newTitle, blocks })
  }

  const handleBlockChange = (updatedBlock) => {
    const newBlocks = blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks })
  }

  const handleBlockDelete = (blockId) => {
    const newBlocks = blocks.filter(b => b.id !== blockId)
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks })
  }

  const handleBlockDuplicate = (block) => {
    const duplicated = {
      ...block,
      id: Date.now().toString(),
      order: block.order + 1
    }
    const index = blocks.findIndex(b => b.id === block.id)
    const newBlocks = [
      ...blocks.slice(0, index + 1),
      duplicated,
      ...blocks.slice(index + 1)
    ]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks })
  }

  const addBlock = () => {
    const newBlock = {
      id: Date.now().toString(),
      title: '',
      body: '',
      attributes: [],
      children: [],
      collapsed: true,
      order: blocks.length
    }
    const newBlocks = [...blocks, newBlock]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks })
  }

  const handleDelete = () => {
    if (window.confirm('¿Eliminar esta nota?')) {
      onDelete(note.id)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0' }}
        >
          ←
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}
          >
            ···
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              right: '0',
              top: '28px',
              background: 'white',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              zIndex: 10,
              minWidth: '160px'
            }}>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}
              >
                Exportar
              </div>
              <div
                onClick={handleDelete}
                style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
              >
                Eliminar nota
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          style={{
            width: '100%',
            border: 'none',
            fontSize: '24px',
            fontWeight: 'bold',
            outline: 'none',
            fontFamily: 'var(--font-main)'
          }}
        />
      </div>

      <div>
        {blocks.map(block => (
          <Block
            key={block.id}
            block={block}
            onChange={handleBlockChange}
            onDelete={handleBlockDelete}
            onDuplicate={handleBlockDuplicate}
          />
        ))}

        <button
          onClick={addBlock}
          style={{
            marginTop: '16px',
            background: 'none',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '10px',
            width: '100%',
            cursor: 'pointer',
            color: 'var(--color-text-light)',
            fontSize: '14px'
          }}
        >
          + Añadir bloque
        </button>
      </div>
    </div>
  )
}

export default NoteDetail
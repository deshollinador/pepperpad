import { useState } from 'react'

function Block({ block }) {
  const [collapsed, setCollapsed] = useState(true)
  const [title, setTitle] = useState(block.title)
  const [body, setBody] = useState(block.body)

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
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
          value={body}
          onChange={e => setBody(e.target.value)}
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
    </div>
  )
}

function NoteDetail({ note, onBack }) {
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(note.blocks)

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
    setBlocks([...blocks, newBlock])
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0', marginRight: '16px' }}
        >
          ←
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
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
          <Block key={block.id} block={block} />
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
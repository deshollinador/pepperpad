// src/components/NoteDetail.jsx
import { useState, useRef } from 'react'
import Block from './Block'

function NoteDetail({ note, onBack, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title)
  const [noteBody, setNoteBody] = useState(note.body || '')
  const [titleCollapsed, setTitleCollapsed] = useState(true)
  const [blocks, setBlocks] = useState(note.blocks)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropIndicator, setDropIndicator] = useState(null)

  const dragInfo = useRef(null)
  const blocksRef = useRef(null)

  const save = (newBlocks) => {
    setBlocks(newBlocks)
    onUpdate({ ...note, title, body: noteBody, blocks: newBlocks })
  }

  const removeBlock = (list, id) =>
    list
      .filter(b => b.id !== id)
      .map(b => ({ ...b, children: (b.children || []).filter(c => c.id !== id) }))

  const handleBlockChange = (updated) => {
    const newBlocks = blocks.map(b => {
      if (b.id === updated.id) return updated
      if (b.children?.some(c => c.id === updated.id))
        return { ...b, children: b.children.map(c => c.id === updated.id ? updated : c) }
      return b
    })
    save(newBlocks)
  }

  const handleBlockDelete = (id) => {
    save(removeBlock(blocks, id))
  }

  const handleBlockDuplicate = (block) => {
    const isTop = blocks.some(b => b.id === block.id)
    const dup = {
      ...block,
      id: Date.now().toString(),
      children: (block.children || []).map(c => ({ ...c, id: Date.now().toString() + Math.random() }))
    }
    if (isTop) {
      const i = blocks.findIndex(b => b.id === block.id)
      save([...blocks.slice(0, i + 1), dup, ...blocks.slice(i + 1)])
    } else {
      save(blocks.map(b => {
        const i = (b.children || []).findIndex(c => c.id === block.id)
        if (i === -1) return b
        const children = [...b.children.slice(0, i + 1), dup, ...b.children.slice(i + 1)]
        return { ...b, children }
      }))
    }
  }

  const handleAddChild = (parentId) => {
    const child = { id: Date.now().toString(), title: '', body: '', attributes: [], children: [], collapsed: true, order: 0 }
    save(blocks.map(b => b.id === parentId ? { ...b, children: [...(b.children || []), child] } : b))
  }

  const addBlock = () => {
    const b = { id: Date.now().toString(), title: '', body: '', attributes: [], children: [], collapsed: true, order: blocks.length }
    save([...blocks, b])
  }

  const handleDragStart = (block, parentId) => {
    dragInfo.current = { block, parentId }
  }

  const handleDragEnd = () => {
    dragInfo.current = null
    setDropIndicator(null)
  }

  const handleDragOverContainer = (e) => {
    e.preventDefault()
    if (!dragInfo.current || !blocksRef.current) return

    const { block: dragged } = dragInfo.current
    const containerRect = blocksRef.current.getBoundingClientRect()
    const x = e.clientX - containerRect.left
    const y = e.clientY

    const topBlockEls = Array.from(blocksRef.current.querySelectorAll('[data-block-id]'))
      .filter(el => el.dataset.depth === '0')

    // Check if cursor is inside an expanded parent
    for (let i = 0; i < topBlockEls.length; i++) {
      const parentEl = topBlockEls[i]
      const parentRect = parentEl.getBoundingClientRect()
      const parentBlock = blocks[i]

      if (y >= parentRect.top && y <= parentRect.bottom && parentBlock.children?.length > 0) {
        const childEls = Array.from(parentEl.querySelectorAll('[data-block-id]'))
          .filter(el => el.dataset.depth === '1')

        if (childEls.length === 0) break

        // If cursor is far left, fall through to top-level logic
        if (x < 32) break

        let childIndex = parentBlock.children.length
        for (let j = 0; j < childEls.length; j++) {
          const childRect = childEls[j].getBoundingClientRect()
          const midY = childRect.top + childRect.height / 2
          if (y < midY) {
            childIndex = j
            break
          }
        }

        setDropIndicator({ type: 'between-children', parentId: parentBlock.id, beforeIndex: childIndex })
        return
      }
    }

    // Top-level logic
    let targetIndex = blocks.length
    for (let i = 0; i < topBlockEls.length; i++) {
      const rect = topBlockEls[i].getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      if (y < midY) {
        targetIndex = i
        break
      }
    }

    const indentThreshold = 48
    const nestIntent = x > indentThreshold

    let candidateParent = null
    if (nestIntent && topBlockEls.length > 0) {
      for (let i = 0; i < topBlockEls.length; i++) {
        const rect = topBlockEls[i].getBoundingClientRect()
        if (y >= rect.top && y <= rect.bottom) {
          candidateParent = blocks[i]
          break
        }
        if (i < topBlockEls.length - 1) {
          const nextRect = topBlockEls[i + 1].getBoundingClientRect()
          if (y > rect.bottom && y < nextRect.top) {
            candidateParent = blocks[i]
            break
          }
        }
      }
    }

    const wouldNest = nestIntent && candidateParent && candidateParent.id !== dragged.id
    const blocked = wouldNest && (dragged.children?.length > 0)

    if (wouldNest && !blocked) {
      setDropIndicator({ type: 'into', blockId: candidateParent.id })
    } else {
      setDropIndicator({ type: 'between', beforeIndex: targetIndex })
    }
  }

  const handleDropOnContainer = (e) => {
    e.preventDefault()
    if (!dragInfo.current || !dropIndicator) return

    const { block: dragged } = dragInfo.current
    const originalIndex = blocks.findIndex(b => b.id === dragged.id)
    let newBlocks = removeBlock(blocks, dragged.id)

    if (dropIndicator.type === 'into') {
      const demoted = { ...dragged, children: [] }
      newBlocks = newBlocks.map(b =>
        b.id === dropIndicator.blockId
          ? { ...b, children: [...(b.children || []), demoted] }
          : b
      )
    } else if (dropIndicator.type === 'between-children') {
      const demoted = { ...dragged, children: [] }
      newBlocks = newBlocks.map(b => {
        if (b.id !== dropIndicator.parentId) return b
        const children = [...(b.children || []).filter(c => c.id !== dragged.id)]
        const originalChildIndex = (b.children || []).findIndex(c => c.id === dragged.id)
        let idx = dropIndicator.beforeIndex
        if (originalChildIndex !== -1 && originalChildIndex < idx) idx--
        idx = Math.max(0, Math.min(idx, children.length))
        children.splice(idx, 0, demoted)
        return { ...b, children }
      })
    } else {
      const promoted = { ...dragged }
      let idx = dropIndicator.beforeIndex
      if (originalIndex !== -1 && originalIndex < idx) idx--
      idx = Math.max(0, Math.min(idx, newBlocks.length))
      newBlocks.splice(idx, 0, promoted)
    }

    save(newBlocks)
    dragInfo.current = null
    setDropIndicator(null)
  }

  const handleDragLeaveContainer = (e) => {
    if (!blocksRef.current?.contains(e.relatedTarget)) {
      setDropIndicator(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}>···</button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: '0', top: '28px', background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px' }}>
              <div onClick={() => setMenuOpen(false)} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}>Exportar</div>
              <div onClick={() => { if (window.confirm('¿Eliminar esta nota?')) onDelete(note.id) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}>Eliminar nota</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <input
            type="text" value={title}
            onChange={e => { setTitle(e.target.value); onUpdate({ ...note, title: e.target.value, body: noteBody, blocks }) }}
            placeholder="Título"
            style={{ width: '100%', border: 'none', fontSize: '24px', fontWeight: 'bold', outline: 'none', fontFamily: 'var(--font-main)' }}
          />
          <span onClick={() => setTitleCollapsed(!titleCollapsed)} style={{ color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '18px', paddingLeft: '8px' }}>
            {titleCollapsed ? '▸' : '▾'}
          </span>
        </div>
        {!titleCollapsed && (
          <textarea
            value={noteBody}
            onChange={e => { setNoteBody(e.target.value); onUpdate({ ...note, title, body: e.target.value, blocks }) }}
            placeholder="Escribe algo..."
            style={{ marginTop: '8px', width: '100%', minHeight: '80px', border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text-light)', resize: 'none' }}
          />
        )}
      </div>

      <div
        ref={blocksRef}
        onDragOver={handleDragOverContainer}
        onDrop={handleDropOnContainer}
        onDragLeave={handleDragLeaveContainer}
      >
        {blocks.map((block, i) => (
          <div key={block.id} style={{ position: 'relative' }}>
            {dropIndicator?.type === 'between' && dropIndicator.beforeIndex === i && (
              <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
            )}
            <Block
              block={block}
              depth={0}
              onChange={handleBlockChange}
              onDelete={handleBlockDelete}
              onDuplicate={handleBlockDuplicate}
              onAddChild={handleAddChild}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              isDropTarget={dropIndicator?.type === 'into' && dropIndicator.blockId === block.id}
              childDropIndicator={dropIndicator?.type === 'between-children' && dropIndicator.parentId === block.id ? dropIndicator : null}
              dragInfo={dragInfo}
            />
          </div>
        ))}

        {dropIndicator?.type === 'between' && dropIndicator.beforeIndex === blocks.length && (
          <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
        )}

        <button
          onClick={addBlock}
          style={{ marginTop: '16px', background: 'none', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius)', padding: '10px', width: '100%', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '14px' }}
        >
          + Añadir
        </button>
      </div>
    </div>
  )
}

export default NoteDetail
// src/components/NoteDetail.jsx
import { useState, useRef, useEffect } from 'react'
import Block from './Block'

// ─── constantes monetarias ────────────────────────────────────
const MONETARY = ['€', '$', '£']
const isMonetary = (label) => MONETARY.includes(label)

// ─── calcular total de la nota ────────────────────────────────
const computeNoteTotal = (blocks) => {
  let total = 0
  let currency = null

  for (const block of blocks) {
    const attrs = block.attributes || []
    const monetaryAttr = attrs.find(a => isMonetary(a.label))
    if (!monetaryAttr) continue

    const udsAttr = attrs.find(a => a.label === 'uds' || a.label === 'u')
    if (attrs.length === 2 && udsAttr) {
      const qty = parseFloat(udsAttr.value)
      const price = parseFloat(monetaryAttr.value)
      if (!isNaN(qty) && !isNaN(price)) {
        total += qty * price
        currency = monetaryAttr.label
      }
    } else {
      const val = parseFloat(monetaryAttr.value)
      if (!isNaN(val)) {
        total += val
        currency = monetaryAttr.label
      }
    }
  }

  return currency ? { total: Math.round(total * 100) / 100, currency } : null
}

function NoteDetail({ note, onBack, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(note.blocks)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropIndicator, setDropIndicator] = useState(null)

  const dragInfo = useRef(null)
  const blocksRef = useRef(null)
  const firstBlockRef = useRef(null)

  const hasMultipleBlocks = blocks.length > 1

  // Recoger todas las unidades usadas en la nota para sugerencias
  const allAttributes = blocks.flatMap(b => [
    ...(b.attributes || []),
    ...(b.children || []).flatMap(c => c.attributes || [])
  ])

  const noteTotal = hasMultipleBlocks ? computeNoteTotal(blocks) : null

  useEffect(() => {
    if (!note.title && note.blocks.length === 1 && !note.blocks[0].title && !note.blocks[0].body) {
      firstBlockRef.current?.focus()
    }
  }, [])

  const save = (newBlocks, newTitle = title) => {
    setBlocks(newBlocks)
    onUpdate({ ...note, title: newTitle, blocks: newBlocks })
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
    if (blocks.length === 1) return
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
    let currentBlocks = blocks
    if (blocks.length === 1 && blocks[0].body.trim() && !blocks[0].title.trim()) {
      currentBlocks = [{ ...blocks[0], id: Date.now().toString() + '-migrated', title: blocks[0].body, body: '', collapsed: true }]
    } else {
      currentBlocks = currentBlocks.map(b => ({ ...b, id: b.id + '-r', collapsed: true }))
    }

    const b = {
      id: Date.now().toString(),
      title: '',
      body: '',
      attributes: [],
      children: [],
      collapsed: true,
      order: currentBlocks.length
    }
    const newBlocks = [...currentBlocks, b]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks })
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

    const { parentId } = dragInfo.current
    const y = e.clientY

    if (parentId === null) {
      const topBlockEls = Array.from(blocksRef.current.querySelectorAll('[data-block-id]'))
        .filter(el => el.dataset.depth === '0')

      let targetIndex = blocks.length
      for (let i = 0; i < topBlockEls.length; i++) {
        const rect = topBlockEls[i].getBoundingClientRect()
        if (y < rect.top + rect.height / 2) { targetIndex = i; break }
      }
      setDropIndicator({ type: 'between', beforeIndex: targetIndex, parentId: null })
    } else {
      const parentBlock = blocks.find(b => b.id === parentId)
      if (!parentBlock) return

      const parentEl = blocksRef.current.querySelector(`[data-block-id="${parentId}"]`)
      if (!parentEl) return

      const childEls = Array.from(parentEl.querySelectorAll('[data-block-id]'))
        .filter(el => el.dataset.depth === '1')

      let targetIndex = parentBlock.children.length
      for (let i = 0; i < childEls.length; i++) {
        const rect = childEls[i].getBoundingClientRect()
        if (y < rect.top + rect.height / 2) { targetIndex = i; break }
      }
      setDropIndicator({ type: 'between', beforeIndex: targetIndex, parentId })
    }
  }

  const handleDropOnContainer = (e) => {
    e.preventDefault()
    if (!dragInfo.current || !dropIndicator) return

    const { block: dragged, parentId } = dragInfo.current
    let newBlocks

    if (parentId === null) {
      const originalIndex = blocks.findIndex(b => b.id === dragged.id)
      newBlocks = blocks.filter(b => b.id !== dragged.id)
      let idx = dropIndicator.beforeIndex
      if (originalIndex < idx) idx--
      idx = Math.max(0, Math.min(idx, newBlocks.length))
      newBlocks.splice(idx, 0, dragged)
    } else {
      newBlocks = blocks.map(b => {
        if (b.id !== parentId) return b
        const originalChildIndex = (b.children || []).findIndex(c => c.id === dragged.id)
        const children = (b.children || []).filter(c => c.id !== dragged.id)
        let idx = dropIndicator.beforeIndex
        if (originalChildIndex !== -1 && originalChildIndex < idx) idx--
        idx = Math.max(0, Math.min(idx, children.length))
        children.splice(idx, 0, dragged)
        return { ...b, children }
      })
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
    <div onClick={() => setMenuOpen(false)}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => onBack({ ...note, title, blocks })}
          style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0' }}
        >←</button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}
          >···</button>
          {menuOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{ position: 'absolute', right: '0', top: '28px', background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px' }}
            >
              <div onClick={() => setMenuOpen(false)} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}>Exportar</div>
              <div
                onClick={() => { if (window.confirm('¿Eliminar esta nota?')) onDelete(note.id) }}
                style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
              >Eliminar nota</div>
            </div>
          )}
        </div>
      </div>

      {/* título de la nota */}
      <input
        type="text"
        value={title}
        onChange={e => {
          setTitle(e.target.value)
          onUpdate({ ...note, title: e.target.value, blocks })
        }}
        placeholder="Título"
        style={{
          width: '100%', border: 'none', fontSize: '20px', fontWeight: '600',
          outline: 'none', fontFamily: 'var(--font-main)', marginBottom: '4px',
          color: 'var(--color-text)'
        }}
      />

      {/* total de la nota */}
      {noteTotal && (
        <div style={{
          fontSize: '13px', color: 'var(--color-text-light)',
          marginBottom: '16px', textAlign: 'right',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {noteTotal.total}{noteTotal.currency}
        </div>
      )}

      {!noteTotal && <div style={{ marginBottom: '16px' }} />}

      {/* bloques */}
      <div
        ref={blocksRef}
        onDragOver={handleDragOverContainer}
        onDrop={handleDropOnContainer}
        onDragLeave={handleDragLeaveContainer}
      >
        {blocks.map((block, i) => (
          <div key={block.id} style={{ position: 'relative' }}>
            {dropIndicator?.parentId === null && dropIndicator.beforeIndex === i && (
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
              isDropTarget={false}
              childDropIndicator={dropIndicator?.parentId === block.id ? dropIndicator : null}
              dragInfo={dragInfo}
              inputRef={i === 0 ? firstBlockRef : null}
              showDivider={hasMultipleBlocks}
              allAttributes={allAttributes}
            />
          </div>
        ))}

        {dropIndicator?.parentId === null && dropIndicator.beforeIndex === blocks.length && (
          <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
        )}
      </div>

      {/* añadir bloque */}
      <button
        onClick={addBlock}
        style={{
          position: 'fixed', bottom: '24px', left: '24px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-light)', fontSize: '13px', padding: '0'
        }}
      >+ Nuevo</button>
    </div>
  )
}

export default NoteDetail
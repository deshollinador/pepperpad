// src/components/NoteDetail.jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import Block from './Block'

const MONETARY = ['€', '$', '£']
const isMonetary = (label) => MONETARY.includes(label)

// ─── formatear valor monetario con dos decimales y coma ───────
const formatMonetary = (value) => {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toFixed(2).replace('.', ',')
}

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

const isBlockEmpty = (block) =>
  !block.title?.trim() && !block.body?.trim() && (block.attributes || []).length === 0

// ─── parser inline ────────────────────────────────────────────
const parseInlineAttributes = (raw) => {
  const tokenRegex = /(?:^|(?<=\s))[@=]\s*(-?\d+\.?\d*)\s*([a-zA-Z%$€£°\/²³]*)/g
  const attrs = []
  let match
  while ((match = tokenRegex.exec(raw)) !== null) {
    const value = match[1]
    const label = match[2].toLowerCase()
    const isM = MONETARY.includes(label)
    attrs.push({ id: Date.now().toString() + Math.random(), value, label, sum: isM })
  }
  const cleanTitle = raw
    .replace(/(?:^|(?<=\s))[@=]\s*-?\d+\.?\d*\s*[a-zA-Z%$€£°\/²³]*/g, '')
    .trim()
  const nonMoney = attrs.filter(a => !MONETARY.includes(a.label))
  const money = attrs.filter(a => MONETARY.includes(a.label))
  return { cleanTitle, attrs: [...nonMoney, ...money] }
}

function NoteDetail({ note, onBack, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(note.blocks)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropIndicator, setDropIndicator] = useState(null)
  const [totalVisible, setTotalVisible] = useState(true)
  const [newBlockId, setNewBlockId] = useState(null)

  const dragInfo = useRef(null)
  const blocksRef = useRef(null)
  const firstBlockRef = useRef(null)
  const totalNumberRef = useRef(null)
  const newBlockTitleRef = useRef(null)
  const observerRef = useRef(null)
  const blockInputRefs = useRef({})

  const isStructured = note.isStructured || blocks.length > 1

  const allAttributes = blocks.flatMap(b => [
    ...(b.attributes || []),
    ...(b.children || []).flatMap(c => c.attributes || [])
  ])

  const noteTotal = isStructured ? computeNoteTotal(blocks) : null

  // ─── observer apuntando solo al número ───────────────────────
  const observeTotalNumber = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!totalNumberRef.current) return
    observerRef.current = new IntersectionObserver(
      ([entry]) => setTotalVisible(entry.isIntersecting),
      { threshold: 0 }
    )
    observerRef.current.observe(totalNumberRef.current)
  }, [])

  useEffect(() => {
    if (!noteTotal) {
      setTotalVisible(true)
      return
    }
    const t = setTimeout(observeTotalNumber, 50)
    return () => {
      clearTimeout(t)
      observerRef.current?.disconnect()
    }
  }, [noteTotal, observeTotalNumber])

  useEffect(() => {
    if (!note.title && note.blocks.length === 1 && !note.blocks[0].title && !note.blocks[0].body) {
      firstBlockRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (newBlockId && newBlockTitleRef.current) {
      newBlockTitleRef.current.focus()
      setNewBlockId(null)
    }
  }, [newBlockId, blocks])

  const save = (newBlocks, newTitle = title, extra = {}) => {
    setBlocks(newBlocks)
    onUpdate({ ...note, title: newTitle, blocks: newBlocks, ...extra })
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
    const newBlocks = removeBlock(blocks, id)

    // si queda un solo bloque sin atributos, volver a modo simple
    if (newBlocks.length === 1 && (newBlocks[0].attributes || []).length === 0) {
      const b = newBlocks[0]
      // asegurar que el contenido queda en body para el textarea de modo simple
      // si el contenido está en title (por migración previa), moverlo a body
      const restoredBlock = {
        ...b,
        body: b.body?.trim() ? b.body : (b.title?.trim() ? b.title : ''),
        title: '',
        collapsed: false
      }
      save([restoredBlock], title, { isStructured: false })
    } else {
      save(newBlocks)
    }
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
    const child = {
      id: Date.now().toString(), title: '', body: '',
      attributes: [], children: [], collapsed: true, order: 0
    }
    save(blocks.map(b => b.id === parentId ? { ...b, children: [...(b.children || []), child] } : b))
  }

  // ─── conversión desde nota simple por @ ──────────────────────
  const handleConvertToStructured = (block, rawBody) => {
    const { cleanTitle, attrs } = parseInlineAttributes(rawBody)
    const convertedBlock = {
      ...block,
      id: block.id + '-converted',
      title: cleanTitle || rawBody.replace(/[@=]\S*/g, '').trim(),
      body: '',
      attributes: attrs,
      collapsed: true
    }
    const newId = Date.now().toString()
    const secondBlock = {
      id: newId, title: '', body: '', attributes: [], children: [],
      collapsed: true, order: 1
    }
    const newBlocks = [convertedBlock, secondBlock]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks, isStructured: true })
    setNewBlockId(newId)
  }

  // ─── añadir bloque: bloqueado si el último está vacío ────────
  const addBlock = () => {
    const lastBlock = blocks[blocks.length - 1]
    if (isBlockEmpty(lastBlock)) {
      const lastRef = blockInputRefs.current[lastBlock.id]
      if (lastRef) lastRef.focus()
      return
    }

    let currentBlocks = blocks
    if (blocks.length === 1 && blocks[0].body.trim() && !blocks[0].title.trim()) {
      currentBlocks = [{
        ...blocks[0],
        id: Date.now().toString() + '-migrated',
        title: blocks[0].body,
        body: '',
        collapsed: true
      }]
    } else {
      currentBlocks = currentBlocks.map(b => ({ ...b, id: b.id + '-r', collapsed: true }))
    }

    const newId = Date.now().toString()
    const b = {
      id: newId, title: '', body: '', attributes: [], children: [],
      collapsed: true, order: currentBlocks.length
    }
    const newBlocks = [...currentBlocks, b]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks, isStructured: true })
    setNewBlockId(newId)
  }

  const handleBack = () => {
    const cleaned = blocks.filter(b => !isBlockEmpty(b))
    const finalBlocks = cleaned.length > 0 ? cleaned : blocks.slice(0, 1)
    onBack({ ...note, title, blocks: finalBlocks })
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

  // ─── resolver ref de input para cada bloque ──────────────────
  const resolveInputRef = (blockId, i) => {
    if (blockId === newBlockId) return newBlockTitleRef
    if (i === 0 && !isStructured) return firstBlockRef
    return (el) => { blockInputRefs.current[blockId] = el }
  }

  return (
    <div onClick={() => setMenuOpen(false)}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={handleBack}
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
              style={{
                position: 'absolute', right: '0', top: '28px', background: 'white',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px'
              }}
            >
              <div onClick={() => setMenuOpen(false)}
                style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}>
                Exportar
              </div>
              <div
                onClick={() => { if (window.confirm('¿Eliminar esta nota?')) onDelete(note.id) }}
                style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
              >Eliminar nota</div>
            </div>
          )}
        </div>
      </div>

      {/* título */}
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

      {/* total superior — línea debajo, separa del listado */}
      {noteTotal && !totalVisible && (
        <div style={{
          marginTop: '8px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--color-border)',
          textAlign: 'right',
          fontSize: '15px',
          fontWeight: '600',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text)'
        }}>
          Total: {formatMonetary(noteTotal.total)}{noteTotal.currency}
        </div>
      )}

      {!(noteTotal && !totalVisible) && <div style={{ marginBottom: '16px' }} />}

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
              inputRef={resolveInputRef(block.id, i)}
              showDivider={isStructured}
              allAttributes={allAttributes}
              onConvertToStructured={handleConvertToStructured}
            />
          </div>
        ))}

        {dropIndicator?.parentId === null && dropIndicator.beforeIndex === blocks.length && (
          <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
        )}
      </div>

      {/* zona + */}
      <div
        onClick={addBlock}
        style={{
          minHeight: '60px',
          cursor: 'text',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '36px',
          color: 'var(--color-text-light)',
          fontSize: '14px',
          opacity: 0.4,
          userSelect: 'none'
        }}
      >+</div>

      {/* total inferior — línea arriba, ref solo en el número */}
      {noteTotal && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          marginTop: '8px',
          paddingTop: '12px',
          textAlign: 'right',
        }}>
          <span
            ref={totalNumberRef}
            style={{
              fontSize: '15px',
              fontWeight: '600',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-text)'
            }}
          >
            Total: {formatMonetary(noteTotal.total)}{noteTotal.currency}
          </span>
        </div>
      )}
    </div>
  )
}

export default NoteDetail

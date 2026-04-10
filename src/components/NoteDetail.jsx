// src/components/NoteDetail.jsx
import { useState, useRef, useEffect, useCallback } from 'react'
import Block from './Block'

const MONETARY = ['€', '$', '£']
const isMonetary = (label) => MONETARY.includes(label)

const formatMonetary = (value) => {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toFixed(2).replace('.', ',')
}

// ─── subtotal de bloques ──────────────────────────────────────
const computeSubtotal = (blocks) => {
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
      if (!isNaN(qty) && !isNaN(price)) { total += qty * price; currency = monetaryAttr.label }
    } else {
      const val = parseFloat(monetaryAttr.value)
      if (!isNaN(val)) { total += val; currency = monetaryAttr.label }
    }
  }
  return currency ? { total: Math.round(total * 100) / 100, currency } : null
}

// ─── parser de modificadores ──────────────────────────────────
const parseModifier = (raw) => {
  const tokenMatch = raw.match(/[@=]\s*(-?\d+\.?\d*)\s*([a-zA-Z%$€£°\/²³]*)/)
  if (!tokenMatch) return null
  const value = parseFloat(tokenMatch[1])
  const unitRaw = tokenMatch[2]
  const unit = unitRaw.toLowerCase()
  const labelBefore = raw.replace(/[@=]\s*-?\d+\.?\d*\s*[a-zA-Z%$€£°\/²³]*/g, '').trim()
  const rawLabel = labelBefore || unitRaw || 'Modificador'
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
  if (unit === '%') return { label, type: 'percent', value }
  if (isMonetary(unit)) return { label, type: 'fixed', value, currency: unit }
  if (!isNaN(value) && value !== 0) return { label, type: 'divide', value, unit }
  return null
}

// ─── aplicar modificadores en cascada ────────────────────────
const applyModifiers = (subtotal, modifiers, currency) => {
  let running = subtotal
  const steps = []
  for (const mod of modifiers) {
    const parsed = parseModifier(mod.raw)
    if (!parsed) continue
    let delta = 0
    let perUnit = null
    if (parsed.type === 'percent') delta = Math.round(running * parsed.value) / 100
    else if (parsed.type === 'fixed') delta = parsed.value
    else if (parsed.type === 'divide') perUnit = Math.round((running / parsed.value) * 100) / 100
    steps.push({
      id: mod.id, label: parsed.label, type: parsed.type, value: parsed.value,
      delta: parsed.type === 'divide' ? 0 : Math.round(delta * 100) / 100,
      perUnit, currency: parsed.currency || currency,
      unit: parsed.type === 'percent' ? '%' : (parsed.type === 'divide' ? parsed.unit : (parsed.currency || currency))
    })
    if (parsed.type !== 'divide') running = Math.round((running + delta) * 100) / 100
  }
  return { steps, finalTotal: running }
}

const isBlockEmpty = (block) =>
  !block.title?.trim() && !block.body?.trim() && (block.attributes || []).length === 0

const parseInlineAttributes = (raw) => {
  const tokenRegex = /(?:^|(?<=\s))[@=]\s*(-?\d+\.?\d*)\s*([a-zA-Z%$€£°\/²³]*)/g
  const attrs = []
  let match
  while ((match = tokenRegex.exec(raw)) !== null) {
    const value = match[1]; const label = match[2].toLowerCase()
    attrs.push({ id: Date.now().toString() + Math.random(), value, label, sum: MONETARY.includes(label) })
  }
  const cleanTitle = raw.replace(/(?:^|(?<=\s))[@=]\s*-?\d+\.?\d*\s*[a-zA-Z%$€£°\/²³]*/g, '').trim()
  return { cleanTitle, attrs: [...attrs.filter(a => !MONETARY.includes(a.label)), ...attrs.filter(a => MONETARY.includes(a.label))] }
}

const stepToRaw = (step) => {
  if (step.type === 'percent') return `${step.label} @${step.value}%`
  if (step.type === 'fixed') return `${step.label} @${step.value}${step.currency}`
  if (step.type === 'divide') {
    // si la label ES la unidad (ej. "@6personas" → label:"personas", unit:"personas")
    // no repetir: "personas @6personas" → "personas @6"
    const labelIsUnit = step.label.toLowerCase() === step.unit.toLowerCase()
    return labelIsUnit ? `${step.label} @${step.value}` : `${step.label} @${step.value}${step.unit}`
  }
  return step.label
}

// ─── ancho fijo para la columna de números ────────────────────
// Todas las filas (subtotal, modificadores, total) usan este paddingRight
// para que los números queden alineados en la misma columna derecha.
const NUM_COL_WIDTH = '90px'
const NUM_COL_PR = '0px' // padding-right del contenedor raíz (el padre ya tiene el margen)

// ─── fila de modificador ─────────────────────────────────────
function ModRow({ step, isDragging, isDragOver, isEditing, editingRaw, onEditingRawChange,
  onStartEdit, onCommitEdit, onCancelEdit, onDelete, onDragStart, onDragOver, onDrop, onDragEnd, currency, numColWidth }) {
  const [hovered, setHovered] = useState(false)

  // parámetro gris: "21%", "-10%", "÷6"
  const paramLabel = () => {
    if (step.type === 'percent') return `${step.value > 0 ? '+' : ''}${step.value}%`
    if (step.type === 'fixed') return `${step.value >= 0 ? '+' : ''}${step.value}${step.currency}`
    if (step.type === 'divide') return `÷${step.value}`
    return ''
  }

  // resultado negro: "+14,93$", "-7,90$", "18,64$"
  const resultLabel = () => {
    if (step.type === 'percent') return `${step.delta >= 0 ? '+' : ''}${formatMonetary(step.delta)}${step.currency}`
    if (step.type === 'fixed') return `${step.delta >= 0 ? '+' : ''}${formatMonetary(step.delta)}${step.currency}`
    if (step.type === 'divide' && step.perUnit !== null) return formatMonetary(step.perUnit) + step.currency
    return ''
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(step.id)}
      onDragOver={e => onDragOver(e, step.id)}
      onDrop={() => onDrop(step.id)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        paddingTop: '6px', paddingBottom: '6px', paddingLeft: '36px',
        fontSize: '14px',
        opacity: isDragging ? 0.4 : 1,
        borderTop: isDragOver ? '2px solid var(--color-text)' : '2px solid transparent',
        transition: 'opacity 0.15s', cursor: 'default'
      }}
    >
      {/* handle — visible solo en hover */}
      <span style={{
        color: 'var(--color-text-light)', fontSize: '14px', cursor: 'grab',
        flexShrink: 0, userSelect: 'none', lineHeight: 1,
        opacity: hovered ? 0.5 : 0, transition: 'opacity 0.15s', width: '14px'
      }}>⠿</span>

      {isEditing ? (
        <input
          autoFocus
          value={editingRaw}
          onChange={e => onEditingRawChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit() }}
          onClick={e => e.stopPropagation()}
          style={{ flex: 1, border: 'none', borderBottom: '1px solid var(--color-border)', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text)', background: 'transparent', paddingBottom: '2px' }}
        />
      ) : (
        <>
          {/* etiqueta — flex, clickable para editar */}
          <span
            onClick={e => { e.stopPropagation(); onStartEdit(step) }}
            style={{ flex: 1, color: 'var(--color-text-light)', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >{step.label || '—'}</span>

          {/* parámetro gris — ancho fijo */}
          <span
            onClick={e => { e.stopPropagation(); onStartEdit(step) }}
            style={{ color: 'var(--color-text-light)', fontSize: '14px', fontVariantNumeric: 'tabular-nums', cursor: 'text', flexShrink: 0, width: '44px', textAlign: 'right' }}
          >{paramLabel()}</span>

          {/* resultado negro — ancho fijo, alineado con subtotal/total */}
          <span
            onClick={e => { e.stopPropagation(); onStartEdit(step) }}
            style={{ color: 'var(--color-text)', fontSize: '14px', fontVariantNumeric: 'tabular-nums', cursor: 'text', flexShrink: 0, width: numColWidth, textAlign: 'right' }}
          >{resultLabel()}</span>
        </>
      )}

      <span
        onClick={e => { e.stopPropagation(); onDelete(step.id) }}
        style={{ cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '14px', lineHeight: 1, flexShrink: 0, width: '20px', textAlign: 'center', opacity: hovered ? 1 : 0.3, transition: 'opacity 0.15s' }}
      >×</span>
    </div>
  )
}

// ─── fila de añadir modificador ───────────────────────────────
function ModAddRow({ modInput, setModInput, addModifier, modInputRef, hasItems }) {
  const [open, setOpen] = useState(!hasItems)

  const handleOpen = (e) => { e.stopPropagation(); setOpen(true) }
  const handleAdd = () => { addModifier(); setOpen(false) }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
    if (e.key === 'Escape') { setModInput(''); setOpen(false) }
  }

  useEffect(() => {
    if (open && modInputRef.current) modInputRef.current.focus()
  }, [open])

  if (!open) {
    return (
      <div
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', paddingLeft: '50px', paddingTop: '8px', paddingBottom: '4px', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '14px', opacity: 0.4, userSelect: 'none' }}
      >+</div>
    )
  }

  return (
    <div style={{ paddingLeft: '50px', paddingTop: '8px', paddingBottom: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          ref={modInputRef}
          type="text" value={modInput}
          onChange={e => setModInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={e => e.stopPropagation()}
          onBlur={() => { if (!modInput.trim()) setOpen(false) }}
          placeholder="etiqueta @valor"
          style={{ flex: 1, border: 'none', borderBottom: '1px solid var(--color-border)', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text)', background: 'transparent', paddingBottom: '4px' }}
        />
        <button onClick={e => { e.stopPropagation(); handleAdd() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>+</button>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-light)', opacity: 0.5, marginTop: '4px', lineHeight: 1.4 }}>
        @21% · @-10% · @-5€ · personas @6
      </div>
    </div>
  )
}

function NoteDetail({ note, onBack, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title)
  const [blocks, setBlocks] = useState(note.blocks)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropIndicator, setDropIndicator] = useState(null)
  const [totalVisible, setTotalVisible] = useState(true)
  const [newBlockId, setNewBlockId] = useState(null)
  const [collapseAll, setCollapseAll] = useState(0)
  const [footerNote, setFooterNote] = useState(note.footerNote || '')
  const [modifiers, setModifiers] = useState(note.modifiers || [])
  const [modInput, setModInput] = useState('')
  const [subtotalLabel, setSubtotalLabel] = useState(note.subtotalLabel || 'Subtotal')
  const [editingSubtotalLabel, setEditingSubtotalLabel] = useState(false)
  const [editingModId, setEditingModId] = useState(null)
  const [editingModRaw, setEditingModRaw] = useState('')
  const [modDragId, setModDragId] = useState(null)
  const [modDragOverId, setModDragOverId] = useState(null)
  const [modExpanded, setModExpanded] = useState((note.modifiers || []).length > 0)

  const modInputRef = useRef(null)
  const subtotalLabelRef = useRef(null)
  const dragInfo = useRef(null)
  const blocksRef = useRef(null)
  const firstBlockRef = useRef(null)
  const totalNumberRef = useRef(null)
  const newBlockTitleRef = useRef(null)
  const observerRef = useRef(null)
  const blockInputRefs = useRef({})
  const containerRef = useRef(null)
  const footerRef = useRef(null)

  const isStructured = note.isStructured || blocks.length > 1
  const allAttributes = blocks.flatMap(b => [...(b.attributes || []), ...(b.children || []).flatMap(c => c.attributes || [])])

  const subtotalResult = isStructured ? computeSubtotal(blocks) : null
  const { steps: modSteps, finalTotal } = subtotalResult
    ? applyModifiers(subtotalResult.total, modifiers, subtotalResult.currency)
    : { steps: [], finalTotal: 0 }
  const noteTotal = subtotalResult
    ? { total: finalTotal, currency: subtotalResult.currency, subtotal: subtotalResult.total }
    : null

  useEffect(() => { window.scrollTo(0, 0) }, [])

  const observeTotalNumber = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect()
    if (!totalNumberRef.current) return
    observerRef.current = new IntersectionObserver(([entry]) => setTotalVisible(entry.isIntersecting), { threshold: 0 })
    observerRef.current.observe(totalNumberRef.current)
  }, [])

  useEffect(() => {
    if (!noteTotal) { setTotalVisible(true); return }
    const t = setTimeout(observeTotalNumber, 50)
    return () => { clearTimeout(t); observerRef.current?.disconnect() }
  }, [noteTotal, observeTotalNumber])

  useEffect(() => {
    if (!note.title && note.blocks.length === 1 && !note.blocks[0].title && !note.blocks[0].body)
      firstBlockRef.current?.focus()
  }, [])

  useEffect(() => {
    if (newBlockId && newBlockTitleRef.current) { newBlockTitleRef.current.focus(); setNewBlockId(null) }
  }, [newBlockId, blocks])

  useEffect(() => {
    if (editingSubtotalLabel && subtotalLabelRef.current) {
      subtotalLabelRef.current.focus(); subtotalLabelRef.current.select()
    }
  }, [editingSubtotalLabel])

  useEffect(() => {
    const updateFooterHeight = () => {
      if (!footerRef.current) return
      const rect = footerRef.current.getBoundingClientRect()
      footerRef.current.style.minHeight = Math.max(80, window.innerHeight - rect.top) + 'px'
    }
    updateFooterHeight()
    window.addEventListener('resize', updateFooterHeight)
    return () => window.removeEventListener('resize', updateFooterHeight)
  }, [noteTotal, modExpanded, modifiers])

  const save = (newBlocks, newTitle = title, extra = {}) => {
    setBlocks(newBlocks)
    onUpdate({ ...note, title: newTitle, blocks: newBlocks, modifiers, footerNote, subtotalLabel, ...extra })
  }

  const saveModifiers = (newModifiers) => {
    setModifiers(newModifiers)
    onUpdate({ ...note, title, blocks, modifiers: newModifiers, footerNote, subtotalLabel })
  }

  const saveFooterNote = (text) => {
    setFooterNote(text)
    onUpdate({ ...note, title, blocks, modifiers, footerNote: text, subtotalLabel })
  }

  const saveSubtotalLabel = (label) => {
    setSubtotalLabel(label)
    onUpdate({ ...note, title, blocks, modifiers, footerNote, subtotalLabel: label })
  }

  const handleContainerClick = () => setMenuOpen(false)

  const removeBlock = (list, id) =>
    list.filter(b => b.id !== id).map(b => ({ ...b, children: (b.children || []).filter(c => c.id !== id) }))

  const handleBlockChange = (updated) => {
    const newBlocks = blocks.map(b => {
      if (b.id === updated.id) return updated
      if (b.children?.some(c => c.id === updated.id)) return { ...b, children: b.children.map(c => c.id === updated.id ? updated : c) }
      return b
    })
    save(newBlocks)
  }

  const handleBlockDelete = (id) => {
    if (blocks.length === 1) return
    const newBlocks = removeBlock(blocks, id)
    if (newBlocks.length === 1 && (newBlocks[0].attributes || []).length === 0) {
      const b = newBlocks[0]
      save([{ ...b, body: b.body?.trim() ? b.body : (b.title?.trim() ? b.title : ''), title: '', collapsed: false }], title, { isStructured: false })
    } else { save(newBlocks) }
  }

  const handleBlockDuplicate = (block) => {
    const isTop = blocks.some(b => b.id === block.id)
    const dup = { ...block, id: Date.now().toString(), children: (block.children || []).map(c => ({ ...c, id: Date.now().toString() + Math.random() })) }
    if (isTop) {
      const i = blocks.findIndex(b => b.id === block.id)
      save([...blocks.slice(0, i + 1), dup, ...blocks.slice(i + 1)])
    } else {
      save(blocks.map(b => {
        const i = (b.children || []).findIndex(c => c.id === block.id)
        if (i === -1) return b
        return { ...b, children: [...b.children.slice(0, i + 1), dup, ...b.children.slice(i + 1)] }
      }))
    }
  }

  const handleAddChild = (parentId) => {
    const child = { id: Date.now().toString(), title: '', body: '', attributes: [], children: [], collapsed: true, order: 0 }
    save(blocks.map(b => b.id === parentId ? { ...b, children: [...(b.children || []), child] } : b))
  }

  const handleConvertToStructured = (block, rawBody) => {
    const { cleanTitle, attrs } = parseInlineAttributes(rawBody)
    const convertedBlock = { ...block, id: block.id + '-converted', title: cleanTitle || rawBody.replace(/[@=]\S*/g, '').trim(), body: '', attributes: attrs, collapsed: true }
    const newId = Date.now().toString()
    const newBlocks = [convertedBlock, { id: newId, title: '', body: '', attributes: [], children: [], collapsed: true, order: 1 }]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks, isStructured: true, modifiers, footerNote, subtotalLabel })
    setNewBlockId(newId)
  }

  const addBlock = () => {
    const lastBlock = blocks[blocks.length - 1]
    if (isBlockEmpty(lastBlock)) { const r = blockInputRefs.current[lastBlock.id]; if (r) r.focus(); return }
    let currentBlocks = blocks
    if (blocks.length === 1 && blocks[0].body.trim() && !blocks[0].title.trim()) {
      currentBlocks = [{ ...blocks[0], id: Date.now().toString() + '-migrated', title: blocks[0].body, body: '', collapsed: true }]
    } else {
      currentBlocks = currentBlocks.map(b => ({ ...b, id: b.id + '-r', collapsed: true }))
    }
    const newId = Date.now().toString()
    const newBlocks = [...currentBlocks, { id: newId, title: '', body: '', attributes: [], children: [], collapsed: true, order: currentBlocks.length }]
    setBlocks(newBlocks)
    onUpdate({ ...note, title, blocks: newBlocks, isStructured: true, modifiers, footerNote, subtotalLabel })
    setNewBlockId(newId)
  }

  const addModifier = () => {
    if (!modInput.trim() || !parseModifier(modInput)) return
    const newMod = { id: Date.now().toString(), raw: modInput.trim() }
    setModInput('')
    saveModifiers([...modifiers, newMod])
  }

  const deleteModifier = (id) => saveModifiers(modifiers.filter(m => m.id !== id))

  const startEditMod = (step) => { setEditingModId(step.id); setEditingModRaw(stepToRaw(step)) }

  const commitEditMod = () => {
    if (!editingModRaw.trim()) { deleteModifier(editingModId); setEditingModId(null); return }
    if (!parseModifier(editingModRaw)) { setEditingModId(null); return }
    saveModifiers(modifiers.map(m => m.id === editingModId ? { ...m, raw: editingModRaw.trim() } : m))
    setEditingModId(null); setEditingModRaw('')
  }

  const handleModDragStart = (id) => setModDragId(id)
  const handleModDragOver = (e, id) => { e.preventDefault(); setModDragOverId(id) }
  const handleModDrop = (targetId) => {
    if (!modDragId || modDragId === targetId) { setModDragId(null); setModDragOverId(null); return }
    const from = modifiers.findIndex(m => m.id === modDragId)
    const to = modifiers.findIndex(m => m.id === targetId)
    const reordered = [...modifiers]; const [moved] = reordered.splice(from, 1); reordered.splice(to, 0, moved)
    setModDragId(null); setModDragOverId(null); saveModifiers(reordered)
  }
  const handleModDragEnd = () => { setModDragId(null); setModDragOverId(null) }

  const handleBack = () => {
    const cleaned = blocks.filter(b => !isBlockEmpty(b))
    onBack({ ...note, title, blocks: cleaned.length > 0 ? cleaned : blocks.slice(0, 1), modifiers, footerNote, subtotalLabel })
  }

  const handleDragStart = (block, parentId) => { dragInfo.current = { block, parentId } }
  const handleDragEnd = () => { dragInfo.current = null; setDropIndicator(null) }

  const handleDragOverContainer = (e) => {
    e.preventDefault()
    if (!dragInfo.current || !blocksRef.current) return
    const { parentId } = dragInfo.current; const y = e.clientY
    if (parentId === null) {
      const topBlockEls = Array.from(blocksRef.current.querySelectorAll('[data-block-id]')).filter(el => el.dataset.depth === '0')
      let targetIndex = blocks.length
      for (let i = 0; i < topBlockEls.length; i++) { const rect = topBlockEls[i].getBoundingClientRect(); if (y < rect.top + rect.height / 2) { targetIndex = i; break } }
      setDropIndicator({ type: 'between', beforeIndex: targetIndex, parentId: null })
    } else {
      const parentBlock = blocks.find(b => b.id === parentId); if (!parentBlock) return
      const parentEl = blocksRef.current.querySelector(`[data-block-id="${parentId}"]`); if (!parentEl) return
      const childEls = Array.from(parentEl.querySelectorAll('[data-block-id]')).filter(el => el.dataset.depth === '1')
      let targetIndex = parentBlock.children.length
      for (let i = 0; i < childEls.length; i++) { const rect = childEls[i].getBoundingClientRect(); if (y < rect.top + rect.height / 2) { targetIndex = i; break } }
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
      let idx = dropIndicator.beforeIndex; if (originalIndex < idx) idx--
      idx = Math.max(0, Math.min(idx, newBlocks.length)); newBlocks.splice(idx, 0, dragged)
    } else {
      newBlocks = blocks.map(b => {
        if (b.id !== parentId) return b
        const originalChildIndex = (b.children || []).findIndex(c => c.id === dragged.id)
        const children = (b.children || []).filter(c => c.id !== dragged.id)
        let idx = dropIndicator.beforeIndex; if (originalChildIndex !== -1 && originalChildIndex < idx) idx--
        idx = Math.max(0, Math.min(idx, children.length)); children.splice(idx, 0, dragged); return { ...b, children }
      })
    }
    save(newBlocks); dragInfo.current = null; setDropIndicator(null)
  }

  const handleDragLeaveContainer = (e) => { if (!blocksRef.current?.contains(e.relatedTarget)) setDropIndicator(null) }

  const resolveInputRef = (blockId, i) => {
    if (blockId === newBlockId) return newBlockTitleRef
    if (i === 0 && !isStructured) return firstBlockRef
    return (el) => { blockInputRefs.current[blockId] = el }
  }

  // ─── alineación: todas las filas del total usan el mismo paddingLeft
  // y la columna de números tiene ancho fijo alineado a la derecha ──────
  const ROW_PL = '36px'  // alineado con el cuerpo de los bloques

  return (
    <div ref={containerRef} onClick={handleContainerClick}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0' }}>←</button>
        <div style={{ position: 'relative' }}>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px' }}>···</button>
          {menuOpen && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '28px', background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px' }}>
              <div onClick={() => setMenuOpen(false)} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}>Exportar</div>
              <div onClick={() => { if (window.confirm('¿Eliminar esta nota?')) onDelete(note.id) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}>Eliminar nota</div>
            </div>
          )}
        </div>
      </div>

      {/* título */}
      <input
        type="text" value={title}
        onChange={e => { setTitle(e.target.value); onUpdate({ ...note, title: e.target.value, blocks, modifiers, footerNote, subtotalLabel }) }}
        onClick={e => e.stopPropagation()}
        placeholder="Título"
        style={{ width: '100%', border: 'none', fontSize: '20px', fontWeight: '600', outline: 'none', fontFamily: 'var(--font-main)', marginBottom: '4px', color: 'var(--color-text)' }}
      />

      {/* total superior — solo cuando el inferior no es visible */}
      {noteTotal && !totalVisible && (
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: ROW_PL, marginTop: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', fontSize: '15px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
          <span style={{ flex: 1, color: 'var(--color-text-light)', fontWeight: '400', fontSize: '13px' }}>Total</span>
          <span style={{ width: NUM_COL_WIDTH, textAlign: 'right' }}>{formatMonetary(noteTotal.total)}{noteTotal.currency}</span>
        </div>
      )}

      {!(noteTotal && !totalVisible) && <div style={{ marginBottom: '16px' }} />}

      {/* bloques */}
      <div ref={blocksRef} onDragOver={handleDragOverContainer} onDrop={handleDropOnContainer} onDragLeave={handleDragLeaveContainer}>
        {blocks.map((block, i) => (
          <div key={block.id} style={{ position: 'relative' }}>
            {dropIndicator?.parentId === null && dropIndicator.beforeIndex === i && (
              <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
            )}
            <Block
              block={block} depth={0}
              onChange={handleBlockChange} onDelete={handleBlockDelete}
              onDuplicate={handleBlockDuplicate} onAddChild={handleAddChild}
              onDragStart={handleDragStart} onDragEnd={handleDragEnd}
              isDropTarget={false}
              childDropIndicator={dropIndicator?.parentId === block.id ? dropIndicator : null}
              dragInfo={dragInfo} inputRef={resolveInputRef(block.id, i)}
              showDivider={isStructured} allAttributes={allAttributes}
              onConvertToStructured={handleConvertToStructured} collapseAll={collapseAll}
            />
          </div>
        ))}
        {dropIndicator?.parentId === null && dropIndicator.beforeIndex === blocks.length && (
          <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
        )}
      </div>

      {/* zona + */}
      <div onClick={e => { e.stopPropagation(); addBlock() }} style={{ minHeight: '60px', cursor: 'text', display: 'flex', alignItems: 'center', paddingLeft: ROW_PL, color: 'var(--color-text-light)', fontSize: '14px', opacity: 0.4, userSelect: 'none' }}>+</div>

      {/* ── total inferior ── */}
      {noteTotal && (
        <div onClick={e => e.stopPropagation()}>
          <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px' }} />

          {/* fila subtotal — clickable para expandir/colapsar */}
          <div
            style={{ display: 'flex', alignItems: 'center', paddingLeft: ROW_PL, paddingTop: '12px', paddingBottom: modExpanded ? '4px' : '0', cursor: 'pointer' }}
            onClick={() => setModExpanded(v => !v)}
          >
            {/* etiqueta subtotal editable — solo si hay modificadores Tipo A */}
            {modExpanded ? (
              modSteps.some(s => s.type !== 'divide') ? (
                editingSubtotalLabel ? (
                  <input
                    ref={subtotalLabelRef}
                    value={subtotalLabel}
                    onChange={e => setSubtotalLabel(e.target.value)}
                    onBlur={() => { saveSubtotalLabel(subtotalLabel); setEditingSubtotalLabel(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') { saveSubtotalLabel(subtotalLabel); setEditingSubtotalLabel(false) } }}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '15px', fontWeight: '600', color: 'var(--color-text)', background: 'transparent' }}
                  />
                ) : (
                  <span onClick={e => { e.stopPropagation(); setEditingSubtotalLabel(true) }} style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: 'var(--color-text)', cursor: 'text' }}>
                    {subtotalLabel}
                  </span>
                )
              ) : (
                <span style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: 'var(--color-text)' }}>Total</span>
              )
            ) : (
              <span style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: 'var(--color-text)' }}>
                {'Total'}
              </span>
            )}

            <span ref={totalNumberRef} style={{ width: NUM_COL_WIDTH, textAlign: 'right', fontSize: '15px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
              {formatMonetary(modExpanded ? subtotalResult.total : noteTotal.total)}{noteTotal.currency}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-light)', opacity: 0.5, transform: modExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block', lineHeight: 1, marginLeft: '6px' }}>▾</span>
          </div>

          {/* panel expandido */}
          {modExpanded && (
            <div style={{ paddingBottom: '8px' }}>

              {/* modificadores */}
              {modSteps.map(step => (
                <ModRow
                  key={step.id} step={step}
                  isDragging={modDragId === step.id} isDragOver={modDragOverId === step.id}
                  isEditing={editingModId === step.id} editingRaw={editingModRaw}
                  onEditingRawChange={setEditingModRaw}
                  onStartEdit={startEditMod} onCommitEdit={commitEditMod} onCancelEdit={() => setEditingModId(null)}
                  onDelete={deleteModifier}
                  onDragStart={handleModDragStart} onDragOver={handleModDragOver}
                  onDrop={handleModDrop} onDragEnd={handleModDragEnd}
                  currency={noteTotal.currency}
                  numColWidth={NUM_COL_WIDTH}
                />
              ))}

              {/* + añadir modificador — bajo los items */}
              <ModAddRow
                modInput={modInput} setModInput={setModInput}
                addModifier={addModifier} modInputRef={modInputRef}
                hasItems={modSteps.length > 0}
              />

              {/* total final — solo si hay modificadores que cambian el total */}
              {modSteps.some(s => s.type !== 'divide') && (
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: ROW_PL, paddingTop: '10px', borderTop: '1px solid var(--color-border)', fontSize: '15px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                  <span style={{ flex: 1 }}>Total</span>
                  <span style={{ width: NUM_COL_WIDTH, textAlign: 'right' }}>{formatMonetary(noteTotal.total)}{noteTotal.currency}</span>
                  <span style={{ width: '26px' }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* campo de texto libre — crece hasta el borde de pantalla */}
      <textarea
        ref={footerRef}
        value={footerNote}
        onChange={e => saveFooterNote(e.target.value)}
        onClick={e => e.stopPropagation()}
        placeholder="" rows={2}
        style={{ width: '100%', border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text)', resize: 'none', lineHeight: '1.6', background: 'transparent', marginTop: '32px', boxSizing: 'border-box', overflow: 'hidden', display: 'block' }}
      />
    </div>
  )
}

export default NoteDetail

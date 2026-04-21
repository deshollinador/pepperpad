// src/components/Block.jsx
import { useState, useRef, useEffect } from 'react'
import {
  MONETARY, isMonetary, isUds, formatMonetary, normalizeDecimal,
  computeChildrenSubtotal, computeChildrenUnitTotals,
  parseBlockTags, displayTag
} from '../utils/totals'

const sortAttributes = (attrs) => {
  const nonMoney = attrs.filter(a => !isMonetary(a.label))
  const money = attrs.filter(a => isMonetary(a.label))
  return [...nonMoney, ...money]
}

const computeBlockTotal = (attributes) => {
  const attrs = (attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
  const monetaryAttrs = attrs.filter(a => isMonetary(a.label))
  const udsAttr = attrs.find(a => isUds(a.label))
  if (attrs.length === 2 && udsAttr && monetaryAttrs.length === 1) {
    const qty = parseFloat(normalizeDecimal(udsAttr.value))
    const price = parseFloat(normalizeDecimal(monetaryAttrs[0].value))
    if (!isNaN(qty) && !isNaN(price))
      return { hasCalc: true, total: Math.round(qty * price * 100) / 100, currency: monetaryAttrs[0].label, pricePerUnit: price, qty }
  }
  if (monetaryAttrs.length === 1) {
    const val = parseFloat(normalizeDecimal(monetaryAttrs[0].value))
    if (!isNaN(val)) return { hasCalc: false, total: val, currency: monetaryAttrs[0].label }
  }
  return null
}

const reconstructRawTitle = (title, attributes, tags) => {
  const tagStr = (tags || []).map(t => `#${displayTag(t)}`).join(' ')
  const attrStr = (attributes || []).map(a => `@${a.value}${a.label}`).join(' ')
  return [title, tagStr, attrStr].filter(Boolean).join(' ').trim()
}

const parseInlineAttributes = (raw) => {
  const tokenRegex = /[@=]\s*(-?\d+[.,]?\d*)\s*([a-zA-Z%$€£°\/²³]*)/g
  const attrs = []
  let match
  while ((match = tokenRegex.exec(raw)) !== null) {
    const value = normalizeDecimal(match[1])
    const label = match[2].toLowerCase()
    attrs.push({ id: Date.now().toString() + Math.random(), value, label, sum: isMonetary(label) })
  }
  const cleanTitle = raw.replace(/[@=]\s*-?\d+[.,]?\d*\s*[a-zA-Z%$€£°\/²³]*/g, '').trim()
  return { cleanTitle, attrs: sortAttributes(attrs) }
}

const autoResize = (el) => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

// ─── ley de unidades en colapsado ────────────────────────────
const buildCollapsedUnits = (block) => {
  const children = block.children || []
  const ownAttrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
  const ownNonMonetary = ownAttrs.filter(a => !isMonetary(a.label) && !isUds(a.label))

  const childUnitMap = {}
  for (const child of children) {
    const attrs = (child.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    for (const attr of attrs) {
      if (isMonetary(attr.label) || isUds(attr.label)) continue
      const val = parseFloat(normalizeDecimal(attr.value))
      if (isNaN(val)) continue
      if (!childUnitMap[attr.label]) childUnitMap[attr.label] = 0
      childUnitMap[attr.label] += val
    }
  }

  const allLabels = new Set([
    ...ownNonMonetary.map(a => a.label),
    ...Object.keys(childUnitMap)
  ])

  const units = []
  for (const label of allLabels) {
    const ownAttr = ownNonMonetary.find(a => a.label === label)
    const ownVal = ownAttr ? parseFloat(normalizeDecimal(ownAttr.value)) : null
    const childSum = childUnitMap[label] !== undefined ? Math.round(childUnitMap[label] * 100) / 100 : null

    if (ownVal !== null && childSum !== null && Math.round(ownVal * 100) !== Math.round(childSum * 100)) {
      units.push({ label, display: `${ownVal} → ${childSum} ${label}`, attrId: ownAttr?.id })
    } else if (childSum !== null) {
      units.push({ label, display: `${childSum} ${label}`, attrId: null })
    } else if (ownVal !== null) {
      units.push({ label, display: `${ownVal} ${label}`, attrId: ownAttr?.id })
    }
  }

  return units
}

// ─── determinar si mostrar etiqueta del padre ─────────────────
const getParentTagForDisplay = (block) => {
  const tags = block.tags || []
  if (tags.length === 0) return null
  const children = block.children || []
  if (children.length === 0) return tags[0]
  const anyChildHasTag = children.some(c => (c.tags || []).length > 0)
  return anyChildHasTag ? null : tags[0]
}

// ─── píldora editable inline ──────────────────────────────────
function InlinePill({ prefix, value, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [editing])

  const startEdit = (e) => {
    e.stopPropagation()
    setRaw(value)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const trimmed = raw.trim()
    if (!trimmed) onDelete()
    else onSave(`${prefix}${trimmed}`)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') setEditing(false)
    if ((e.key === 'Backspace' || e.key === 'Delete') && raw.length === 0) e.preventDefault()
  }

  const handleChange = (e) => {
    let val = e.target.value
    if (val.startsWith('@') || val.startsWith('#')) val = val.slice(1)
    setRaw(val)
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-light)', fontSize: '13px' }}>
        <span style={{ opacity: 0.5 }}>{prefix}</span>
        <input
          ref={inputRef}
          value={raw}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onClick={e => e.stopPropagation()}
          style={{
            border: 'none', borderBottom: '1px solid var(--color-border)',
            outline: 'none', fontFamily: 'var(--font-main)',
            fontSize: '13px', color: 'var(--color-text)',
            background: 'transparent',
            width: `${Math.max((raw.length || 1) + 1, 3)}ch`,
            paddingBottom: '1px'
          }}
        />
      </span>
    )
  }

  return (
    <span
      onClick={startEdit}
      style={{
        color: prefix === '#' ? 'var(--color-text-light)' : 'var(--color-text)',
        fontSize: '13px', cursor: 'text', fontVariantNumeric: 'tabular-nums',
        opacity: prefix === '#' ? 0.7 : 1
      }}
    >
      {prefix === '#' ? displayTag(value) : value}
    </span>
  )
}

function Block({
  block, depth, onChange, onDelete, onDuplicate, onAddChild,
  onDragStart, onDragEnd, childDropIndicator, dragInfo, inputRef,
  allAttributes, collapseAll, newChildId, onNewChildRef
}) {
  const [expanded, setExpanded] = useState(!block.collapsed)
  const [showHandle, setShowHandle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [rawTitle, setRawTitle] = useState('')
  const longPressTimer = useRef(null)
  const bodyTextareaRef = useRef(null)
  const titleInputRef = useRef(null)
  const blockRef = useRef(null)
  const blurTimerRef = useRef(null)

  const hasChildren = (block.children || []).length > 0
  const blockTotal = computeBlockTotal(block.attributes)
  const collapsedUnits = depth === 0 ? buildCollapsedUnits(block) : []
  const childMonetary = depth === 0 && hasChildren ? computeChildrenSubtotal(block.children) : null
  const ownMonetary = blockTotal
  const tags = block.tags || []
  const parentTagForDisplay = depth === 0 ? getParentTagForDisplay(block) : null

  const monetaryDisplay = (() => {
    if (!childMonetary && !ownMonetary) return null
    if (childMonetary && ownMonetary && childMonetary.currency === ownMonetary.currency) {
      if (Math.round(childMonetary.total * 100) !== Math.round(ownMonetary.total * 100))
        return { str: `${formatMonetary(ownMonetary.total)}${ownMonetary.currency} → ${formatMonetary(childMonetary.total)}${childMonetary.currency}` }
      return { str: `${formatMonetary(childMonetary.total)}${childMonetary.currency}` }
    }
    if (childMonetary) return { str: `${formatMonetary(childMonetary.total)}${childMonetary.currency}` }
    if (ownMonetary) {
      if (ownMonetary.hasCalc) return { str: `${formatMonetary(ownMonetary.pricePerUnit)}${ownMonetary.currency}/ud = ${formatMonetary(ownMonetary.total)}${ownMonetary.currency}` }
      return { str: `${formatMonetary(ownMonetary.total)}${ownMonetary.currency}` }
    }
    return null
  })()

  useEffect(() => { if (collapseAll) setExpanded(false) }, [collapseAll])
  useEffect(() => { if (expanded) autoResize(bodyTextareaRef.current) }, [expanded])
  useEffect(() => {
    if (newChildId && (block.children || []).some(c => c.id === newChildId)) setExpanded(true)
  }, [newChildId, block.children])

  // Colapsar cuando el foco sale completamente del bloque
  useEffect(() => {
    const el = blockRef.current
    if (!el || !expanded) return
    const handleFocusOut = (e) => {
      if (!e.relatedTarget || !el.contains(e.relatedTarget)) {
        clearTimeout(blurTimerRef.current)
        blurTimerRef.current = setTimeout(() => setExpanded(false), 120)
      }
    }
    el.addEventListener('focusout', handleFocusOut)
    return () => el.removeEventListener('focusout', handleFocusOut)
  }, [expanded])

  // Cuando se activa edición desde +Atributo o +Etiqueta, enfocar el título
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      const len = titleInputRef.current.value.length
      titleInputRef.current.setSelectionRange(len, len)
    }
  }, [isEditingTitle, rawTitle])

  const handleTouchStart = () => { longPressTimer.current = setTimeout(() => setShowHandle(true), 500) }
  const handleTouchEnd = () => { clearTimeout(longPressTimer.current); setShowHandle(false) }
  const handleTouchCancel = () => { clearTimeout(longPressTimer.current); setShowHandle(false) }

  const handleDragStart = (e) => {
    onDragStart(block, depth === 0 ? null : block.parentId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnd = () => { setShowHandle(false); onDragEnd() }

  // Clicar en título: expande y activa edición
  const handleTitleClick = (e) => {
    e.stopPropagation()
    setExpanded(true)
  }

  const handleTitleFocus = () => {
    clearTimeout(blurTimerRef.current)
    setIsEditingTitle(true)
    setRawTitle(reconstructRawTitle(block.title, block.attributes, block.tags))
  }

  const commitTitle = () => {
    setIsEditingTitle(false)
    const raw = rawTitle
    if (!raw.trim()) { onChange({ ...block, title: '', attributes: [], tags: [] }); setExpanded(false); return }
    const { cleanTitle: afterTags, tags: newTags } = parseBlockTags(raw)
    const { cleanTitle, attrs } = parseInlineAttributes(afterTags)
    if (attrs.length === 0 && newTags.length === 0) {
      onChange({ ...block, title: raw.trim(), attributes: [], tags: [] })
    } else {
      onChange({ ...block, title: cleanTitle, attributes: attrs.slice(0, 3), tags: newTags.slice(0, 1) })
    }
    setExpanded(false)
  }

  const handleTitleBlur = () => {
    // Delay para verificar si el foco va a otro elemento dentro del bloque
    blurTimerRef.current = setTimeout(() => {
      if (!blockRef.current) { commitTitle(); return }
      const active = document.activeElement
      if (blockRef.current.contains(active)) return // foco dentro del bloque, no colapsar
      commitTitle()
    }, 100)
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
    if (e.key === 'Escape') { setIsEditingTitle(false); setExpanded(false) }
  }

  // +Atributo: añade @ y enfoca el título
  const addAttribute = (e) => {
    e.stopPropagation()
    const currentRaw = reconstructRawTitle(block.title, block.attributes, block.tags)
    const newRaw = currentRaw ? currentRaw + ' @' : '@'
    setRawTitle(newRaw)
    setIsEditingTitle(true)
    // El useEffect se encargará de enfocar
  }

  // +Etiqueta: añade # y enfoca el título
  const addTag = (e) => {
    e.stopPropagation()
    if (tags.length >= 1) return
    const currentRaw = reconstructRawTitle(block.title, block.attributes, block.tags)
    const newRaw = currentRaw ? currentRaw + ' #' : '#'
    setRawTitle(newRaw)
    setIsEditingTitle(true)
  }

  // Guardar cambio de píldora de atributo
  const handlePillSave = (attrId, raw) => {
    const otherAttrs = (block.attributes || []).filter(a => a.id !== attrId)
    const otherAttrStr = otherAttrs.map(a => `@${a.value}${a.label}`).join(' ')
    const tagStr = tags.map(t => `#${displayTag(t)}`).join(' ')
    const fullRaw = [block.title, tagStr, otherAttrStr, raw].filter(Boolean).join(' ').trim()
    const { cleanTitle: afterTags, tags: newTags } = parseBlockTags(fullRaw)
    const { cleanTitle, attrs } = parseInlineAttributes(afterTags)
    onChange({ ...block, title: cleanTitle, attributes: attrs.slice(0, 3), tags: newTags.slice(0, 1) })
  }

  const handlePillDelete = (attrId) => {
    onChange({ ...block, attributes: (block.attributes || []).filter(a => a.id !== attrId) })
  }

  const handleTagPillSave = (raw) => {
    const { cleanTitle: afterTags, tags: newTags } = parseBlockTags(raw)
    const existingAttrStr = (block.attributes || []).map(a => `@${a.value}${a.label}`).join(' ')
    const fullRaw = [block.title, afterTags, existingAttrStr].filter(Boolean).join(' ').trim()
    const { cleanTitle, attrs } = parseInlineAttributes(fullRaw)
    onChange({ ...block, title: cleanTitle, attributes: attrs.slice(0, 3), tags: newTags.slice(0, 1) })
  }

  const handleTagPillDelete = () => onChange({ ...block, tags: [] })

  // ─── fila derecha colapsada ───────────────────────────────────
  const renderCollapsedRight = () => {
    const attrs = (block.attributes || []).filter(a => a.value || a.label)
    const nonMonetaryAttrs = attrs.filter(a => !isMonetary((a.label || '').toLowerCase()))
    const monetaryAttrs = attrs.filter(a => isMonetary((a.label || '').toLowerCase()))

    if (!hasChildren && tags.length === 0 && attrs.length === 0) return null

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
        {/* etiqueta del padre */}
        {parentTagForDisplay && (
          <InlinePill
            prefix="#" value={parentTagForDisplay}
            onSave={handleTagPillSave}
            onDelete={handleTagPillDelete}
          />
        )}
        {/* sin hijos: atributos no monetarios como píldoras editables */}
        {!hasChildren && nonMonetaryAttrs.map(a => (
          <InlinePill
            key={a.id}
            prefix="@" value={`${a.value}${a.label}`}
            onSave={(raw) => handlePillSave(a.id, raw)}
            onDelete={() => handlePillDelete(a.id)}
          />
        ))}
        {/* con hijos: unidades según ley unificada (texto estático) */}
        {hasChildren && collapsedUnits.map(u => (
          <span key={u.label} style={{ color: 'var(--color-text-light)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
            {u.display}
          </span>
        ))}
        {/* monetario */}
        {monetaryDisplay ? (
          <span style={{ color: 'var(--color-text)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
            {monetaryDisplay.str}
          </span>
        ) : (
          !hasChildren && monetaryAttrs.map(a => (
            <InlinePill
              key={a.id}
              prefix="@" value={`${a.value}${a.label}`}
              onSave={(raw) => handlePillSave(a.id, raw)}
              onDelete={() => handlePillDelete(a.id)}
            />
          ))
        )}
      </div>
    )
  }

  return (
    <div
      ref={blockRef}
      data-block-id={block.id}
      data-depth={depth}
      style={{ paddingLeft: depth * 20, position: 'relative', marginBottom: depth === 0 ? '4px' : '2px' }}
      onMouseEnter={() => setShowHandle(true)}
      onMouseLeave={() => { setShowHandle(false); setMenuOpen(false) }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={() => setMenuOpen(false)}
    >
      {/* ── fila principal ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>

        {/* handle drag */}
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={e => e.stopPropagation()}
          style={{ cursor: 'grab', color: 'var(--color-text-light)', fontSize: '18px', opacity: showHandle ? 1 : 0, transition: 'opacity 0.15s', userSelect: 'none', flexShrink: 0, lineHeight: 1, padding: '8px 4px' }}
        >⠿</div>

        {/* chevron solo si tiene hijos */}
        {hasChildren ? (
          <div
            onClick={e => { e.stopPropagation(); setExpanded(prev => !prev) }}
            style={{ flexShrink: 0, width: '20px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}
          >{expanded ? '▾' : '▸'}</div>
        ) : (
          <div style={{ flexShrink: 0, width: '20px' }} />
        )}

        {/* título */}
        <input
          ref={(el) => {
            titleInputRef.current = el
            if (typeof inputRef === 'function') inputRef(el)
            else if (inputRef) inputRef.current = el
          }}
          type="text"
          value={isEditingTitle ? rawTitle : block.title}
          onChange={e => isEditingTitle ? setRawTitle(e.target.value) : onChange({ ...block, title: e.target.value })}
          onClick={handleTitleClick}
          onFocus={handleTitleFocus}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          placeholder="..."
          style={{
            border: 'none', fontSize: depth === 0 ? '15px' : '14px', outline: 'none',
            fontFamily: 'var(--font-main)', flex: 1, minWidth: 0,
            color: depth === 0 ? 'var(--color-text)' : 'var(--color-text-light)',
            background: 'transparent', cursor: 'text'
          }}
        />

        {/* + Atributo y + Etiqueta — solo en expandido, en la línea del título */}
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button
              onMouseDown={e => e.preventDefault()} // evitar que blur del título se dispare antes
              onClick={addAttribute}
              style={{ background: 'none', border: '1px dashed var(--color-border)', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-light)', fontFamily: 'var(--font-main)', whiteSpace: 'nowrap' }}
            >+ atributo</button>
            {tags.length === 0 && (
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={addTag}
                style={{ background: 'none', border: '1px dashed var(--color-border)', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-light)', fontFamily: 'var(--font-main)', whiteSpace: 'nowrap' }}
              >+ etiqueta</button>
            )}
          </div>
        )}

        {/* valores colapsados */}
        {!expanded && !isEditingTitle && (
          <div onClick={e => e.stopPropagation()}>
            {renderCollapsedRight()}
          </div>
        )}

        {/* menú ··· */}
        <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '18px', padding: '8px 4px', opacity: showHandle ? 1 : 0, transition: 'opacity 0.15s' }}
          >···</button>
          {menuOpen && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: '0', top: '36px', background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '140px' }}>
              <div onClick={() => { onDuplicate(block); setMenuOpen(false) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '15px' }}>Duplicar</div>
              <div onClick={() => { if (window.confirm('¿Eliminar?')) onDelete(block.id); setMenuOpen(false) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '15px', color: 'red' }}>Eliminar</div>
            </div>
          )}
        </div>
      </div>

      {/* ── contenido desplegado ── */}
      {expanded && (
        <div style={{ paddingLeft: '36px', paddingBottom: '12px' }}>

          {/* píldoras de atributos y etiqueta existentes */}
          {(tags.length > 0 || (block.attributes || []).length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {tags.map((tag, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.06)', borderRadius: '20px', padding: '3px 10px', fontSize: '13px' }}>
                  <InlinePill
                    prefix="#" value={tag}
                    onSave={handleTagPillSave}
                    onDelete={handleTagPillDelete}
                  />
                </div>
              ))}
              {(block.attributes || []).map(attr => (
                <div key={attr.id} style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.06)', borderRadius: '20px', padding: '3px 10px', fontSize: '13px' }}>
                  <InlinePill
                    prefix="@" value={`${attr.value}${attr.label}`}
                    onSave={(raw) => handlePillSave(attr.id, raw)}
                    onDelete={() => handlePillDelete(attr.id)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* textarea body */}
          <textarea
            ref={bodyTextareaRef}
            value={block.body}
            onChange={e => { onChange({ ...block, body: e.target.value }); autoResize(e.target) }}
            onFocus={() => clearTimeout(blurTimerRef.current)}
            placeholder="Escribe algo..."
            rows={1}
            style={{ width: '100%', border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text)', resize: 'none', lineHeight: '1.5', background: 'rgba(0,0,0,0.04)', borderRadius: '4px', padding: '8px 10px', marginBottom: '10px', boxSizing: 'border-box', overflow: 'hidden' }}
          />

          {/* hijos */}
          {depth === 0 && (
            <div>
              {(block.children || []).map((child, ci) => (
                <div key={child.id} style={{ position: 'relative' }}>
                  {childDropIndicator?.beforeIndex === ci && (
                    <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
                  )}
                  <Block
                    block={child} depth={1}
                    onChange={onChange} onDelete={onDelete} onDuplicate={onDuplicate} onAddChild={onAddChild}
                    onDragStart={(b) => { dragInfo.current = { block: b, parentId: block.id }; onDragStart(b, block.id) }}
                    onDragEnd={onDragEnd} dragInfo={dragInfo}
                    allAttributes={allAttributes} collapseAll={collapseAll}
                    inputRef={child.id === newChildId ? onNewChildRef : undefined}
                  />
                </div>
              ))}
              {childDropIndicator?.beforeIndex === (block.children || []).length && (
                <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
              )}

              <div
                onClick={() => onAddChild(block.id)}
                style={{ minHeight: '32px', cursor: 'text', display: 'flex', alignItems: 'center', paddingLeft: '20px', color: 'var(--color-text-light)', fontSize: '14px', opacity: 0.4, userSelect: 'none' }}
              >+</div>

              {/* total de hijos */}
              {hasChildren && (() => {
                const childMon = computeChildrenSubtotal(block.children)
                const childUnits = computeChildrenUnitTotals(block.children)
                if (!childMon && childUnits.length === 0) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--color-border)', marginTop: '4px' }}>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-light)' }}>Total</span>
                    {childUnits.map(ut => (
                      <span key={ut.label} style={{ fontSize: '13px', color: 'var(--color-text-light)', fontVariantNumeric: 'tabular-nums' }}>{ut.total} {ut.label}</span>
                    ))}
                    {childMon && (
                      <span style={{ fontSize: '13px', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{formatMonetary(childMon.total)}{childMon.currency}</span>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Block

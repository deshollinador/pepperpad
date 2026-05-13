// src/components/Block.jsx
import { useState, useRef, useEffect } from 'react'
import {
  parseBlockTitle, reconstructRaw,
  MAX_ATTRIBUTES, isMonetaryLabel, isUdsLabel,
  displayTag
} from '../utils/blockParser'
import {
  formatMonetary, normalizeDecimal,
  computeChildrenSubtotal, computeChildrenUnitTotals
} from '../utils/totals'

const computeBlockTotal = (attributes) => {
  const attrs = (attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
  const monetaryAttrs = attrs.filter(a => isMonetaryLabel(a.label))
  const udsAttr = attrs.find(a => isUdsLabel(a.label))
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

const buildCollapsedUnits = (block) => {
  const children = block.children || []
  const ownAttrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
  const ownNonMonetary = ownAttrs.filter(a => !isMonetaryLabel(a.label) && !isUdsLabel(a.label))
  const childUnitMap = {}
  for (const child of children) {
    for (const attr of (child.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))) {
      if (isMonetaryLabel(attr.label) || isUdsLabel(attr.label)) continue
      const val = parseFloat(normalizeDecimal(attr.value))
      if (isNaN(val)) continue
      if (!childUnitMap[attr.label]) childUnitMap[attr.label] = 0
      childUnitMap[attr.label] += val
    }
  }
  const allLabels = new Set([...ownNonMonetary.map(a => a.label), ...Object.keys(childUnitMap)])
  const units = []
  for (const label of allLabels) {
    const ownAttr = ownNonMonetary.find(a => a.label === label)
    const ownVal = ownAttr ? parseFloat(normalizeDecimal(ownAttr.value)) : null
    const childSum = childUnitMap[label] !== undefined ? Math.round(childUnitMap[label] * 100) / 100 : null
    if (ownVal !== null && childSum !== null && Math.round(ownVal * 100) !== Math.round(childSum * 100)) {
      units.push({ label, display: `${ownVal} → ${childSum} ${label}` })
    } else if (childSum !== null) {
      units.push({ label, display: `${childSum} ${label}` })
    } else if (ownVal !== null) {
      units.push({ label, display: `${ownVal} ${label}` })
    }
  }
  return units
}

const getParentTagForDisplay = (block) => {
  const tags = block.tags || []
  if (tags.length === 0) return null
  const children = block.children || []
  if (children.length === 0) return tags[0]
  return children.some(c => (c.tags || []).length > 0) ? null : tags[0]
}

const autoResize = (el) => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

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

  const startEdit = (e) => { e.stopPropagation(); setRaw(value); setEditing(true) }

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
        <input ref={inputRef} value={raw} onChange={handleChange} onBlur={commit} onKeyDown={handleKeyDown}
          onClick={e => e.stopPropagation()}
          style={{ border: 'none', borderBottom: '1px solid var(--color-border)', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '13px', color: 'var(--color-text)', background: 'transparent', width: `${Math.max((raw.length || 1) + 1, 3)}ch`, paddingBottom: '1px' }} />
      </span>
    )
  }

  return (
    <span onClick={startEdit}
      style={{ color: prefix === '#' ? 'var(--color-text-light)' : 'var(--color-text)', fontSize: '13px', cursor: 'text', fontVariantNumeric: 'tabular-nums', opacity: prefix === '#' ? 0.7 : 1 }}>
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
  const collapseTimerRef = useRef(null)

  const hasChildren = (block.children || []).length > 0
  const blockTotal = computeBlockTotal(block.attributes)
  const collapsedUnits = depth === 0 ? buildCollapsedUnits(block) : []
  const childMonetary = depth === 0 && hasChildren ? computeChildrenSubtotal(block.children) : null
  const tags = block.tags || []
  const parentTagForDisplay = depth === 0 ? getParentTagForDisplay(block) : null
  const attrMaxed = (block.attributes || []).length >= MAX_ATTRIBUTES
  const tagMaxed = tags.length >= 1

  const monetaryDisplay = (() => {
    const ownMonetary = blockTotal
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

  useEffect(() => {
    const el = blockRef.current
    if (!el || !expanded) return
    const handleFocusOut = (e) => {
      const related = e.relatedTarget
      if (!related || !el.contains(related)) {
        clearTimeout(collapseTimerRef.current)
        collapseTimerRef.current = setTimeout(() => {
          if (!el.contains(document.activeElement)) setExpanded(false)
        }, 300)
      }
    }
    el.addEventListener('focusout', handleFocusOut)
    return () => el.removeEventListener('focusout', handleFocusOut)
  }, [expanded])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      const len = titleInputRef.current.value.length
      titleInputRef.current.setSelectionRange(len, len)
    }
  }, [isEditingTitle, rawTitle])

  const cancelCollapse = () => clearTimeout(collapseTimerRef.current)

  const handleTouchStart = () => { longPressTimer.current = setTimeout(() => setShowHandle(true), 500) }
  const handleTouchEnd = () => { clearTimeout(longPressTimer.current); setShowHandle(false) }
  const handleTouchCancel = () => { clearTimeout(longPressTimer.current); setShowHandle(false) }
  const handleDragStart = (e) => { onDragStart(block, depth === 0 ? null : block.parentId); e.dataTransfer.effectAllowed = 'move' }
  const handleDragEnd = () => { setShowHandle(false); onDragEnd() }

  const handleTitleClick = (e) => { e.stopPropagation(); cancelCollapse(); setExpanded(true) }

  const handleTitleFocus = () => {
    cancelCollapse()
    if (!isEditingTitle) setRawTitle(reconstructRaw(block.title, block.attributes, block.tags))
    setIsEditingTitle(true)
  }

  const commitTitle = () => {
    setIsEditingTitle(false)
    if (!rawTitle.trim()) { onChange({ ...block, title: '', attributes: [], tags: [] }); setExpanded(false); return }
    const parsed = parseBlockTitle(rawTitle)
    onChange({ ...block, title: parsed.title, attributes: parsed.attributes, tags: parsed.tags })
    setExpanded(false)
  }

  const handleTitleBlur = (e) => {
    if (e.relatedTarget && blockRef.current?.contains(e.relatedTarget)) return
    commitTitle()
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
    if (e.key === 'Escape') { setIsEditingTitle(false); setExpanded(false) }
  }

  const applyPillChange = (raw) => {
    const parsed = parseBlockTitle(raw)
    onChange({ ...block, title: parsed.title, attributes: parsed.attributes, tags: parsed.tags })
  }

  const handlePillSave = (attrId, raw) => {
    const otherAttrs = (block.attributes || []).filter(a => a.id !== attrId)
    const fullRaw = [block.title, ...tags.map(t => `#${displayTag(t)}`), ...otherAttrs.map(a => `@${a.value}${a.label}`), raw].filter(Boolean).join(' ')
    applyPillChange(fullRaw)
  }
  const handlePillDelete = (attrId) => onChange({ ...block, attributes: (block.attributes || []).filter(a => a.id !== attrId) })

  const handleTagPillSave = (raw) => {
    const fullRaw = [block.title, raw, ...(block.attributes || []).map(a => `@${a.value}${a.label}`)].filter(Boolean).join(' ')
    applyPillChange(fullRaw)
  }
  const handleTagPillDelete = () => onChange({ ...block, tags: [] })

  const addAttribute = (e) => {
    e.stopPropagation(); cancelCollapse()
    if (attrMaxed) return
    const base = isEditingTitle ? rawTitle : reconstructRaw(block.title, block.attributes, block.tags)
    setRawTitle(base ? base + ' @' : '@')
    setIsEditingTitle(true)
  }

  const addTag = (e) => {
    e.stopPropagation(); cancelCollapse()
    if (tagMaxed) return
    const base = isEditingTitle ? rawTitle : reconstructRaw(block.title, block.attributes, block.tags)
    setRawTitle(base ? base + ' #' : '#')
    setIsEditingTitle(true)
  }

  const renderCollapsedRight = () => {
    const attrs = (block.attributes || []).filter(a => a.value || a.label)
    const nonMonetaryAttrs = attrs.filter(a => !isMonetaryLabel((a.label || '').toLowerCase()))
    const monetaryAttrs = attrs.filter(a => isMonetaryLabel((a.label || '').toLowerCase()))
    if (!hasChildren && tags.length === 0 && attrs.length === 0) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
        {parentTagForDisplay && <InlinePill prefix="#" value={parentTagForDisplay} onSave={handleTagPillSave} onDelete={handleTagPillDelete} />}
        {!hasChildren && nonMonetaryAttrs.map(a => (
          <InlinePill key={a.id} prefix="@" value={`${a.value}${a.label}`} onSave={(r) => handlePillSave(a.id, r)} onDelete={() => handlePillDelete(a.id)} />
        ))}
        {hasChildren && collapsedUnits.map(u => (
          <span key={u.label} style={{ color: 'var(--color-text-light)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{u.display}</span>
        ))}
        {hasChildren && monetaryDisplay && (
          <span style={{ color: 'var(--color-text)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{monetaryDisplay.str}</span>
        )}
        {!hasChildren && monetaryAttrs.map(a => (
          <InlinePill key={a.id} prefix="@" value={`${a.value}${a.label}`} onSave={(r) => handlePillSave(a.id, r)} onDelete={() => handlePillDelete(a.id)} />
        ))}
      </div>
    )
  }

  const btnStyle = (disabled) => ({
    background: 'none', border: '1px dashed var(--color-border)', borderRadius: '20px',
    padding: '3px 10px', fontSize: '12px', cursor: disabled ? 'default' : 'pointer',
    color: 'var(--color-text-light)', fontFamily: 'var(--font-main)', opacity: disabled ? 0.3 : 1, whiteSpace: 'nowrap'
  })

  return (
    <div ref={blockRef} data-block-id={block.id} data-depth={depth}
      style={{ paddingLeft: depth * 20, position: 'relative', marginBottom: depth === 0 ? '4px' : '2px' }}
      onMouseEnter={() => setShowHandle(true)}
      onMouseLeave={() => { setShowHandle(false); setMenuOpen(false) }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchCancel}
      onClick={() => setMenuOpen(false)}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
        <div draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd} onClick={e => e.stopPropagation()}
          style={{ cursor: 'grab', color: 'var(--color-text-light)', fontSize: '18px', opacity: showHandle ? 1 : 0, transition: 'opacity 0.15s', userSelect: 'none', flexShrink: 0, lineHeight: 1, padding: '8px 4px' }}>⠿</div>

        {hasChildren
          ? <div onClick={e => { e.stopPropagation(); setExpanded(p => !p) }}
              style={{ flexShrink: 0, width: '20px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
              {expanded ? '▾' : '▸'}
            </div>
          : <div style={{ flexShrink: 0, width: '20px' }} />
        }

        <input
          ref={(el) => { titleInputRef.current = el; if (typeof inputRef === 'function') inputRef(el); else if (inputRef) inputRef.current = el }}
          type="text"
          value={isEditingTitle ? rawTitle : block.title}
          onChange={e => setRawTitle(e.target.value)}
          onClick={handleTitleClick} onFocus={handleTitleFocus} onBlur={handleTitleBlur} onKeyDown={handleTitleKeyDown}
          placeholder="..."
          style={{ border: 'none', fontSize: depth === 0 ? '15px' : '14px', outline: 'none', fontFamily: 'var(--font-main)', flex: 1, minWidth: 0, color: depth === 0 ? 'var(--color-text)' : 'var(--color-text-light)', background: 'transparent', cursor: 'text' }}
        />

        {!expanded && !isEditingTitle && <div onClick={e => e.stopPropagation()}>{renderCollapsedRight()}</div>}

        <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '18px', padding: '8px 4px', opacity: showHandle ? 1 : 0, transition: 'opacity 0.15s' }}>···</button>
          {menuOpen && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '36px', background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '140px' }}>
              <div onClick={() => { onDuplicate(block); setMenuOpen(false) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '15px' }}>Duplicar</div>
              <div onClick={() => { if (window.confirm('¿Eliminar?')) onDelete(block.id); setMenuOpen(false) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '15px', color: 'red' }}>Eliminar</div>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ paddingLeft: '36px', paddingBottom: '12px' }}>
          {(tags.length > 0 || (block.attributes || []).length > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {tags.map((tag, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.06)', borderRadius: '20px', padding: '3px 10px', fontSize: '13px' }}>
                  <InlinePill prefix="#" value={tag} onSave={handleTagPillSave} onDelete={handleTagPillDelete} />
                </div>
              ))}
              {(block.attributes || []).map(attr => (
                <div key={attr.id} style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0,0,0,0.06)', borderRadius: '20px', padding: '3px 10px', fontSize: '13px' }}>
                  <InlinePill prefix="@" value={`${attr.value}${attr.label}`} onSave={(r) => handlePillSave(attr.id, r)} onDelete={() => handlePillDelete(attr.id)} />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }} onClick={e => e.stopPropagation()}>
            <button onMouseDown={e => e.preventDefault()} onClick={addAttribute} disabled={attrMaxed} style={btnStyle(attrMaxed)}>+ atributo</button>
            <button onMouseDown={e => e.preventDefault()} onClick={addTag} disabled={tagMaxed} style={btnStyle(tagMaxed)}>+ etiqueta</button>
          </div>

          <textarea ref={bodyTextareaRef} value={block.body}
            onChange={e => { onChange({ ...block, body: e.target.value }); autoResize(e.target) }}
            onFocus={cancelCollapse}
            placeholder="Escribe algo..." rows={1}
            style={{ width: '100%', border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text)', resize: 'none', lineHeight: '1.5', background: 'rgba(0,0,0,0.04)', borderRadius: '4px', padding: '8px 10px', marginBottom: '10px', boxSizing: 'border-box', overflow: 'hidden' }}
          />

          {depth === 0 && (
            <div>
              {(block.children || []).map((child, ci) => (
                <div key={child.id} style={{ position: 'relative' }}>
                  {childDropIndicator?.beforeIndex === ci && <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />}
                  <Block block={child} depth={1} onChange={onChange} onDelete={onDelete} onDuplicate={onDuplicate} onAddChild={onAddChild}
                    onDragStart={(b) => { dragInfo.current = { block: b, parentId: block.id }; onDragStart(b, block.id) }}
                    onDragEnd={onDragEnd} dragInfo={dragInfo} allAttributes={allAttributes} collapseAll={collapseAll}
                    inputRef={child.id === newChildId ? onNewChildRef : undefined} />
                </div>
              ))}
              {childDropIndicator?.beforeIndex === (block.children || []).length && <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />}

              <div onClick={() => onAddChild(block.id)}
                style={{ minHeight: '32px', cursor: 'text', display: 'flex', alignItems: 'center', paddingLeft: '20px', color: 'var(--color-text-light)', fontSize: '14px', opacity: 0.4, userSelect: 'none' }}>+</div>

              {hasChildren && (() => {
                const childMon = computeChildrenSubtotal(block.children)
                const childUnits = computeChildrenUnitTotals(block.children)
                if (!childMon && childUnits.length === 0) return null
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--color-border)', marginTop: '4px' }}>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-light)' }}>Total</span>
                    {childUnits.map(ut => <span key={ut.label} style={{ fontSize: '13px', color: 'var(--color-text-light)', fontVariantNumeric: 'tabular-nums' }}>{ut.total} {ut.label}</span>)}
                    {childMon && <span style={{ fontSize: '13px', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{formatMonetary(childMon.total)}{childMon.currency}</span>}
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

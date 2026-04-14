// src/components/Block.jsx
import { useState, useRef, useEffect } from 'react'
import {
  MONETARY, isMonetary, isUds, formatMonetary,
  computeChildrenSubtotal, computeChildrenUnitTotals
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
    const qty = parseFloat(udsAttr.value)
    const price = parseFloat(monetaryAttrs[0].value)
    if (!isNaN(qty) && !isNaN(price)) {
      return { hasCalc: true, total: Math.round(qty * price * 100) / 100, currency: monetaryAttrs[0].label, pricePerUnit: price, qty }
    }
  }

  if (monetaryAttrs.length === 1) {
    const val = parseFloat(monetaryAttrs[0].value)
    if (!isNaN(val)) return { hasCalc: false, total: val, currency: monetaryAttrs[0].label }
  }

  return null
}

const reconstructRawTitle = (title, attributes) => {
  if (!attributes || attributes.length === 0) return title
  const tokens = attributes.map(a => `@${a.value}${a.label}`).join(' ')
  return `${title} ${tokens}`.trim()
}

const parseInlineAttributes = (raw) => {
  const tokenRegex = /(?:^|(?<=\s))[@=]\s*(-?\d+\.?\d*)\s*([a-zA-Z%$€£°\/²³]*)/g
  const attrs = []
  let match
  while ((match = tokenRegex.exec(raw)) !== null) {
    const value = match[1]
    const label = match[2].toLowerCase()
    attrs.push({ id: Date.now().toString() + Math.random(), value, label, sum: isMonetary(label) })
  }
  const cleanTitle = raw.replace(/(?:^|(?<=\s))[@=]\s*-?\d+\.?\d*\s*[a-zA-Z%$€£°\/²³]*/g, '').trim()
  return { cleanTitle, attrs: sortAttributes(attrs) }
}

const hasInlineTokens = (text) =>
  /(?:^|(?<=\s))[@=]\s*-?\d+\.?\d*\s*[a-zA-Z%$€£°\/²³]*/.test(text)

const autoResize = (el) => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

// ─── resumen de totales de hijos para mostrar en fila colapsada ──
// Devuelve array de strings como "12compases", "6,00€", "8 → 12compases"
const buildChildrenSummary = (block) => {
  const children = block.children || []
  if (children.length === 0) return []

  const summary = []

  // totales monetarios de hijos
  const childMonetary = computeChildrenSubtotal(children)
  if (childMonetary) {
    // valor propio monetario del padre
    const ownTotal = computeBlockTotal(block.attributes)
    const ownMonetary = ownTotal && ownTotal.currency === childMonetary.currency ? ownTotal.total : null
    const childStr = `${formatMonetary(childMonetary.total)}${childMonetary.currency}`
    if (ownMonetary !== null && Math.round(ownMonetary * 100) !== Math.round(childMonetary.total * 100)) {
      summary.push(`${formatMonetary(ownMonetary)} → ${childStr}`)
    } else {
      summary.push(childStr)
    }
  }

  // totales por unidad no monetaria de hijos
  const childUnits = computeChildrenUnitTotals(children)
  for (const ut of childUnits) {
    // valor propio del padre para esa unidad
    const ownAttr = (block.attributes || []).find(a => (a.label || '').toLowerCase() === ut.label)
    const ownVal = ownAttr ? parseFloat(ownAttr.value) : null
    const childStr = `${ut.total}${ut.label}`
    if (ownVal !== null && !isNaN(ownVal) && Math.round(ownVal * 100) !== Math.round(ut.total * 100)) {
      summary.push(`${ownVal} → ${childStr}`)
    } else {
      summary.push(childStr)
    }
  }

  return summary
}

function Block({
  block, depth, onChange, onDelete, onDuplicate, onAddChild,
  onDragStart, onDragEnd, childDropIndicator, dragInfo, inputRef, showDivider,
  allAttributes, onConvertToStructured, collapseAll
}) {
  const [expanded, setExpanded] = useState(!block.collapsed)
  const [showHandle, setShowHandle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingAttrId, setEditingAttrId] = useState(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [rawTitle, setRawTitle] = useState('')
  const longPressTimer = useRef(null)
  const simpleTextareaRef = useRef(null)
  const bodyTextareaRef = useRef(null)

  const isSimpleMode = !showDivider && depth === 0
  const hasAttributes = (block.attributes || []).length > 0
  const hasChildren = (block.children || []).length > 0
  const blockTotal = computeBlockTotal(block.attributes)
  const childrenSummary = depth === 0 ? buildChildrenSummary(block) : []
  const showChildrenSummary = childrenSummary.length > 0

  useEffect(() => { if (collapseAll) setExpanded(false) }, [collapseAll])
  useEffect(() => { autoResize(simpleTextareaRef.current) }, [])
  useEffect(() => { if (expanded) autoResize(bodyTextareaRef.current) }, [expanded])

  const handleTouchStart = () => { longPressTimer.current = setTimeout(() => setShowHandle(true), 500) }
  const handleTouchEnd = () => { clearTimeout(longPressTimer.current) }

  const handleDragStart = (e) => {
    onDragStart(block, depth === 0 ? null : block.parentId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnd = () => { setShowHandle(false); onDragEnd() }

  const handleTitleFocus = () => {
    setIsEditingTitle(true)
    setRawTitle(reconstructRawTitle(block.title, block.attributes))
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    if (!rawTitle.trim()) { onChange({ ...block, title: '', attributes: [] }); return }
    const { cleanTitle, attrs } = parseInlineAttributes(rawTitle)
    if (attrs.length === 0) { onChange({ ...block, title: rawTitle.trim(), attributes: [] }); return }
    onChange({ ...block, title: cleanTitle, attributes: attrs.slice(0, 3) })
  }

  const handleTitleKeyDown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } }

  const addAttribute = () => {
    if ((block.attributes || []).length >= 3) return
    const newAttr = { id: Date.now().toString(), label: '', value: '', sum: false }
    onChange({ ...block, attributes: [...(block.attributes || []), newAttr] })
    setEditingAttrId(newAttr.id)
  }

  const updateAttribute = (id, field, raw) => {
    let value = raw
    if (field === 'value') {
      value = raw.replace(/[^0-9.\-]/g, '')
      const parts = value.split('.')
      if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('')
      if (value.indexOf('-') > 0) value = value.replace(/-/g, '')
    }
    onChange({ ...block, attributes: (block.attributes || []).map(a => a.id === id ? { ...a, [field]: value } : a) })
  }

  const normalizeLabel = (id, raw) => {
    const cleaned = raw.replace(/[^a-zA-Z%$€£°\/²³]/g, '').toLowerCase()
    onChange({ ...block, attributes: sortAttributes((block.attributes || []).map(a => a.id === id ? { ...a, label: cleaned, sum: isMonetary(cleaned) } : a)) })
  }

  const toggleAttributeSum = (id) => {
    onChange({ ...block, attributes: (block.attributes || []).map(a => a.id === id ? { ...a, sum: !a.sum } : a) })
  }

  const deleteAttribute = (id) => {
    onChange({ ...block, attributes: (block.attributes || []).filter(a => a.id !== id) })
  }

  const getLabelSuggestions = (currentValue) => {
    if (!allAttributes || !currentValue) return []
    const used = allAttributes.filter(a => a.label && a.label.startsWith(currentValue) && a.label !== currentValue).map(a => a.label)
    return [...new Set(used)]
  }

  // ─── fila de atributos colapsada ──────────────────────────────
  // Si hay hijos: muestra el resumen de hijos (con → si difiere del valor propio)
  // Si no hay hijos: muestra los atributos propios del bloque
  const renderCollapsedRight = () => {
    if (showChildrenSummary) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {childrenSummary.map((s, i) => (
            <span key={i} style={{ fontSize: '14px', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{s}</span>
          ))}
        </div>
      )
    }

    if (!hasAttributes || !blockTotal) return null

    const attrs = (block.attributes || []).filter(a => a.value || a.label)
    const nonMonetary = attrs.filter(a => !isMonetary(a.label))
    const monetaryAttr = attrs.find(a => isMonetary(a.label))

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
        {nonMonetary.map((a) => (
          <span key={a.id} style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>{a.value}{a.label}</span>
        ))}
        {blockTotal?.hasCalc && (
          <span style={{ color: 'var(--color-text)', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
            {formatMonetary(blockTotal.pricePerUnit)}{blockTotal.currency}/ud = {formatMonetary(blockTotal.total)}{blockTotal.currency}
          </span>
        )}
        {!blockTotal?.hasCalc && monetaryAttr && (
          <span style={{ color: 'var(--color-text)', fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>
            {formatMonetary(monetaryAttr.value)}{monetaryAttr.label}
          </span>
        )}
      </div>
    )
  }

  if (isSimpleMode) {
    return (
      <div data-block-id={block.id} data-depth={depth}>
        <textarea
          ref={(el) => {
            simpleTextareaRef.current = el
            if (typeof inputRef === 'function') inputRef(el)
            else if (inputRef) inputRef.current = el
          }}
          value={block.body}
          onChange={e => { onChange({ ...block, body: e.target.value }); autoResize(e.target) }}
          onKeyDown={e => {
            if (e.key === 'Enter' && hasInlineTokens(e.target.value) && onConvertToStructured) {
              e.preventDefault(); onConvertToStructured(block, e.target.value)
            }
          }}
          onBlur={e => { if (hasInlineTokens(e.target.value) && onConvertToStructured) onConvertToStructured(block, e.target.value) }}
          placeholder="Nota"
          rows={1}
          style={{ width: '100%', minHeight: '28px', border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '15px', color: 'var(--color-text)', resize: 'none', lineHeight: '1.6', background: 'transparent', display: 'block', boxSizing: 'border-box', overflow: 'hidden' }}
        />
      </div>
    )
  }

  // ─── modo estructurado ────────────────────────────────────────
  return (
    <div
      data-block-id={block.id}
      data-depth={depth}
      style={{ paddingLeft: depth * 20, position: 'relative', marginBottom: depth === 0 ? '4px' : '2px' }}
      onMouseEnter={() => setShowHandle(true)}
      onMouseLeave={() => { setShowHandle(false); setMenuOpen(false) }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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

        {/* chevron */}
        <div
          onClick={e => { e.stopPropagation(); setExpanded(prev => !prev) }}
          style={{ flexShrink: 0, width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-light)', fontSize: '14px', cursor: 'pointer', userSelect: 'none' }}
        >{expanded ? '▾' : '▸'}</div>

        {/* título */}
        <input
          ref={inputRef}
          type="text"
          value={isEditingTitle ? rawTitle : block.title}
          onChange={e => isEditingTitle ? setRawTitle(e.target.value) : onChange({ ...block, title: e.target.value })}
          onClick={e => e.stopPropagation()}
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

        {/* derecha colapsada: resumen hijos o atributos propios */}
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

          {/* atributos propios */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {(block.attributes || []).map(attr => {
              const suggestions = getLabelSuggestions(attr.label)
              return (
                <div key={attr.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '20px', padding: '4px 12px', fontSize: '14px', position: 'relative' }}>
                  {editingAttrId === attr.id ? (
                    <>
                      <input autoFocus value={attr.value} onChange={e => updateAttribute(attr.id, 'value', e.target.value)} placeholder="valor" style={{ width: '48px', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontFamily: 'var(--font-main)' }} />
                      <div style={{ position: 'relative' }}>
                        <input value={attr.label} onChange={e => updateAttribute(attr.id, 'label', e.target.value)} placeholder="unidad" style={{ width: '48px', border: 'none', outline: 'none', background: 'transparent', fontSize: '14px', fontFamily: 'var(--font-main)' }}
                          onBlur={e => { normalizeLabel(attr.id, e.target.value); setEditingAttrId(null) }} />
                        {suggestions.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 20, minWidth: '80px' }}>
                            {suggestions.map(s => (
                              <div key={s} onMouseDown={e => { e.preventDefault(); normalizeLabel(attr.id, s); setEditingAttrId(null) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px' }}>{s}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <span onClick={() => toggleAttributeSum(attr.id)} title="Incluir en totales" style={{ cursor: 'pointer', fontSize: '13px', opacity: attr.sum ? 1 : 0.3, userSelect: 'none' }}>Σ</span>
                    </>
                  ) : (
                    <span onClick={() => setEditingAttrId(attr.id)} style={{ cursor: 'pointer' }}>{attr.value || '—'}{attr.label}</span>
                  )}
                  <span onClick={e => { e.stopPropagation(); deleteAttribute(attr.id) }} style={{ cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '14px', lineHeight: 1 }}>×</span>
                </div>
              )
            })}
            {(block.attributes || []).length < 3 && (
              <button onClick={addAttribute} style={{ background: 'none', border: '1px dashed var(--color-border)', borderRadius: '20px', padding: '4px 12px', fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-light)', fontFamily: 'var(--font-main)' }}>+ Atributo</button>
            )}
          </div>

          {/* texto */}
          <textarea
            ref={bodyTextareaRef}
            value={block.body}
            onChange={e => { onChange({ ...block, body: e.target.value }); autoResize(e.target) }}
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
                    onDragEnd={onDragEnd} dragInfo={dragInfo} showDivider={true}
                    allAttributes={allAttributes} collapseAll={collapseAll}
                  />
                </div>
              ))}
              {childDropIndicator?.beforeIndex === (block.children || []).length && (
                <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
              )}

              {/* totales de hijos expandidos — solo si hay hijos con datos */}
              {hasChildren && childrenSummary.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', paddingLeft: '0', borderTop: '1px solid var(--color-border)', marginTop: '4px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-text-light)' }}>Total</span>
                  {childrenSummary.map((s, i) => (
                    <span key={i} style={{ fontSize: '13px', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{s}</span>
                  ))}
                </div>
              )}

              <button onClick={() => onAddChild(block.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '14px', padding: '6px 0', marginLeft: '0' }}>+ Nuevo</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Block

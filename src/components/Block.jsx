// src/components/Block.jsx
import { useState, useRef } from 'react'

function Block({
  block, depth, onChange, onDelete, onDuplicate, onAddChild,
  onDragStart, onDragEnd, isDropTarget, childDropIndicator, dragInfo, inputRef, showDivider
}) {
  const [expanded, setExpanded] = useState(!block.collapsed)
  const [showHandle, setShowHandle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingAttrId, setEditingAttrId] = useState(null)
  const longPressTimer = useRef(null)

  const isSimpleMode = !showDivider && depth === 0
  const hasAttributes = (block.attributes || []).length > 0

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setShowHandle(true), 500)
  }

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current)
  }

  const handleDragStart = (e) => {
    onDragStart(block, depth === 0 ? null : block.parentId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setShowHandle(false)
    onDragEnd()
  }

  const addAttribute = () => {
    if ((block.attributes || []).length >= 2) return
    const newAttr = { id: Date.now().toString(), label: '', value: '', sum: false }
    const updated = { ...block, attributes: [...(block.attributes || []), newAttr] }
    onChange(updated)
    setEditingAttrId(newAttr.id)
  }

  const updateAttribute = (id, field, raw) => {
    let value = raw
    if (field === 'value') {
      // Solo números, punto decimal y signo negativo
      value = raw.replace(/[^0-9.\-]/g, '')
      // Evitar múltiples puntos o guiones
      const parts = value.split('.')
      if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('')
      if (value.indexOf('-') > 0) value = value.replace(/-/g, '')
    }
    const newAttrs = (block.attributes || []).map(a =>
      a.id === id ? { ...a, [field]: value } : a
    )
    onChange({ ...block, attributes: newAttrs })
  }

  const normalizeLabel = (id, raw) => {
    // Solo letras, %, $, €, £, °, /, ², ³ — normalizar a minúsculas al salir
    const cleaned = raw
      .replace(/[^a-zA-Z%$€£°\/²³]/g, '')
      .toLowerCase()
    const newAttrs = (block.attributes || []).map(a =>
      a.id === id ? { ...a, label: cleaned } : a
    )
    onChange({ ...block, attributes: newAttrs })
  }

  const toggleAttributeSum = (id) => {
    const newAttrs = (block.attributes || []).map(a =>
      a.id === id ? { ...a, sum: !a.sum } : a
    )
    onChange({ ...block, attributes: newAttrs })
  }

  const deleteAttribute = (id) => {
    onChange({ ...block, attributes: (block.attributes || []).filter(a => a.id !== id) })
  }

  const renderAttributeLine = () => {
    const attrs = (block.attributes || []).filter(a => a.value || a.label)
    if (attrs.length === 0) return null
    return attrs.map((a, i) => (
      <span key={a.id} style={{ color: 'var(--color-text-light)', fontSize: '14px' }}>
        {i > 0 && <span style={{ margin: '0 6px' }}>·</span>}
        {a.value}{a.label}
        {a.sum && <span style={{ fontSize: '11px', marginLeft: '2px', opacity: 0.5 }}>Σ</span>}
      </span>
    ))
  }

  // ─── modo simple ─────────────────────────────────────────────
  if (isSimpleMode) {
    return (
      <div data-block-id={block.id} data-depth={depth}>
        <textarea
          ref={inputRef}
          value={block.body}
          onChange={e => onChange({ ...block, body: e.target.value })}
          placeholder="Nota"
          style={{
            width: '100%',
            minHeight: '200px',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-main)',
            fontSize: '16px',
            color: 'var(--color-text)',
            resize: 'none',
            lineHeight: '1.6',
            background: 'transparent'
          }}
        />
      </div>
    )
  }

  // ─── modo estructurado ───────────────────────────────────────
  return (
    <div
      data-block-id={block.id}
      data-depth={depth}
      style={{
        paddingLeft: depth * 20,
        position: 'relative',
        marginBottom: depth === 0 ? '4px' : '2px'
      }}
      onMouseEnter={() => setShowHandle(true)}
      onMouseLeave={() => { setShowHandle(false); setMenuOpen(false) }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => setMenuOpen(false)}
    >
      {/* ── fila principal ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', cursor: 'pointer' }}
        onClick={() => setExpanded(prev => !prev)}
      >
{/* handle */}
<div
  draggable
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
  onClick={e => e.stopPropagation()}
  style={{
    cursor: 'grab',
    color: 'var(--color-text-light)',
    fontSize: '14px',
    opacity: showHandle ? 1 : 0,
    transition: 'opacity 0.15s',
    userSelect: 'none',
    flexShrink: 0,
    lineHeight: 1
  }}
>⠿</div>

{/* chevron toggle */}
<div
  onClick={e => { e.stopPropagation(); setExpanded(prev => !prev) }}
  style={{
    flexShrink: 0,
    width: '12px',
    color: 'var(--color-text-light)',
    fontSize: '9px',
    cursor: 'pointer',
    userSelect: 'none',
    lineHeight: 1,
    opacity: 0.5
  }}
>{expanded ? '▾' : '▸'}</div>

{/* título */}
<input
  ref={inputRef}
  type="text"
  value={block.title}
  onChange={e => onChange({ ...block, title: e.target.value })}
  onClick={e => e.stopPropagation()}
  placeholder="..."
  style={{
    border: 'none',
    fontSize: depth === 0 ? '15px' : '14px',
    outline: 'none',
    fontFamily: 'var(--font-main)',
    flex: 1,
    minWidth: 0,
    color: depth === 0 ? 'var(--color-text)' : 'var(--color-text-light)',
    background: 'transparent',
    cursor: 'text'
  }}
/>

        {/* atributos en línea cuando colapsado */}
        {hasAttributes && !expanded && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
            onClick={e => e.stopPropagation()}
          >
            {renderAttributeLine()}
          </div>
        )}

        {/* ··· menú — visible al hover */}
        <div
          style={{ position: 'relative', flexShrink: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-light)',
              fontSize: '16px',
              padding: '0 4px',
              opacity: showHandle ? 1 : 0,
              transition: 'opacity 0.15s'
            }}
          >···</button>
          {menuOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', right: '0', top: '28px',
                background: 'white', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 10, minWidth: '140px'
              }}
            >
              <div
                onClick={() => { onDuplicate(block); setMenuOpen(false) }}
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px' }}
              >Duplicar</div>
              <div
                onClick={() => { if (window.confirm('¿Eliminar?')) onDelete(block.id); setMenuOpen(false) }}
                style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
              >Eliminar</div>
            </div>
          )}
        </div>
      </div>

      {/* ── contenido desplegado ── */}
      {expanded && (
        <div style={{ paddingLeft: '22px', paddingBottom: '12px' }}>

          {/* campo de texto */}
          <textarea
            value={block.body}
            onChange={e => onChange({ ...block, body: e.target.value })}
            placeholder="Escribe algo..."
            rows={1}
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontFamily: 'var(--font-main)', fontSize: '14px',
              color: 'var(--color-text)', resize: 'none', lineHeight: '1.5',
              background: 'rgba(0,0,0,0.04)', borderRadius: '4px',
              padding: '6px 8px', marginBottom: '12px', boxSizing: 'border-box'
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
          />

          {/* atributos */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {(block.attributes || []).map(attr => (
              <div
                key={attr.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(0,0,0,0.06)', borderRadius: '20px',
                  padding: '3px 10px', fontSize: '13px'
                }}
              >
                {editingAttrId === attr.id ? (
                  <>
                    <input
                      autoFocus
                      value={attr.value}
                      onChange={e => updateAttribute(attr.id, 'value', e.target.value)}
                      placeholder="valor"
                      style={{ width: '44px', border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'var(--font-main)' }}
                    />
                    <input
                      value={attr.label}
                      onChange={e => updateAttribute(attr.id, 'label', e.target.value)}
                      placeholder="unidad"
                      style={{ width: '44px', border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', fontFamily: 'var(--font-main)' }}
                      onBlur={e => {
                        normalizeLabel(attr.id, e.target.value)
                        setEditingAttrId(null)
                      }}
                    />
                    {/* toggle Σ */}
                    <span
                      onClick={() => toggleAttributeSum(attr.id)}
                      title="Incluir en totales"
                      style={{
                        cursor: 'pointer',
                        fontSize: '12px',
                        opacity: attr.sum ? 1 : 0.3,
                        userSelect: 'none'
                      }}
                    >Σ</span>
                  </>
                ) : (
                  <span onClick={() => setEditingAttrId(attr.id)} style={{ cursor: 'pointer' }}>
                    {attr.value || '—'}{attr.label}
                    {attr.sum && <span style={{ fontSize: '11px', marginLeft: '3px', opacity: 0.4 }}>Σ</span>}
                  </span>
                )}
                <span
                  onClick={e => { e.stopPropagation(); deleteAttribute(attr.id) }}
                  style={{ cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '12px', lineHeight: 1 }}
                >×</span>
              </div>
            ))}

            {(block.attributes || []).length < 2 && (
              <button
                onClick={addAttribute}
                style={{
                  background: 'none', border: '1px dashed var(--color-border)',
                  borderRadius: '20px', padding: '3px 10px', fontSize: '13px',
                  cursor: 'pointer', color: 'var(--color-text-light)', fontFamily: 'var(--font-main)'
                }}
              >+ Atributo</button>
            )}
          </div>

          {/* hijos — solo en bloques padre (depth === 0) */}
          {depth === 0 && (
            <div>
              {(block.children || []).map((child, ci) => (
                <div key={child.id} style={{ position: 'relative' }}>
                  {childDropIndicator?.beforeIndex === ci && (
                    <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
                  )}
                  <Block
                    block={child}
                    depth={1}
                    onChange={onChange}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onAddChild={onAddChild}
                    onDragStart={(b) => {
                      dragInfo.current = { block: b, parentId: block.id }
                      onDragStart(b, block.id)
                    }}
                    onDragEnd={onDragEnd}
                    isDropTarget={false}
                    dragInfo={dragInfo}
                    showDivider={true}
                  />
                </div>
              ))}
              {childDropIndicator?.beforeIndex === (block.children || []).length && (
                <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
              )}
              <button
                onClick={() => onAddChild(block.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-light)', fontSize: '13px',
                  padding: '4px 0', marginLeft: '8px'
                }}
              >+ Nuevo</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Block
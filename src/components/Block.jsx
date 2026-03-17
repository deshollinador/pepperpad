// src/components/Block.jsx
import { useState, useRef } from 'react'

function Block({
  block, depth, onChange, onDelete, onDuplicate, onAddChild,
  onDragStart, onDragEnd, isDropTarget, childDropIndicator, dragInfo
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [contextMenu, setContextMenu] = useState(false)
  const [showHandle, setShowHandle] = useState(false)
  const longPressTimer = useRef(null)

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu(true)
  }

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

  return (
    <div
      data-block-id={block.id}
      data-depth={depth}
      style={{
        borderBottom: depth === 0 ? '1px solid var(--color-border)' : 'none',
        padding: '4px 0',
        paddingLeft: depth * 20,
        position: 'relative',
        background: isDropTarget ? 'rgba(0,0,0,0.04)' : 'transparent',
        borderRadius: isDropTarget ? '4px' : '0',
        outline: isDropTarget ? '2px solid var(--color-text)' : 'none',
        transition: 'background 0.1s, outline 0.1s'
      }}
      onClick={() => setContextMenu(false)}
      onMouseEnter={() => setShowHandle(true)}
      onMouseLeave={() => setShowHandle(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{
            cursor: 'grab',
            color: 'var(--color-text-light)',
            fontSize: '14px',
            padding: '0 4px',
            opacity: showHandle ? 1 : 0,
            transition: 'opacity 0.15s',
            userSelect: 'none',
            flexShrink: 0,
            lineHeight: 1
          }}
        >
          ⠿
        </div>

        <input
          type="text"
          value={block.title}
          onChange={e => onChange({ ...block, title: e.target.value })}
          onContextMenu={handleContextMenu}
          placeholder="Título"
          style={{
            border: 'none',
            fontSize: depth === 0 ? '16px' : '14px',
            outline: 'none',
            fontFamily: 'var(--font-main)',
            width: '100%',
            color: depth === 0 ? 'var(--color-text)' : 'var(--color-text-light)',
            background: 'transparent'
          }}
        />
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ color: 'var(--color-text-light)', cursor: 'pointer', fontSize: '18px', paddingLeft: '8px', flexShrink: 0 }}
        >
          {collapsed ? '▸' : '▾'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ paddingLeft: '22px' }}>
          <textarea
            value={block.body}
            onChange={e => onChange({ ...block, body: e.target.value })}
            placeholder="Escribe algo..."
            style={{ marginTop: '8px', width: '100%', minHeight: '80px', border: 'none', outline: 'none', fontFamily: 'var(--font-main)', fontSize: '14px', color: 'var(--color-text-light)', resize: 'none', background: 'transparent' }}
          />

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
                  />
                </div>
              ))}
              {childDropIndicator?.beforeIndex === (block.children || []).length && (
                <div style={{ height: '2px', background: 'var(--color-text)', borderRadius: '1px', margin: '2px 0' }} />
              )}

              <button
                onClick={() => onAddChild(block.id)}
                style={{ marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: '13px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                + Añadir
              </button>
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', right: '0', top: '0', background: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '160px' }}
        >
          <div onClick={() => { onDuplicate(block); setContextMenu(false) }} style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px' }}>Duplicar</div>
          <div
            onClick={() => { if (window.confirm('¿Eliminar?')) onDelete(block.id); setContextMenu(false) }}
            style={{ padding: '12px 16px', cursor: 'pointer', fontSize: '14px', color: 'red' }}
          >
            Eliminar
          </div>
        </div>
      )}
    </div>
  )
}

export default Block
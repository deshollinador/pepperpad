// src/utils/totals.js

export const MONETARY = ['€', '$', '£']
export const isMonetary = (label) => MONETARY.includes(label)

export const UDS_SYNONYMS = ['u', 'ud', 'uds', 'unidad', 'unidades', 'unitat', 'pieza', 'piezas', 'items', 'item']
export const isUds = (label) => UDS_SYNONYMS.includes((label || '').toLowerCase())

export const formatMonetary = (value) => {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toFixed(2).replace('.', ',')
}

// ─── subtotal monetario de un array de bloques ────────────────
export const computeSubtotal = (blocks) => {
  let total = 0
  let currency = null
  for (const block of blocks) {
    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    const monetaryAttr = attrs.find(a => isMonetary(a.label))
    if (!monetaryAttr) continue
    const udsAttr = attrs.find(a => isUds(a.label))
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

// ─── totales por unidad no monetaria de un array de bloques ──
// Devuelve [{ label, total }] para cada unidad presente en ≥2 bloques
export const computeUnitTotals = (blocks) => {
  const map = {}
  for (const block of blocks) {
    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    for (const attr of attrs) {
      if (isMonetary(attr.label) || isUds(attr.label)) continue
      const val = parseFloat(attr.value)
      if (isNaN(val)) continue
      if (!map[attr.label]) map[attr.label] = { total: 0, count: 0 }
      map[attr.label].total += val
      map[attr.label].count += 1
    }
  }
  return Object.entries(map)
    .filter(([, v]) => v.count >= 2)
    .map(([label, v]) => ({ label, total: Math.round(v.total * 100) / 100 }))
}

// ─── totales de un bloque padre sobre sus hijos ───────────────
// Igual que computeUnitTotals pero con umbral count >= 1
// (un solo hijo ya es suficiente para propagar al padre)
export const computeChildrenUnitTotals = (children) => {
  const map = {}
  for (const block of children) {
    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    for (const attr of attrs) {
      if (isMonetary(attr.label) || isUds(attr.label)) continue
      const val = parseFloat(attr.value)
      if (isNaN(val)) continue
      if (!map[attr.label]) map[attr.label] = { total: 0, count: 0 }
      map[attr.label].total += val
      map[attr.label].count += 1
    }
  }
  return Object.entries(map)
    .map(([label, v]) => ({ label, total: Math.round(v.total * 100) / 100 }))
}

export const computeChildrenSubtotal = (children) => {
  return computeSubtotal(children)
}

// src/utils/totals.js
// Solo lógica de cálculo. El parsing vive en blockParser.js

export const MONETARY = ['€', '$', '£']
export const isMonetary = (label) => MONETARY.includes(label)

export const UDS_SYNONYMS = ['u', 'ud', 'uds', 'unidad', 'unidades', 'unitat', 'pieza', 'piezas', 'items', 'item']
export const isUds = (label) => UDS_SYNONYMS.includes((label || '').toLowerCase())

export const formatMonetary = (value) => {
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toFixed(2).replace('.', ',')
}

export const normalizeDecimal = (str) => String(str).replace(',', '.')

export const formatUnitTotal = (total, hasDecimals) => {
  if (!hasDecimals && Number.isInteger(total)) return String(total)
  return String(total).replace('.', ',')
}

// Re-exportar desde blockParser para compatibilidad
export { displayTag } from './blockParser'

// ─── detectar modo estructurado ──────────────────────────────
export const isStructuredNote = (blocks) => {
  if (!blocks || blocks.length === 0) return false
  if (blocks.length > 1) return true
  const b = blocks[0]
  return !!(b.title?.trim() || (b.attributes || []).length > 0 || (b.children || []).length > 0)
}

// ─── subtotal monetario ───────────────────────────────────────
export const computeSubtotal = (blocks) => {
  let total = 0
  let currency = null
  for (const block of blocks) {
    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    const monetaryAttr = attrs.find(a => isMonetary(a.label))
    if (!monetaryAttr) continue
    const udsAttr = attrs.find(a => isUds(a.label))
    if (attrs.length === 2 && udsAttr) {
      const qty = parseFloat(normalizeDecimal(udsAttr.value))
      const price = parseFloat(normalizeDecimal(monetaryAttr.value))
      if (!isNaN(qty) && !isNaN(price)) { total += qty * price; currency = monetaryAttr.label }
    } else {
      const val = parseFloat(normalizeDecimal(monetaryAttr.value))
      if (!isNaN(val)) { total += val; currency = monetaryAttr.label }
    }
  }
  return currency ? { total: Math.round(total * 100) / 100, currency } : null
}

// ─── totales por unidad no monetaria ─────────────────────────
export const computeUnitTotals = (blocks) => {
  const map = {}
  for (const block of blocks) {
    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    for (const attr of attrs) {
      if (isMonetary(attr.label) || isUds(attr.label)) continue
      const val = parseFloat(normalizeDecimal(attr.value))
      if (isNaN(val)) continue
      if (!map[attr.label]) map[attr.label] = { total: 0, count: 0, hasDecimals: false }
      map[attr.label].total += val
      map[attr.label].count += 1
      if (String(attr.value).includes(',') || String(attr.value).includes('.')) map[attr.label].hasDecimals = true
    }
  }
  return Object.entries(map)
    .filter(([, v]) => v.count >= 2)
    .map(([label, v]) => ({ label, total: Math.round(v.total * 100) / 100, hasDecimals: v.hasDecimals }))
}

// ─── valor monetario efectivo de un bloque ───────────────────
const getBlockMonetaryValue = (block) => {
  const children = block.children || []
  if (children.length > 0) {
    const childResult = computeSubtotal(children)
    if (childResult) return { value: childResult.total, currency: childResult.currency }
    return null
  }
  const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
  const monetaryAttr = attrs.find(a => isMonetary(a.label))
  if (!monetaryAttr) return null
  const udsAttr = attrs.find(a => isUds(a.label))
  let value = 0
  if (attrs.length === 2 && udsAttr) {
    const qty = parseFloat(normalizeDecimal(udsAttr.value))
    const price = parseFloat(normalizeDecimal(monetaryAttr.value))
    if (!isNaN(qty) && !isNaN(price)) value = qty * price
    else return null
  } else {
    value = parseFloat(normalizeDecimal(monetaryAttr.value))
    if (isNaN(value)) return null
  }
  return { value, currency: monetaryAttr.label }
}

// ─── valor de unidades no monetarias de un bloque ────────────
const getBlockUnitValues = (block) => {
  const children = block.children || []
  if (children.length > 0) {
    const map = {}
    for (const child of children) {
      const attrs = (child.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
      for (const attr of attrs) {
        if (isMonetary(attr.label) || isUds(attr.label)) continue
        const val = parseFloat(normalizeDecimal(attr.value))
        if (isNaN(val)) continue
        if (!map[attr.label]) map[attr.label] = 0
        map[attr.label] += val
      }
    }
    return Object.entries(map).map(([label, total]) => ({ label, total: Math.round(total * 100) / 100 }))
  }
  const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
  return attrs
    .filter(a => !isMonetary(a.label) && !isUds(a.label))
    .map(a => ({ label: a.label, total: parseFloat(normalizeDecimal(a.value)) || 0 }))
}

// ─── totales por etiqueta # ───────────────────────────────────
export const computeTagTotals = (blocks) => {
  const map = {}
  for (const block of blocks) {
    const tags = block.tags || []
    if (tags.length === 0) continue
    const tag = tags[0]
    if (!map[tag]) map[tag] = { monetary: null, units: {} }
    const monetary = getBlockMonetaryValue(block)
    if (monetary) {
      if (!map[tag].monetary) map[tag].monetary = { total: 0, currency: monetary.currency }
      map[tag].monetary.total += monetary.value
    }
    for (const { label, total } of getBlockUnitValues(block)) {
      if (!map[tag].units[label]) map[tag].units[label] = 0
      map[tag].units[label] += total
    }
  }
  return Object.entries(map).map(([tag, v]) => ({
    tag,
    monetary: v.monetary ? { total: Math.round(v.monetary.total * 100) / 100, currency: v.monetary.currency } : null,
    units: Object.entries(v.units).map(([label, total]) => ({ label, total: Math.round(total * 100) / 100 }))
  }))
}

// ─── totales por unidad — nivel hijos ────────────────────────
export const computeChildrenUnitTotals = (children) => {
  const map = {}
  for (const block of children) {
    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    for (const attr of attrs) {
      if (isMonetary(attr.label) || isUds(attr.label)) continue
      const val = parseFloat(normalizeDecimal(attr.value))
      if (isNaN(val)) continue
      if (!map[attr.label]) map[attr.label] = { total: 0 }
      map[attr.label].total += val
    }
  }
  return Object.entries(map).map(([label, v]) => ({ label, total: Math.round(v.total * 100) / 100 }))
}

export const computeChildrenSubtotal = (children) => computeSubtotal(children)

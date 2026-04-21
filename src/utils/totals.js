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

export const normalizeDecimal = (str) => String(str).replace(',', '.')

export const formatUnitValue = (raw) => {
  const original = String(raw).trim()
  const normalized = original.replace(',', '.')
  const num = parseFloat(normalized)
  if (isNaN(num)) return original
  return original.replace('.', ',')
}

export const normalizeTag = (raw) => raw.trim().toLowerCase()
export const displayTag = (tag) => tag.charAt(0).toUpperCase() + tag.slice(1)

// ─── parsear etiquetas # ─────────────────────────────────────
// Acepta #Tag con o sin espacio previo: "Verde#Carrefour" o "Verde #Carrefour"
export const parseBlockTags = (raw) => {
  const tags = []
  const tagRegex = /#([a-zA-ZÀ-ÿ0-9_]+)/g
  let match
  while ((match = tagRegex.exec(raw)) !== null) {
    tags.push(normalizeTag(match[1]))
  }
  const cleanTitle = raw.replace(/#[a-zA-ZÀ-ÿ0-9_]+/g, '').trim()
  return { cleanTitle, tags }
}

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
      if (String(attr.value).includes(',') || String(attr.value).includes('.')) {
        map[attr.label].hasDecimals = true
      }
    }
  }
  return Object.entries(map)
    .filter(([, v]) => v.count >= 2)
    .map(([label, v]) => ({
      label,
      total: Math.round(v.total * 100) / 100,
      hasDecimals: v.hasDecimals
    }))
}

export const formatUnitTotal = (total, hasDecimals) => {
  if (!hasDecimals && Number.isInteger(total)) return String(total)
  return String(total).replace('.', ',')
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

// ─── totales por etiqueta # ───────────────────────────────────
export const computeTagTotals = (blocks) => {
  const map = {}
  for (const block of blocks) {
    const tags = block.tags || []
    if (tags.length === 0) continue
    const monetary = getBlockMonetaryValue(block)
    if (!monetary) continue
    const tag = tags[0]
    if (!map[tag]) map[tag] = { total: 0, currency: monetary.currency }
    map[tag].total += monetary.value
  }
  return Object.entries(map).map(([tag, v]) => ({
    tag,
    total: Math.round(v.total * 100) / 100,
    currency: v.currency
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
      if (!map[attr.label]) map[attr.label] = { total: 0, count: 0 }
      map[attr.label].total += val
      map[attr.label].count += 1
    }
  }
  return Object.entries(map)
    .map(([label, v]) => ({ label, total: Math.round(v.total * 100) / 100 }))
}

export const computeChildrenSubtotal = (children) => computeSubtotal(children)

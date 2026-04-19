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

// Normaliza coma decimal a punto para parseFloat
export const normalizeDecimal = (str) => String(str).replace(',', '.')

// ─── parsear etiquetas # de un título de bloque ───────────────
// Devuelve { cleanTitle, tags }
// Ejemplo: "Camisa #Marcelo" → { cleanTitle: "Camisa", tags: ["Marcelo"] }
export const parseBlockTags = (raw) => {
  const tags = []
  const tagRegex = /(?:^|\s)#([a-zA-ZÀ-ÿ0-9_]+)/g
  let match
  while ((match = tagRegex.exec(raw)) !== null) {
    tags.push(match[1])
  }
  const cleanTitle = raw.replace(/(?:^|\s)#[a-zA-ZÀ-ÿ0-9_]+/g, '').trim()
  return { cleanTitle, tags }
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

// ─── totales por unidad no monetaria — nivel nota (≥2 bloques) ──
export const computeUnitTotals = (blocks) => {
  const map = {}
  for (const block of blocks) {
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
    .filter(([, v]) => v.count >= 2)
    .map(([label, v]) => ({ label, total: Math.round(v.total * 100) / 100 }))
}

// ─── totales por etiqueta # ───────────────────────────────────
// Devuelve [{ tag, total, currency }] para cada etiqueta presente
// Solo bloques con exactamente una etiqueta y atributo monetario
export const computeTagTotals = (blocks) => {
  const map = {}  // tag → { total, currency }

  for (const block of blocks) {
    const tags = block.tags || []
    if (tags.length === 0) continue

    const attrs = (block.attributes || []).map(a => ({ ...a, label: (a.label || '').toLowerCase() }))
    const monetaryAttr = attrs.find(a => isMonetary(a.label))
    if (!monetaryAttr) continue

    const udsAttr = attrs.find(a => isUds(a.label))
    let value = 0
    if (attrs.length === 2 && udsAttr) {
      const qty = parseFloat(normalizeDecimal(udsAttr.value))
      const price = parseFloat(normalizeDecimal(monetaryAttr.value))
      if (!isNaN(qty) && !isNaN(price)) value = qty * price
    } else {
      value = parseFloat(normalizeDecimal(monetaryAttr.value))
    }
    if (isNaN(value)) continue

    // Una etiqueta por bloque — suma al grupo
    const tag = tags[0]
    if (!map[tag]) map[tag] = { total: 0, currency: monetaryAttr.label }
    map[tag].total += value
  }

  return Object.entries(map).map(([tag, v]) => ({
    tag,
    total: Math.round(v.total * 100) / 100,
    currency: v.currency
  }))
}

// ─── totales por unidad — nivel hijos (≥1 hijo) ───────────────
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

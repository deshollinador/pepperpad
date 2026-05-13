// src/utils/blockParser.js
//
// Parser centralizado para Pepperpad.
// Toda la lógica de parsing de @ # y modificadores vive aquí.
// Los componentes React no interpretan texto — solo llaman funciones de este módulo.

import { normalizeDecimal } from './totals'

// ─── constantes ───────────────────────────────────────────────
export const MONETARY_LABELS = ['€', '$', '£']
export const UDS_SYNONYMS = ['u', 'ud', 'uds', 'unidad', 'unidades', 'unitat', 'pieza', 'piezas', 'items', 'item']

export const isMonetaryLabel = (label) => MONETARY_LABELS.includes(label)
export const isUdsLabel = (label) => UDS_SYNONYMS.includes((label || '').toLowerCase())

// ─── normalización de etiquetas ──────────────────────────────
const removeDiacritics = (str) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const normalizeTag = (raw) => removeDiacritics(raw.trim().toLowerCase())
export const displayTag = (tag) => tag.charAt(0).toUpperCase() + tag.slice(1)

// ─── tipos de token ───────────────────────────────────────────
// Un token es la unidad mínima de información estructurada en Pepperpad.
// Puede ser un atributo (@) o una etiqueta (#).
//
// Atributo: { kind: 'attribute', value: string, label: string }
//   ej. @10€ → { kind: 'attribute', value: '10', label: '€' }
//   ej. @3kg → { kind: 'attribute', value: '3', label: 'kg' }
//
// Etiqueta: { kind: 'tag', value: string }
//   ej. #Marcelo → { kind: 'tag', value: 'marcelo' }

// ─── parsear tokens de un string crudo ───────────────────────
// Acepta cualquier combinación de @ y # con o sin espacio previo.
// Devuelve { cleanText, attributes, tags }
//
// Ejemplo:
//   parseTokens('Camisa #Marcelo @10€')
//   → { cleanText: 'Camisa', attributes: [{value:'10', label:'€'}], tags: ['marcelo'] }
export const parseTokens = (raw) => {
  if (!raw || !raw.trim()) return { cleanText: '', attributes: [], tags: [] }

  const attributes = []
  const tags = []
  let text = raw

  // Extraer etiquetas # (con o sin espacio previo)
  const tagRegex = /#([a-zA-ZÀ-ÿ0-9_]+)/g
  let match
  while ((match = tagRegex.exec(raw)) !== null) {
    tags.push(normalizeTag(match[1]))
  }
  text = text.replace(/#[a-zA-ZÀ-ÿ0-9_]+/g, '').trim()

  // Extraer atributos @ (con o sin espacio previo, acepta coma decimal)
  const attrRegex = /[@=]\s*(-?\d+[.,]?\d*)\s*([a-zA-Z%$€£°\/²³]*)/g
  while ((match = attrRegex.exec(text)) !== null) {
    attributes.push({
      value: normalizeDecimal(match[1]),
      label: match[2].toLowerCase()
    })
  }
  text = text.replace(/[@=]\s*-?\d+[.,]?\d*\s*[a-zA-Z%$€£°\/²³]*/g, '').trim()
  // Limpiar espacios múltiples
  text = text.replace(/\s+/g, ' ').trim()

  return { cleanText: text, attributes, tags }
}

// ─── reconstruir string crudo desde estructura ────────────────
// Usado para mostrar el raw en el input cuando el usuario va a editar.
// Es la única función que va en la dirección estructura → string.
export const reconstructRaw = (cleanText, attributes, tags) => {
  const tagStr = (tags || []).map(t => `#${displayTag(t)}`).join(' ')
  const attrStr = (attributes || []).map(a => `@${a.value}${a.label}`).join(' ')
  return [cleanText, tagStr, attrStr].filter(Boolean).join(' ').trim()
}

// ─── parsear un bloque ────────────────────────────────────────
// Dado un string crudo de título de bloque, devuelve la estructura del bloque.
// Aplica límites: máximo MAX_ATTRIBUTES atributos, máximo 1 etiqueta.
export const MAX_ATTRIBUTES = 3

export const parseBlockTitle = (raw) => {
  const { cleanText, attributes, tags } = parseTokens(raw)
  // Ordenar: no monetarios primero, monetarios al final
  const sorted = [
    ...attributes.filter(a => !isMonetaryLabel(a.label)),
    ...attributes.filter(a => isMonetaryLabel(a.label))
  ]
  return {
    title: cleanText,
    attributes: sorted.slice(0, MAX_ATTRIBUTES).map(a => ({
      id: Date.now().toString() + Math.random(),
      value: a.value,
      label: a.label,
      sum: isMonetaryLabel(a.label)
    })),
    tags: tags.slice(0, 1)
  }
}

// ─── parsear título de nota ───────────────────────────────────
// El título de la nota solo acepta atributos @, no etiquetas #.
// Acepta fracciones en el valor: @120/4
export const parseTitleAttributes = (raw) => {
  const tokenRegex = /(?:^|(?<=\s))[@=]\s*(-?\d+[.,]?\d*(?:\/\d+[.,]?\d*)?)\s*([a-zA-Z%$€£°²³]*)/g
  const attrs = []
  let match
  while ((match = tokenRegex.exec(raw)) !== null) {
    attrs.push({
      id: Date.now().toString() + Math.random(),
      value: normalizeDecimal(match[1]),
      label: match[2].toLowerCase()
    })
  }
  const cleanTitle = raw
    .replace(/(?:^|(?<=\s))[@=]\s*-?\d+[.,]?\d*(?:\/\d+[.,]?\d*)?\s*[a-zA-Z%$€£°²³]*/g, '')
    .trim()
  return { cleanTitle, attrs: attrs.slice(0, MAX_ATTRIBUTES) }
}

// ─── detectar si un string tiene tokens inline ────────────────
// Usado para decidir si convertir nota simple a estructurada.
export const hasInlineTokens = (text) =>
  /[@=]\s*-?\d+[.,]?\d*\s*[a-zA-Z%$€£°\/²³]*/.test(text)

// ─── parsear modificadores ────────────────────────────────────
// Un modificador es una línea como "IVA @21%" o "personas @6" o "Descuento @-5€"
// Devuelve un objeto de modificador parseado, o null si no es válido.
//
// Tipos:
//   percent: @21%  → aplica porcentaje sobre el running total
//   fixed:   @-5€  → suma/resta cantidad fija
//   divide:  @6    → divide el total entre N (informativo)
export const parseModifier = (raw) => {
  const tokenMatch = raw.match(/[@=]\s*(-?\d+[.,]?\d*)\s*([%$€£]?)([a-zA-Z°\/²³]*)/)
  if (!tokenMatch) return null

  const value = parseFloat(normalizeDecimal(tokenMatch[1]))
  const symbol = tokenMatch[2]
  const wordAfter = tokenMatch[3]
  const labelBefore = raw.replace(/[@=]\s*-?\d+[.,]?\d*\s*[%$€£]?[a-zA-Z°\/²³]*/g, '').trim()
  const rawLabel = labelBefore || wordAfter || symbol || ''
  const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : ''

  if (symbol === '%') return { label, type: 'percent', value }
  if (['€', '$', '£'].includes(symbol)) return { label, type: 'fixed', value, currency: symbol }
  if (!isNaN(value) && value !== 0) return { label, type: 'divide', value, unit: wordAfter }
  return null
}

// ─── parsear modificador de unidad no monetaria ───────────────
// Igual que parseModifier pero solo acepta % y divisor (no moneda fija).
export const parseModifierUnit = (raw) => {
  const tokenMatch = raw.match(/[@=]\s*(-?\d+[.,]?\d*)\s*([%]?)([a-zA-Z°\/²³]*)/)
  if (!tokenMatch) return null

  const value = parseFloat(normalizeDecimal(tokenMatch[1]))
  const symbol = tokenMatch[2]
  const wordAfter = tokenMatch[3]
  const labelBefore = raw.replace(/[@=]\s*-?\d+[.,]?\d*\s*[%]?[a-zA-Z°\/²³]*/g, '').trim()
  const rawLabel = labelBefore || wordAfter || symbol || ''
  const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : ''

  if (symbol === '%') return { label, type: 'percent', value }
  if (!isNaN(value) && value !== 0) return { label, type: 'divide', value, unit: wordAfter }
  return null
}

// ─── reconstruir raw de un modificador desde su estructura ────
// Para mostrar en el input de edición de un modificador.
export const modifierToRaw = (step) => {
  if (step.type === 'percent') return `${step.label} @${step.value}%`
  if (step.type === 'fixed') return `${step.label} @${step.value}${step.currency}`
  if (step.type === 'divide') {
    const labelIsUnit = step.label.toLowerCase() === (step.unit || '').toLowerCase()
    return labelIsUnit ? `@${step.value}` : `${step.label ? step.label + ' ' : ''}@${step.value}${step.unit || ''}`
  }
  return step.label || ''
}

export const modifierUnitToRaw = (step) => {
  if (step.type === 'percent') return `${step.label} @${step.value}%`
  if (step.type === 'divide') return `@${step.value}`
  return step.label || ''
}

// ─── aplicar modificadores en cascada ────────────────────────
// Toma un subtotal y una lista de modificadores raw, devuelve los pasos y el total final.
export const applyModifiers = (subtotal, modifiers, currency) => {
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
      id: mod.id,
      label: parsed.label,
      type: parsed.type,
      value: parsed.value,
      delta: parsed.type === 'divide' ? 0 : Math.round(delta * 100) / 100,
      perUnit,
      currency: parsed.currency || currency,
      unit: parsed.type === 'percent' ? '%' : (parsed.type === 'divide' ? parsed.unit : (parsed.currency || currency))
    })

    if (parsed.type !== 'divide') running = Math.round((running + delta) * 100) / 100
  }

  return { steps, finalTotal: running }
}

// ─── aplicar modificadores de unidad en cascada ──────────────
export const applyModifiersUnit = (subtotal, modifiers) => {
  let running = subtotal
  const steps = []

  for (const mod of modifiers) {
    const parsed = parseModifierUnit(mod.raw)
    if (!parsed) continue

    let delta = 0
    let perUnit = null

    if (parsed.type === 'percent') delta = Math.round(running * parsed.value) / 100
    else if (parsed.type === 'divide') perUnit = Math.round((running / parsed.value) * 100) / 100

    const resultStr = parsed.type === 'percent'
      ? `${Math.round(delta * 100) / 100}`
      : (perUnit !== null ? `${perUnit}` : '')

    steps.push({
      id: mod.id,
      label: parsed.label,
      type: parsed.type,
      value: parsed.value,
      delta: Math.round(delta * 100) / 100,
      perUnit,
      resultStr
    })

    if (parsed.type !== 'divide') running = Math.round((running + delta) * 100) / 100
  }

  return { steps, finalTotal: running }
}

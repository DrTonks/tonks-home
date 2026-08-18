export interface TerminalRecommendationOptions {
  content: string
  city?: string
  source?: string
  invalidOption?: OptionName
}

type OptionName = 'city' | 'source'

interface OptionMarker {
  name: OptionName
  start: number
  valueStart: number
}

function removeMatchingQuotes(value: string): string {
  if (value.length < 2) return value
  const first = value[0]
  const last = value[value.length - 1]
  return (first === '"' && last === '"') || (first === "'" && last === "'")
    ? value.slice(1, -1).trim()
    : value
}

function findOptionMarkers(input: string): OptionMarker[] {
  const markers: OptionMarker[] = []
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (quote) {
      if (character === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character !== '-' || (index > 0 && !/\s/.test(input[index - 1]))) continue

    const option = input.slice(index).match(/^-(city|source)(?=\s|$)/i)
    if (!option) continue

    markers.push({
      name: option[1].toLowerCase() as OptionName,
      start: index,
      valueStart: index + option[0].length,
    })
    index += option[0].length - 1
  }

  return markers
}

export function parseTerminalRecommendationOptions(input: string): TerminalRecommendationOptions {
  const markers = findOptionMarkers(input)
  if (!markers.length) return { content: input.trim() }

  const options: Partial<Record<OptionName, string>> = {}
  let invalidOption: OptionName | undefined
  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1]
    const rawValue = input.slice(marker.valueStart, nextMarker?.start ?? input.length).trim()
    const value = removeMatchingQuotes(rawValue)
    if (value) options[marker.name] = value
    else invalidOption ??= marker.name
  })

  return {
    content: input.slice(0, markers[0].start).trim(),
    ...options,
    ...(invalidOption ? { invalidOption } : {}),
  }
}

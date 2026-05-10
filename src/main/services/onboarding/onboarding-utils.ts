export function cleanString(value: string | undefined): string {
  return value?.trim().replace(/\r\n/g, '\n') ?? ''
}

export function uniqueList(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => cleanString(value)).filter(Boolean))]
}

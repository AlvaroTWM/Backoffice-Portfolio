/**
 * Paleta de gráficos — exactamente 4 colores Loyalty (compartidos por todos los charts).
 */

import { LOYALTY_BRAND } from './brandColors'

/** Orden fijo: Fresh · Jungle · Lavanda · Radian */
export const CHART_COLORS_4 = [
  LOYALTY_BRAND.fresh,
  LOYALTY_BRAND.jungle,
  LOYALTY_BRAND.lavanda,
  LOYALTY_BRAND.radian,
] as const

export function chartColor(index: number): string {
  return CHART_COLORS_4[((index % 4) + 4) % 4]
}

export function chartColorsForCount(count: number): string[] {
  return Array.from({ length: count }, (_, i) => chartColor(i))
}

export interface ChartPalette {
  colors: readonly [string, string, string, string]
  primary: string
  secondary: string
  accentLine: string
  series: string[]
  stack: {
    positive: string
    neutral: string
    negative: string
  }
  projection: [string, string, string, string]
  tableHeaderBg: string
  badgeCalm: { bg: string; text: string }
}

export function getChartPalette(isDark: boolean): ChartPalette {
  const colors = CHART_COLORS_4
  const stack = {
    positive: colors[0],
    neutral: colors[3],
    negative: colors[1],
  }

  return {
    colors,
    primary: colors[0],
    secondary: colors[1],
    accentLine: colors[2],
    series: [...colors],
    stack,
    projection: [colors[0], colors[1], colors[2], colors[3]],
    tableHeaderBg: isDark ? 'rgba(11, 61, 54, 0.55)' : 'rgba(244, 241, 234, 0.95)',
    badgeCalm: {
      bg: isDark ? 'rgba(0, 168, 107, 0.18)' : 'rgba(0, 168, 107, 0.12)',
      text: isDark ? LOYALTY_BRAND.freshSoft : LOYALTY_BRAND.freshStrong,
    },
  }
}

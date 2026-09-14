/**
 * Paleta de gráficos — alto contraste en light/dark.
 * Light mode usa la paleta de marca ITTI.
 */

import { BRAND_LIGHT } from './brandColors'

export interface ChartPalette {
  primary:     string
  secondary:   string
  accentLine:  string
  series:      string[]
  stack: {
    positive: string
    neutral:  string
    negative: string
  }
  projection: [string, string, string, string]
  tableHeaderBg: string
  badgeCalm:   { bg: string; text: string }
}

export function getChartPalette(isDark: boolean): ChartPalette {
  if (isDark) {
    return {
      primary:    '#2DD4BF',
      secondary:  '#34D399',
      accentLine: '#A5B4FC',
      series: [
        '#2DD4BF',
        '#34D399',
        '#38BDF8',
        '#A78BFA',
        '#FBBF24',
        '#FB7185',
        '#4ADE80',
        '#94A3B8',
      ],
      stack: {
        positive: '#34D399',
        neutral:  '#FBBF24',
        negative: '#FB7185',
      },
      projection: ['#6EE7B7', '#2DD4BF', '#38BDF8', '#818CF8'],
      tableHeaderBg: 'rgba(15, 23, 42, 0.55)',
      badgeCalm: {
        bg:   'rgba(45, 212, 191, 0.18)',
        text: '#99F6E4',
      },
    }
  }

  return {
    primary:    BRAND_LIGHT.ocean,
    secondary:  BRAND_LIGHT.sky,
    accentLine: BRAND_LIGHT.navy,
    series: [
      BRAND_LIGHT.mint,
      BRAND_LIGHT.sky,
      BRAND_LIGHT.ocean,
      BRAND_LIGHT.navy,
      '#D97706',
      '#E11D48',
      '#16A34A',
      '#64748B',
    ],
    stack: {
      positive: BRAND_LIGHT.mint,
      neutral:  '#F59E0B',
      negative: '#EF4444',
    },
    projection: [BRAND_LIGHT.mint, BRAND_LIGHT.sky, BRAND_LIGHT.ocean, BRAND_LIGHT.navy],
    tableHeaderBg: 'rgba(238, 244, 250, 0.95)',
    badgeCalm: {
      bg:   'rgba(21, 216, 179, 0.14)',
      text: BRAND_LIGHT.ocean,
    },
  }
}

/**
 * Identidad Loyalty ueno — tokens digitales.
 * Fuente: identidad-colores.md (Pantone/CMYK). HEX aproximados para UI;
 * reemplazar cuando existan HEX oficiales de marca.
 */
export const LOYALTY_BRAND = {
  /** Fresh Green — primario */
  fresh: '#00A86B',
  freshStrong: '#008F5A',
  freshSoft: '#C4FFD4',
  /** Jungle Green — profundo / dark surfaces */
  jungle: '#0B3D36',
  jungleMuted: '#134E45',
  /** Night Dark — contraste */
  night: '#0A1614',
  nightElevated: '#12201D',
  /** Secundarios */
  lavanda: '#8B8FE8',
  lavandaSoft: '#E8E9FA',
  radian: '#C6E04A',
  menta: '#A8D5C8',
  /** Neutrales */
  beige: '#F4F1EA',
  coolGray: '#8B949E',
  warmGray: '#6E6B66',
  white: '#FFFFFF',
} as const

/** @deprecated Usar LOYALTY_BRAND — legacy ITTI charts */
export const BRAND_LIGHT = {
  navy: LOYALTY_BRAND.jungle,
  ocean: LOYALTY_BRAND.freshStrong,
  sky: LOYALTY_BRAND.menta,
  mint: LOYALTY_BRAND.fresh,
} as const

export const BRAND_LIGHT_RGB = {
  navy: '11, 61, 54',
  ocean: '0, 143, 90',
  sky: '168, 213, 200',
  mint: '0, 168, 107',
} as const

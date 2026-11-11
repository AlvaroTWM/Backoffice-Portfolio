import { useId, type ReactNode } from 'react'

const labelFont =
  'ui-rounded, "SF Pro Rounded", Nunito, ui-sans-serif, system-ui, sans-serif'

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`
}

/** Wordmark genérico (texto) para la demo pública, sin marcas reales. */
function Wordmark({
  color,
  x = 0,
  y = 0,
  scale = 1,
}: {
  color: string
  x?: number
  y?: number
  scale?: number
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <text
        x="0"
        y="9.6"
        fill={color}
        fontFamily={labelFont}
        fontSize="11.5"
        fontWeight={800}
        letterSpacing="-0.4"
      >
        loyal
      </text>
    </g>
  )
}

function Chip({
  gradId,
  x,
  y,
  light = false,
}: {
  gradId: string
  x: number
  y: number
  light?: boolean
}) {
  const groove = light ? '#C5C9CE' : '#7E868E'
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="11.6" height="9" rx="1.9" fill="#000" opacity="0.14" transform="translate(0.18 0.32)" />
      <rect width="11.6" height="9" rx="1.9" fill={`url(#${gradId})`} />
      <rect
        x="0.4"
        y="0.38"
        width="10.8"
        height="8.24"
        rx="1.55"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="0.4"
      />
      <path
        d="M0 3.05h11.6M0 5.95h11.6M3.85 0v9M7.75 0v9"
        stroke={groove}
        strokeWidth="0.34"
      />
      <rect x="3.85" y="3.05" width="3.9" height="2.9" fill="none" stroke="#F7F8F9" strokeWidth="0.62" />
    </g>
  )
}

function Contactless({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth="0.78" strokeLinecap="round">
      <path d="M0.45 3.15c1.05.82 1.05 2.45 0 3.28" />
      <path d="M2.4 1.35c2 1.6 2 5.15 0 6.75" />
      <path d="M4.35-.35c2.95 2.35 2.95 7.7 0 10.05" />
    </g>
  )
}

function Mastercard({
  id,
  x,
  y,
  left,
  right,
  outline = false,
  blend,
}: {
  id: string
  x: number
  y: number
  left: string
  right: string
  outline?: boolean
  blend?: string
}) {
  const r = 4.55
  const dx = 5.2
  if (outline) {
    return (
      <g transform={`translate(${x} ${y})`} fill="none" stroke={left} strokeWidth="0.58">
        <circle cx="0" cy="0" r={r} />
        <circle cx={dx} cy="0" r={r} />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <clipPath id={`${id}-mc`}>
        <circle cx="0" cy="0" r={r} />
      </clipPath>
      <circle cx="0" cy="0" r={r} fill={left} />
      <circle cx={dx} cy="0" r={r} fill={right} />
      {blend ? <circle cx={dx} cy="0" r={r} fill={blend} clipPath={`url(#${id}-mc)`} /> : null}
    </g>
  )
}

function CardShell({
  className,
  id,
  rim = 0.8,
  children,
}: {
  className: string
  id: string
  rim?: number
  children: ReactNode
}) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 54 85.6">
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect width="54" height="85.6" rx="5.15" />
        </clipPath>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="9%" stopColor="#fff" stopOpacity="0" />
          <stop offset="90%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`${id}-chip`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBFCFC" />
          <stop offset="36%" stopColor="#C5C9CE" />
          <stop offset="68%" stopColor="#EEF0F2" />
          <stop offset="100%" stopColor="#B7BDC3" />
        </linearGradient>
        <linearGradient id={`${id}-chip-light`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="48%" stopColor="#E7E9EC" />
          <stop offset="100%" stopColor="#F6F7F8" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        {children}
        <rect width="54" height="85.6" fill={`url(#${id}-rim)`} opacity={rim} />
      </g>
    </svg>
  )
}

function StripedCard() {
  const id = useSvgId('striped')
  return (
    <CardShell className="wallet-card wallet-card--striped" id={id} rim={0.72}>
      <rect width="54" height="85.6" fill="#fff" />
      <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="85.6">
        <stop offset="0%" stopColor="#E30613" />
        <stop offset="28%" stopColor="#E30613" />
        <stop offset="66%" stopColor="#E30613" stopOpacity="0" />
      </linearGradient>
      <rect x="3.5" width="8.5" height="85.6" fill={`url(#${id}-fade)`} />
      <rect x="16.5" width="8.5" height="85.6" fill={`url(#${id}-fade)`} />
      <rect x="29.5" width="8.5" height="85.6" fill={`url(#${id}-fade)`} />
      <Chip gradId={`${id}-chip`} x={15.1} y={16.2} />
      <Contactless x={39.4} y={16.6} color="#6B7280" />
      <text
        x="41.6"
        y="66.4"
        fill="#1D4A9F"
        fontFamily={labelFont}
        fontSize="2.35"
        fontWeight={700}
        textAnchor="middle"
      >
        crédito | débito
      </text>
      <Mastercard id={id} x={36.2} y={72.6} left="#EB001B" right="#F79E1B" blend="#FF5F00" />
      <Wordmark color="#1D3C8F" x={3.3} y={73.2} scale={0.6} />
    </CardShell>
  )
}

function BlackCard() {
  const id = useSvgId('black')
  return (
    <CardShell className="wallet-card wallet-card--black" id={id} rim={0.9}>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#2A2A2E" />
        <stop offset="34%" stopColor="#0C0C0E" />
        <stop offset="100%" stopColor="#050506" />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.75" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="30%" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="56%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${id}-core`} cx="35%" cy="32%" r="70%">
        <stop offset="0%" stopColor="#C8F8D4" />
        <stop offset="42%" stopColor="#22C55E" />
        <stop offset="100%" stopColor="#128A42" />
      </radialGradient>
      <rect width="54" height="85.6" fill={`url(#${id}-bg)`} />
      <rect width="54" height="85.6" fill={`url(#${id}-sheen)`} />
      <Chip gradId={`${id}-chip`} x={30.2} y={8.4} />
      <Contactless x={43.1} y={8.7} color="#D5D8DE" />
      <g transform="translate(27 39.5)" fill="none" stroke="#C5C9D0" strokeWidth="0.34">
        <ellipse rx="12.4" ry="4.15" />
        <ellipse rx="12.4" ry="4.15" transform="rotate(60)" />
        <ellipse rx="12.4" ry="4.15" transform="rotate(120)" />
      </g>
      <circle cx="27" cy="39.5" r="1.45" fill={`url(#${id}-core)`} />
      <g
        transform="translate(4.1 57.2)"
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.2 1.3V14.2H11.6" />
      </g>
      <Wordmark color="#E7E7EA" x={4.15} y={74.6} scale={0.27} />
      <text x={18.4} y={77.55} fill="#E7E7EA" fontFamily={labelFont} fontSize="2.05" fontWeight={700}>
        bank
      </text>
      <Mastercard id={id} x={33.4} y={67.2} left="#C8CCD2" right="#C8CCD2" outline />
      <text
        x="36"
        y="75.15"
        fill="#C8CCD2"
        fontFamily={labelFont}
        fontSize="2.05"
        fontWeight={700}
        textAnchor="middle"
      >
        mastercard
      </text>
    </CardShell>
  )
}

function GrayCard() {
  const id = useSvgId('gray')
  return (
    <CardShell className="wallet-card wallet-card--gray" id={id} rim={0.4}>
      <rect width="54" height="85.6" fill="#3A3B3D" />
      <Contactless x={15.6} y={9.4} color="#F4F5F6" />
      <Chip gradId={`${id}-chip-light`} x={7.2} y={20.2} light />
      <Mastercard id={id} x={32.4} y={49.5} left="#D0D3D8" right="#8E939A" />
      <g transform="translate(40.2 77.6) rotate(-90)">
        <Wordmark color="#fff" scale={0.46} />
        <text x="15.4" y="9.6" fill="#F4F5F6" fontFamily={labelFont} fontSize="3.05" fontWeight={700}>
          black
        </text>
      </g>
    </CardShell>
  )
}

function BankCard() {
  const id = useSvgId('bank')
  return (
    <CardShell className="wallet-card wallet-card--bank" id={id} rim={0.32}>
      <rect width="54" height="85.6" fill="#3DBB98" />
      <Chip gradId={`${id}-chip-light`} x={16.2} y={14.6} light />
      <Contactless x={29.6} y={15} color="#F7FFFC" />
      <Wordmark color="#fff" x={3.4} y={72.4} scale={0.62} />
      <Mastercard id={id} x={35.6} y={71.2} left="#EB001B" right="#F79E1B" blend="#FF5F00" />
    </CardShell>
  )
}

export function WalletCard({ variant }: { variant: 'bank' | 'black' | 'gray' | 'striped' }) {
  if (variant === 'striped') return <StripedCard />
  if (variant === 'black') return <BlackCard />
  if (variant === 'gray') return <GrayCard />
  return <BankCard />
}

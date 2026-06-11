interface SpinnerProps {
  size?: number
  label?: string
}

export function Spinner({ size = 24, label }: SpinnerProps) {
  return (
    <span class="spinner-wrap">
      <span class="spinner" style={{ width: size, height: size }} aria-hidden="true" />
      {label && <span class="spinner-label">{label}</span>}
    </span>
  )
}

interface ProgressBarProps {
  /** 0..1, or null for indeterminate. */
  value: number | null
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const pct = value == null ? null : Math.max(0, Math.min(1, value)) * 100
  return (
    <div class="progress" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      {label && <div class="progress__label">{label}</div>}
      <div class="progress__track">
        <div
          class={`progress__fill ${pct == null ? 'is-indeterminate' : ''}`}
          style={pct == null ? undefined : { width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

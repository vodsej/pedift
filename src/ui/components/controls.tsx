import type { JSX, ComponentChildren } from 'preact'

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ComponentChildren
  hint?: string
}) {
  return (
    <label class="field">
      <span class="field__label">{label}</span>
      {children}
      {hint && <span class="field__hint">{hint}</span>}
    </label>
  )
}

export function TextInput(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  const { class: cls = '', ...rest } = props
  return <input class={`input ${cls}`} {...rest} />
}

export function Select({
  value,
  onChange,
  options,
  class: cls = '',
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  class?: string
}) {
  return (
    <select
      class={`input select ${cls}`}
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onInput,
  class: cls = '',
}: {
  value: number
  min: number
  max: number
  step?: number
  onInput: (v: number) => void
  class?: string
}) {
  return (
    <input
      type="range"
      class={`slider ${cls}`}
      min={min}
      max={max}
      step={step}
      value={value}
      onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
    />
  )
}

export function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <span class="colorinput">
      <input
        type="color"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        aria-label="Color"
      />
    </span>
  )
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div class="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          class={`segmented__opt ${value === o.value ? 'is-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

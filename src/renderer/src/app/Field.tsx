import { type ReactElement, type ReactNode, cloneElement, useId } from 'react'

export function Field(props: {
  readonly label: string
  readonly hint?: string
  readonly children: ReactElement<{ 'aria-describedby'?: string }>
}): ReactNode {
  const hintId = useId()
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.hint ? cloneElement(props.children, { 'aria-describedby': hintId }) : props.children}
      {props.hint ? <small id={hintId}>{props.hint}</small> : null}
    </label>
  )
}

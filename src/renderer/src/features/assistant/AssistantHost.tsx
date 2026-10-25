import type { ReactNode, ComponentProps } from 'react'
import { AssistantContext } from './assistant-context'
import { AssistantPanel } from './AssistantPanel'
/** Mount once around the existing shell. Children remain mounted beneath the modal. */
export function AssistantHost({
  children,
  ...props
}: ComponentProps<typeof AssistantPanel> & { readonly children: ReactNode }): ReactNode {
  return (
    <AssistantContext
      value={(launch) => {
        void props.controller.open(launch)
      }}
    >
      {children}
      <AssistantPanel {...props} />
    </AssistantContext>
  )
}

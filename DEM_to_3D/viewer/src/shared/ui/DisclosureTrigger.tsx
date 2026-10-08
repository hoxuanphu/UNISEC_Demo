import type { ButtonHTMLAttributes } from 'react';
import { UiIcon } from './UiIcon';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { expanded: boolean };

/** A disclosure row keeps the label and chevron inside the same pointer target. */
export function DisclosureTrigger({ expanded, className = '', children, ...props }: Props): JSX.Element {
  return <button {...props} type="button" className={`disclosure-trigger ${className}`} aria-expanded={expanded}>
    <span>{children}</span><UiIcon name={expanded ? 'collapse' : 'expand'} size={16}/>
  </button>;
}

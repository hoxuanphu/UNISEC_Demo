import type { ReactNode } from 'react';
import { UiIcon } from './UiIcon';

type Props = {
  tone?: 'neutral' | 'critical' | 'warning' | 'selected' | 'priority';
  icon?: 'blocked' | 'uncertain' | 'priority';
  children: ReactNode;
};

/** Status stays readable without a colored badge or reliance on color alone. */
export function StatusText({ tone = 'neutral', icon, children }: Props): JSX.Element {
  return <span className={`status-text ${tone}`}>
    {icon && <UiIcon name={icon} size={15}/>}
    {children}
  </span>;
}

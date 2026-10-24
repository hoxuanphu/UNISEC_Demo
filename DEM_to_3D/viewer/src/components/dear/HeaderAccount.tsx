import { useId, useRef, useState } from 'react';
import type { Locale } from '../../types/dear';
import { useDismissiblePopover } from '../../shared/hooks/useDismissiblePopover';
import { UiIcon } from './UiIcon';

export function HeaderAccount({
  locale,
  identityName,
  onSwitchRole,
  role = 'manager'
}: {
  locale: Locale;
  identityName: string;
  onSwitchRole: () => void;
  role?: 'resident' | 'manager';
}): JSX.Element {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    id = useId();
  useDismissiblePopover(root, open, () => setOpen(false));
  return (
    <div className="account-anchor" ref={root}>
      <button
        type="button"
        className="icon-button demo-account"
        aria-label={t('Tài khoản', 'Account')}
        title={identityName}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <UiIcon name="account" />
      </button>
      {open && (
        <section
          className="header-account-popover"
          id={id}
          role="dialog"
          aria-label={t('Tài khoản', 'Account')}
          data-popover
        >
          <strong>{identityName}</strong>
          <p>{role === 'resident' ? t('Người dân', 'Resident') : t('Điều phối viên', 'Response coordinator')}</p>
          <button
            className="button"
            onClick={() => {
              setOpen(false);
              onSwitchRole();
            }}
          >
            {t('Đổi vai trò', 'Switch role')}
          </button>
        </section>
      )}
    </div>
  );
}

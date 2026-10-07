import type { ComponentProps } from 'react';
import { ModelUploadPanel } from '../../components/ModelUploadPanel';
import { UiIcon } from '../../shared/ui/UiIcon';

type Props = ComponentProps<typeof ModelUploadPanel> & { onClose: () => void };

export function TerrainUploadDialog({ onClose, ...upload }: Props): JSX.Element {
  const { locale = 'vi' } = upload;
  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-dialog-title" onClick={event => event.stopPropagation()} style={{ width: '640px' }}>
      <div className="modal-head">
        <h2 id="upload-dialog-title">{locale === 'en' ? 'Terrain model' : 'Mô hình địa hình'}</h2>
        <button className="icon-button" onClick={onClose} aria-label={locale === 'vi' ? 'Đóng' : 'Close'}>
          <UiIcon name="close" />
        </button>
      </div>
      <div className="modal-body"><ModelUploadPanel {...upload} /></div>
    </div>
  </div>;
}

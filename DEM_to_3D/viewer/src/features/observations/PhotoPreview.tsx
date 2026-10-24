import { useNativeDialog } from '../../shared/hooks/useNativeDialog';
import { useRef } from 'react';
import type { FieldPhoto } from './model';
import type { Locale } from '../../types/dear';
import { UiIcon } from '../../shared/ui/UiIcon';
import { photoCaptureLabel, photoCaptureTime, photoLocation } from './captureMetadata';
export function PhotoPreview({
  photo,
  locale,
  onClose
}: {
  photo: FieldPhoto;
  locale: Locale;
  onClose: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  useNativeDialog(ref);
  const capture = photoCaptureTime(photo), location = photoLocation(photo);
  return (
    <dialog
      ref={ref}
      className="field-photo-preview"
      aria-label={photo.name}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{photo.name}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={locale === 'vi' ? 'Đóng ảnh' : 'Close photo'}
          onClick={onClose}
        >
          <UiIcon name="close" />
        </button>
      </header>
      <img src={photo.preview} alt={photo.name} />
      {(capture || location) && <dl className="field-metadata photo-preview-metadata">
        {capture && <div><dt>{locale === 'vi' ? 'Chụp lúc' : 'Captured at'}</dt><dd>{photoCaptureLabel(photo, locale)}</dd></div>}
        {location && <div><dt>{locale === 'vi' ? 'Vị trí khi chụp' : 'Capture location'}</dt><dd>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</dd></div>}
      </dl>}
      {!capture && !location && <p>{locale === 'vi' ? 'Ảnh chưa có ngày chụp và vị trí.' : 'No capture time or location in this photo.'}</p>}
    </dialog>
  );
}

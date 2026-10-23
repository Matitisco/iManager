import { useRef } from 'react';
import { autofillImeiSpecs } from '../../lib/report-unknown-tac';

/** Manual edits, including clearing the field, take ownership of the model. */
export function useModelAutofill(value: string, onChange: (model: string) => void, enabled = true) {
  const touched = useRef(false);
  const automatic = useRef<string | null>(null);
  return {
    editModel(model: string) {
      touched.current = true;
      onChange(model);
    },
    fillModel(imei: string, labelModel?: string | null) {
      if (!enabled) return;
      const specs = autofillImeiSpecs(imei);
      if (touched.current || (value.trim() && value !== automatic.current)) return;
      const model = labelModel || specs?.model;
      if (!model) return;
      automatic.current = model;
      onChange(model);
    },
  };
}

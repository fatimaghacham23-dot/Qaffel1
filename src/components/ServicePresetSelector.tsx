"use client";

interface ServicePreset {
  id: string;
  name: string;
  description: string | null;
  amount_usd: number | null;
  amount_lbp: number | null;
  currency: string;
  default_validity_days: number | null;
}

interface ServicePresetSelectorProps {
  presets: ServicePreset[];
}

function dispatchFieldUpdate(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function ServicePresetSelector({ presets }: ServicePresetSelectorProps) {
  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = e.target.value;
    if (!presetId) return;

    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    // Prefill title
    const titleInput = document.getElementById("title") as HTMLInputElement;
    if (titleInput) titleInput.value = preset.name;

    // Prefill description
    const descInput = document.getElementById("description") as HTMLTextAreaElement;
    if (descInput) descInput.value = preset.description || "";

    // Prefill amounts
    const usdInput = document.getElementById("amount_usd") as HTMLInputElement;
    if (usdInput) {
      usdInput.value = preset.amount_usd?.toString() || "";
      dispatchFieldUpdate(usdInput);
    }

    const lbpInput = document.getElementById("amount_lbp") as HTMLInputElement;
    if (lbpInput) {
      lbpInput.value = preset.amount_lbp?.toString() || "";
      dispatchFieldUpdate(lbpInput);
    }

    // Prefill currency
    const currencyInput = document.getElementById("currency") as HTMLSelectElement;
    if (currencyInput) {
      currencyInput.value = preset.currency || "USD";
      dispatchFieldUpdate(currencyInput);
    }

    // Prefill validity
    if (preset.default_validity_days) {
      const validUntilInput = document.getElementById("valid_until") as HTMLInputElement;
      if (validUntilInput) {
        const date = new Date();
        date.setDate(date.getDate() + preset.default_validity_days);
        // Set to end of day
        date.setHours(23, 59, 0, 0);
        
        // Format for datetime-local (YYYY-MM-DDTHH:mm)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        validUntilInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    }
    
    // Reset selector so it can be used again
    e.target.value = "";
  };

  if (!presets || presets.length === 0) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <label className="label font-bold text-ink" htmlFor="preset_selector">
        Use service preset
      </label>
      <select 
        className="field mt-1" 
        id="preset_selector" 
        onChange={handleSelect}
        defaultValue=""
      >
        <option value="">Choose a preset to prefill fields...</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name} ({preset.currency === 'USD' ? `$${preset.amount_usd}` : `${preset.amount_lbp?.toLocaleString()} LBP`})
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-slate-600">
        Selecting a preset will overwrite the current title, description, and amounts.
      </p>
    </div>
  );
}

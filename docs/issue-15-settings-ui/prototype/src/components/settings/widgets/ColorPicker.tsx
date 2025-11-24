/**
 * ColorPicker Widget
 *
 * Color picker with hex input and visual preview.
 */

import { useState, useRef } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
}

export function ColorPicker({
  value,
  onChange,
  label,
  error,
}: ColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleHexChange = (hex: string) => {
    // Add # if not present
    const formatted = hex.startsWith('#') ? hex : `#${hex}`;
    onChange(formatted);
  };

  const presetColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-white">{label}</label>
      )}

      <div className="flex items-center gap-3">
        {/* Color Preview */}
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="w-12 h-12 rounded border-2 border-gray-600 hover:border-gray-500 transition-colors"
          style={{ backgroundColor: value }}
        />

        {/* Hex Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#3b82f6"
          className={`flex-1 px-4 py-2 bg-gray-800 text-white rounded border ${
            error ? 'border-red-500' : 'border-gray-700'
          } focus:border-blue-500 focus:outline-none font-mono uppercase`}
          maxLength={7}
        />

        {/* Native Color Picker */}
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded cursor-pointer"
        />
      </div>

      {/* Preset Colors */}
      {showPicker && (
        <div className="p-4 bg-gray-800 rounded border border-gray-700">
          <p className="text-sm text-gray-400 mb-3">Quick Colors</p>
          <div className="grid grid-cols-8 gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setShowPicker(false);
                }}
                className="w-10 h-10 rounded border-2 border-gray-600 hover:border-white transition-colors"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

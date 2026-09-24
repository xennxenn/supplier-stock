import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Search, CheckSquare, Square } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badgeColor?: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = "ทั้งหมด",
  icon: Icon,
  badgeColor = "bg-sky-500 text-white",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  const isAllSelected =
    options.length > 0 &&
    options.every((opt) => selectedValues.includes(opt.value));

  const handleToggleAll = () => {
    if (isAllSelected || selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const handleToggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.value === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    return `เลือก ${selectedValues.length} รายการ`;
  };

  return (
    <div className="relative inline-block w-full text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 border cursor-pointer ${
          selectedValues.length > 0
            ? "liquid-glass-btn border-sky-400/60 text-sky-950 font-semibold shadow-xs"
            : "liquid-glass-btn border-slate-200/80 text-slate-700 hover:text-slate-900"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          <span className="text-slate-500 font-normal">{label}:</span>
          <span className="truncate font-bold text-slate-900">{displayText()}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {selectedValues.length > 0 && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition"
              title="ล้างตัวกรองนี้"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          {selectedValues.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${badgeColor}`}>
              {selectedValues.length}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 max-w-[90vw] rounded-2xl liquid-glass border border-white/80 shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Actions */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
              <span>{label}</span>
              <span className="text-slate-400 font-normal">({options.length})</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleAll}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-800 transition cursor-pointer"
              >
                {isAllSelected ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </button>
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-800 transition cursor-pointer"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>

          {/* Search box if options > 5 */}
          {options.length > 5 && (
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`ค้นหา ${label}...`}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                ไม่พบข้อมูลที่ตรงกับการค้นหา
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    onClick={() => handleToggleOption(opt.value)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-xl text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-sky-50 text-sky-950 font-semibold border border-sky-200/60"
                        : "text-slate-700 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div className="shrink-0 text-sky-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 fill-sky-600 text-white" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </div>

                    {opt.count !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 font-mono shrink-0">
                        {opt.count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

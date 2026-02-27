import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Package } from 'lucide-react';
import { usePacks, useLumiverseActions, saveToExtension } from '../../store/LumiverseContext';

/**
 * Searchable pack dropdown with "Create new..." option.
 * Used by ContentWorkshop Quick Create cards.
 *
 * Props:
 * - value: string — currently selected pack name
 * - onChange: (packName: string) => void
 * - placeholder: string
 */
function PackDropdown({ value, onChange, placeholder = 'Select pack...' }) {
    const { customPacks } = usePacks();
    const actions = useLumiverseActions();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const filtered = customPacks.filter(p => {
        const name = p.packName || p.name || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const searchTrimmed = search.trim();
    const showCreateOption = searchTrimmed.length > 0 &&
        !customPacks.some(p => (p.packName || p.name || '').toLowerCase() === searchTrimmed.toLowerCase());

    const handleSelect = useCallback((packName) => {
        onChange(packName);
        setSearch('');
        setIsOpen(false);
    }, [onChange]);

    const handleCreateAndSelect = useCallback(() => {
        const name = search.trim();
        if (!name) return;

        const newPack = {
            id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            packName: name,
            name: name,
            packAuthor: null,
            coverUrl: null,
            url: '',
            isCustom: true,
            version: 1,
            packExtras: [],
            lumiaItems: [],
            loomItems: [],
        };

        actions.addCustomPack(newPack);
        saveToExtension();
        onChange(name);
        setSearch('');
        setIsOpen(false);
    }, [search, actions, onChange]);

    const handleInputChange = useCallback((e) => {
        setSearch(e.target.value);
        if (!isOpen) setIsOpen(true);
    }, [isOpen]);

    const handleFocus = useCallback(() => {
        setIsOpen(true);
    }, []);

    const displayValue = isOpen ? search : (value || '');

    return (
        <div className="lumiverse-pack-dropdown" ref={wrapperRef}>
            <input
                ref={inputRef}
                className="lumiverse-pack-dropdown-input"
                type="text"
                value={displayValue}
                onChange={handleInputChange}
                onFocus={handleFocus}
                placeholder={value || placeholder}
            />
            <span className="lumiverse-pack-dropdown-chevron">
                <ChevronDown size={12} />
            </span>

            {isOpen && (
                <div className="lumiverse-pack-dropdown-list">
                    {filtered.map(p => {
                        const name = p.packName || p.name || '';
                        return (
                            <button
                                key={name}
                                className="lumiverse-pack-dropdown-item"
                                type="button"
                                onClick={() => handleSelect(name)}
                            >
                                <Package size={12} />
                                {name}
                            </button>
                        );
                    })}
                    {showCreateOption && (
                        <button
                            className="lumiverse-pack-dropdown-item lumiverse-pack-dropdown-item--create"
                            type="button"
                            onClick={handleCreateAndSelect}
                        >
                            <Plus size={12} />
                            Create "{searchTrimmed}"
                        </button>
                    )}
                    {filtered.length === 0 && !showCreateOption && (
                        <div className="lumiverse-pack-dropdown-empty">
                            No packs found. Type to create one.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default PackDropdown;

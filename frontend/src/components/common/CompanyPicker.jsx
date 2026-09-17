import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';

/**
 * Selector de cliente con búsqueda asíncrona.
 *
 * Son ~69.000 contactos, así que no caben en un <select>: se busca contra la
 * API a partir de 2 caracteres, igual que en CreateTicketModal.
 *
 * value    → objeto contacto seleccionado (o null)
 * onChange → recibe el contacto, o null al limpiar
 */
export default function CompanyPicker({ value, onChange, placeholder = 'Buscar cliente…', className = '' }) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (boxRef.current && !boxRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { data: results = [], isFetching } = useQuery({
        queryKey: ['company-picker', search],
        queryFn: async () => {
            const res = await apiClient.get(`/contacts?search=${encodeURIComponent(search)}&per_page=10`);
            return res.data.data ?? [];
        },
        enabled: search.trim().length >= 2,
    });

    if (value) {
        return (
            <div className={`flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-primary-50 ${className}`}>
                <span className="text-sm text-gray-800 truncate" title={value.name}>{value.name}</span>
                <button
                    type="button"
                    onClick={() => { onChange(null); setSearch(''); }}
                    className="ml-auto text-gray-400 hover:text-gray-700 text-lg leading-none"
                    aria-label="Quitar filtro de cliente"
                >×</button>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`} ref={boxRef}>
            <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
                onFocus={() => setIsOpen(true)}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {isOpen && search.trim().length >= 2 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {isFetching && <div className="px-3 py-2 text-sm text-gray-400">Buscando…</div>}
                    {!isFetching && results.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
                    )}
                    {results.map(c => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => { onChange(c); setIsOpen(false); setSearch(''); }}
                            className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                            <span className="block truncate">{c.name}</span>
                            {c.cif && <span className="block text-xs text-gray-400">{c.cif}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

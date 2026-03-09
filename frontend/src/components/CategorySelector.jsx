import { useState, useEffect } from 'react';

export default function CategorySelector({ categories = [], value = '', onChange }) {
    const [level1Id, setLevel1Id] = useState('');
    const [level2Id, setLevel2Id] = useState('');
    const [level3Id, setLevel3Id] = useState('');

    // Pre-fill state if a starting value is provided (e.g. editing a ticket)
    useEffect(() => {
        if (!value || !categories.length) return;

        let found1, found2, found3;

        // Find which level the incoming value belongs to
        for (const l1 of categories) {
            if (l1.id == value) {
                found1 = l1; break;
            }
            if (l1.children) {
                for (const l2 of l1.children) {
                    if (l2.id == value) {
                        found1 = l1; found2 = l2; break;
                    }
                    if (l2.children) {
                        for (const l3 of l2.children) {
                            if (l3.id == value) {
                                found1 = l1; found2 = l2; found3 = l3; break;
                            }
                        }
                    }
                }
            }
        }

        if (found1) setLevel1Id(found1.id.toString());
        if (found2) setLevel2Id(found2.id.toString());
        if (found3) setLevel3Id(found3.id.toString());
    }, [value, categories]);

    // Derived children arrays based on current selections
    const level1Options = categories;
    const level2Options = level1Id ? (categories.find(c => c.id.toString() === level1Id)?.children || []) : [];
    const level3Options = level2Id ? (level2Options.find(c => c.id.toString() === level2Id)?.children || []) : [];

    // Handlers
    const handleL1Change = (e) => {
        const id = e.target.value;
        setLevel1Id(id);
        setLevel2Id('');
        setLevel3Id('');
        onChange(id); // Bubble up deepest selection
    };

    const handleL2Change = (e) => {
        const id = e.target.value;
        setLevel2Id(id);
        setLevel3Id('');
        // Bubble up deepest selection; if cleared, bubble back to L1
        onChange(id || level1Id);
    };

    const handleL3Change = (e) => {
        const id = e.target.value;
        setLevel3Id(id);
        // Bubble up deepest selection; if cleared, bubble back to L2
        onChange(id || level2Id);
    };

    return (
        <div className="space-y-3">
            {/* Level 1 Select */}
            <div>
                <select
                    value={level1Id}
                    onChange={handleL1Change}
                    className="w-full"
                >
                    <option value="">Select Primary Category</option>
                    {level1Options.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Level 2 Select (Only visible if L1 is chosen AND has children) */}
            {level1Id && level2Options.length > 0 && (
                <div className="pl-4 border-l-2 border-primary-200">
                    <select
                        value={level2Id}
                        onChange={handleL2Change}
                        className="w-full"
                    >
                        <option value="">Select Sub-Category (Optional)</option>
                        {level2Options.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Level 3 Select (Only visible if L2 is chosen AND has children) */}
            {level2Id && level3Options.length > 0 && (
                <div className="pl-8 border-l-2 border-primary-200">
                    <select
                        value={level3Id}
                        onChange={handleL3Change}
                        className="w-full"
                    >
                        <option value="">Select Specific Type (Optional)</option>
                        {level3Options.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

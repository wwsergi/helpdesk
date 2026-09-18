/**
 * Semáforo de calidad de fichaje.
 *
 * El estado y los motivos los calcula el backend (StatisticsController::
 * evaluateCompanyHealth): los umbrales viven en un único sitio para que el
 * ranking y la pantalla de calidad no puedan contradecirse.
 *
 * Color + glifo + etiqueta accesible: la paleta de estado no llega a 3:1 sobre
 * blanco, y además así se entiende sin distinguir rojo de verde.
 */
export const HEALTH = {
    good:     { color: '#0ca30c', glyph: '✓', label: 'Correcto' },
    warning:  { color: '#fab219', glyph: '!', label: 'Revisar' },
    critical: { color: '#d03b3b', glyph: '✕', label: 'Fichaje incorrecto' },
    unknown:  { color: '#9ca3af', glyph: '–', label: 'Sin datos suficientes' },
};

export default function HealthLight({ status, reasons = [], onHover, onLeave, size = 5 }) {
    const cfg = HEALTH[status] ?? HEALTH.unknown;
    const text = `${cfg.label}. ${reasons.join(' ')}`;
    const px = size === 4 ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-[11px]';
    return (
        <span
            role="img"
            aria-label={text}
            tabIndex={0}
            onMouseEnter={e => onHover?.(e, text)}
            onMouseMove={e => onHover?.(e, text)}
            onMouseLeave={onLeave}
            onFocus={e => onHover?.(e, text)}
            onBlur={onLeave}
            className={`inline-flex items-center justify-center ${px} rounded-full text-white font-bold cursor-help shrink-0`}
            style={{ backgroundColor: cfg.color }}
        >{cfg.glyph}</span>
    );
}

/** Leyenda de los tres estados evaluables. */
export function HealthLegend() {
    return (
        <>
            {['good', 'warning', 'critical'].map(k => (
                <div key={k} className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
                        style={{ backgroundColor: HEALTH[k].color }}>{HEALTH[k].glyph}</span>
                    <span className="text-sm text-gray-600">{HEALTH[k].label}</span>
                </div>
            ))}
        </>
    );
}

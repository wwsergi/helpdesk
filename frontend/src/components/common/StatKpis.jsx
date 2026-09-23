import { HEALTH } from './healthStatus';

/**
 * Piezas de KPI compartidas por las tres pantallas de estadísticas.
 *
 * Los datos llegan de /statistics/fichajes-kpis, que se consulta EN PARALELO a
 * la carga principal de cada pantalla: la tabla o el gráfico no esperan por
 * estos indicadores, y si tardan aparecen después sin bloquear nada.
 */

const nf = new Intl.NumberFormat('es-ES');

/**
 * Variación respecto al periodo anterior.
 *
 * Deliberadamente en tinta neutra con una flecha, no en verde/rojo: que el
 * volumen baje un 2% no es "malo" en sí, y teñirlo de rojo impone un juicio que
 * el dato no sostiene. La paleta de estado se reserva para lo que sí es un
 * estado (ver StoppedAlert).
 */
function Delta({ value, suffix = '%', title }) {
    if (value === null || value === undefined) return null;
    const up = value > 0;
    const flat = Math.abs(value) < 0.05;
    return (
        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap" title={title}>
            <span aria-hidden="true">{flat ? '→' : up ? '↑' : '↓'}</span>
            {' '}{value > 0 ? '+' : ''}{value}{suffix}
        </span>
    );
}

export function KpiCard({ label, value, hint, delta, deltaSuffix, deltaTitle, children }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-xl font-semibold text-gray-900 mt-1 flex items-baseline">
                <span>{value}</span>
                <Delta value={delta} suffix={deltaSuffix} title={deltaTitle} />
            </div>
            {hint && <div className="text-xs text-gray-400 mt-1 leading-snug">{hint}</div>}
            {children}
        </div>
    );
}

/** Fila de tarjetas; se adapta al número que reciba. */
export function KpiGrid({ children }) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{children}</div>;
}

/**
 * Barras horizontales para comparar magnitudes entre pocas categorías
 * ordenadas. Un solo tono: la longitud ya codifica la magnitud, variar el color
 * además sería redundante. Cada barra lleva su cifra al lado, así que no
 * dependen del color para leerse.
 */
export function MiniBars({ title, items, hint, color = '#2a78d6', suffix = '' }) {
    const max = Math.max(...items.map(i => i.value ?? 0), 1);
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-3">{title}</div>
            <div className="space-y-2">
                {items.map(i => (
                    <div key={i.label} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs text-gray-600 truncate" title={i.label}>{i.label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded">
                            <div className="h-2 rounded" style={{ width: `${((i.value ?? 0) / max) * 100}%`, backgroundColor: color }} />
                        </div>
                        <span className="w-16 text-right text-xs tabular-nums text-gray-800">
                            {i.value === null ? '—' : `${i.value}${suffix}`}
                        </span>
                        {i.sub && <span className="w-20 text-right text-[11px] text-gray-400 tabular-nums">{i.sub}</span>}
                    </div>
                ))}
            </div>
            {hint && <div className="text-xs text-gray-400 mt-3 leading-snug">{hint}</div>}
        </div>
    );
}

/** Reparto global por tipo, con los mismos colores y orden que el ranking. */
export function TypeSplitBar({ byType, series }) {
    const total = series.reduce((a, s) => a + (byType[s.key] || 0), 0);
    if (!total) return null;
    const visible = series.filter(s => (byType[s.key] || 0) > 0);
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500 mb-3">Reparto global por tipo</div>
            <div className="flex h-3 w-full gap-[2px]">
                {visible.map((s, i) => (
                    <div key={s.key}
                        title={`${s.label}: ${nf.format(byType[s.key])} (${(byType[s.key] / total * 100).toFixed(1)} %)`}
                        style={{
                            width: `${(byType[s.key] / total) * 100}%`,
                            backgroundColor: s.color,
                            borderTopLeftRadius: i === 0 ? 4 : 0, borderBottomLeftRadius: i === 0 ? 4 : 0,
                            borderTopRightRadius: i === visible.length - 1 ? 4 : 0,
                            borderBottomRightRadius: i === visible.length - 1 ? 4 : 0,
                        }} />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {visible.map(s => (
                    <span key={s.key} className="text-[11px] text-gray-500">
                        <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ backgroundColor: s.color }} />
                        {s.label} {(byType[s.key] / total * 100).toFixed(1)} %
                    </span>
                ))}
            </div>
        </div>
    );
}

/**
 * Clientes que han dejado de fichar. Esto SÍ es un estado, no una medida, así
 * que usa la paleta de estado reservada, y siempre con glifo y etiqueta.
 */
export function StoppedAlert({ stopped, started, prevFrom, prevTo }) {
    const level = stopped > 0 ? 'warning' : 'good';
    const cfg = HEALTH[level];
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-xs text-gray-500">Clientes que han dejado de fichar</div>
            <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: cfg.color }} aria-hidden="true">{cfg.glyph}</span>
                <span className="text-xl font-semibold text-gray-900">{nf.format(stopped)}</span>
                <span className="text-xs text-gray-500">· {nf.format(started)} empezaron</span>
            </div>
            <div className="text-xs text-gray-400 mt-1 leading-snug">
                Fichaban entre el {prevFrom} y el {prevTo} y no lo han hecho en este periodo.
            </div>
        </div>
    );
}

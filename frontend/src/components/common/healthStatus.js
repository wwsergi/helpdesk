/**
 * Paleta de estado del semáforo de calidad de fichaje.
 *
 * Vive en su propio módulo, separada del componente, porque mezclar constantes
 * y componentes en un mismo fichero rompe el fast refresh de React.
 *
 * Son los colores de estado reservados del sistema de diseño: no se reutilizan
 * nunca como colores de serie. El glifo acompaña siempre al color, porque
 * ninguno de ellos llega a 3:1 de contraste sobre blanco y porque así se
 * distinguen sin depender de percibir rojo y verde.
 */
export const HEALTH = {
    good:     { color: '#0ca30c', glyph: '✓', label: 'Correcto' },
    warning:  { color: '#fab219', glyph: '!', label: 'Revisar' },
    critical: { color: '#d03b3b', glyph: '✕', label: 'Fichaje incorrecto' },
    unknown:  { color: '#9ca3af', glyph: '–', label: 'Sin datos suficientes' },
};

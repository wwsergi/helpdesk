import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api';

/**
 * KPIs de fichajes para las pantallas de estadísticas.
 *
 * Consulta independiente a propósito: se lanza a la vez que la carga principal
 * de la pantalla, así la tabla o el gráfico se pintan a su ritmo y los
 * indicadores aparecen cuando estén. Si tardan o fallan, la pantalla funciona
 * igual.
 */
export function useFichajeKpis({ from, to, plan, distributor, planTier, contactId, enabled = true }) {
    return useQuery({
        queryKey: ['fichaje_kpis', from, to, plan, distributor, planTier, contactId],
        queryFn: async () => {
            const p = new URLSearchParams({ date_from: from, date_to: to });
            if (plan) p.set('plan', plan);
            if (distributor) p.set('distributor', distributor);
            if (planTier) p.set('plan_tier', planTier);
            if (contactId) p.set('contact_id', contactId);
            return (await apiClient.get(`/statistics/fichajes-kpis?${p}`)).data;
        },
        enabled,
        staleTime: 60_000,
    });
}

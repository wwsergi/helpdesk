import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api';

export function usePriorities() {
    return useQuery({
        queryKey: ['priorities'],
        queryFn: async () => {
            const res = await apiClient.get('/priorities');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function getPriorityBadgeStyle(color) {
    return {
        backgroundColor: color + '22',
        color: color,
        border: `1px solid ${color}55`,
    };
}

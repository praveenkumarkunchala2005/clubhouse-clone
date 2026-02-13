// In development, use relative URLs to go through Vite proxy (avoids CORS).
// In production, use VITE_BACKEND_URL if set.
const BASE_URL = import.meta.env.PROD ? (import.meta.env.VITE_BACKEND_URL || '') : '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
    const res = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
    }

    return res.json();
}

export function getRooms(token: string) {
    return fetchWithAuth('/api/rooms', token);
}

export function getRoomState(id: string, token: string) {
    return fetchWithAuth(`/api/rooms/${id}`, token);
}

export function getMessages(roomId: string, token: string, cursor?: string) {
    const params = cursor ? `?cursor=${cursor}` : '';
    return fetchWithAuth(`/api/rooms/${roomId}/messages${params}`, token);
}

/**
 * Persistent Client ID utility to identify browser instances across page refreshes.
 * Prevents "name already taken" race conditions on server platforms like Render.
 */
export function getClientId() {
    try {
        let id = localStorage.getItem('chatjet_client_id');
        if (!id) {
            id = 'c_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
            localStorage.setItem('chatjet_client_id', id);
        }
        return id;
    } catch {
        // Fallback for private browsing or disabled storage
        return 'temp_' + Math.random().toString(36).substring(2, 11);
    }
}

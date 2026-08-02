/**
 * Generate a consistent, high-quality avatar URL based on a user seed name or ID.
 */
export function getAvatarUrl(seed, size = 64) {
    if (!seed) seed = 'user';
    const cleanSeed = encodeURIComponent(String(seed).trim());
    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${cleanSeed}&radius=50&backgroundColor=1e293b,0f172a,1e1b4b,172554,18181b,1e3a8a,14532d,701a75`;
}

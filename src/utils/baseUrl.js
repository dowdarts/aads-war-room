/**
 * Returns the base URL path for static assets depending on the host.
 *   wiki.aadsdarts.com           → '/'
 *   dowdarts.github.io/aads-war-room/ → '/aads-war-room/'
 *   localhost (dev)              → '/'
 */
export function getBaseUrl() {
  if (window.location.hostname === 'dowdarts.github.io') {
    // Derive from the actual pathname: /aads-war-room/... → /aads-war-room/
    const match = window.location.pathname.match(/^(\/[^/]+\/)/)
    return match ? match[1] : '/'
  }
  return '/'
}

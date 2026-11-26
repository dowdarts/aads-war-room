import { getBaseUrl } from '../utils/baseUrl.js'

export default function ShotAtPot() {
  return (
    <iframe
      title="Shot at Pot"
      src={getBaseUrl() + 'shot-at-pot.html'}
      className="w-full border-0"
      style={{ height: 'calc(100vh - 100px)' }}
    />
  )
}

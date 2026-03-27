import { useMemo, useState } from 'react'
import { getBaseUrl } from '../utils/baseUrl.js'

export default function PaymentLanding() {
  const paymentUrl = useMemo(() => `${window.location.origin}${getBaseUrl()}payment.html`, [])
  const [copiedField, setCopiedField] = useState('')

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(''), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const openPaymentPage = () => {
    window.open(paymentUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#050505] via-[#0a0a0a] to-[#101010] p-6">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-[28px] border border-[#242424] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="bg-linear-to-r from-orange-500 to-amber-500 px-6 py-4 text-sm font-black uppercase tracking-[0.35em] text-black">
            Atlantic Amateur Darts Series
          </div>
          <div className="grid gap-8 p-8 lg:grid-cols-[1.3fr_0.9fr] lg:p-10">
            <section>
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-orange-400">
                Support Landing
              </p>
              <h1 className="mb-4 text-4xl font-black leading-tight text-white lg:text-5xl">
                Open the standalone payment page for player travel support.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-gray-300">
                This tab is now the launch point only. The actual payment experience lives on its own direct page so you can attach that exact URL to a QR code and send donors straight there.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={openPaymentPage}
                  className="rounded-xl bg-orange-500 px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-black transition hover:bg-orange-400"
                >
                  Open Payment Page
                </button>
                <button
                  onClick={() => copyToClipboard(paymentUrl, 'url')}
                  className={`rounded-xl border px-6 py-4 text-sm font-black uppercase tracking-[0.2em] transition ${
                    copiedField === 'url'
                      ? 'border-green-500 bg-green-600 text-white'
                      : 'border-[#303030] bg-[#171717] text-white hover:border-orange-500 hover:text-orange-300'
                  }`}
                >
                  {copiedField === 'url' ? 'Copied Payment URL' : 'Copy Payment URL'}
                </button>
              </div>
              <div className="mt-8 rounded-2xl border border-[#2d2d2d] bg-black/30 p-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-gray-400">
                  QR Code Target URL
                </p>
                <p className="break-all font-mono text-sm text-orange-300">{paymentUrl}</p>
              </div>
            </section>

            <aside className="rounded-3xl border border-[#242424] bg-[#0b0b0b] p-6">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-orange-400">
                What donors get
              </p>
              <div className="space-y-4 text-sm leading-7 text-gray-300">
                <p>Auto-deposit e-transfer details for Matthew Dow.</p>
                <p>Quick-select bank buttons that open each donor’s own online banking.</p>
                <p>A dedicated path you can use in posters, social posts, and QR codes.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
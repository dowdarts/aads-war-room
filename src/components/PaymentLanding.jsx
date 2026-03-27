import { useState } from 'react'

const MAJOR_BANKS = [
  { name: 'ATB Financial', color: 'text-blue-600', url: 'https://www.atb.com/personal/' },
  { name: 'BMO', color: 'text-blue-600', url: 'https://www.bmo.com/main/personal/' },
  { name: 'CIBC', color: 'text-red-600', url: 'https://www.cibc.com/en/personal-banking.html' },
  { name: 'Coast Capital', color: 'text-blue-500', url: 'https://www.coastcapitalsavings.com/' },
  { name: 'Desjardins', color: 'text-green-600', url: 'https://www.desjardins.com/ca/index.jsp' },
  { name: 'Laurentian Bank', color: 'text-blue-800', url: 'https://www.laurentianbank.ca/en/' },
  { name: 'Meridian', color: 'text-blue-700', url: 'https://www.meridiancu.ca/' },
  { name: 'National Bank', color: 'text-red-600', url: 'https://www.nbc.ca/personal.html' },
  { name: 'PC Financial', color: 'text-red-500', url: 'https://www.pcfinancial.ca/' },
  { name: 'Peoples Trust', color: 'text-blue-600', url: 'https://www.peoplestrust.com/' },
  { name: 'RBC', color: 'text-blue-600', url: 'https://www.rbcroyalbank.com/personal/' },
  { name: 'Scotiabank', color: 'text-red-600', url: 'https://www.scotiabank.com/ca/en/personal.html' },
  { name: 'Simplii Financial', color: 'text-pink-600', url: 'https://www.simplii.com/en/home.html' },
  { name: 'Tangerine', color: 'text-orange-600', url: 'https://www.tangerine.ca/en' },
  { name: 'TD Canada Trust', color: 'text-green-600', url: 'https://www.td.com/ca/en/personal-banking/' },
]

const ETRANSFER_INFO = {
  recipient: 'Matthew Dow',
  email: 'dow1800@gmail.com',
  message: 'AADS Player Travel Support'
}

export default function PaymentLanding() {
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

  const handleBankClick = (bankUrl) => {
    // Open bank website in new tab
    window.open(bankUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#050505] via-[#0a0a0a] to-[#0f0f0f] p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-linear-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mb-4">
            Support AADS Player Travel
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Help support players competing through the Atlantic Amateur Darts Series. Donations go toward
            travel, accommodations, entry fees, and the costs of getting players to events.
          </p>
        </div>

        {/* Fundraiser Goals Section */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            🎯 Current Fundraising Goals
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#111111] rounded-lg p-6 border border-[#333333]">
              <h3 className="text-lg font-semibold text-orange-400 mb-3">Travel Costs</h3>
              <p className="text-gray-300 mb-4">Flights, fuel, and ground transportation for players travelling to compete.</p>
              <div className="text-sm text-gray-400">Target: $2,500</div>
            </div>
            <div className="bg-[#111111] rounded-lg p-6 border border-[#333333]">
              <h3 className="text-lg font-semibold text-orange-400 mb-3">Hotels & Entry Fees</h3>
              <p className="text-gray-300 mb-4">Accommodations and event registration costs that help players reach the oche.</p>
              <div className="text-sm text-gray-400">Target: $1,800</div>
            </div>
          </div>
        </div>

        {/* E-Transfer Information */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            💳 E-Transfer Information
          </h2>
          <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-400">✅</span>
              <span className="text-green-300 font-medium">Auto-Deposit Enabled</span>
            </div>
            <p className="text-green-200 text-sm">No security question required - transfers are automatically deposited!</p>
          </div>
          <div className="grid gap-4">
            
            {/* Recipient Name */}
            <div className="flex items-center justify-between bg-[#111111] rounded-lg p-4 border border-[#333333]">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Recipient Name</label>
                <span className="text-white font-mono text-lg">{ETRANSFER_INFO.recipient}</span>
              </div>
              <button
                onClick={() => copyToClipboard(ETRANSFER_INFO.recipient, 'recipient')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  copiedField === 'recipient' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {copiedField === 'recipient' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between bg-[#111111] rounded-lg p-4 border border-[#333333]">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Email Address</label>
                <span className="text-white font-mono text-lg">{ETRANSFER_INFO.email}</span>
              </div>
              <button
                onClick={() => copyToClipboard(ETRANSFER_INFO.email, 'email')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  copiedField === 'email' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {copiedField === 'email' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>

            {/* Message */}
            <div className="flex items-center justify-between bg-[#111111] rounded-lg p-4 border border-[#333333]">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Message</label>
                <span className="text-white font-mono text-lg">{ETRANSFER_INFO.message}</span>
              </div>
              <button
                onClick={() => copyToClipboard(ETRANSFER_INFO.message, 'message')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  copiedField === 'message' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {copiedField === 'message' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>


          </div>
        </div>

        {/* Bank Selection */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            🏦 Quick Bank Access
          </h2>
          <p className="text-gray-400 mb-6">Click your bank to open their online banking portal:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {MAJOR_BANKS.map((bank) => (
              <button
                key={bank.name}
                onClick={() => handleBankClick(bank.url)}
                className="bg-white hover:bg-gray-50 rounded-lg p-4 text-center transition-all transform hover:scale-105 hover:shadow-lg border border-gray-200"
              >
                <div className={`${bank.color} font-bold text-sm`}>{bank.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
            📱 QR Code Access
          </h2>
          <div className="text-center">
            <div className="inline-block bg-white p-6 rounded-xl mb-4">
              {/* QR Code placeholder - you can replace this with an actual QR code generator */}
              <div className="w-48 h-48 bg-gray-100 border-2 border-dashed border-gray-400 flex items-center justify-center rounded-lg">
                <div className="text-gray-600 text-center">
                  <div className="text-4xl mb-2">📱</div>
                  <div className="text-sm font-medium">QR Code</div>
                  <div className="text-xs">Scan to access this page</div>
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Scan this QR code to quickly access this donation page on mobile devices
            </p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Questions about supporting a player? Contact us at{' '}
            <button
              onClick={() => copyToClipboard(ETRANSFER_INFO.email, 'contact')}
              className="text-orange-400 hover:text-orange-300 underline transition-colors"
            >
              {ETRANSFER_INFO.email}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
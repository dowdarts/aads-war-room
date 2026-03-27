import { useState } from 'react'
import { useStats } from '../context/StatsContext.jsx'

const PROVINCES = [
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'ON', name: 'Ontario' },
  { code: 'NL', name: 'Newfoundland & Labrador' },
]

export default function PlayerForm({ onClose }) {
  const { dispatch } = useStats()
  const [formData, setFormData] = useState({
    fullName: '',
    nickname: '',
    hometown: '',
    age: '',
    yearsPlaying: '',
    province: 'NB',
    profileImage: '',
    hobbies: '',
    dartSetup: '',
    practiceRoutine: '',
    strengths: '',
    improvements: '',
    checkouts: '',
    currentForm: '',
    recentResults: '',
    achievements: '',
    pressureManagement: '',
    mentalApproach: '',
    stagePresence: '',
    preMatchRituals: '',
    aadsMeaning: '',
    dartConnectEmail: '',
  })

  const [imagePreview, setImagePreview] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
        setFormData(prev => ({ 
          ...prev, 
          profileImage: e.target.result // Base64 for now, could be updated to use file uploads
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.fullName.trim()) {
      alert('Please enter a full name')
      return
    }

    const newPlayer = {
      ...formData,
      displayName: formData.fullName,
      profileImage: formData.profileImage || '/images/players/placeholder.svg'
    }

    dispatch({ type: 'ADD_NEW_PLAYER', payload: newPlayer })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-l-4 border-orange px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-white text-2xl font-black">Add New Player</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Profile Image Section */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-[10px] text-orange uppercase tracking-widest mb-3">Profile Image</h3>
            <div className="flex items-center gap-4">
              {(imagePreview || formData.profileImage) && (
                <img 
                  src={imagePreview || formData.profileImage} 
                  alt="Profile preview" 
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#2a2a2a]"
                />
              )}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="imageUpload"
                />
                <label 
                  htmlFor="imageUpload"
                  className="bg-orange/10 border border-orange/30 text-orange px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer hover:bg-orange/20 transition-colors"
                >
                  Upload Image
                </label>
                <div className="text-xs text-gray-500 mt-1">Or enter image URL below</div>
              </div>
            </div>
            <input
              type="url"
              name="profileImage"
              value={formData.profileImage}
              onChange={handleInputChange}
              placeholder="Image URL (optional)"
              className="w-full mt-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
            />
          </div>

          {/* Basic Information */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-[10px] text-orange uppercase tracking-widest mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleInputChange}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Hometown</label>
                <input
                  type="text"
                  name="hometown"
                  value={formData.hometown}
                  onChange={handleInputChange}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Province</label>
                <select
                  name="province"
                  value={formData.province}
                  onChange={handleInputChange}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
                >
                  {PROVINCES.map(p => (
                    <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  min="0"
                  max="120"
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Years Playing</label>
                <input
                  type="text"
                  name="yearsPlaying"
                  value={formData.yearsPlaying}
                  onChange={handleInputChange}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-[10px] text-orange uppercase tracking-widest mb-3">Contact Information</h3>
            <div>
              <label className="block text-gray-400 text-sm mb-1">Dart Connect Email</label>
              <input
                type="email"
                name="dartConnectEmail"
                value={formData.dartConnectEmail}
                onChange={handleInputChange}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50"
              />
            </div>
          </div>

          {/* Game Information */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <h3 className="text-[10px] text-orange uppercase tracking-widest mb-3">Game Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Dart Setup</label>
                <textarea
                  name="dartSetup"
                  value={formData.dartSetup}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Practice Routine</label>
                <textarea
                  name="practiceRoutine"
                  value={formData.practiceRoutine}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Strengths</label>
                <textarea
                  name="strengths"
                  value={formData.strengths}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Areas for Improvement</label>
                <textarea
                  name="improvements"
                  value={formData.improvements}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Additional Information (Collapsible) */}
          <details className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4">
            <summary className="text-[10px] text-orange uppercase tracking-widest mb-3 cursor-pointer">
              Additional Information (Optional)
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {[
                { name: 'hobbies', label: 'Hobbies' },
                { name: 'checkouts', label: 'Favorite Checkouts' },
                { name: 'currentForm', label: 'Current Form' },
                { name: 'recentResults', label: 'Recent Results' },
                { name: 'achievements', label: 'Achievements' },
                { name: 'pressureManagement', label: 'Pressure Management' },
                { name: 'mentalApproach', label: 'Mental Approach' },
                { name: 'stagePresence', label: 'Stage Presence' },
                { name: 'preMatchRituals', label: 'Pre-Match Rituals' },
                { name: 'aadsMeaning', label: 'What AADS Means to You' },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-gray-400 text-sm mb-1">{field.label}</label>
                  <textarea
                    name={field.name}
                    value={formData[field.name]}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange/50 resize-none"
                  />
                </div>
              ))}
            </div>
          </details>

          {/* Submit buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="bg-orange hover:bg-orange/80 text-black px-6 py-3 rounded-lg font-semibold text-sm transition-colors flex-1"
            >
              Add Player
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
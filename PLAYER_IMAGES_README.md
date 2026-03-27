# Player Profile Images & Management Features

## New Features Added

### 1. Profile Images Support
- **New CSV Format**: Players can now have profile images specified in the CSV
- **Automatic Fallback**: If no image is provided, a placeholder SVG is used
- **Display Integration**: Images appear in player cards and player listings
- **Image Sources**: Supports URLs and uploaded images (base64)

### 2. Add New Players
- **Interactive Form**: Click "Add Player" button in the Players tab
- **Comprehensive Fields**: All player information can be entered including:
  - Basic info (name, nickname, hometown, province, age)
  - Contact info (Dart Connect email)
  - Game details (dart setup, practice routine, strengths)
  - Optional fields (hobbies, achievements, mental approach, etc.)
- **Image Upload**: Upload profile images or provide image URLs
- **Real-time Addition**: New players appear immediately in the interface

### 3. CSV Export/Import
- **Export Function**: Download current player data as CSV (Data Manager tab)
- **Preserves Images**: Exported CSV includes profile image URLs
- **Import Support**: Can re-import exported CSV files
- **Backward Compatible**: Still supports old Google Forms CSV format

## File Structure

### New CSV Format
```csv
fullName,nickname,hometown,age,yearsPlaying,province,profileImage,hobbies,dartSetup,...
Tyler Stewart,The Ginger Cowboy,Sussex,31,8,NB,/images/players/tyler-stewart.jpg,Rum,Red dragon fusion 24g...
```

### Image Storage
```
public/
  images/
    players/
      placeholder.svg          # Default placeholder image
      player-name.jpg          # Individual player images
```

## Usage Instructions

### Adding Profile Images
1. **For existing players**: Upload a new CSV with `profileImage` column
2. **For new players**: Use the "Add Player" form with image upload
3. **Image placement**: Store images in `public/images/players/` folder
4. **URL format**: Use `/images/players/filename.jpg` in CSV

### Adding New Players
1. Go to Players tab
2. Click "Add Player" button
3. Fill required fields (at minimum: Full Name)
4. Upload profile image or provide URL
5. Add optional information as needed
6. Click "Add Player" to save

### Exporting Player Data
1. Go to Data Manager tab
2. Click "Export Players CSV" 
3. CSV downloads with all current players
4. Includes any newly added players
5. File named with current date

### Importing Player Data
1. Go to Data Manager tab
2. Use "Upload Player CSV Override"
3. Select your CSV file
4. Data replaces current player list for session

## Technical Details

### CSV Parser Updates
- **Auto-detection**: Automatically detects new vs old CSV format
- **Field mapping**: Maps old Google Forms fields to new structure
- **Image handling**: Adds placeholder image for legacy data
- **Backward compatibility**: Old CSV files continue to work

### Data Storage
- **Runtime storage**: New players stored in localStorage
- **Session persistence**: Data survives page refreshes
- **Export capability**: Can export for permanent storage
- **Merge logic**: Runtime players override static ones by name

### Image Handling
- **Error fallback**: Broken image URLs fall back to placeholder
- **Multiple formats**: Supports JPG, PNG, SVG, etc.
- **Base64 support**: Uploaded images converted to base64
- **Responsive display**: Images scale appropriately in UI

## Migration from Old Format

Your existing `players.csv` continues to work! The system:
1. Detects the old format automatically
2. Maps fields to new structure
3. Adds placeholder images for all players
4. Allows adding images through the form or new CSV

To upgrade fully:
1. Export current players using new export function
2. Add profile images to exported CSV
3. Re-import the enhanced CSV
4. Replace the old CSV file permanently if desired
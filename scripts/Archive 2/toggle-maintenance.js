import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mode = process.argv[2]
if (!['on', 'off'].includes(mode)) {
  console.error('Usage: node scripts/toggle-maintenance.js [on|off]')
  process.exit(1)
}

// Update both environment files since we have Next.js and Vite
const envFiles = [
  path.join(__dirname, '../.env.production.local'),
  path.join(__dirname, '../frontend/sams-ui/.env.production')
]

envFiles.forEach(envPath => {
  try {
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8')
      
      // Update for Next.js format
      if (envPath.includes('.env.production.local')) {
        content = content.replace(
          /NEXT_PUBLIC_MAINTENANCE_MODE=\w+/,
          `NEXT_PUBLIC_MAINTENANCE_MODE=${mode === 'on' ? 'true' : 'false'}`
        )
      }
      
      // Update for Vite format
      if (envPath.includes('sams-ui/.env.production')) {
        content = content.replace(
          /VITE_MAINTENANCE_MODE=\w+/,
          `VITE_MAINTENANCE_MODE=${mode === 'on' ? 'true' : 'false'}`
        )
      }
      
      fs.writeFileSync(envPath, content)
      console.log(`✅ Updated ${envPath}`)
    }
  } catch (error) {
    console.error(`❌ Error updating ${envPath}:`, error.message)
  }
})

console.log(`✅ Maintenance mode: ${mode === 'on' ? 'ENABLED' : 'DISABLED'}`)
console.log('📦 Remember to rebuild and redeploy:')
console.log('   npm run build:prod && firebase deploy')
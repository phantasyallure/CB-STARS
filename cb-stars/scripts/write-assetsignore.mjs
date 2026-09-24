// Runs at the end of "npm run build:cf".
// Cloudflare refuses to deploy when the compiled Worker (dist/_worker.js) sits inside the
// static-assets folder without an ".assetsignore" telling it to skip that folder.
// We write the file here instead of relying on public/.assetsignore, because dotfiles are
// silently dropped by some upload methods (e.g. GitHub's drag-and-drop uploader).
import { writeFileSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
writeFileSync('dist/.assetsignore', '_worker.js\n')
console.log('✓ wrote dist/.assetsignore')

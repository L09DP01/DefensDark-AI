import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walk(filepath, callback);
    } else if (stats.isFile() && (filepath.endsWith('.ts') || filepath.endsWith('.tsx'))) {
      callback(filepath);
    }
  }
}

const dirs = ['app', 'components', 'lib', 'hooks'];
for (const dir of dirs) {
  if (fs.existsSync(dir)) {
    walk(dir, (filepath) => {
      let content = fs.readFileSync(filepath, 'utf-8');
      const original = content;
      
      content = content.replace(/from "convex\/react"/g, 'from "@/lib/supabase/hooks"');
      content = content.replace(/from 'convex\/react'/g, "from '@/lib/supabase/hooks'");
      
      content = content.replace(/from "@\/convex\/_generated\/api"/g, 'from "@/lib/supabase/api"');
      content = content.replace(/from '@\/convex\/_generated\/api'/g, "from '@/lib/supabase/api'");
      
      if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`Updated ${filepath}`);
      }
    });
  }
}

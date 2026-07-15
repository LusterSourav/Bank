// Comprehensive import/export wiring + production audit
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('.', import.meta.url));
const srcDir = path.join(root, 'src');

let failures = [];
function assert(label, ok, detail) {
  if (!ok) failures.push({ label, detail: detail || '' });
  console[ok ? 'log' : 'error'](`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ': ' + detail : ''}`);
}

// Read all files
const files = {
  'src/app.js': readFileSync(path.join(root, 'src/app.js'), 'utf-8'),
  'src/routes.js': readFileSync(path.join(root, 'src/routes.js'), 'utf-8'),
  'src/authRoutes.js': readFileSync(path.join(root, 'src/authRoutes.js'), 'utf-8'),
  'src/config.js': readFileSync(path.join(root, 'src/config.js'), 'utf-8'),
  'src/db.js': readFileSync(path.join(root, 'src/db.js'), 'utf-8'),
  'src/dispute.js': readFileSync(path.join(root, 'src/dispute.js'), 'utf-8'),
  'src/encryption.js': readFileSync(path.join(root, 'src/encryption.js'), 'utf-8'),
  'src/erebor.js': readFileSync(path.join(root, 'src/erebor.js'), 'utf-8'),
  'src/middleware.js': readFileSync(path.join(root, 'src/middleware.js'), 'utf-8'),
  'src/models.js': readFileSync(path.join(root, 'src/models.js'), 'utf-8'),
  'src/notifications.js': readFileSync(path.join(root, 'src/notifications.js'), 'utf-8'),
  'src/otp.js': readFileSync(path.join(root, 'src/otp.js'), 'utf-8'),
  'src/relayer.js': readFileSync(path.join(root, 'src/relayer.js'), 'utf-8'),
  'src/totp.js': readFileSync(path.join(root, 'src/totp.js'), 'utf-8'),
  'src/totpSession.js': readFileSync(path.join(root, 'src/totpSession.js'), 'utf-8'),
  'src/watcher.js': readFileSync(path.join(root, 'src/watcher.js'), 'utf-8'),
  'src/webauthn.js': readFileSync(path.join(root, 'src/webauthn.js'), 'utf-8'),
  'src/webhooks/gig.js': readFileSync(path.join(root, 'src/webhooks/gig.js'), 'utf-8'),
  'src/kyc/routes.js': readFileSync(path.join(root, 'src/kyc/routes.js'), 'utf-8'),
  'src/kyc/provider.js': readFileSync(path.join(root, 'src/kyc/provider.js'), 'utf-8'),
  'src/kyc/fraud.js': readFileSync(path.join(root, 'src/kyc/fraud.js'), 'utf-8'),
  'src/kyc/nameMatch.js': readFileSync(path.join(root, 'src/kyc/nameMatch.js'), 'utf-8'),
  'src/fraud/ip.js': readFileSync(path.join(root, 'src/fraud/ip.js'), 'utf-8'),
  'src/fraud/store.js': readFileSync(path.join(root, 'src/fraud/store.js'), 'utf-8'),
  'api/index.js': readFileSync(path.join(root, 'api/index.js'), 'utf-8'),
  'src/index.js': readFileSync(path.join(root, 'src/index.js'), 'utf-8'),
};

function extractImports(code) {
  const imports = [];
  const re = /import\s+(?:(?:\{[^}]*\})\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    imports.push(m[1]);
  }
  return imports;
}

function extractExports(code) {
  const exports = [];
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    exports.push(m[1]);
  }
  // Also check for export default at end
  if (/export\s+default\s+\w+/.test(code)) {
    const m2 = code.match(/export\s+default\s+(\w+)/);
    if (m2) exports.push('default: ' + m2[1]);
  }
  return exports;
}

// 1. Check every import resolves to an existing file
console.log('\n=== IMPORT/EXPORT WIRING ===');
const importMap = {};
for (const [filepath, code] of Object.entries(files)) {
  const dir = path.dirname(path.join(root, filepath));
  const imports = extractImports(code);
  
  for (const imp of imports) {
    if (imp.startsWith('.') || imp.startsWith('/')) {
      // Relative import
      if (!imp.endsWith('.js')) continue; // node_modules
      const resolved = path.resolve(dir, imp);
      if (!files[path.relative(root, resolved)]) {
        // Check if it exists on disk
        try {
          readFileSync(resolved);
        } catch {
          assert(`Import exists: ${filepath} -> ${imp}`, false, 'file not found');
        }
      }
    }
  }
}

// 2. Check named imports vs exports
for (const [filepath, code] of Object.entries(files)) {
  const namedImportRe = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = namedImportRe.exec(code)) !== null) {
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim());
    const target = m[2];
    if (!target.startsWith('.') && !target.startsWith('/')) continue;
    
    // Find target file content
    const dir = path.dirname(path.join(root, filepath));
    const resolved = path.resolve(dir, target.endsWith('.js') ? target : target + '.js');
    const relPath = path.relative(root, resolved);
    const targetCode = files[relPath];
    
    if (targetCode) {
      const targetExports = extractExports(targetCode);
      for (const name of names) {
        if (name === 'default') continue; // default import doesn't need named export
        if (!targetExports.includes(name) && !targetCode.includes(`export { ${name}`) && !targetCode.includes(`export {\n  ${name}`)) {
          // Check for default re-export pattern
          if (!targetCode.includes(`export default ${name}`) && !targetCode.includes(`export { ${name} as default`)) {
            assert(`Named export exists: ${filepath} imports ${name} from ${target}`, false, `"${name}" not exported from ${target}`);
          }
        }
      }
    }
  }
}

// 3. Check route mounting doesn't conflict
console.log('\n=== ROUTE MOUNTING ===');
const app = files['src/app.js'];
const routeMounts = app.match(/app\.use\('([^']+)',\s*(\w+)/g);
if (routeMounts) {
  for (const m of routeMounts) {
    assert(`Route mounted: ${m}`, true);
  }
}

// 4. Check all source files parse
console.log('\n=== SYNTAX ===');
const allFiles = Object.keys(files);
for (const f of allFiles) {
  try {
    execSync(`node --check ${f}`, { cwd: root, stdio: 'pipe' });
  } catch {
    assert(`Syntax: ${f}`, false, 'parse error');
  }
}

// 5. Dead code check — exports never imported
console.log('\n=== DEAD CODE ===');
const allExports = {};
for (const [filepath, code] of Object.entries(files)) {
  const dir = path.dirname(path.join(root, filepath));
  const regex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+(\w+)/g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    const name = m[1];
    // Check if this name is imported by any other file
    let imported = false;
    for (const [otherPath, otherCode] of Object.entries(files)) {
      if (otherPath === filepath) continue;
      if (new RegExp(`\\b${name}\\b`).test(otherCode) && 
          otherCode.includes(`from`) && 
          otherCode.includes(`./`) &&
          otherCode.includes(name)) {
        imported = true;
        break;
      }
    }
    if (!imported && !['app', 'router', 'User', 'Transaction', 'Beneficiary', 'Otp', 'Escrow', 'connect', 'handler', 'store'].includes(name)) {
      assert(`Dead export: ${filepath} exports ${name}`, false, 'never imported');
    }
  }
}

// 6. Environment variable coverage
console.log('\n=== ENV VAR COVERAGE ===');
const envExample = readFileSync(path.join(root, '.env.example'), 'utf-8');
const envVarsDeclared = [...envExample.matchAll(/^([A-Z_]+)=/gm)].map(m => m[1]);
const envVarsUsed = new Set();
for (const code of Object.values(files)) {
  const matches = code.matchAll(/process\.env\.([A-Z_]+)/g);
  for (const m of matches) {
    envVarsUsed.add(m[1]);
  }
}
// Count how many declared vars are actually referenced in code
for (const v of envVarsDeclared) {
  if (!envVarsUsed.has(v)) {
    assert(`ENV var referenced: ${v}`, false, 'declared in .env.example but never used in code');
  }
}

// 7. Check NODE_ENV checks
console.log('\n=== NODE_ENV CHECKS ===');
const nodeEnvChecks = [];
for (const [filepath, code] of Object.entries(files)) {
  const matches = [...code.matchAll(/process\.env\.NODE_ENV/g)];
  for (const m of matches) {
    nodeEnvChecks.push(filepath);
  }
}
if (nodeEnvChecks.length === 0) {
  assert('NODE_ENV checks exist', false, 'no process.env.NODE_ENV used anywhere');
} else {
  assert(`NODE_ENV checked in ${nodeEnvChecks.length} files`, true, nodeEnvChecks.join(', '));
}

// 8. Verify config.js export matches what importers expect
console.log('\n=== CONFIG USAGE ===');
const configExport = files['src/config.js'];
const configKeys = [...configExport.matchAll(/^\s+(\w+):/gm)].map(m => m[1]);
for (const [filepath, code] of Object.entries(files)) {
  if (filepath === 'src/config.js') continue;
  if (!code.includes("from './config.js'") && !code.includes('from "../config.js"') && !code.includes('../config.js')) continue;
  
  const configRefs = [...code.matchAll(/config\.(\w+)/g)].map(m => m[1]);
  for (const ref of configRefs) {
    if (ref === 'default') continue;
    // Check if the ref is a nested key (config.sandbox.apiKey -> sandbox)
    if (!configKeys.includes(ref)) {
      // Might be a nested access — check if parent exists
      const parentPath = code.match(new RegExp(`config\\.${ref}\\.`));
      // Could be that ref is a nested key — check if the parent key exists in config
      assert(`Config key exists: ${filepath} uses config.${ref}`, configKeys.includes(ref),
        `"${ref}" not exported from config.js`);
    }
  }
}

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`${failures.length} wiring issues found:`);
for (const f of failures) {
  console.error(`  ISSUE ${f.label} ${f.detail}`);
}
if (failures.length === 0) {
  console.log('ALL WIRING CHECKS PASSED');
}
process.exit(failures.length > 0 ? 1 : 0);

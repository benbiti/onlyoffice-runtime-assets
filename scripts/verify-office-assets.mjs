import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP_DIR_ALWAYS_KEEP = new Set(['images', 'search']);
const HELP_LANG_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/i;
const REQUIRED_FILES = [
  'web-apps/apps/api/documents/api.js',
  'document_editor_service_worker.js',
  'plugins.json',
  'themes.json',
  'wasm-integrity-manifest.json',
];
const VENDOR_PREFIX = 'vendor/office/';

function normalizeLocale(value) {
  return value.trim().toLowerCase();
}

function normalizeLocaleSet(values, fallback) {
  const base = values && values.length > 0 ? values : fallback;
  return new Set(base.map(normalizeLocale).filter(Boolean));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(directoryPath) {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function verifyRequiredFiles(root, errors) {
  for (const relativeFile of REQUIRED_FILES) {
    const absoluteFile = path.join(root, relativeFile);
    if (await fileExists(absoluteFile)) {
      continue;
    }
    errors.push(`Missing required OFFICE file: ${relativeFile}`);
  }
}

async function verifyLocaleFiles(root, allowedLocales, errors) {
  let scanned = 0;
  const appsRoot = path.join(root, 'web-apps', 'apps');
  if (!(await directoryExists(appsRoot))) {
    return scanned;
  }

  const appEntries = await fs.readdir(appsRoot, { withFileTypes: true });
  for (const appEntry of appEntries) {
    if (!appEntry.isDirectory()) continue;
    const appRoot = path.join(appsRoot, appEntry.name);
    const stack = [appRoot];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      if (!currentDir) continue;
      const currentEntries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const currentEntry of currentEntries) {
        const absolutePath = path.join(currentDir, currentEntry.name);
        if (!currentEntry.isDirectory()) continue;

        if (currentEntry.name === 'locale') {
          const localeEntries = await fs.readdir(absolutePath, { withFileTypes: true });
          for (const localeEntry of localeEntries) {
            if (!localeEntry.isFile()) continue;
            if (!localeEntry.name.endsWith('.json') && !localeEntry.name.endsWith('.js')) {
              continue;
            }
            scanned += 1;
            const locale = normalizeLocale(localeEntry.name.replace(/\.(json|js)$/, ''));
            if (!locale || allowedLocales.has(locale)) {
              continue;
            }
            const relativePath = path.relative(root, path.join(absolutePath, localeEntry.name)).split(path.sep).join('/');
            errors.push(`Found non-allowed locale asset (${locale}): ${relativePath}`);
          }
          continue;
        }

        stack.push(absolutePath);
      }
    }
  }

  return scanned;
}

async function verifyHelpDirectories(root, allowedHelpLocales, errors) {
  let scanned = 0;
  const appsRoot = path.join(root, 'web-apps', 'apps');
  if (!(await directoryExists(appsRoot))) {
    return scanned;
  }

  const appEntries = await fs.readdir(appsRoot, { withFileTypes: true });
  for (const appEntry of appEntries) {
    if (!appEntry.isDirectory()) continue;
    const helpRoot = path.join(appsRoot, appEntry.name, 'main', 'resources', 'help');
    if (!(await directoryExists(helpRoot))) continue;

    const helpEntries = await fs.readdir(helpRoot, { withFileTypes: true });
    for (const helpEntry of helpEntries) {
      if (!helpEntry.isDirectory()) continue;
      scanned += 1;
      const normalizedName = normalizeLocale(helpEntry.name);
      if (HELP_DIR_ALWAYS_KEEP.has(normalizedName)) continue;
      if (!HELP_LANG_PATTERN.test(normalizedName)) continue;
      if (allowedHelpLocales.has(normalizedName)) continue;
      const relativePath = path.relative(root, path.join(helpRoot, helpEntry.name)).split(path.sep).join('/');
      errors.push(`Found non-allowed help locale directory (${normalizedName}): ${relativePath}`);
    }
  }

  return scanned;
}

async function verifyMonacoNlsFiles(root, allowedMonacoLocales, errors) {
  let scanned = 0;
  const monacoVsDir = path.join(root, 'web-apps', 'vendor', 'monaco', 'monaco', 'min', 'vs');
  if (!(await directoryExists(monacoVsDir))) {
    return scanned;
  }

  const entries = await fs.readdir(monacoVsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('nls.messages.') || !entry.name.endsWith('.js')) continue;
    scanned += 1;
    const locale = normalizeLocale(entry.name.replace(/^nls\.messages\./, '').replace(/\.js$/, ''));
    if (!locale || allowedMonacoLocales.has(locale)) continue;
    const relativePath = path.relative(root, path.join(monacoVsDir, entry.name)).split(path.sep).join('/');
    errors.push(`Found non-allowed Monaco locale (${locale}): ${relativePath}`);
  }

  return scanned;
}

async function readManifest(root) {
  const manifestPath = path.join(root, 'wasm-integrity-manifest.json');
  const content = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(content);
}

function resolveManifestAssetPath(root, entryPath, warnings) {
  if (entryPath.startsWith(VENDOR_PREFIX)) {
    return path.join(root, entryPath.slice(VENDOR_PREFIX.length));
  }

  warnings.push(`Unexpected manifest key without vendor prefix: ${entryPath}`);
  return path.join(root, entryPath);
}

async function verifyManifest(root, verifyManifestFileSet, errors, warnings) {
  let manifest;
  try {
    manifest = await readManifest(root);
  } catch (error) {
    errors.push(`Failed to parse wasm-integrity-manifest.json: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }

  const entries = Object.entries(manifest.files ?? {});
  if (entries.length === 0) {
    errors.push('wasm-integrity-manifest.json has no tracked files');
    return 0;
  }

  if (!verifyManifestFileSet) {
    return entries.length;
  }

  let missingCount = 0;
  const maxMissingReports = 20;
  for (const [relativePublicPath] of entries) {
    const absolutePath = resolveManifestAssetPath(root, relativePublicPath, warnings);
    if (await fileExists(absolutePath)) {
      continue;
    }
    missingCount += 1;
    if (missingCount <= maxMissingReports) {
      errors.push(`Manifest entry points to missing file: ${relativePublicPath}`);
    }
  }

  if (missingCount > maxMissingReports) {
    errors.push(`Manifest has ${missingCount - maxMissingReports} additional missing files (omitted)`);
  }

  return entries.length;
}

export async function validateOfficeAssets(assetRoot = process.cwd(), options = {}) {
  const root = path.resolve(assetRoot);
  const rootStat = await fs.stat(root).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    return {
      ok: false,
      errors: [`OFFICE asset root does not exist: ${root}`],
      warnings: [],
      stats: {
        localeFilesScanned: 0,
        helpDirectoriesScanned: 0,
        monacoNlsFilesScanned: 0,
        manifestEntries: 0,
      },
    };
  }

  const allowedLocales = options.locales ? normalizeLocaleSet(options.locales, []) : null;
  const allowedHelpLocales = options.helpLocales
    ? normalizeLocaleSet(options.helpLocales, [])
    : null;
  const allowedMonacoLocales = options.monacoLocales
    ? normalizeLocaleSet(options.monacoLocales, [])
    : null;

  const errors = [];
  const warnings = [];

  await verifyRequiredFiles(root, errors);
  const localeFilesScanned = allowedLocales
    ? await verifyLocaleFiles(root, allowedLocales, errors)
    : 0;
  const helpDirectoriesScanned = allowedHelpLocales
    ? await verifyHelpDirectories(root, allowedHelpLocales, errors)
    : 0;
  const monacoNlsFilesScanned = allowedMonacoLocales
    ? await verifyMonacoNlsFiles(root, allowedMonacoLocales, errors)
    : 0;
  const manifestEntries = await verifyManifest(root, options.verifyManifestFileSet !== false, errors, warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      localeFilesScanned,
      helpDirectoriesScanned,
      monacoNlsFilesScanned,
      manifestEntries,
    },
  };
}

function parseListArg(value, fallback) {
  if (!value) return fallback;
  const items = value
    .split(',')
    .map(item => normalizeLocale(item))
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function parseCliArguments(argv) {
  let assetRoot = process.cwd();
  let locales;
  let helpLocales;
  let monacoLocales;
  let verifyManifestFileSet = true;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--asset-root') {
      assetRoot = argv[index + 1] ? path.resolve(argv[index + 1]) : assetRoot;
      index += 1;
      continue;
    }
    if (current === '--locales') {
      locales = parseListArg(argv[index + 1], ['en']);
      index += 1;
      continue;
    }
    if (current === '--help-locales') {
      helpLocales = parseListArg(argv[index + 1], ['en']);
      index += 1;
      continue;
    }
    if (current === '--monaco-locales') {
      monacoLocales = parseListArg(argv[index + 1], ['en']);
      index += 1;
      continue;
    }
    if (current === '--en-only') {
      locales = ['en'];
      helpLocales = ['en'];
      monacoLocales = ['en'];
      continue;
    }
    if (current === '--skip-manifest-file-check') {
      verifyManifestFileSet = false;
      continue;
    }
    if (current === '--json') {
      json = true;
    }
  }

  return {
    assetRoot,
    locales,
    helpLocales,
    monacoLocales,
    verifyManifestFileSet,
    json,
  };
}

async function runCli() {
  const args = parseCliArguments(process.argv.slice(2));
  const result = await validateOfficeAssets(args.assetRoot, {
    locales: args.locales,
    helpLocales: args.helpLocales,
    monacoLocales: args.monacoLocales,
    verifyManifestFileSet: args.verifyManifestFileSet,
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (!result.ok) {
    for (const error of result.errors) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      // eslint-disable-next-line no-console
      console.warn(warning);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `OFFICE asset verification passed: localeFiles=${result.stats.localeFilesScanned}, helpDirs=${result.stats.helpDirectoriesScanned}, monacoNls=${result.stats.monacoNlsFilesScanned}, manifestEntries=${result.stats.manifestEntries}`,
  );
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  runCli().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

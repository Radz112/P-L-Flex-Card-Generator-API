// Font registration for canvas
import { registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

const FONTS = [
  { file: 'Roboto-Bold.ttf', family: 'Roboto', weight: 'bold' }
];

function findFontsDir(): string {
  const paths = [
    path.join(__dirname, '../assets/fonts'),
    path.join(__dirname, '../../src/assets/fonts'),
    path.join(process.cwd(), 'src/assets/fonts')
  ];
  return paths.find(p => fs.existsSync(p)) || paths[0];
}

export function loadFonts(): { success: boolean; loaded: string[]; failed: string[] } {
  const result = { success: true, loaded: [] as string[], failed: [] as string[] };
  const fontsDir = findFontsDir();

  console.log(`[Fonts] Loading from: ${fontsDir}`);

  if (!fs.existsSync(fontsDir)) {
    console.error(`[Fonts] Directory not found`);
    return { ...result, success: false };
  }

  for (const font of FONTS) {
    const fontPath = path.join(fontsDir, font.file);
    try {
      if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: font.family, weight: font.weight });
        console.log(`[Fonts] ✓ ${font.family} (${font.weight})`);
        result.loaded.push(font.file);
      } else {
        console.error(`[Fonts] ✗ ${font.file} not found`);
        result.failed.push(font.file);
        result.success = false;
      }
    } catch (err) {
      console.error(`[Fonts] ✗ ${font.file}: ${err instanceof Error ? err.message : err}`);
      result.failed.push(font.file);
      result.success = false;
    }
  }

  return result;
}

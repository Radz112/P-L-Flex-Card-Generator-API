import { registerFont } from 'canvas';
import path from 'path';
import fs from 'fs';

export function loadFonts(): { success: boolean; loaded: string[]; failed: string[] } {
  const dirs = [
    path.join(__dirname, '../assets/fonts'),
    path.join(__dirname, '../../src/assets/fonts'),
    path.join(process.cwd(), 'src/assets/fonts')
  ];
  const fontsDir = dirs.find(p => fs.existsSync(p)) || dirs[0];
  const fontPath = path.join(fontsDir, 'Roboto-Bold.ttf');

  console.log(`[Fonts] Loading from: ${fontsDir}`);

  if (!fs.existsSync(fontPath)) {
    console.error('[Fonts] Roboto-Bold.ttf not found');
    return { success: false, loaded: [], failed: ['Roboto-Bold.ttf'] };
  }

  try {
    registerFont(fontPath, { family: 'Roboto', weight: 'bold' });
    console.log('[Fonts] Roboto loaded');
    return { success: true, loaded: ['Roboto-Bold.ttf'], failed: [] };
  } catch (err) {
    console.error('[Fonts] Failed:', err instanceof Error ? err.message : err);
    return { success: false, loaded: [], failed: ['Roboto-Bold.ttf'] };
  }
}

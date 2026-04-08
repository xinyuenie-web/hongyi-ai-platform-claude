/**
 * 种子数据脚本 - 从CSV导入树木和庭院风格数据
 * Usage: npm run seed -w apps/server
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { Tree } from '../models/tree.model.js';
import { GardenStyle } from '../models/garden-style.model.js';
import { Admin } from '../models/admin.model.js';
import { TREE_SPECIES } from '@hongyi/shared';

/** Decode GB18030 buffer to UTF-8 string */
function decodeGB18030(buffer: Buffer): string {
  const decoder = new TextDecoder('gb18030');
  return decoder.decode(buffer);
}

/** Parse CSV line (handles quoted fields) */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Seed tree data from CSV */
async function seedTrees(): Promise<void> {
  // Go up from apps/server to project root
  const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const csvPath = path.resolve(projectRoot, '十种造型树木清单20260402.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠ 树木CSV文件未找到:', csvPath);
    return;
  }

  const buffer = fs.readFileSync(csvPath);
  const text = decodeGB18030(buffer);
  const lines = text.split('\n').filter((l) => l.trim());

  // Skip header
  const header = parseCSVLine(lines[0]);
  console.log('CSV columns:', header);

  const trees = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 6 || !fields[0].startsWith('HY')) continue;

    const [treeId, name, species, height, crown, price] = fields;
    const statusText = fields[fields.length - 1];

    // Get fengshui info from shared constants
    const speciesInfo = TREE_SPECIES[species];

    trees.push({
      treeId,
      name,
      species,
      specs: {
        height: parseInt(height),
        crown: parseInt(crown),
      },
      price: {
        sale: parseInt(price),
      },
      coverImage: `/images/trees/${treeId}.jpg`,
      images: [`/images/trees/${treeId}.jpg`],
      fengshui: speciesInfo
        ? {
            symbol: speciesInfo.fengshuiSymbol,
            positions: speciesInfo.fengshuiPositions,
            element: speciesInfo.element,
          }
        : undefined,
      tags: [species, '造型树', '精品'],
      location: '湖南浏阳',
      status: statusText === '在售' ? 'available' : 'sold',
    });
  }

  // Upsert trees
  for (const tree of trees) {
    await Tree.findOneAndUpdate({ treeId: tree.treeId }, { $set: tree }, { upsert: true });
  }
  console.log(`✓ ${trees.length} 棵树木已导入`);
}

/** Seed garden style data from CSV */
async function seedGardenStyles(): Promise<void> {
  const projectRoot2 = path.resolve(__dirname, '..', '..', '..', '..');
  const csvPath = path.resolve(projectRoot2, '五类庭院别墅清单20260402.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('⚠ 庭院风格CSV文件未找到:', csvPath);
    return;
  }

  const buffer = fs.readFileSync(csvPath);
  const text = decodeGB18030(buffer);
  const lines = text.split('\n').filter((l) => l.trim());

  // Find the header row (skip title rows)
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('编号')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    console.log('⚠ 无法解析庭院风格CSV');
    return;
  }

  const styleTypeMap: Record<string, 'modern' | 'chinese' | 'european' | 'japanese' | 'tuscan'> = {
    现代简约风格: 'modern',
    新中式风格: 'chinese',
    欧式古典风格: 'european',
    日式禅意风格: 'japanese',
    田园托斯卡纳风格: 'tuscan',
  };

  const styles = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 8 || !fields[0].startsWith('TY')) continue;

    const [styleId, name, _image, description, keywordsStr, elements, architectureNotes, suitableScenes, atmosphere] = fields;

    styles.push({
      styleId,
      name,
      type: styleTypeMap[name] || 'modern',
      image: `/images/styles/${styleId}.png`,
      description,
      keywords: keywordsStr
        ? keywordsStr
            .split(/[、，,]/)
            .map((k) => k.trim())
            .filter(Boolean)
        : [],
      elements: elements || '',
      architectureNotes: architectureNotes || '',
      suitableScenes: suitableScenes || '',
      atmosphere: atmosphere || '',
    });
  }

  for (const style of styles) {
    await GardenStyle.findOneAndUpdate({ styleId: style.styleId }, { $set: style }, { upsert: true });
  }
  console.log(`✓ ${styles.length} 种庭院风格已导入`);
}

/** Seed default admin account */
async function seedAdmin(): Promise<void> {
  const exists = await Admin.findOne({ username: 'admin' });
  if (!exists) {
    await Admin.create({ username: 'admin', password: 'hongyi2026' });
    console.log('✓ 管理员账号已创建 (admin / hongyi2026)');
  } else {
    console.log('✓ 管理员账号已存在');
  }
}

async function main(): Promise<void> {
  console.log('🌱 开始导入种子数据...\n');

  await mongoose.connect(config.mongodbUri);
  console.log('✓ 数据库已连接\n');

  await seedTrees();
  await seedGardenStyles();
  await seedAdmin();

  console.log('\n🎉 种子数据导入完成！');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('导入失败:', err);
  process.exit(1);
});

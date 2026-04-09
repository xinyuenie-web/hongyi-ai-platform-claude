/** AI养护知识库 - 各树种养护指南 */

interface CareGuide {
  species: string;
  overview: string;
  seasonal: {
    spring: string;
    summer: string;
    autumn: string;
    winter: string;
  };
  watering: string;
  fertilizing: string;
  pruning: string;
  pestControl: string;
  tips: string[];
}

const CARE_KNOWLEDGE: Record<string, CareGuide> = {
  '罗汉松': {
    species: '罗汉松',
    overview: '罗汉松为常绿针叶乔木，喜温暖湿润环境，耐阴性强，是高端庭院的首选造型树种。',
    seasonal: {
      spring: '3-4月施春肥（有机肥为主），修剪整形，检查越冬后枝条状况。适当增加浇水频率。',
      summer: '注意遮阳防晒（尤其新栽树），保持土壤湿润但不积水，每周浇水2-3次。高温期喷叶面水降温。',
      autumn: '9月施秋肥促根生长，减少浇水频率，进行秋季修剪定型。',
      winter: '减少浇水，北方需包裹保温。停止施肥。检查是否有冻害迹象。',
    },
    watering: '春秋季每3-4天浇一次透水，夏季每1-2天，冬季每7-10天。避免积水导致烂根。',
    fertilizing: '春季施腐熟有机肥，夏季薄施液肥，秋季施磷钾肥促进木质化，冬季停肥。',
    pruning: '每年春秋两次整形修剪，摘除过密枝叶，保持造型通透。生长期可随时摘心控形。',
    pestControl: '注意防治介壳虫、叶枯病。春季喷石硫合剂预防，发现虫害及时用专用药剂。',
    tips: ['新栽种后前3个月为关键期，需特别关注浇水', '避免强烈西晒', '盆栽每2-3年换盆一次'],
  },
  '黑松': {
    species: '黑松',
    overview: '黑松为常绿乔木，树姿苍劲，是日式和中式庭院的灵魂树种。耐旱耐瘠薄，适应性强。',
    seasonal: {
      spring: '3月施春肥，4-5月进行"摘芽"控制新梢长度，保持造型紧凑。',
      summer: '控水促短针，减少浇水量。7月可进行"切芽"（剪除春芽促二次芽）。',
      autumn: '9-10月施磷钾肥，进行疏枝整形。秋季是黑松最佳观赏期。',
      winter: '基本免维护，偶尔检查是否有雪压折枝。寒潮前适当浇水防冻。',
    },
    watering: '黑松耐旱，宁干勿湿。生长期每5-7天浇一次，冬季每10-15天。',
    fertilizing: '以有机肥为主，春秋各施一次。避免高氮肥导致针叶过长。',
    pruning: '春季摘芽、夏季切芽、秋季疏枝是黑松造型三大关键技法。',
    pestControl: '注意松材线虫病预防（定期注射药剂），防治松毛虫和松干蚧。',
    tips: ['短针培养是黑松造型的核心技术', '全日照环境最佳', '通风良好可预防大部分病害'],
  },
  '五针松': {
    species: '五针松',
    overview: '五针松叶短而密，五针一束，姿态优雅，是日式庭院的至宝。生长缓慢，珍贵品种。',
    seasonal: {
      spring: '春季薄施有机肥，适当摘除过长新芽。注意通风防霉。',
      summer: '半阴环境为佳，避免烈日直射。保持空气湿度，适当喷雾。',
      autumn: '施磷钾肥促根，摘除老叶保持美观。秋季是移栽最佳季节。',
      winter: '耐寒性一般，北方需防寒。保持盆土微湿不干。',
    },
    watering: '喜湿润但怕积水，春秋每3-5天，夏季注意叶面喷水增湿。',
    fertilizing: '薄肥勤施，以饼肥水为主，每月一次。忌浓肥。',
    pruning: '以摘芽控形为主，秋季适当疏枝。五针松生长慢，少动大枝。',
    pestControl: '主要防治叶枯病和介壳虫，保持通风是最好的预防。',
    tips: ['五针松忌强光暴晒', '嫁接苗注意保护嫁接口', '排水良好是种植关键'],
  },
  '榆树': {
    species: '榆树',
    overview: '榆树生命力极强，萌发力旺盛，是造型盆景的上佳素材。落叶乔木，四季变化丰富。',
    seasonal: {
      spring: '春季萌芽前施基肥，新芽展开后开始修剪。榆树萌发力强，可大胆修剪。',
      summer: '生长旺期，每2-3周修剪一次保持造型。注意通风防虫。',
      autumn: '秋叶变黄，观赏性极佳。减少修剪，施磷钾肥。',
      winter: '落叶后进行冬季重剪整形，可观枝干造型之美。',
    },
    watering: '喜湿润，生长期保持土壤湿润。夏季每天浇水，冬季控水。',
    fertilizing: '春夏生长期每月施一次复合肥，秋季施磷钾肥。',
    pruning: '榆树耐修剪，全年可修。冬季是整形重剪最佳时期。',
    pestControl: '注意防治榆叶甲、蚜虫。春季喷药预防。',
    tips: ['榆树造型以"剪"为主', '夏季遮阳有助于保持叶片细小', '老桩移栽需保留足够土球'],
  },
  '红花檵木': {
    species: '红花檵木',
    overview: '红花檵木四季红叶，春季红花满枝，是彩叶造型树中的精品。常绿灌木或小乔木。',
    seasonal: {
      spring: '3-4月花期，开花后轻修剪。施花后肥补充养分。',
      summer: '生长旺期，每月修剪保持造型。注意浇水保持叶色鲜艳。',
      autumn: '秋季新叶最红，控氮增磷钾可促进叶色。',
      winter: '南方常绿，北方需防寒保温。减少浇水。',
    },
    watering: '喜湿润酸性土壤，生长期每2-3天浇水。忌碱性水。',
    fertilizing: '以酸性肥料为主（硫酸亚铁+有机肥），每月一次。',
    pruning: '花后修剪为主，生长期随时摘心控形。',
    pestControl: '较少病虫害，偶有蚜虫和叶斑病。',
    tips: ['酸性土壤是保持红叶的关键', '全光照叶色更红', '忌积水导致根腐'],
  },
  '白蜡': {
    species: '白蜡',
    overview: '白蜡树形优美，秋叶金黄，是欧式庭院的经典景观树。落叶乔木，适应性广。',
    seasonal: {
      spring: '春季发芽前施基肥，修剪枯死枝和交叉枝。',
      summer: '正常养护，注意天牛防治。适当浇水。',
      autumn: '秋叶金黄是最佳观赏期，减少修剪保留秋色。',
      winter: '落叶后冬剪整形，清理落叶防病。',
    },
    watering: '耐旱性较好，每5-7天浇水一次即可。新栽树注意保湿。',
    fertilizing: '春季施复合肥，秋季施有机肥改土。',
    pruning: '以冬季整形修剪为主，夏季适当疏枝通风。',
    pestControl: '重点防治白蜡窄吉丁虫和天牛。',
    tips: ['白蜡适应性极强，管理粗放', '对城市污染有较强抵抗力', '大规格移栽需重截'],
  },
  '紫薇': {
    species: '紫薇',
    overview: '紫薇花期长达百日（6-9月），故称"百日红"。树皮光滑如绸，造型独特。',
    seasonal: {
      spring: '3月重剪（剪去上年枝条2/3），施春肥促花芽分化。',
      summer: '6-9月花期，花后及时剪除残花可促二次开花。注意浇水。',
      autumn: '花期结束后施秋肥，减少修剪让枝条木质化。',
      winter: '落叶后欣赏枝干美，进行冬季重剪。清理枯叶防病。',
    },
    watering: '花期需水量大，每2-3天浇水。其他季节每5-7天。',
    fertilizing: '春季施磷钾肥促花，花期每2周追施液肥。',
    pruning: '紫薇"越剪越开花"，春季重剪是保证开花的关键。',
    pestControl: '白粉病是紫薇最常见病害，注意通风和喷药预防。',
    tips: ['春季重剪是紫薇养护最重要的步骤', '花后剪残花可延长花期1-2个月', '老桩造型具有极高观赏价值'],
  },
  '大阪松': {
    species: '大阪松',
    overview: '大阪松是五针松的栽培品种，针叶短密金黄，日式庭院的代表性树种。',
    seasonal: {
      spring: '轻施有机肥，摘除过长新芽。保持通风。',
      summer: '半阴为佳，避免午后烈日。勤喷叶面水。',
      autumn: '施磷钾肥，摘除老黄叶。',
      winter: '需适当防寒，保持盆土不干。',
    },
    watering: '与五针松相同，喜湿怕涝。春秋3-5天一次。',
    fertilizing: '薄肥勤施，以有机液肥为主。',
    pruning: '以摘芽为主，保持短针密叶效果。',
    pestControl: '同五针松，注意通风防病。',
    tips: ['大阪松比普通五针松更耐热', '金黄色针叶需充足光照维持', '嫁接苗管理同五针松'],
  },
  '黄杨': {
    species: '黄杨',
    overview: '黄杨四季常绿，叶密枝细，是造型绿篱和盆景的首选。生长极慢，寿命长。',
    seasonal: {
      spring: '春季施薄肥，修剪整形。黄杨生长慢，修剪量不宜过大。',
      summer: '注意遮阳保湿，高温易引起叶焦。每天喷水降温。',
      autumn: '秋季施肥促根，减少修剪。',
      winter: '耐寒性好，北方盆栽需入室。',
    },
    watering: '喜湿润，生长期保持土壤微湿。夏季增加喷水频率。',
    fertilizing: '每月施一次稀薄液肥，以饼肥水为佳。',
    pruning: '全年可修剪，春秋为佳。黄杨造型以"云片"型最经典。',
    pestControl: '注意黄杨绢野螟防治，春季提前喷药。',
    tips: ['黄杨生长极慢，大型造型价值极高', '忌强光暴晒', '排水良好是关键'],
  },
  '枸骨': {
    species: '枸骨',
    overview: '枸骨叶形奇特如"冬青虎刺"，秋冬挂满红果，是年宵盆景的热门品种。',
    seasonal: {
      spring: '春季施肥修剪，促进新枝萌发。',
      summer: '半阴环境为佳，保持湿润通风。',
      autumn: '果实渐红，减少修剪保留果枝。施磷肥促果。',
      winter: '红果满枝，观赏期最佳。适当控水保果。',
    },
    watering: '喜湿润，生长期每3-4天浇水。冬季减少。',
    fertilizing: '春季施氮肥促叶，夏秋施磷钾肥促果。',
    pruning: '春季修剪为主，注意保留花芽枝。',
    pestControl: '病虫害较少，偶有蚧壳虫。',
    tips: ['雌雄异株，需雌株才能结果', '红果期长达3-4个月', '叶缘有刺，修剪注意防护'],
  },
};

export interface CarePlan {
  species: string;
  guide: CareGuide;
  currentSeasonTasks: string[];
  nextMonthReminders: string[];
  urgentTips: string[];
}

/** Generate care plan for a specific tree */
export function generateCarePlan(species: string): CarePlan | null {
  const guide = CARE_KNOWLEDGE[species];
  if (!guide) return null;

  const now = new Date();
  const month = now.getMonth() + 1;

  // Determine current season
  let currentSeason: keyof CareGuide['seasonal'];
  if (month >= 3 && month <= 5) currentSeason = 'spring';
  else if (month >= 6 && month <= 8) currentSeason = 'summer';
  else if (month >= 9 && month <= 11) currentSeason = 'autumn';
  else currentSeason = 'winter';

  const seasonNames: Record<string, string> = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };

  const currentSeasonTasks = [
    `【${seasonNames[currentSeason]}养护重点】${guide.seasonal[currentSeason]}`,
    `【浇水】${guide.watering}`,
    `【施肥】${guide.fertilizing}`,
  ];

  // Next month reminders
  const nextMonth = month === 12 ? 1 : month + 1;
  let nextSeason: keyof CareGuide['seasonal'];
  if (nextMonth >= 3 && nextMonth <= 5) nextSeason = 'spring';
  else if (nextMonth >= 6 && nextMonth <= 8) nextSeason = 'summer';
  else if (nextMonth >= 9 && nextMonth <= 11) nextSeason = 'autumn';
  else nextSeason = 'winter';

  const nextMonthReminders = [];
  if (nextSeason !== currentSeason) {
    nextMonthReminders.push(`即将进入${seasonNames[nextSeason]}，请提前准备：${guide.seasonal[nextSeason]}`);
  }
  nextMonthReminders.push(`修剪提醒：${guide.pruning}`);

  const urgentTips = [];
  if (month >= 6 && month <= 8) {
    urgentTips.push(`高温季节注意：${guide.watering}`);
    urgentTips.push(`病虫害防治：${guide.pestControl}`);
  }
  if (month >= 12 || month <= 2) {
    urgentTips.push(`防寒保温：${guide.seasonal.winter}`);
  }

  return {
    species,
    guide,
    currentSeasonTasks,
    nextMonthReminders,
    urgentTips,
  };
}

/** Get all species care guides */
export function getAllCareGuides(): CareGuide[] {
  return Object.values(CARE_KNOWLEDGE);
}

/** Get care guide for specific species */
export function getCareGuide(species: string): CareGuide | null {
  return CARE_KNOWLEDGE[species] || null;
}

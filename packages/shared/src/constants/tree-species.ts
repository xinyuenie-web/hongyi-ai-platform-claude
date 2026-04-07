/** 树木品种信息 */
export interface SpeciesInfo {
  /** 品类名称 */
  name: string;
  /** 拉丁名 */
  latin: string;
  /** 风水寓意 */
  fengshuiSymbol: string;
  /** 适宜方位 */
  fengshuiPositions: string[];
  /** 五行属性 */
  element: string;
  /** 养护难度 1-5 */
  careDifficulty: number;
  /** 简介 */
  description: string;
}

/** 十种核心造型树木品种 */
export const TREE_SPECIES: Record<string, SpeciesInfo> = {
  罗汉松: {
    name: '罗汉松',
    latin: 'Podocarpus macrophyllus',
    fengshuiSymbol: '招财纳福、长寿安康',
    fengshuiPositions: ['门前', '庭院东南方'],
    element: '木',
    careDifficulty: 3,
    description: '四季常绿，姿态古朴苍劲，是高端庭院造型树的首选品种',
  },
  黑松: {
    name: '黑松',
    latin: 'Pinus thunbergii',
    fengshuiSymbol: '坚韧不拔、基业长青',
    fengshuiPositions: ['庭院东方', '院门两侧'],
    element: '木',
    careDifficulty: 3,
    description: '树形刚劲有力，针叶浓密，是日式和中式庭院的经典树种',
  },
  五针松: {
    name: '五针松',
    latin: 'Pinus parviflora',
    fengshuiSymbol: '五福临门、富贵吉祥',
    fengshuiPositions: ['庭院中央', '假山旁'],
    element: '木',
    careDifficulty: 4,
    description: '针叶短密呈五针一束，树形优雅，名贵观赏松种',
  },
  榆树: {
    name: '榆树',
    latin: 'Ulmus pumila',
    fengshuiSymbol: '余财余粮、年年有余',
    fengshuiPositions: ['庭院西方', '后院'],
    element: '木',
    careDifficulty: 2,
    description: '造型桩景古朴苍劲，易于造型养护，性价比极高',
  },
  红花檵木: {
    name: '红花檵木',
    latin: 'Loropetalum chinense var. rubrum',
    fengshuiSymbol: '红红火火、喜庆吉祥',
    fengshuiPositions: ['门前', '庭院南方'],
    element: '火',
    careDifficulty: 2,
    description: '浏阳特色树种，红叶红花，四季观赏，是造型花木的代表品种',
  },
  白蜡: {
    name: '对节白蜡',
    latin: 'Fraxinus hupehensis',
    fengshuiSymbol: '刚正不阿、节节高升',
    fengshuiPositions: ['庭院北方', '书房窗前'],
    element: '金',
    careDifficulty: 3,
    description: '被誉为"活化石"，树形苍劲古朴，极具艺术观赏价值',
  },
  紫薇: {
    name: '紫薇',
    latin: 'Lagerstroemia indica',
    fengshuiSymbol: '紫气东来、官运亨通',
    fengshuiPositions: ['庭院东方', '门前'],
    element: '火',
    careDifficulty: 2,
    description: '夏秋开花，花期长达百日，老桩造型别具韵味',
  },
  大阪松: {
    name: '大阪松',
    latin: 'Pinus parviflora var. pentaphylla',
    fengshuiSymbol: '尊贵典雅、永恒不变',
    fengshuiPositions: ['庭院中央', '入口处'],
    element: '木',
    careDifficulty: 5,
    description: '五针松变种，针叶银蓝色，极为名贵，是顶级庭院的标志性树种',
  },
  黄杨: {
    name: '黄杨',
    latin: 'Buxus sinica',
    fengshuiSymbol: '正气凛然、驱邪化煞',
    fengshuiPositions: ['门前', '庭院四角'],
    element: '木',
    careDifficulty: 2,
    description: '生长缓慢，木质细密，造型桩景小巧精致，适合中小庭院',
  },
  枸骨: {
    name: '枸骨',
    latin: 'Ilex cornuta',
    fengshuiSymbol: '多子多福、驱邪避灾',
    fengshuiPositions: ['庭院西南方', '围墙旁'],
    element: '木',
    careDifficulty: 2,
    description: '叶形奇特如龙爪，秋冬挂满红果，兼具观叶观果价值',
  },
};

/** 获取所有品种名称列表 */
export const SPECIES_LIST = Object.keys(TREE_SPECIES);

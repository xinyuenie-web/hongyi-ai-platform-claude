import { Tree } from '../models/tree.model.js';
import { GardenStyle } from '../models/garden-style.model.js';

// ---------------------------------------------------------------------------
// Style keyword mapping for smart matching
// ---------------------------------------------------------------------------
const STYLE_KEYWORDS: Record<string, string[]> = {
  modern: ['现代', '简约', '极简', '简洁', '时尚', '都市', '现代风', '简约风', '线条'],
  chinese: ['中式', '中国风', '古典', '禅意', '国风', '传统', '东方', '中国', '文人', '山水', '诗意'],
  european: ['欧式', '欧洲', '古典', '法式', '英式', '宫廷', '巴洛克', '罗马', '地中海'],
  japanese: ['日式', '日本', '禅', '枯山水', '和风', '侘寂', '石灯笼', '日本风'],
  tuscan: ['田园', '托斯卡纳', '乡村', '自然', '花园', 'pastoral', '野趣', '牧歌'],
};

// ---------------------------------------------------------------------------
// Tree-style affinity: which trees suit which styles
// ---------------------------------------------------------------------------
const TREE_STYLE_AFFINITY: Record<string, string[]> = {
  '罗汉松': ['chinese', 'japanese', 'modern'],
  '黑松': ['japanese', 'chinese'],
  '五针松': ['japanese', 'chinese', 'modern'],
  '榆树': ['chinese', 'tuscan', 'european'],
  '红花檵木': ['chinese', 'japanese', 'modern'],
  '白蜡': ['european', 'modern', 'tuscan'],
  '紫薇': ['chinese', 'european', 'tuscan'],
  '大阪松': ['japanese', 'chinese'],
  '黄杨': ['european', 'chinese', 'modern', 'japanese'],
  '枸骨': ['chinese', 'european'],
};

// ---------------------------------------------------------------------------
// Feng shui tips per style
// ---------------------------------------------------------------------------
const FENGSHUI_TIPS: Record<string, string> = {
  modern: '现代简约庭院建议摆放罗汉松或黄杨，寓意"长寿安康"，搭配白色砾石营造清净气场。',
  chinese: '中式庭院首推罗汉松和黑松，松柏常青象征"福寿延绵"，宜置于庭院东南方位。',
  european: '欧式庭院适宜白蜡和紫薇，紫薇花开百日寓意"紫气东来"，搭配对称布局彰显大气。',
  japanese: '日式禅意庭院以五针松、黑松为核心，配合枯山水布局，营造"静谧悟道"的意境。',
  tuscan: '田园风格庭院以紫薇和榆树为主景，自然生长的姿态象征"生机勃勃"，宜群植营造层次。',
};

// ---------------------------------------------------------------------------
// Zone planning templates per style
// ---------------------------------------------------------------------------
const ZONE_TEMPLATES: Record<string, ZonePlan[]> = {
  modern: [
    { zone: '入口区', areaRatio: 0.15, description: '极简迎宾空间，两侧对植造型黄杨，地面铺设灰色花岗岩板与白砾石带，配合隐藏式地灯勾勒出利落的引导动线。' },
    { zone: '主景区', areaRatio: 0.35, description: '以一棵精品罗汉松为视觉中心，背景为清水混凝土景墙，前方设镜面水景倒映树影，周围搭配黑色卵石与观赏草。' },
    { zone: '休憩区', areaRatio: 0.30, description: '户外客厅区域，铺设防腐木平台，放置现代风格户外沙发与茶几，上方安装电动遮阳篷，一侧种植竹篱增强私密性。' },
    { zone: '步道与边界', areaRatio: 0.20, description: '几何线条步道连接各功能区，边界以Corten钢板收边，内侧种植低矮绿篱与地被植物。' },
  ],
  chinese: [
    { zone: '入口区', areaRatio: 0.15, description: '青砖门楼配铜钉大门，入口设影壁一座，壁前置太湖石一组，两侧植翠竹数丛，营造"庭院深深"的第一印象。' },
    { zone: '主景区', areaRatio: 0.35, description: '以造型黑松或罗汉松为主景树，配合假山水池、锦鲤戏水，池畔设置石桌石凳，背景种植紫竹与红枫形成层次。' },
    { zone: '休憩区', areaRatio: 0.30, description: '四角亭或廊架一座，内设实木茶台，适宜品茗对弈。四周种植桂花、腊梅，四季飘香。地面以青石板与鹅卵石拼铺。' },
    { zone: '步道与边界', areaRatio: 0.20, description: '曲径通幽的青石步道串联各景，沿途布置石灯笼与矮竹篱，墙根植爬山虎与凌霄，边界以粉墙黛瓦为借景框架。' },
  ],
  european: [
    { zone: '入口区', areaRatio: 0.15, description: '铸铁大门配石柱门廊，两侧对称种植修剪整齐的球形黄杨，地面铺设仿古砖，中轴线直通主景喷泉。' },
    { zone: '主景区', areaRatio: 0.35, description: '中央设置多层石雕喷泉，四周以对称花坛环绕，主景树选用白蜡或紫薇，下层种植月季、薰衣草形成色带。' },
    { zone: '休憩区', areaRatio: 0.30, description: '铁艺凉亭或石柱廊架下设置户外餐桌椅，周围攀爬藤本月季与紫藤，营造浪漫的法式花园用餐体验。' },
    { zone: '步道与边界', areaRatio: 0.20, description: '砾石与砖砌交替的对称步道，沿途以修剪低矮的黄杨绿篱引导方向，边界设置铸铁围栏与攀缘植物。' },
  ],
  japanese: [
    { zone: '入口区', areaRatio: 0.15, description: '竹木栅门配石板飞石路，入口设蹲踞（手水钵）一组，两侧植苔藓与蕨类，落叶自然散落营造侘寂之美。' },
    { zone: '主景区', areaRatio: 0.35, description: '枯山水庭核心区域，白砂砾耙出水纹，置石三五组模拟山岳，侧植五针松一棵苍劲如画，背景为竹林屏障。' },
    { zone: '休憩区', areaRatio: 0.30, description: '和室外廊（缘侧）面向主景，铺设竹席与蒲团，可静坐冥想。一角设石灯笼与枫树，秋日红叶映衬别有韵味。' },
    { zone: '步道与边界', areaRatio: 0.20, description: '飞石步道蜿蜒穿行于苔地之间，以竹篱（四目垣）为边界，沿途设置石灯笼指引夜间行走。' },
  ],
  tuscan: [
    { zone: '入口区', areaRatio: 0.15, description: '木质拱门覆盖攀缘蔷薇，入口小径两侧种植薰衣草与迷迭香，芳香扑鼻，脚下碎石路自然质朴。' },
    { zone: '主景区', areaRatio: 0.35, description: '以一棵大冠幅紫薇或榆树为中心遮荫树，树下设石砌圆形花坛，四周混种多年生花卉，营造花团锦簇的田园画面。' },
    { zone: '休憩区', areaRatio: 0.30, description: '葡萄架或紫藤花廊下设置原木长桌与藤编椅，适合户外聚餐。旁边设置壁炉或烤架，打造乡村生活场景。' },
    { zone: '步道与边界', areaRatio: 0.20, description: '天然石板与草缝交错的乡间小路，沿途种植鼠尾草、波斯菊等野花，边界以低矮木栅栏与爬藤植物柔化。' },
  ],
};

// ---------------------------------------------------------------------------
// Plant layering templates per style
// ---------------------------------------------------------------------------
const PLANT_LAYERING: Record<string, PlantLayer[]> = {
  modern: [
    { layer: '乔木层', height: '3-8m', plants: '罗汉松、黄杨大树、白蜡', role: '构建空间骨架，提供疏朗的竖向线条' },
    { layer: '灌木层', height: '0.5-2m', plants: '红花檵木球、龟甲冬青、大叶黄杨', role: '界定空间边界，形成整洁的绿色背景' },
    { layer: '地被层', height: '0-0.5m', plants: '矮麦冬、佛甲草、细叶芒', role: '软化硬质铺装边缘，填充地面空白区域' },
  ],
  chinese: [
    { layer: '乔木层', height: '3-10m', plants: '黑松、罗汉松、桂花、红枫', role: '营造林冠天际线，松柏常青象征长寿' },
    { layer: '灌木层', height: '0.5-3m', plants: '紫竹、南天竹、红花檵木、腊梅', role: '丰富中层色彩，四季有花有叶可赏' },
    { layer: '地被层', height: '0-0.5m', plants: '吉祥草、书带草、苔藓、石菖蒲', role: '覆盖裸土，营造幽深静谧的林下氛围' },
  ],
  european: [
    { layer: '乔木层', height: '4-12m', plants: '白蜡、紫薇、榆树', role: '提供庄重的轴线感与夏季荫凉' },
    { layer: '灌木层', height: '0.5-2m', plants: '黄杨球、月季、绣球花', role: '构成规整的花坛与绿篱结构' },
    { layer: '地被层', height: '0-0.5m', plants: '草坪、鸢尾、薰衣草、三色堇', role: '铺展大面积色块，强调对称的图案美' },
  ],
  japanese: [
    { layer: '乔木层', height: '3-8m', plants: '五针松、黑松、大阪松、红枫', role: '以孤植或少量组合呈现自然山林意象' },
    { layer: '灌木层', height: '0.5-2m', plants: '杜鹃、南天竹、绣球、枸骨', role: '模拟林缘灌丛，秋冬挂果增添野趣' },
    { layer: '地被层', height: '0-0.5m', plants: '苔藓、玉簪、蕨类、矮麦冬', role: '覆盖地面如绿毯，配合飞石步道增强禅意' },
  ],
  tuscan: [
    { layer: '乔木层', height: '3-10m', plants: '紫薇、榆树、石榴', role: '提供自然散漫的冠幅与夏日果花' },
    { layer: '灌木层', height: '0.5-2m', plants: '迷迭香、月季、绣球、木槿', role: '营造田园色彩，花期交错全年有景' },
    { layer: '地被层', height: '0-0.5m', plants: '薰衣草、鼠尾草、百里香、草坪', role: '以芳香地被铺满花径两侧，踩踏释香' },
  ],
};

// ---------------------------------------------------------------------------
// Seasonal color schemes per style
// ---------------------------------------------------------------------------
const SEASONAL_COLORS: Record<string, SeasonalColor[]> = {
  modern: [
    { season: '春', palette: '嫩绿 + 白 + 银灰', highlight: '新叶初展的翠绿与白砾石形成清新对比' },
    { season: '夏', palette: '深绿 + 墨绿 + 冷灰', highlight: '浓密绿荫与清水混凝土构成都市清凉感' },
    { season: '秋', palette: '金黄 + 橙红 + 灰', highlight: '观赏草穗金黄摇曳，搭配暖色灯光' },
    { season: '冬', palette: '常绿 + 白 + 黑', highlight: '罗汉松苍翠依旧，雪后黑白分明如水墨' },
  ],
  chinese: [
    { season: '春', palette: '粉红 + 嫩绿 + 白', highlight: '桃花灼灼、柳芽初绿，春水碧于天' },
    { season: '夏', palette: '碧绿 + 荷粉 + 翠', highlight: '荷叶田田、竹影摇曳，浓荫蔽日' },
    { season: '秋', palette: '金黄 + 橙红 + 丹', highlight: '红枫如火、桂花飘香、银杏铺金' },
    { season: '冬', palette: '苍绿 + 白 + 暗红', highlight: '腊梅傲雪、松柏长青、红灯映雪' },
  ],
  european: [
    { season: '春', palette: '粉紫 + 嫩绿 + 金', highlight: '月季初绽、紫藤垂花，喷泉春水流淌' },
    { season: '夏', palette: '紫蓝 + 粉红 + 绿', highlight: '薰衣草成片、紫薇盛放，色彩浓烈热情' },
    { season: '秋', palette: '金橙 + 酒红 + 棕', highlight: '白蜡金叶飘落、月季秋花复开' },
    { season: '冬', palette: '银白 + 暗绿 + 灰', highlight: '常绿黄杨球如哨兵矗立，石雕喷泉冰挂如艺' },
  ],
  japanese: [
    { season: '春', palette: '樱粉 + 嫩绿 + 苔绿', highlight: '枝垂樱花瓣如雨落入砂纹，禅意初萌' },
    { season: '夏', palette: '深绿 + 苔绿 + 靛蓝', highlight: '五针松翠浓如墨，苔藓铺展如绒毯' },
    { season: '秋', palette: '朱红 + 金黄 + 苔绿', highlight: '红枫映入手水钵，落叶散于白砂间' },
    { season: '冬', palette: '枯黄 + 苍绿 + 白', highlight: '松雪压枝而不折，枯山水愈显空灵' },
  ],
  tuscan: [
    { season: '春', palette: '鹅黄 + 淡紫 + 草绿', highlight: '蔷薇攀满拱门，野花遍地生机盎然' },
    { season: '夏', palette: '紫蓝 + 玫红 + 金', highlight: '薰衣草与向日葵交织，热烈的南欧色调' },
    { season: '秋', palette: '橙红 + 赭石 + 金', highlight: '石榴裂红、枯藤老树，丰收的田园暖意' },
    { season: '冬', palette: '枯黄 + 灰绿 + 土棕', highlight: '常绿香草依然芬芳，原木与石材质感温暖' },
  ],
};

// ---------------------------------------------------------------------------
// Monthly maintenance guide per species
// ---------------------------------------------------------------------------
const MONTHLY_CARE: Record<string, MonthlyCare[]> = {
  '罗汉松': [
    { month: '1月', task: '防寒保温：根部覆稻草或无纺布，北方需搭保温棚；减少浇水，保持土壤微润。' },
    { month: '2月', task: '检查越冬情况：清除枯叶残枝，观察是否有冻伤枝条并及时修剪。' },
    { month: '3月', task: '春季施肥：施一次腐熟有机肥（饼肥或鸡粪），促进春梢萌发。' },
    { month: '4月', task: '摘芽控型：新芽长至3-5cm时摘除过长芽头，保持造型紧凑。' },
    { month: '5月', task: '病虫防治：喷洒石硫合剂预防叶枯病和介壳虫，注意通风。' },
    { month: '6月', task: '夏季修剪：剪除徒长枝和内膛过密枝，改善通风透光。' },
    { month: '7月', task: '高温管理：早晚浇水，中午遮荫40%，叶面喷雾降温。' },
    { month: '8月', task: '追施薄肥：施一次稀释液肥（N:P:K=15:15:15），促进秋梢健壮。' },
    { month: '9月', task: '秋季整形：对造型枝进行蟠扎调整，固定来年观赏形态。' },
    { month: '10月', task: '控水准备越冬：逐渐减少浇水频率，施一次磷钾肥增强抗寒力。' },
    { month: '11月', task: '清园防病：清除落叶杂草，喷一次广谱杀菌剂。' },
    { month: '12月', task: '越冬管理：停止施肥，保持土壤偏干，检查防寒措施是否到位。' },
  ],
  '黑松': [
    { month: '1月', task: '防寒巡查：检查根部覆盖物，避免土壤冰冻伤根。' },
    { month: '2月', task: '盘点枝条：标记需要春季修剪的枯枝与弱枝。' },
    { month: '3月', task: '春肥催芽：施缓释复合肥一次，促进松针萌发。' },
    { month: '4月', task: '摘松烛（切芽）：新芽（松烛）长至2/3时掐除顶端，控制节间距。' },
    { month: '5月', task: '二次摘芽：对过旺枝条进行二次摘芽，保证树冠匀称。' },
    { month: '6月', task: '拔老叶：拔除前年老针叶，保持内膛通透、减少病害。' },
    { month: '7月', task: '防治松毛虫：巡查虫害，必要时喷施生物农药（苏云金杆菌）。' },
    { month: '8月', task: '高温浇水：保证土壤湿润但不积水，叶面喷雾防灼伤。' },
    { month: '9月', task: '秋季蟠扎：利用枝条柔韧期进行造型调整与铝丝绑扎。' },
    { month: '10月', task: '施越冬肥：追施一次骨粉+草木灰，增强树势过冬。' },
    { month: '11月', task: '涂白防冻：树干涂白防日灼与冻裂，清理树下落针。' },
    { month: '12月', task: '休眠期管理：控水停肥，保持防寒设施完好。' },
  ],
  '五针松': [
    { month: '1月', task: '避风防寒：置于避风向阳处，盆栽可入冷室越冬。' },
    { month: '2月', task: '检查嫁接口：观察嫁接五针松接口愈合情况，必要时重新绑缚。' },
    { month: '3月', task: '换盆或松土：盆栽3年一换盆，地栽松表层土改善透气性。' },
    { month: '4月', task: '轻度摘芽：五针松生长慢，仅摘除过长新芽的1/3即可。' },
    { month: '5月', task: '通风防锈病：确保周围通风良好，喷三唑酮预防锈病。' },
    { month: '6月', task: '遮荫50%：五针松忌强光暴晒，搭遮阳网保护针叶。' },
    { month: '7月', task: '控温控水：高温期浇水见干见湿，严禁积水导致烂根。' },
    { month: '8月', task: '薄肥勤施：每半月施一次稀薄饼肥水（1:15稀释）。' },
    { month: '9月', task: '整理针叶：疏除过密的老叶束，保持姿态疏朗。' },
    { month: '10月', task: '施磷钾肥：增强越冬抗性，叶面喷施磷酸二氢钾。' },
    { month: '11月', task: '减水入冬：逐步降低浇水量，保持根部微润。' },
    { month: '12月', task: '冬季观赏：五针松冬态极美，注意防寒风直吹。' },
  ],
  '紫薇': [
    { month: '1月', task: '重剪整形：落叶后进行强剪，保留主枝骨架，短截至芽眼上方1cm。' },
    { month: '2月', task: '刮老皮：刮除主干老翘皮，露出光滑新皮，同时消灭越冬虫卵。' },
    { month: '3月', task: '萌芽肥：施速效氮肥+有机肥，促春梢粗壮萌发。' },
    { month: '4月', task: '抹芽定枝：抹除多余萌蘖芽，每枝保留2-3个壮芽。' },
    { month: '5月', task: '防治白粉病和蚜虫：喷施多菌灵+吡虫啉混合液。' },
    { month: '6月', task: '花前追肥：施磷钾肥促进花芽分化，期待盛夏繁花。' },
    { month: '7月', task: '盛花管理：花开后及时摘除残花序，促进二次开花。' },
    { month: '8月', task: '二次花期：继续追肥浇水，紫薇可持续开花至秋初。' },
    { month: '9月', task: '减肥控长：停止氮肥，促进枝条木质化以便越冬。' },
    { month: '10月', task: '秋叶观赏：紫薇秋叶变色可观赏，自然落叶不必干预。' },
    { month: '11月', task: '清园涂白：清理落叶，树干涂白防冻害与日灼。' },
    { month: '12月', task: '休眠越冬：无需特别管理，可规划来年修剪方案。' },
  ],
  '白蜡': [
    { month: '1月', task: '冬季修剪：疏除交叉枝、病枝，保持通透冠形。' },
    { month: '2月', task: '刷白防虫：树干刷石灰水防越冬害虫，检查主干伤口。' },
    { month: '3月', task: '春季追肥：穴施复合肥（每株300-500g），浇透水促根。' },
    { month: '4月', task: '萌芽管理：清除根际萌蘖，保持单干或预定冠形。' },
    { month: '5月', task: '防治天牛：巡查树干有无蛀孔与木屑，发现及时药杀。' },
    { month: '6月', task: '夏季摘心：对徒长枝摘心控制高度，促发侧枝丰满冠幅。' },
    { month: '7月', task: '深层浇水：高温期每周深浇1-2次，保持根层湿润。' },
    { month: '8月', task: '叶面追肥：喷施0.3%尿素+磷酸二氢钾，叶色更浓绿。' },
    { month: '9月', task: '秋色预告：白蜡秋叶金黄，减少氮肥促进变色。' },
    { month: '10月', task: '施越冬基肥：开沟施有机肥（腐熟鸡粪10kg/株）。' },
    { month: '11月', task: '落叶清理：及时清扫落叶防病菌越冬。' },
    { month: '12月', task: '防寒措施：幼树裹草绳，根部覆盖落叶层保温。' },
  ],
  '榆树': [
    { month: '1月', task: '冬剪定型：重剪造型枝，榆树耐修剪可大胆操作。' },
    { month: '2月', task: '防榆叶甲越冬成虫：树干绑草把诱杀。' },
    { month: '3月', task: '春肥催芽：施饼肥+复合肥，榆树萌芽力极强。' },
    { month: '4月', task: '摘芽控型：频繁摘除过长新梢，保持紧凑云片型。' },
    { month: '5月', task: '打叶促密：适当摘除大叶，促生小而密的新叶。' },
    { month: '6月', task: '夏剪疏枝：剪除内膛密枝，防止郁闭引发病害。' },
    { month: '7月', task: '正常浇水施肥：保持水肥充足，榆树生长旺盛期。' },
    { month: '8月', task: '二次摘叶（可选）：追求小叶效果可再次摘叶促新芽。' },
    { month: '9月', task: '造型微调：蟠扎或修剪调整秋冬观赏形态。' },
    { month: '10月', task: '施越冬肥：控氮增磷钾，促进枝条充实。' },
    { month: '11月', task: '落叶后清园：清理落叶与枯枝，喷石硫合剂封园。' },
    { month: '12月', task: '欣赏冬态：榆树枝干遒劲，冬季骨架美尤为出色。' },
  ],
  '红花檵木': [
    { month: '1月', task: '防寒管理：根部覆草保温，北方需入棚越冬。' },
    { month: '2月', task: '修剪整形：花前轻剪，保留花芽枝条。' },
    { month: '3月', task: '花期来临：红花檵木3月下旬始花，追施磷肥促花。' },
    { month: '4月', task: '盛花期：满树红花极为壮观，花后及时修剪残花枝。' },
    { month: '5月', task: '花后追肥：施复合肥恢复树势，促进新叶生长。' },
    { month: '6月', task: '夏季修剪：保持球形或造型外轮廓的圆整度。' },
    { month: '7月', task: '浇水遮荫：高温期注意补水，避免叶片灼伤失色。' },
    { month: '8月', task: '防治角斑病：喷施代森锰锌预防叶部病害。' },
    { month: '9月', task: '秋梢管理：适当摘心控秋梢，防止冬季冻伤嫩枝。' },
    { month: '10月', task: '叶色观赏：秋季叶色转深红，施磷钾肥增色。' },
    { month: '11月', task: '清园工作：清理落叶，检查病虫残体。' },
    { month: '12月', task: '越冬准备：北方务必防寒，南方无需特别处理。' },
  ],
  '黄杨': [
    { month: '1月', task: '防寒防风：覆盖防寒布，避免冬季冷风导致叶片焦枯。' },
    { month: '2月', task: '检查状态：观察有无冻害枝条，标记待修剪部位。' },
    { month: '3月', task: '春季修剪：整形修剪，黄杨耐剪可精细造型。' },
    { month: '4月', task: '施春肥：追施复合肥+有机肥，促进萌发新叶。' },
    { month: '5月', task: '二次修剪：保持几何造型的锐利边缘。' },
    { month: '6月', task: '防治黄杨绢螟：幼虫期喷施高效氯氟氰菊酯。' },
    { month: '7月', task: '高温管理：适当遮荫，叶面喷水降温保湿。' },
    { month: '8月', task: '追肥一次：薄施液肥维持叶色浓绿。' },
    { month: '9月', task: '秋季整形：入冬前最后一次精修造型。' },
    { month: '10月', task: '施越冬肥：磷钾肥为主增强抗性。' },
    { month: '11月', task: '冬季观赏：黄杨常绿，冬季仍有良好景观效果。' },
    { month: '12月', task: '巡查越冬：确保防寒措施到位，及时补修。' },
  ],
  '大阪松': [
    { month: '1月', task: '冷室越冬：盆栽入冷室（0-5°C），地栽覆膜防寒。' },
    { month: '2月', task: '观察芽动：大阪松萌芽较早，提前准备摘芽工具。' },
    { month: '3月', task: '春季换盆：每2-3年换盆一次，修剪老根促新根。' },
    { month: '4月', task: '摘松烛：新芽伸展时摘除1/2-2/3，控制节间。' },
    { month: '5月', task: '二次摘芽调整：强枝多摘、弱枝少摘，均衡树势。' },
    { month: '6月', task: '遮荫防晒：大阪松忌强光，遮荫50%以上。' },
    { month: '7月', task: '控水防涝：高温多雨季注意排水，宁干勿湿。' },
    { month: '8月', task: '薄肥养护：施稀释饼肥水，促进针叶短密。' },
    { month: '9月', task: '拔老叶整理：疏除老针叶，改善通风透光。' },
    { month: '10月', task: '秋季观赏：大阪松针叶呈蓝绿色，秋季最为漂亮。' },
    { month: '11月', task: '减水准备入冬：控制浇水，促进休眠。' },
    { month: '12月', task: '越冬管理：防寒风直吹，保持低温休眠状态。' },
  ],
  '枸骨': [
    { month: '1月', task: '挂果观赏：枸骨冬季红果满枝，观赏价值极高。' },
    { month: '2月', task: '修剪整形：果后修剪，疏除过密枝与枯枝。' },
    { month: '3月', task: '春季施肥：施有机肥+复合肥促新梢生长。' },
    { month: '4月', task: '花期管理：枸骨4月开小花，保持水分充足助坐果。' },
    { month: '5月', task: '疏花疏果：适当疏除过密花序，保证果实品质。' },
    { month: '6月', task: '夏季修剪：轻剪保持冠形圆整，勿重剪影响挂果。' },
    { month: '7月', task: '正常水肥管理：保持土壤湿润，追施磷钾肥。' },
    { month: '8月', task: '果实膨大期：增施钾肥促果实着色与膨大。' },
    { month: '9月', task: '果实转色：枸骨果由绿转红，减少氮肥。' },
    { month: '10月', task: '红果初显：秋季枸骨红果配绿叶，极具节庆感。' },
    { month: '11月', task: '观果佳期：红果挂枝可持续至翌年2月。' },
    { month: '12月', task: '防鸟护果：必要时挂防鸟网保护观赏效果。' },
  ],
};

// Fallback for species without specific care guide
const DEFAULT_MONTHLY_CARE: MonthlyCare[] = [
  { month: '1月', task: '防寒保温：根部覆盖保温材料，减少浇水频率。' },
  { month: '2月', task: '越冬检查：巡查冻害情况，标记需修剪枝条。' },
  { month: '3月', task: '春季施肥：施有机底肥与复合追肥，浇透返青水。' },
  { month: '4月', task: '萌芽管理：疏除弱芽多余芽，保留强壮枝条。' },
  { month: '5月', task: '病虫害预防：喷施广谱杀虫杀菌剂，定期巡查。' },
  { month: '6月', task: '夏季修剪：疏除过密枝与徒长枝，保持通风透光。' },
  { month: '7月', task: '高温管理：充分浇水，适当遮荫，叶面喷雾降温。' },
  { month: '8月', task: '追施薄肥：液肥追施一次维持生长势，注意排水防涝。' },
  { month: '9月', task: '秋季整形：最后一次修剪定型，准备越冬。' },
  { month: '10月', task: '施越冬基肥：以磷钾肥为主，增强抗寒能力。' },
  { month: '11月', task: '清园工作：清理落叶枯枝，喷药封园。' },
  { month: '12月', task: '越冬管理：停止施肥，保持土壤偏干，做好防寒。' },
];

// ---------------------------------------------------------------------------
// Effect description templates per style (season-by-season vivid prose)
// ---------------------------------------------------------------------------
const EFFECT_DESCRIPTIONS: Record<string, (treeNames: string, area: number | null) => string> = {
  modern: (treeNames, area) => {
    const areaNote = area ? `在${area}平方米的空间中，` : '';
    return `${areaNote}这座现代简约庭院将呈现四季分明的极致美感——

【春】万物复苏之际，${treeNames}抽出嫩绿新叶，与白色砾石铺面形成清新明快的对比。镜面水景映出初春的蓝天白云，几何线条的步道引导您缓步入园。

【夏】浓密的树冠撑起一片清凉绿荫，光影透过叶隙在清水混凝土景墙上投下斑驳光影。夜幕降临，隐藏式地灯亮起，${treeNames}的轮廓在暖光中如同雕塑般矗立。

【秋】观赏草穗由绿转金，在秋风中轻轻摇曳。落叶点缀在黑色卵石间，Corten钢板的锈色与秋叶交相辉映，整座庭院笼罩在温暖的琥珀色调中。

【冬】${treeNames}苍翠依旧，在银白霜冻中愈显坚韧。简约的景观结构在冬日低角度阳光下呈现出最纯粹的光影之美，宛如一幅黑白分明的建筑摄影。`;
  },
  chinese: (treeNames, area) => {
    const areaNote = area ? `在${area}平方米的天地间，` : '';
    return `${areaNote}这座新中式庭院将营造出"虽由人作，宛自天开"的诗意境界——

【春】桃花灼灼、柳色初匀，${treeNames}在春雨润泽下焕发新绿。池中锦鲤欢跃，假山石缝间的兰草悄然吐蕊，一派"春色满园关不住"的盎然生机。

【夏】浓荫蔽日、翠竹摇风，${treeNames}撑起一方清凉世界。午后于四角亭内品茗，听雨打芭蕉，看荷叶田田，恍若置身宋人画卷之中。

【秋】桂花飘香十里、红枫燃尽层林，${treeNames}在金色阳光下投下斑驳的影子。青石小径上铺满落叶，石桌上一壶新茶、几卷闲书，尽享"采菊东篱下"的悠然。

【冬】腊梅傲雪、松柏长青，${treeNames}在白雪映衬下愈显苍劲。晨起推窗，粉墙黛瓦间的一树寒梅"凌寒独自开"，暗香浮动间为新春埋下伏笔。`;
  },
  european: (treeNames, area) => {
    const areaNote = area ? `在${area}平方米的格局中，` : '';
    return `${areaNote}这座欧式古典庭院将呈现大气磅礴的贵族风范——

【春】石雕喷泉在暖阳下重新欢唱，${treeNames}绽放新叶如翡翠华盖。花坛中月季初绽、紫藤垂花，铁艺凉亭被攀缘花卉簇拥，空气中弥漫着花香与泉水的清新。

【夏】${treeNames}提供了大片林荫，薰衣草与紫薇同期盛放，将整座花园染成梦幻的紫色调。夏夜的烛光晚餐在花廊下进行，月光与花影交织出最浪漫的场景。

【秋】${treeNames}换上金黄与橙红的盛装，落叶如金币般铺满砾石小径。月季迎来秋花盛放，喷泉水面漂浮着几片枫叶，整座庭院仿佛一幅莫奈的油画。

【冬】常绿黄杨球如忠诚的卫士守望花园，石雕在薄霜中更显古典气韵。冬日斜阳穿过光秃的${treeNames}枝桠，在地面投下精美的蕾丝般的投影。`;
  },
  japanese: (treeNames, area) => {
    const areaNote = area ? `在${area}平方米的方寸之间，` : '';
    return `${areaNote}这座日式禅意庭院将呈现"一花一世界"的深邃意境——

【春】${treeNames}萌出翠绿新芽，苔藓在春雨中愈发碧绿如绒。蹲踞中的竹筒"鹿威"一声清响，几片花瓣飘入白砂纹理，春的气息在寂静中悄然弥漫。

【夏】${treeNames}浓荫如墨，白砂上的耙纹在斑驳日光下如同真实的水波。蕨类在石组阴影中舒展叶片，缘侧上一杯冷抹茶、一卷经文，暑气全消。

【秋】红枫点燃了庭院最浓烈的色彩，${treeNames}在红叶的映衬下更显苍古。落叶散布于白砂间不必清扫——这正是"侘寂"美学的真谛，残缺中蕴含圆满。

【冬】${treeNames}披上薄雪，枝干的骨架之美在冬日最为动人。枯山水在雪白天地间褪去一切色彩，只剩石与砂的永恒对话——此刻的空灵，便是禅的本意。`;
  },
  tuscan: (treeNames, area) => {
    const areaNote = area ? `在${area}平方米的田园中，` : '';
    return `${areaNote}这座托斯卡纳田园庭院将带来欧洲乡间的悠然诗意——

【春】蔷薇爬满木质拱门绽放出粉白花朵，${treeNames}在温暖春风中舒展新叶。薰衣草与迷迭香开始抽穗，空气中混合着花草的芬芳与泥土的清香，处处生机盎然。

【夏】${treeNames}的巨大树冠投下一片凉爽绿荫，紫藤花廊下的原木长桌摆满了新鲜水果与葡萄酒。蝉鸣声中，波斯菊与向日葵争相绽放，将花园变成一片热烈的色彩海洋。

【秋】${treeNames}的叶片镀上金色，石榴裂开红色果实。藤蔓在原木围栏上变成了琥珀色，户外壁炉升起袅袅炊烟，在微凉的秋风中享受一顿丰盛的乡村晚餐。

【冬】常绿香草依然散发芬芳，枯藤老树在冬日暖阳下别有一番质朴美感。${treeNames}的冬态骨架配合原木与石材的暖色调，让人即使在寒冬也能感受到生活的温度。`;
  },
};

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------
interface ZonePlan {
  zone: string;
  areaRatio: number;
  description: string;
}

interface PlantLayer {
  layer: string;
  height: string;
  plants: string;
  role: string;
}

interface SeasonalColor {
  season: string;
  palette: string;
  highlight: string;
}

interface MonthlyCare {
  month: string;
  task: string;
}

interface BudgetBreakdown {
  treeCost: number;
  treeCostDetail: Array<{ name: string; price: number; quantity: number }>;
  landscapingCost: number;
  laborCost: number;
  maintenanceFirstYear: number;
  total: number;
  budgetNote: string;
}

interface DesignProposal {
  zonePlanning: ZonePlan[];
  plantLayering: PlantLayer[];
  seasonalColors: SeasonalColor[];
}

interface MaintenancePlanEntry {
  treeName: string;
  species: string;
  schedule: MonthlyCare[];
}

interface AnalysisResult {
  recommendedStyles: Array<{
    styleId: string;
    name: string;
    type: string;
    image: string;
    description: string;
    matchScore: number;
    reason: string;
  }>;
  recommendedTrees: Array<{
    treeId: string;
    name: string;
    species: string;
    coverImage: string;
    price: number;
    specs: { height: number; crown: number };
    reason: string;
    matchScore: number;
  }>;
  fengshuiTip: string;
  designSummary: string;
  designProposal: DesignProposal;
  budgetBreakdown: BudgetBreakdown;
  effectDescription: string;
  maintenancePlan: MaintenancePlanEntry[];
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Extract area in square meters from message, e.g. "200平", "100㎡", "300平方米" */
function parseArea(message: string): number | null {
  // Patterns: 200平, 200平米, 200平方, 200平方米, 200㎡, 200m2, 200M2
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:平方米|平方|平米|平|㎡|m2)/i,
    /面积\s*[:：]?\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:亩)/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      // If matched "亩", convert to square meters (1亩 ≈ 667㎡)
      if (pattern.source.includes('亩')) {
        return Math.round(value * 667);
      }
      return value;
    }
  }
  return null;
}

/** Extract budget in yuan from message, e.g. "预算10万", "5万元", "预算50000" */
function parseBudget(message: string): number | null {
  const patterns = [
    // "预算10万" / "预算10万元" / "预算10w"
    /预算\s*[:：]?\s*(\d+(?:\.\d+)?)\s*万(?:元|块)?/,
    /(\d+(?:\.\d+)?)\s*万\s*(?:元|块)?\s*(?:预算|的预算)/,
    /预算\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:元|块)/,
    // "预算10万" without 元
    /预算\s*[:：]?\s*(\d+(?:\.\d+)?)\s*[万w]/i,
    // Bare "X万" near budget-related context
    /(?:花|投入|投资|费用|总价|价格)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*万/,
    // Just "X万元"
    /(\d+(?:\.\d+)?)\s*万元/,
    // Plain number after 预算 (treated as yuan)
    /预算\s*[:：]?\s*(\d{4,})/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      // Heuristic: if value < 1000, it's probably in 万
      if (pattern.source.includes('万') || pattern.source.includes('w')) {
        return value * 10000;
      }
      return value;
    }
  }

  // Final fallback: "预算" followed by a number
  const fallback = message.match(/预算\s*[:：]?\s*(\d+(?:\.\d+)?)/);
  if (fallback) {
    const val = parseFloat(fallback[1]);
    // If less than 500, probably means 万
    if (val < 500) return val * 10000;
    return val;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core analysis function
// ---------------------------------------------------------------------------

/**
 * Analyze garden based on user message and optional photo.
 * Uses smart keyword matching + database data to produce a comprehensive
 * design proposal with budget breakdown, seasonal effects, and care plans.
 */
export async function analyzeGarden(
  message: string,
  photoUrls?: string[],
): Promise<AnalysisResult> {
  // 1. Fetch all styles and available trees from DB
  const [styles, trees] = await Promise.all([
    GardenStyle.find().lean(),
    Tree.find({ status: 'available' }).lean(),
  ]);

  // 2. Parse user intent
  const area = parseArea(message);
  const budget = parseBudget(message);

  // 3. Determine style preferences from message
  const styleScores = computeStyleScores(message);

  // 4. Sort styles by match score
  const rankedStyles = styles
    .map((style) => {
      const score = styleScores[style.type] || 0;
      const baseScore = Math.max(score, 15);
      return {
        styleId: style.styleId,
        name: style.name,
        type: style.type,
        image: style.image || '',
        description: style.description,
        matchScore: Math.min(baseScore, 98),
        reason: getStyleReason(style.type, score > 30),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  // 5. Get top style for tree matching
  const topStyleType = rankedStyles[0]?.type || 'chinese';

  // 6. Rank trees by style affinity + budget awareness
  const rankedTrees = trees
    .map((tree) => {
      const affinityStyles = TREE_STYLE_AFFINITY[tree.species] || [];
      const styleIndex = affinityStyles.indexOf(topStyleType);
      let matchScore = styleIndex >= 0 ? 90 - styleIndex * 15 : 30;

      // Boost based on message keywords matching tree species
      if (message.includes(tree.species) || message.includes(tree.name)) {
        matchScore = 95;
      }

      // Budget-aware adjustment: if budget is tight, prefer affordable trees
      if (budget && tree.price.sale > budget * 0.4) {
        matchScore -= 10;
      }

      return {
        treeId: tree.treeId,
        name: tree.name,
        species: tree.species,
        coverImage: tree.coverImage || '',
        price: tree.price.sale,
        specs: { height: tree.specs.height, crown: tree.specs.crown },
        reason: getTreeReason(tree.species, topStyleType, matchScore > 60),
        matchScore: Math.min(Math.max(matchScore, 10), 98),
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);

  // 7. Build design proposal
  const designProposal = buildDesignProposal(topStyleType, area);

  // 8. Build budget breakdown
  const budgetBreakdown = buildBudgetBreakdown(rankedTrees, budget, area);

  // 9. Generate effect description
  const treeNamesForEffect = rankedTrees.slice(0, 3).map((t) => t.name).join('、');
  const effectFn = EFFECT_DESCRIPTIONS[topStyleType] || EFFECT_DESCRIPTIONS.chinese;
  const effectDescription = effectFn(treeNamesForEffect, area);

  // 10. Build maintenance plan for top 3 trees
  const maintenancePlan = buildMaintenancePlan(rankedTrees.slice(0, 3));

  // 11. Design summary
  const topStyle = rankedStyles[0];
  const designSummary = generateDesignSummary(
    topStyle?.name || '中式',
    rankedTrees,
    message,
    !!photoUrls?.length,
    area,
    budget,
  );

  return {
    recommendedStyles: rankedStyles.slice(0, 3),
    recommendedTrees: rankedTrees,
    fengshuiTip: FENGSHUI_TIPS[topStyleType] || FENGSHUI_TIPS.chinese,
    designSummary,
    designProposal,
    budgetBreakdown,
    effectDescription,
    maintenancePlan,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function computeStyleScores(message: string): Record<string, number> {
  const scores: Record<string, number> = {};
  const lowerMsg = message.toLowerCase();

  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    let score = 10;
    for (const kw of keywords) {
      if (lowerMsg.includes(kw)) {
        score += 25;
      }
    }
    if (
      (lowerMsg.includes('豪华') || lowerMsg.includes('高端') || lowerMsg.includes('别墅')) &&
      (style === 'european' || style === 'chinese')
    ) {
      score += 15;
    }
    if (
      (lowerMsg.includes('小院') || lowerMsg.includes('阳台') || lowerMsg.includes('露台')) &&
      (style === 'japanese' || style === 'modern')
    ) {
      score += 15;
    }
    if (
      (lowerMsg.includes('花园') || lowerMsg.includes('草地') || lowerMsg.includes('鲜花')) &&
      style === 'tuscan'
    ) {
      score += 15;
    }
    // Area-based hints
    if (lowerMsg.includes('大') && (style === 'european' || style === 'chinese')) {
      score += 5;
    }
    if (lowerMsg.includes('小') && (style === 'japanese' || style === 'modern')) {
      score += 5;
    }
    scores[style] = Math.min(score, 98);
  }

  // If no strong signal, boost chinese as default
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore <= 25) {
    scores['chinese'] = (scores['chinese'] || 0) + 30;
  }

  return scores;
}

function getStyleReason(styleType: string, isHighMatch: boolean): string {
  const reasons: Record<string, [string, string]> = {
    modern: ['您的需求完美契合现代简约风格，线条利落、空间通透', '现代简约风格适合追求品质生活的业主'],
    chinese: ['根据您的描述，新中式风格最能体现东方意境与文化底蕴', '新中式风格融合传统韵味与现代审美，经久不衰'],
    european: ['您的庭院空间适合欧式古典风格，大气磅礴、尊贵典雅', '欧式风格适合中大型庭院，彰显主人品味'],
    japanese: ['日式禅意风格与您的需求高度匹配，静谧幽深、意境深远', '日式禅意风格适合注重内心宁静的业主'],
    tuscan: ['田园托斯卡纳风格贴合您的自然生活理念', '田园风格亲近自然，适合享受惬意时光'],
  };
  const [high, low] = reasons[styleType] || ['推荐此风格', '此风格值得考虑'];
  return isHighMatch ? high : low;
}

function getTreeReason(species: string, topStyle: string, isGoodMatch: boolean): string {
  if (isGoodMatch) {
    return `${species}是${getStyleName(topStyle)}庭院的经典树种，造型优美、寓意吉祥`;
  }
  return `${species}可作为庭院点缀，增添层次与趣味`;
}

function getStyleName(type: string): string {
  const names: Record<string, string> = {
    modern: '现代简约',
    chinese: '新中式',
    european: '欧式古典',
    japanese: '日式禅意',
    tuscan: '田园',
  };
  return names[type] || type;
}

function buildDesignProposal(styleType: string, area: number | null): DesignProposal {
  const zones = ZONE_TEMPLATES[styleType] || ZONE_TEMPLATES.chinese;
  const layers = PLANT_LAYERING[styleType] || PLANT_LAYERING.chinese;
  const colors = SEASONAL_COLORS[styleType] || SEASONAL_COLORS.chinese;

  // If area is known, add concrete square-meter values to zone descriptions
  const zonePlanning = zones.map((z) => {
    if (area) {
      const zoneArea = Math.round(area * z.areaRatio);
      return {
        ...z,
        description: `【约${zoneArea}㎡】${z.description}`,
      };
    }
    return { ...z };
  });

  return {
    zonePlanning,
    plantLayering: layers,
    seasonalColors: colors,
  };
}

function buildBudgetBreakdown(
  trees: Array<{ name: string; species: string; price: number }>,
  userBudget: number | null,
  area: number | null,
): BudgetBreakdown {
  // Calculate tree cost: recommend 1 of each top tree
  const treeCostDetail = trees.slice(0, 3).map((t) => ({
    name: t.name,
    price: t.price,
    quantity: 1,
  }));

  const treeCost = treeCostDetail.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Landscaping: hardscape + softscape (estimate 30% of tree cost, min 5000)
  const landscapingCost = Math.max(Math.round(treeCost * 0.3), 5000);

  // Labor: 15% of (trees + landscaping)
  const laborCost = Math.round((treeCost + landscapingCost) * 0.15);

  // First year maintenance: 8% of total installation cost
  const installBase = treeCost + landscapingCost + laborCost;
  const maintenanceFirstYear = Math.round(installBase * 0.08);

  const total = treeCost + landscapingCost + laborCost + maintenanceFirstYear;

  // Budget note
  let budgetNote: string;
  if (userBudget) {
    const diff = userBudget - total;
    if (diff >= 0) {
      const remaining = Math.round(diff);
      budgetNote =
        remaining > 1000
          ? `您的预算${formatCurrency(userBudget)}充裕，估算总费用${formatCurrency(total)}，剩余${formatCurrency(remaining)}可用于增购景观小品、灯光系统或智能灌溉设备。`
          : `您的预算${formatCurrency(userBudget)}与估算总费用${formatCurrency(total)}基本吻合，方案可直接执行。`;
    } else {
      const overBudget = Math.round(-diff);
      budgetNote = `估算总费用${formatCurrency(total)}略超您的预算${formatCurrency(userBudget)}约${formatCurrency(overBudget)}。建议方案：可选择较小规格的主景树以降低树木成本，或分期施工——先完成主景区与入口区，休憩区与步道后续追加。`;
    }
  } else {
    budgetNote = `以上为基于推荐树种的初步估算（总计${formatCurrency(total)}），实际费用将根据场地条件、树木规格选择与施工复杂度调整。建议预留10-15%的弹性预算应对不可预见项。`;
  }

  return {
    treeCost,
    treeCostDetail,
    landscapingCost,
    laborCost,
    maintenanceFirstYear,
    total,
    budgetNote,
  };
}

function buildMaintenancePlan(
  trees: Array<{ name: string; species: string }>,
): MaintenancePlanEntry[] {
  return trees.map((tree) => ({
    treeName: tree.name,
    species: tree.species,
    schedule: MONTHLY_CARE[tree.species] || DEFAULT_MONTHLY_CARE,
  }));
}

function generateDesignSummary(
  styleName: string,
  trees: Array<{ name: string; species: string }>,
  message: string,
  hasPhoto: boolean,
  area: number | null,
  budget: number | null,
): string {
  const treeNames = trees.slice(0, 3).map((t) => t.name).join('、');

  const photoNote = hasPhoto
    ? '根据您上传的庭院照片和需求描述，AI已为您智能分析并生成专属设计方案。'
    : '根据您的需求描述，AI已为您智能匹配最佳庭院方案。';

  const areaNote = area ? `庭院面积约${area}㎡，` : '';
  const budgetNote = budget ? `参考预算${formatCurrency(budget)}，` : '';

  return `${photoNote}${areaNote}${budgetNote}推荐采用「${styleName}」风格进行庭院设计，搭配${treeNames}等精品造型树木，打造独一无二的私家花园。方案包含入口区、主景区、休憩区、步道四大功能分区，植物配置兼顾乔木层、灌木层、地被层三重层次，确保四季有景可赏。我们的专业团队将根据您的实际场地条件，提供从选树、设计、施工到首年养护的全流程服务。`;
}

function formatCurrency(amount: number): string {
  if (amount >= 10000) {
    const wan = amount / 10000;
    // Display as integer if it's a round number, otherwise 1 decimal
    const display = wan === Math.floor(wan) ? wan.toString() : wan.toFixed(1);
    return `${display}万元`;
  }
  return `${amount.toLocaleString('zh-CN')}元`;
}

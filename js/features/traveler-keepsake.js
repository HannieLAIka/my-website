/**
 * Traveler's Keepsake data layer.
 *
 * This module intentionally has no UI or chat integration. It stores one
 * versioned keepsake document per active SESSION_ID and exposes a small API
 * for the future Traveler's Keepsake UI. Chapters organize records inside
 * this document; they never create or switch chat sessions.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'travelerKeepsake';
    const CURRENT_VERSION = 6;
    const CHAPTER_COLLECTION = 'chapters';
    const COLLECTION_NAMES = [
        CHAPTER_COLLECTION,
        'eventTemplates',
        'eventCategories',
        'observations',
        'keepsakes',
        'gifts',
        'quotes',
        'chronicles'
    ];
    const RECORD_COLLECTION_NAMES = COLLECTION_NAMES.filter(
        (name) => name !== CHAPTER_COLLECTION
    );
    const SYSTEM_CATEGORIES = [
        ['category_daily', '日常'], ['category_exploration', '探索'],
        ['category_nature', '自然与动物'], ['category_camp', '营地'],
        ['category_accident', '意外'], ['category_conversation', '交谈']
    ];
    const KEYWORD_CATEGORIES = [['location','地点'],['origin','来处'],['person','人物'],['action','行为'],['discovery','发现物'],['encounter','遭遇'],['activity','活动']];
    const SYSTEM_KEYWORDS = {
        location: ['幽暗森林','古老橡树林','林间溪流','山间隘口','荒废神殿','古代遗迹','地下洞窟','废弃矿井','村庄集市','边境驿站'],
        origin: ['深林深处','山脉另一侧','远方村庄','古代遗迹','地底世界','旅行商人的货箱','失落王国','德鲁伊结社','冒险者公会','古老图书馆'],
        person: ['迷路的旅行者','年迈的德鲁伊','年轻的游侠','精灵猎人','矮人工匠','半身人商贩','流浪吟游诗人','隐居的草药师','神秘的朝圣者','受伤的冒险者'],
        action: ['采集草药','寻找水源','修补装备','搭建营地','追踪动物','观察足迹','辨认植物','阅读古代铭文','探索遗迹','整理行囊'],
        discovery: ['稀有草药','发光苔藓','古代金币','破损的护符','精灵工艺品','矮人符文石','古老地图残片','未知生物的羽毛','奇异矿石','魔法水晶'],
        encounter: ['一只受伤的鹿','一群迁徙的鸟','一只好奇的狐狸','一头野猪','一群林地精怪','一只迷路的幼兽','一位迷路的旅人','突然出现的浓雾','意外的暴雨','倒塌的古树'],
        activity: ['共同采集草药','在溪边休息','分享旅行故事','围坐篝火','整理旅行物资','观察星空','制作旅行纪念品','烹饪晚餐','练习狩猎技巧','研究古代地图']
    };
    const TEMPLATE_PLACEHOLDERS = ['人物','人物A','人物B','地点','来处','做了什么','发现物','遭遇','活动'];
    const SYSTEM_COMPOSITION_TEMPLATES = [
        { id:'composition_system_encounter', title:'旅途遭遇', content:'{人物}在{地点}{做了什么}。' },
        { id:'composition_system_guest', title:'远方来客', content:'来自{来处}的{人物}出现在{地点}。' },
        { id:'composition_system_discovery', title:'偶然发现', content:'{人物}在{地点}发现了{发现物}。' },
        { id:'composition_system_accident', title:'意外插曲', content:'当{人物}经过{地点}时，遭遇了{遭遇}。' },
        { id:'composition_system_activity', title:'共同活动', content:'{人物A}和{人物B}在{地点}{活动}。' },
        { id:'composition_system_mishap', title:'旅途中的意外', content:'{人物}原本打算在{地点}{做了什么}，却意外遇到了{遭遇}。'},
        { id:'composition_system_weather', title:'天气转变', content:'{人物}在{地点}{做了什么}时，天色忽然变得与刚才不同。'},
        { id:'composition_system_animal_sign', title:'动物的指引', content:'{人物}在{地点}观察到{遭遇}留下的奇特痕迹。'},
        { id:'composition_system_found_letter', title:'旧信的来处', content:'{人物}在{地点}发现了来自{来处}的{发现物}。'},
        { id:'composition_system_market_trade', title:'集市小交易', content:'来自{来处}的{人物}在{地点}展示了一件有趣的{发现物}。'},
        { id:'composition_system_camp_recipe', title:'营地新菜谱', content:'{人物A}和{人物B}在{地点}{活动}，并为晚餐想出了一种新做法。'},
        { id:'composition_system_road_block', title:'道路受阻', content:'当{人物}经过{地点}时，{遭遇}挡住了原本的道路。'},
        { id:'composition_system_symbol', title:'陌生符号', content:'{人物}在{地点}发现{发现物}，上面刻着一枚无法辨认的符号。'},
        { id:'composition_system_rest', title:'短暂歇息', content:'{人物A}和{人物B}在{地点}{活动}，让脚步重新恢复轻快。'},
        { id:'composition_system_distant_voice', title:'远处的声音', content:'{人物}在{地点}{做了什么}时，听见了来自远方的动静。'},
        { id:'composition_system_herbal_hint', title:'草药的线索', content:'{人物}在{地点}辨认出{发现物}，想起了关于它的旧传闻。'},
        { id:'composition_system_guest_question', title:'旅人的问题', content:'来自{来处}的{人物}在{地点}向旅人询问一条道路。'},
        { id:'composition_system_night_watch', title:'夜色观察', content:'{人物}在{地点}{做了什么}时，发现夜空中有一颗星星异常明亮。'},
        { id:'composition_system_shared_task', title:'并肩劳作', content:'{人物A}与{人物B}在{地点}{活动}，很快让营地变得井然有序。'},
        { id:'composition_system_mysterious_box', title:'没有锁孔的盒子', content:'{人物}在{地点}找到一个来自{来处}的盒子，却找不到打开它的方法。'},
        { id:'composition_system_rain_shelter', title:'雨中的避所', content:'{人物}在{地点}躲避{遭遇}，意外发现墙角有新鲜的火种。'},
        { id:'composition_system_tales', title:'交换传闻', content:'{人物A}和{人物B}在{地点}{活动}时，交换了各自听过的奇闻。'},
        { id:'composition_system_old_route', title:'旧路重现', content:'{人物}在{地点}阅读{发现物}，从中辨认出一条被遗忘的路线。'},
        { id:'composition_system_small_mistake', title:'小小失误', content:'{人物}在{地点}{做了什么}时出了一个小差错，却因此发现了新的线索。'},
        { id:'composition_system_friendly_challenge', title:'旅途比试', content:'{人物A}和{人物B}在{地点}进行一场轻松的{活动}。'},
        { id:'composition_system_returning_trader', title:'熟悉的商队', content:'来自{来处}的{人物}再次出现在{地点}，带来了上次提到的{发现物}。'},
        { id:'composition_system_hidden_shelter', title:'隐蔽的休息处', content:'{人物}在{地点}{做了什么}时，发现了一处适合避风的角落。'},
        { id:'composition_system_odd_tracks', title:'奇怪的足迹', content:'{人物}在{地点}追踪{遭遇}留下的足迹，却在途中发现它们突然消失。'},
        { id:'composition_system_memory', title:'旧日回忆', content:'{人物A}和{人物B}在{地点}{活动}时，谈起一件已经被时间掩埋的小事。'},
        { id:'composition_system_camp_morning', title:'营地晨光', content:'{人物}在{地点}醒来后，发现{遭遇}让清晨变得格外热闹。'},
        { id:'composition_system_trader_news', title:'商队带来的消息', content:'来自{来处}的{人物}在{地点}分享了一则关于远方的消息。'},
        { id:'composition_system_ruin_mark', title:'遗迹中的标记', content:'{人物}在{地点}{做了什么}时，看见墙上留下了指向{发现物}的古老标记。'},
        { id:'composition_system_river_crossing', title:'河谷渡口', content:'{人物A}和{人物B}在{地点}遇见{遭遇}，只好一起寻找安全的渡路。'},
        { id:'composition_system_starlit_rest', title:'星光下的休息', content:'{人物A}和{人物B}在{地点}{活动}，谈起了来自{来处}的旧传说。'},
        { id:'composition_system_strange_weather', title:'奇异天气', content:'{人物}在{地点}{做了什么}时，天边忽然出现了不合季节的光。'},
        { id:'composition_system_lost_item', title:'遗失的小物', content:'{人物}在{地点}整理行囊时，发现{发现物}不知何时混进了其中。'},
        { id:'composition_system_old_song', title:'旧歌的线索', content:'来自{来处}的{人物}在{地点}唱起一首歌，歌词里藏着关于{发现物}的线索。'},
        { id:'composition_system_creature_watch', title:'静静观察', content:'{人物}在{地点}观察{遭遇}许久，终于明白它为何总在黄昏时出现。'},
        { id:'composition_system_camp_game', title:'营地里的小游戏', content:'{人物A}和{人物B}在{地点}{活动}，输家负责准备下一顿热饮。'},
        { id:'composition_system_hidden_message', title:'藏在路边的话', content:'{人物}在{地点}发现{发现物}，其中夹着一张来自{来处}的短笺。'},
        { id:'composition_system_helpful_local', title:'当地人的提醒', content:'{人物}在{地点}遇到{人物A}，对方提醒他们留意附近的{遭遇}。'},
        { id:'composition_system_herb_market', title:'草药摊前', content:'来自{来处}的{人物}在{地点}展示了几种草药，并请旅人辨认其中的{发现物}。'},
        { id:'composition_system_foggy_path', title:'雾中的道路', content:'{人物}在{地点}{做了什么}时，浓雾遮住了道路，只留下{遭遇}的声音。'},
        { id:'composition_system_shared_discovery', title:'共同发现', content:'{人物A}和{人物B}在{地点}共同发现了{发现物}，并为它猜测了几种来历。'},
        { id:'composition_system_travel_note', title:'写下旅途札记', content:'{人物}在{地点}{做了什么}，把关于{遭遇}的细节记进了旅途札记。'},
        { id:'composition_system_forgotten_camp', title:'被遗忘的营地', content:'{人物}在{地点}发现一处旧营地，篝火旁还留着来自{来处}的{发现物}。'},
        { id:'composition_system_night_sound', title:'夜半声响', content:'{人物A}和{人物B}在{地点}休息时，听见{遭遇}在黑暗中发出细微的声响。'},
        { id:'composition_system_waystone', title:'路标的方向', content:'{人物}在{地点}读懂一块旧路标，决定沿着它指向的方向寻找{发现物}。'},
        { id:'composition_system_friendly_help', title:'顺手相助', content:'{人物}在{地点}遇见{人物A}，于是停下{做了什么}，帮对方解决了一个小麻烦。'},
        { id:'composition_system_camp_tale', title:'篝火故事', content:'{人物A}和{人物B}在{地点}{活动}，一个来自{来处}的传说被讲了两遍。'},
        { id:'composition_system_moonlit_object', title:'月光下的物件', content:'{人物}在{地点}借着月光发现{发现物}，它的影子指向了一条小路。'},
        { id:'composition_system_unexpected_guest', title:'意外来访', content:'{人物}在{地点}{做了什么}时，{遭遇}忽然来到营地边缘。'},
    ];
    const SYSTEM_TEMPLATES = [
        { id: 'event_system_herb', title: '{角色名}的林间发现', content: '{角色名}在林间发现了一株罕见的草药，决定仔细观察它的生长环境。', participants: 'character', categoryId: 'category_exploration', weight: 'normal', tags: ['森林', '采集'], cooldownDays: 3 },
        { id: 'event_system_campfire', title: '篝火旁的一段闲谈', content: '夜色降临，篝火映亮了营地，也为两人留出一段安静交谈的时光。', participants: 'both', categoryId: 'category_camp', weight: 'common', tags: ['营地', '交谈'], cooldownDays: 1 },
        { id: 'event_system_potato_new_badge', title: '土豆骑士的微型盾牌', content: '在村庄广场的公告板旁，旅人发现一面只有掌心大小的木盾。盾面刻着土豆骑士的徽记，旁边还留着一行歪歪扭扭的誓言。', participants: 'daily', categoryId: 'category_daily', weight: 'normal', tags: ['土豆', '骑士', '村庄'], cooldownDays: 10 },
        { id: 'event_system_potato_herb_garden', title: '土豆骑士的药草园', content: '村外的小药草园里插着一块歪斜的木牌，上面画着土豆骑士的盾徽。园丁说，这位小小的守护者每天都会把被风吹倒的幼苗重新扶好。', participants: 'daily', categoryId: 'category_nature', weight: 'normal', tags: ['土豆', '药草', '村庄'], cooldownDays: 10 },
        { id: 'event_system_potato_market', title: '土豆骑士的集市委托', content: '集市摊主请旅人寻找一枚不见了的铜铃。线索一路指向土豆骑士留下的迷你盾牌，铃声则从一篮刚收成的土豆里传来。', participants: 'both', categoryId: 'category_conversation', weight: 'common', tags: ['土豆', '集市', '委托'], cooldownDays: 10 },
        { id: 'event_system_potato_mushroom', title: '土豆骑士与夜光菌', content: '雨后的树根旁长出一圈淡蓝色夜光菌，旁边立着土豆骑士的徽记。采药人留下纸条提醒：只记录它们的位置，不要在夜里贸然采摘。', participants: 'character', categoryId: 'category_exploration', weight: 'rare', tags: ['土豆', '夜光菌', '森林'], cooldownDays: 12 },
        { id: 'event_system_potato_lost_map', title: '土豆骑士的迷你地图', content: '一张折得整整齐齐的小地图夹在旅店留言簿中，地图角落盖着土豆骑士的印记，标出了溪边一处适合避雨的石棚。', participants: 'user', categoryId: 'category_exploration', weight: 'common', tags: ['土豆', '地图', '旅店'], cooldownDays: 10 },
        { id: 'event_system_cangzhu_new_archive', title: '仓助先生的道路档案', content: '驿站掌柜展示了一册用不同颜色线绳装订的道路档案，每一页都记着仓助先生曾经走过的一段路，以及那段路最可靠的休息地点。', participants: 'daily', categoryId: 'category_exploration', weight: 'rare', tags: ['仓助', '驿站', '道路'], cooldownDays: 14 },
        { id: 'event_system_cangzhu_waystone', title: '仓助先生留下的路标', content: '分岔路口的石柱上刻着仓助先生惯用的记号：水源、避风处和最近的驿站都标得清清楚楚，唯独最短的路线被一枚小小的问号代替。', participants: 'character', categoryId: 'category_exploration', weight: 'normal', tags: ['仓助', '路标', '道路'], cooldownDays: 14 },
        { id: 'event_system_cangzhu_courier', title: '仓助先生的迟到包裹', content: '驿站收到一个迟了几周才抵达的包裹，封口写着仓助先生的名字。里面不是贵重物品，而是一叠附有详细路线的沿途风景速写。', participants: 'daily', categoryId: 'category_daily', weight: 'common', tags: ['仓助', '驿站', '包裹'], cooldownDays: 14 },
        { id: 'event_system_cangzhu_rain_shelter', title: '仓助先生标记的避雨处', content: '骤雨来临时，旅人循着仓助先生画在旧木牌上的箭头找到一处干燥岩棚。棚内还留着一张纸，写明附近溪水上涨时应走的高处小径。', participants: 'both', categoryId: 'category_accident', weight: 'normal', tags: ['仓助', '避雨', '山路'], cooldownDays: 14 },
        { id: 'event_system_cangzhu_tea', title: '仓助先生推荐的茶摊', content: '穿过边境驿站时，摊主认出了旅人手里的路线册，说那是仓助先生留下的版本，并热情推荐了一处只有熟客才知道的山茶摊。', participants: 'user', categoryId: 'category_camp', weight: 'common', tags: ['仓助', '茶摊', '驿站'], cooldownDays: 14 },
        { id: 'event_system_merchant_spice', title: '旅行商队的香料盒', content: '一支旅行商队在路边短暂停留，商人打开一只刻着月桂纹的香料盒，邀请路人辨认其中的气味。', participants: 'daily', categoryId: 'category_daily', weight: 'common', tags: ['商队', '风味'], cooldownDays: 2 },
        { id: 'event_system_tavern_song', title: '酒馆里的无名小调', content: '村口酒馆里，一位吟游诗人唱起关于远方的轻快小调，最后一句歌词似乎是临时为在座旅人写的。', participants: 'daily', categoryId: 'category_daily', weight: 'common', tags: ['酒馆', '吟游诗人'], cooldownDays: 2 },
        { id: 'event_system_village_custom', title: '村庄的月灯习俗', content: '路过的村民邀请旅人参加月灯仪式：每个人都要在灯罩上写下一句希望，再把灯挂到老橡树下。', participants: 'daily', categoryId: 'category_daily', weight: 'normal', tags: ['村庄', '习俗'], cooldownDays: 7 },
        { id: 'event_system_maple_pastry', title: '枫糖烤饼的秘密配方', content: '一位矮人摊主分享了当地烤饼的配方，据说真正的诀窍不是枫糖，而是最后撒上的一撮盐。', participants: 'daily', categoryId: 'category_daily', weight: 'common', tags: ['食物', '矮人'], cooldownDays: 3 },
        { id: 'event_system_stone_road', title: '古道尽头的旧石碑', content: '被藤蔓遮掩的石碑立在古道尽头，上面的符号不像警告，更像是某位旅人留下的方向标记。', participants: 'character', categoryId: 'category_exploration', weight: 'normal', tags: ['古道', '石碑'], cooldownDays: 5 },
        { id: 'event_system_watchtower', title: '废弃哨站的风铃', content: '废弃哨站的屋檐下还挂着一串铜风铃，风吹过时，它们响起与远处溪流相似的节奏。', participants: 'both', categoryId: 'category_exploration', weight: 'rare', tags: ['遗迹', '风铃'], cooldownDays: 10 },
        { id: 'event_system_hidden_path', title: '苔藓指向的小径', content: '一排颜色略深的苔藓沿着树根延伸，指向一条地图上没有标出的平缓小路。', participants: 'user', categoryId: 'category_exploration', weight: 'normal', tags: ['小径', '线索'], cooldownDays: 4 },
        { id: 'event_system_traveler_token', title: '被遗忘的旅行徽记', content: '路旁的石缝里卡着一枚旧旅行徽记，背面刻着日期，却没有留下佩戴者的名字。', participants: 'user', categoryId: 'category_exploration', weight: 'normal', tags: ['遗物', '旅人'], cooldownDays: 6 },
        { id: 'event_system_wounded_fox', title: '受伤的银灰狐狸', content: '林缘传来细碎的脚步声，一只银灰色狐狸停在灌木后，前爪带着伤，却没有立刻逃走。', participants: 'both', categoryId: 'category_nature', weight: 'normal', tags: ['动物', '救助'], cooldownDays: 5 },
        { id: 'event_system_firefly_river', title: '河面上的萤火倒影', content: '入夜后，河面漂着一片萤火的倒影，水流把星光般的亮点带向下游。', participants: 'daily', categoryId: 'category_nature', weight: 'common', tags: ['河流', '萤火'], cooldownDays: 3 },
        { id: 'event_system_dryad_trace', title: '树皮上的新芽纹路', content: '一棵老树的树皮上长出新鲜的银色纹路，形状像某种古老魔法生物留下的脚印。', participants: 'character', categoryId: 'category_nature', weight: 'rare', tags: ['古树', '魔法'], cooldownDays: 12 },
        { id: 'event_system_rainbow_moth', title: '彩翅蛾的短暂造访', content: '一只彩翅蛾落在行囊边缘，翅面映出细小的虹光，片刻后便随着风消失在树冠之间。', participants: 'user', categoryId: 'category_nature', weight: 'rare', tags: ['昆虫', '虹光'], cooldownDays: 10 },
        { id: 'event_system_stew', title: '锅里多出的一把香草', content: '准备晚餐时，锅里凭空多了一把香草，闻起来像松针和柑橘；附近没有人承认自己放的。', participants: 'both', categoryId: 'category_camp', weight: 'common', tags: ['烹饪', '香草'], cooldownDays: 2 },
        { id: 'event_system_repair', title: '装备上的细小裂口', content: '整理装备时发现一处细小裂口，修补它只需要几针，却让行囊重新恢复了可靠的模样。', participants: 'user', categoryId: 'category_camp', weight: 'common', tags: ['装备', '修补'], cooldownDays: 2 },
        { id: 'event_system_watch_star', title: '守夜时的流星', content: '守夜的时刻，一颗流星划过山脊上空，短暂照亮了营地周围的树影。', participants: 'character', categoryId: 'category_camp', weight: 'normal', tags: ['守夜', '星空'], cooldownDays: 6 },
        { id: 'event_system_sleeping_song', title: '梦里的古老旋律', content: '清晨醒来时，营地里有人记得昨夜听见一段旋律，却没人能确定那声音究竟来自梦境还是风中。', participants: 'both', categoryId: 'category_camp', weight: 'rare', tags: ['梦境', '旋律'], cooldownDays: 14 },
        { id: 'event_system_sudden_rain', title: '没有预兆的骤雨', content: '天空忽然落下一阵短促的雨，雨停后，石板路上留下了一串通往林中的湿润脚印。', participants: 'daily', categoryId: 'category_accident', weight: 'common', tags: ['天气', '脚印'], cooldownDays: 2 },
        { id: 'event_system_goat_guest', title: '不请自来的山羊', content: '一只戴着小铜铃的山羊跟了队伍一段路，直到发现一块更香的草地，才郑重地向旅人告别。', participants: 'daily', categoryId: 'category_accident', weight: 'common', tags: ['山羊', '插曲'], cooldownDays: 3 },
        { id: 'event_system_misplaced_key', title: '口袋里的陌生钥匙', content: '整理口袋时发现一把不属于自己的小钥匙，它沾着泥土，钥匙柄上刻着一颗歪斜的星星。', participants: 'user', categoryId: 'category_accident', weight: 'normal', tags: ['钥匙', '谜团'], cooldownDays: 7 },
        { id: 'event_system_blue_flame', title: '古道旁的蓝色火焰', content: '黄昏时，古道边的石碗里亮起一簇不会发热的蓝色火焰，直到月亮升起才悄然熄灭。', participants: 'character', categoryId: 'category_accident', weight: 'rare', tags: ['火焰', '神秘'], cooldownDays: 14 },
        { id: 'event_system_old_adventure', title: '交换一段冒险往事', content: '{角色名}提起一段早已结束的冒险，{我}也分享了自己记得最清楚的一个片段；两段故事在某个细节上意外地重合了。', participants: 'both', categoryId: 'category_conversation', weight: 'normal', tags: ['冒险', '回忆'], cooldownDays: 5 },
        { id: 'event_system_animal_lore', title: '关于动物的冷知识', content: '{角色名}讲起一种只在月光下迁徙的森林动物，{我}认真听完后，决定下次留意林间是否有它们的踪迹。', participants: 'both', categoryId: 'category_conversation', weight: 'common', tags: ['动物', '知识'], cooldownDays: 3 },
        { id: 'event_system_magic_theory', title: '一场关于魔法的争论', content: '路过一座旧神殿时，{角色名}和{我}对门楣上的符号含义产生了不同猜测，直到一阵风让其中一块石片翻了面。', participants: 'both', categoryId: 'category_conversation', weight: 'normal', tags: ['魔法', '神殿'], cooldownDays: 6 },
        { id: 'event_system_druid_advice', title: '德鲁伊的天气建议', content: '一位路过的德鲁伊提醒旅人，山谷里的云影正在改变方向，并顺手分享了一个辨认晴雨的简单方法。', participants: 'daily', categoryId: 'category_conversation', weight: 'common', tags: ['德鲁伊', '天气'], cooldownDays: 4 },
        { id: 'event_system_wayfarer_map', title: '路边的手绘地图', content: '在边境驿站，一张手绘地图被压在旧木桌下。它标出了一条已经荒废、却仍可能通往山谷的旧路。', participants: 'daily', categoryId: 'category_daily', weight: 'normal', tags: ['驿站', '地图'], cooldownDays: 5 },
        { id: 'event_system_warm_bread', title: '刚出炉的面包', content: '清晨经过小村时，烘焙师请旅人帮忙试吃一批新面包。麦香混着蜂蜜，足以让赶路的脚步慢下来。', participants: 'daily', categoryId: 'category_daily', weight: 'common', tags: ['村庄', '食物'], cooldownDays: 3 },
        { id: 'event_system_ferry_story', title: '渡船人的故事', content: '河谷渡口的船夫一边撑船，一边讲起一座在雾中消失的旧桥。靠岸时，他仍没说清那故事是真是假。', participants: 'daily', categoryId: 'category_daily', weight: 'normal', tags: ['渡口', '传闻'], cooldownDays: 6 },
        { id: 'event_system_moss_rune', title: '苔藓下的符文', content: '清理石阶上的苔藓时，露出一行矮人符文。它记录的不是宝藏，而是一句提醒后来者小心山洪。', participants: 'character', categoryId: 'category_exploration', weight: 'normal', tags: ['符文', '山洪'], cooldownDays: 7 },
        { id: 'event_system_archway', title: '古老拱门', content: '古道旁的石拱门只剩半边，门下却没有道路。风穿过拱顶时，带来一阵遥远钟声。', participants: 'both', categoryId: 'category_exploration', weight: 'rare', tags: ['遗迹', '钟声'], cooldownDays: 12 },
        { id: 'event_system_mine_lantern', title: '矿井里的微光', content: '废弃矿井深处仍有一盏微弱的提灯，灯油早已干涸，火焰却在石壁间安静燃烧。', participants: 'character', categoryId: 'category_exploration', weight: 'rare', tags: ['矿井', '魔法'], cooldownDays: 14 },
        { id: 'event_system_library_page', title: '风中的书页', content: '遗迹入口飘出一页古书，纸面没有文字，只有一幅描绘附近山脉的精细地图。', participants: 'user', categoryId: 'category_exploration', weight: 'normal', tags: ['古书', '地图'], cooldownDays: 8 },
        { id: 'event_system_bird_nest', title: '树冠里的鸟巢', content: '树冠间传来幼鸟的叫声，附近的鸟群不断把柔软的羽毛带回巢中，像是在准备迎接一场寒潮。', participants: 'daily', categoryId: 'category_nature', weight: 'common', tags: ['鸟类', '森林'], cooldownDays: 3 },
        { id: 'event_system_moon_dew', title: '月露草', content: '月光下，一片小草叶凝出银亮露珠。草药师说它只在空气足够安静的夜里出现。', participants: 'character', categoryId: 'category_nature', weight: 'rare', tags: ['草药', '月光'], cooldownDays: 10 },
        { id: 'event_system_beaver_dam', title: '河狸的水坝', content: '河狸重新堆起一座小水坝，改变了溪水的方向，也让原本干涸的低地长出了新一片芦苇。', participants: 'daily', categoryId: 'category_nature', weight: 'normal', tags: ['河流', '生态'], cooldownDays: 6 },
        { id: 'event_system_stone_garden', title: '石头里的种子', content: '一块裂开的石头中长出细小花茎，根系沿着岩缝寻找水分，显得顽强得近乎神奇。', participants: 'user', categoryId: 'category_nature', weight: 'normal', tags: ['植物', '生命'], cooldownDays: 7 },
        { id: 'event_system_herb_tea', title: '草药茶的火候', content: '营地里的草药茶煮得太久，味道苦得皱眉，却意外驱散了整夜的疲惫。', participants: 'both', categoryId: 'category_camp', weight: 'common', tags: ['草药', '茶'], cooldownDays: 2 },
        { id: 'event_system_boot_lace', title: '靴带和补丁', content: '整理装备时发现靴带快要断了。几针粗糙的补丁虽然不漂亮，却足以撑过接下来的山路。', participants: 'user', categoryId: 'category_camp', weight: 'common', tags: ['装备', '修补'], cooldownDays: 2 },
        { id: 'event_system_story_circle', title: '篝火旁的故事接龙', content: '篝火旁的每个人只讲一句故事，片段最终拼成了一个关于勇敢厨师和会唱歌的龙的荒诞传说。', participants: 'both', categoryId: 'category_camp', weight: 'common', tags: ['篝火', '故事'], cooldownDays: 4 },
        { id: 'event_system_bedroll_frost', title: '霜上的睡袋', content: '黎明时发现睡袋上结了一层薄霜，附近的火堆却没有熄灭，像是夜里有人悄悄替旅人添过柴。', participants: 'character', categoryId: 'category_camp', weight: 'normal', tags: ['霜冻', '守夜'], cooldownDays: 8 },
        { id: 'event_system_cart_wheel', title: '卡住的车轮', content: '一辆商队马车的车轮陷进泥里，几个人合力垫上木板后，车队用一袋苹果作为谢礼。', participants: 'daily', categoryId: 'category_accident', weight: 'common', tags: ['商队', '帮忙'], cooldownDays: 3 },
        { id: 'event_system_floating_lantern', title: '漂来的灯笼', content: '雨后的溪水带来一盏没有灯芯的纸灯笼，灯面画着一颗陌生的星。', participants: 'user', categoryId: 'category_accident', weight: 'rare', tags: ['河流', '灯笼'], cooldownDays: 12 },
        { id: 'event_system_mistaken_signal', title: '误认的信号', content: '山坡上的白布被误认成求救信号，赶到后才发现那是农夫晾晒的床单。', participants: 'daily', categoryId: 'category_accident', weight: 'common', tags: ['误会', '山路'], cooldownDays: 3 },
        { id: 'event_system_silent_bell', title: '不会响的钟', content: '废弃神殿门口挂着一口钟，敲击时没有声音，却让附近的鸟群同时抬头望向天空。', participants: 'character', categoryId: 'category_accident', weight: 'rare', tags: ['神殿', '魔法'], cooldownDays: 14 },
        { id: 'event_system_guardian_question', title: '守卫的谜语', content: '村庄守卫没有索要钱币，而是问了一个关于故乡的谜语。答对后，他指给旅人一条更安全的路。', participants: 'both', categoryId: 'category_conversation', weight: 'normal', tags: ['守卫', '谜语'], cooldownDays: 6 },
        { id: 'event_system_scholar_rubbing', title: '学者的拓印', content: '研究古文字的学者请求帮忙拓印一段碑文，并承诺日后寄来它的完整译文。', participants: 'daily', categoryId: 'category_conversation', weight: 'normal', tags: ['学者', '古文字'], cooldownDays: 7 },
        { id: 'event_system_ranger_warning', title: '游侠的提醒', content: '年轻游侠指出林中最近有人频繁经过，并建议旅人不要在同一片空地停留太久。', participants: 'character', categoryId: 'category_conversation', weight: 'common', tags: ['游侠', '道路'], cooldownDays: 4 },
        { id: 'event_system_minstrel_debate', title: '吟游诗人的争论', content: '吟游诗人坚称月亮会听见旅人的愿望，同行者则提出了三个反例，争论一直持续到晚饭上桌。', participants: 'both', categoryId: 'category_conversation', weight: 'common', tags: ['吟游诗人', '闲谈'], cooldownDays: 4 }
        ,{ id: 'event_system_shrine_water', title: '神龛边的清水', content: '荒野小神龛旁有一碗清水，碗底压着一枚写着祝福的叶片。水源来自哪里，附近的旅人也说不清。', participants: 'daily', categoryId: 'category_exploration', weight: 'normal', tags: ['神龛', '祝福'], cooldownDays: 7 }
    ];
    const REMOVED_SYSTEM_EVENT_IDS = new Set([
        'event_system_potato_guard',
        'event_system_cangzhu_waykeeper'
    ]);
    const WEIGHT_VALUES = { common: 6, normal: 3, rare: 1 };

    function createDefaultTravelerKeepsake() {
        return {
            version: CURRENT_VERSION,
            chapters: [],
            eventTemplates: [],
            eventCategories: [],
            observations: [],
            keepsakes: [],
            gifts: [],
            quotes: [],
            chronicles: []
            ,eventGeneration: { lastCheckedDate: null }
            ,keywordLibrary: [], compositionTemplates: []
        };
    }

    function cloneDefaultTravelerKeepsake() {
        const defaults = createDefaultTravelerKeepsake();
        return {
            version: defaults.version,
            chapters: defaults.chapters.slice(),
            eventTemplates: defaults.eventTemplates.slice(),
            observations: defaults.observations.slice(),
            keepsakes: defaults.keepsakes.slice(),
            gifts: defaults.gifts.slice(),
            quotes: defaults.quotes.slice(),
            chronicles: defaults.chronicles.slice(),
            eventGeneration: { ...defaults.eventGeneration }
            ,keywordLibrary: defaults.keywordLibrary.slice(), compositionTemplates: defaults.compositionTemplates.slice()
        };
    }

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function isValidCollection(value) {
        return Array.isArray(value);
    }

    function getDataVersion(value) {
        if (!isPlainObject(value)
            || !Object.prototype.hasOwnProperty.call(value, 'version')
            || !Number.isInteger(value.version)
            || value.version <= 0) {
            throw new Error('[travelerKeepsake] 数据版本缺失或非法，已拒绝加载');
        }
        return value.version;
    }

    function assertSupportedVersion(value) {
        const version = getDataVersion(value);
        if (version > CURRENT_VERSION) {
            throw new Error(
                `[travelerKeepsake] 数据版本 ${version} 高于当前支持版本 ${CURRENT_VERSION}`
            );
        }
        return version;
    }

    /**
     * Normalize persisted data without mutating the value returned by storage.
     * Unknown fields are retained for forward compatibility, while the known
     * collection fields are guaranteed to be arrays.
     */
    function normalizeTravelerKeepsake(value) {
        assertSupportedVersion(value);
        const normalized = { ...value };

        COLLECTION_NAMES.forEach((name) => {
            if (!isValidCollection(normalized[name])) normalized[name] = [];
        });
        if (!isPlainObject(normalized.eventGeneration)) normalized.eventGeneration = { lastCheckedDate: null };
        if (typeof normalized.eventGeneration.lastCheckedDate !== 'string') normalized.eventGeneration.lastCheckedDate = null;
        if (!Array.isArray(normalized.keywordLibrary)) normalized.keywordLibrary = [];
        if (!Array.isArray(normalized.compositionTemplates)) normalized.compositionTemplates = [];

        // Normalize legacy template participant values without touching the
        // historical observations collection or their content snapshots.
        normalized.eventTemplates = normalized.eventTemplates.map((item) => {
            if (!isPlainObject(item) || item.participants !== 'none') return item;
            return { ...item, participants: 'daily' };
        });
        normalized.observations = normalized.observations.map((item) => {
            if (!isPlainObject(item)) return item;
            return {
                ...item,
                interactionStatus: ['idle', 'pending', 'responded'].includes(item.interactionStatus) ? item.interactionStatus : 'idle',
                interactionResponseIds: Array.isArray(item.interactionResponseIds) ? item.interactionResponseIds.slice() : [],
                travelerAutoResponseDecision: ['hit', 'miss', 'no_cards'].includes(item.travelerAutoResponseDecision) ? item.travelerAutoResponseDecision : null,
                travelerAutoResponseStatus: ['pending', 'responded', 'skipped', 'failed'].includes(item.travelerAutoResponseStatus) ? item.travelerAutoResponseStatus : null
            };
        });

        return normalized;
    }

    /**
     * Version migration entry point. v1 adds chapters; v2 adds eventTemplates;
     * v3 adds eventCategories (current schema v4 keeps this migration chain).
     * Existing records and unknown fields are retained unchanged.
     */
    function migrateTravelerKeepsake(value) {
        const version = assertSupportedVersion(value);
        let migrated = normalizeTravelerKeepsake(value);

        if (version < 2) {
            if (!Array.isArray(migrated.chapters)) migrated.chapters = [];
            migrated.version = 2;
        }

        if (version < 3) {
            if (!Array.isArray(migrated.eventTemplates)) migrated.eventTemplates = [];
            migrated.version = 3;
        }

        if (version < 4) {
            if (!Array.isArray(migrated.eventCategories)) migrated.eventCategories = [];
            migrated.version = 4;
        }
        if (version < 5) {
            if (!isPlainObject(migrated.eventGeneration)) migrated.eventGeneration = { lastCheckedDate: null };
            if (typeof migrated.eventGeneration.lastCheckedDate !== 'string') migrated.eventGeneration.lastCheckedDate = null;
            migrated.version = 5;
        }
        if (version < 6) { migrated.keywordLibrary = Array.isArray(migrated.keywordLibrary) ? migrated.keywordLibrary : []; migrated.compositionTemplates = Array.isArray(migrated.compositionTemplates) ? migrated.compositionTemplates : []; migrated.version = 6; }

        if (migrated.version < CURRENT_VERSION) {
            // Reserved for future schema migrations.
            migrated.version = CURRENT_VERSION;
        }

        return migrated;
    }

    function getTravelerKeepsakeStorageKey() {
        if (typeof global.getStorageKey !== 'function') {
            throw new Error('[travelerKeepsake] getStorageKey() 不可用');
        }
        return global.getStorageKey(STORAGE_KEY);
    }

    function generateTravelerKeepsakeId(prefix) {
        const safePrefix = String(prefix || 'entry')
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '') || 'entry';
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 10);
        return `${safePrefix}_${timestamp}_${random}`;
    }

    function initializeEventCatalog(data) {
        const normalized = migrateTravelerKeepsake(data);
        const result = { ...normalized };
        const categories = Array.isArray(result.eventCategories) ? result.eventCategories.slice() : [];
        SYSTEM_CATEGORIES.forEach(([id, name]) => {
            if (!categories.some((category) => category && category.id === id)) {
                categories.push({ id, name, source: 'system', createdAt: Date.now() });
            }
        });
        result.eventCategories = categories;
        result.eventTemplates = Array.isArray(result.eventTemplates) ? result.eventTemplates : [];
        result.eventTemplates = result.eventTemplates.filter((item) => !(item && item.source === 'system' && REMOVED_SYSTEM_EVENT_IDS.has(item.id)));
        const keywordNow = Date.now();
        Object.entries(SYSTEM_KEYWORDS).forEach(([category, values]) => values.forEach((value) => { if (!result.keywordLibrary.some((item) => item && item.source === 'system' && item.category === category && item.value === value)) result.keywordLibrary.push({ id: `keyword_system_${category}_${value}`, category, value, source: 'system', enabled: true, createdAt: keywordNow, updatedAt: keywordNow }); }));
        SYSTEM_TEMPLATES.forEach((template) => {
            const existing = result.eventTemplates.find((item) => item && item.id === template.id);
            if (!existing) {
                result.eventTemplates.push({ ...template, source: 'system', enabled: true, createdAt: Date.now(), updatedAt: Date.now() });
            } else if (existing.source === 'system' && (existing.content === '哈尔辛在林间发现了一株罕见的草药，决定仔细观察它的生长环境。' || existing.title === '林间发现罕见草药')) {
                existing.title = template.title;
                existing.content = template.content;
                existing.participants = template.participants;
                existing.updatedAt = Date.now();
            }
        });
        SYSTEM_COMPOSITION_TEMPLATES.forEach((template) => { if (!result.compositionTemplates.some((item) => item && item.id === template.id)) result.compositionTemplates.push({ ...template, source:'system', enabled:true, weight:'normal', createdAt:Date.now(), updatedAt:Date.now() }); });
        return result;
    }

    function validateCompositionTemplate(content) { const matches = String(content || '').match(/\{([^{}]+)\}/g) || []; const unknown = matches.map((x) => x.slice(1, -1)).filter((x) => !TEMPLATE_PLACEHOLDERS.includes(x)); const valid = matches.filter((x) => TEMPLATE_PLACEHOLDERS.includes(x.slice(1, -1))); return { valid: valid.length > 0 && unknown.length === 0, placeholders: [...new Set(valid.map((x) => x.slice(1, -1)))], unknown }; }

    function localDateKey(date) {
        const d = date instanceof Date ? date : new Date(date || Date.now());
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function weightedPick(items) {
        const total = items.reduce((sum, item) => sum + (WEIGHT_VALUES[item.weight] || 0), 0);
        if (!total) return null;
        let cursor = Math.random() * total;
        for (const item of items) { cursor -= WEIGHT_VALUES[item.weight] || 0; if (cursor < 0) return item; }
        return items[items.length - 1];
    }

    function chooseDailyCount() {
        const roll = Math.random();
        if (roll < 0.15) return 0;
        if (roll < 0.60) return 1;
        if (roll < 0.90) return 2;
        return 3;
    }

    function replaceEventNames(text, settings) {
        const partner = (settings && settings.partnerName) || '角色名';
        const mine = (settings && settings.myName) || '我';
        return String(text || '').replaceAll('{角色名}', partner).replaceAll('{我}', mine).replaceAll('{自己的名字}', mine);
    }

    function buildEventCandidatePool(data) {
        if (!isPlainObject(data) || !Array.isArray(data.eventTemplates)) throw new Error('[travelerKeepsake] 无法构建事件候选池：事件库数据无效');
        const candidates = data.eventTemplates.filter((item) => item && item.enabled !== false && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string' && ['daily', 'character', 'user', 'both'].includes(item.participants) && Object.prototype.hasOwnProperty.call(WEIGHT_VALUES, item.weight)).map((item) => ({ id: generateTravelerKeepsakeId('candidate'), source: 'library', templateId: item.id, title: item.title, content: item.content, participants: item.participants, categoryId: item.categoryId || null, weight: item.weight, cooldownDays: Math.max(0, Number(item.cooldownDays) || 0), tags: Array.isArray(item.tags) ? item.tags.slice() : [] }));

        const keywordByCategory = {};
        (data.keywordLibrary || []).filter((item) => item && item.enabled !== false && typeof item.value === 'string' && item.value.trim()).forEach((item) => {
            (keywordByCategory[item.category] ||= []).push(item.value.trim());
        });
        const placeholderCategory = { '人物': 'person', '人物A': 'person', '人物B': 'person', '地点': 'location', '来处': 'origin', '做了什么': 'action', '发现物': 'discovery', '遭遇': 'encounter', '活动': 'activity' };
        const compositionCandidates = (data.compositionTemplates || []).filter((template) => template && template.enabled !== false && typeof template.id === 'string' && typeof template.title === 'string' && typeof template.content === 'string').map((template) => {
            const validation = validateCompositionTemplate(template.content);
            if (!validation.valid) return null;
            const values = {};
            for (const placeholder of validation.placeholders) {
                const category = placeholderCategory[placeholder];
                const pool = keywordByCategory[category] || [];
                if (!pool.length) return null;
                if (placeholder === '人物A' || placeholder === '人物B') {
                    const other = placeholder === '人物A' ? values['人物B'] : values['人物A'];
                    const available = pool.filter((value) => value !== other);
                    if (!available.length) return null;
                    values[placeholder] = available[Math.floor(Math.random() * available.length)];
                } else if (!Object.prototype.hasOwnProperty.call(values, placeholder)) {
                    values[placeholder] = pool[Math.floor(Math.random() * pool.length)];
                }
            }
            const replace = (text) => String(text).replace(/\{([^{}]+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match);
            const participants = ['daily', 'character', 'user', 'both'].includes(template.participants) ? template.participants : 'daily';
            const weight = Object.prototype.hasOwnProperty.call(WEIGHT_VALUES, template.weight) ? template.weight : 'normal';
            return { id: generateTravelerKeepsakeId('candidate'), source: 'keyword', templateId: template.id, title: replace(template.title), content: replace(template.content), participants, categoryId: template.categoryId || null, weight, cooldownDays: Math.max(0, Number(template.cooldownDays) || 0), tags: Array.isArray(template.tags) ? template.tags.slice() : [] };
        }).filter(Boolean);
        return candidates.concat(compositionCandidates);
    }

    function drawEventCandidates(pool, observations, day, count) {
        if (!Array.isArray(pool) || !Array.isArray(observations)) throw new Error('[travelerKeepsake] 事件抽取参数无效');
        let eligible = pool.filter((candidate) => !candidate.cooldownDays || !observations.some((observation) => { if (observation.templateId !== candidate.templateId || !observation.date) return false; const days = Math.round((new Date(`${day}T00:00:00`) - new Date(`${observation.date}T00:00:00`)) / 86400000); return days >= 0 && days <= candidate.cooldownDays; }));
        const selected = [];
        while (selected.length < count && eligible.length) { const picked = weightedPick(eligible); if (!picked) break; selected.push(picked); eligible = eligible.filter((item) => item.id !== picked.id); }
        return selected;
    }

    function candidateToObservation(candidate, day, now, settings) {
        return { id: generateTravelerKeepsakeId('observation'), templateId: candidate.templateId, date: day, occurredAt: now, title: replaceEventNames(candidate.title, settings), content: replaceEventNames(candidate.content, settings), participants: candidate.participants, categoryId: candidate.categoryId, tags: candidate.tags.slice(), createdAt: now };
    }

    function generateDailyEvents(data, date, settings) {
        const normalized = migrateTravelerKeepsake(data);
        const day = localDateKey(date);
        if (normalized.eventGeneration.lastCheckedDate === day) return { data: normalized, generated: false, count: 0, observations: [] };
        const now = Date.now();
        const pool = buildEventCandidatePool(normalized);
        const selected = drawEventCandidates(pool, normalized.observations, day, Math.min(chooseDailyCount(), pool.length));
        const observations = selected.map((candidate) => candidateToObservation(candidate, day, now, settings));
        normalized.observations.push(...observations);
        normalized.eventGeneration = { ...normalized.eventGeneration, lastCheckedDate: day };
        return { data: normalized, generated: true, count: observations.length, observations };
    }

    function generateActiveEvent(data, date, settings) {
        const normalized = migrateTravelerKeepsake(data);
        const day = localDateKey(date);
        const selected = drawEventCandidates(buildEventCandidatePool(normalized), normalized.observations, day, 1);
        if (!selected.length) return { data: normalized, generated: false, count: 0, observations: [] };
        const now = Date.now();
        const observations = [candidateToObservation(selected[0], day, now, settings)];
        normalized.observations.push(...observations);
        return { data: normalized, generated: true, count: observations.length, observations };
    }

    function generateScheduledEvent(data, date, settings) {
        const normalized = migrateTravelerKeepsake(data);
        const day = localDateKey(date);
        const selected = drawEventCandidates(buildEventCandidatePool(normalized), normalized.observations, day, 1);
        if (!selected.length) return { data: normalized, generated: false, count: 0, observations: [] };
        const now = Date.now();
        const observation = candidateToObservation(selected[0], day, now, settings);
        const observations = [observation];
        normalized.observations.push(...observations);
        return { data: normalized, generated: true, count: 1, observations };
    }

    /**
     * Return records belonging to a chapter. A null/undefined chapterId
     * selects unassociated records; records without chapterId remain valid.
     */
    function getRecordsForChapter(data, collectionName, chapterId) {
        if (!isPlainObject(data) || !RECORD_COLLECTION_NAMES.includes(collectionName)) {
            return [];
        }
        const records = Array.isArray(data[collectionName])
            ? data[collectionName]
            : [];
        return records.filter((record) => {
            if (!isPlainObject(record)) return chapterId == null;
            return chapterId == null
                ? record.chapterId == null
                : record.chapterId === chapterId;
        });
    }

    /**
     * Remove one chapter without removing any associated records. Matching
     * records are copied with chapterId set to null, making the unlinking
     * behavior explicit and safe for future UI confirmation flows.
     */
    function removeChapterAndUnlinkRecords(data, chapterId) {
        const normalized = migrateTravelerKeepsake(data);
        const result = { ...normalized };
        result.chapters = normalized.chapters.filter(
            (chapter) => !isPlainObject(chapter) || chapter.id !== chapterId
        );

        RECORD_COLLECTION_NAMES.forEach((collectionName) => {
            result[collectionName] = normalized[collectionName].map((record) => {
                if (!isPlainObject(record) || record.chapterId !== chapterId) {
                    return record;
                }
                return { ...record, chapterId: null };
            });
        });

        return result;
    }

    async function loadTravelerKeepsake() {
        const defaults = cloneDefaultTravelerKeepsake();
        const key = getTravelerKeepsakeStorageKey();
        let stored;

        try {
            if (!global.localforage || typeof global.localforage.getItem !== 'function') {
                throw new Error('[travelerKeepsake] LocalForage 不可用，已拒绝使用默认数据');
            }
            stored = await global.localforage.getItem(key);
        } catch (error) {
            console.error('[travelerKeepsake] 读取失败，已拒绝使用默认数据:', error);
            throw error;
        }

        if (stored === null || stored === undefined) return defaults;
        return migrateTravelerKeepsake(stored);
    }

    async function saveTravelerKeepsake(value) {
        const key = getTravelerKeepsakeStorageKey();
        assertSupportedVersion(value);
        const normalized = migrateTravelerKeepsake(value);

        if (!global.localforage || typeof global.localforage.setItem !== 'function') {
            throw new Error('[travelerKeepsake] LocalForage 不可用，无法保存数据');
        }

        await global.localforage.setItem(key, normalized);
        return normalized;
    }

    const api = {
        STORAGE_KEY,
        CURRENT_VERSION,
        COLLECTION_NAMES: COLLECTION_NAMES.slice(),
        RECORD_COLLECTION_NAMES: RECORD_COLLECTION_NAMES.slice(),
        createDefault: createDefaultTravelerKeepsake,
        normalize: normalizeTravelerKeepsake,
        migrate: migrateTravelerKeepsake,
        getRecordsForChapter,
        removeChapterAndUnlinkRecords,
        initializeEventCatalog,
        generateDailyEvents,
        generateActiveEvent,
        generateScheduledEvent,
        buildEventCandidatePool,
        drawEventCandidates,
        KEYWORD_CATEGORIES: KEYWORD_CATEGORIES.map(([id,name]) => ({id,name})), TEMPLATE_PLACEHOLDERS: TEMPLATE_PLACEHOLDERS.slice(), validateCompositionTemplate,
        getStorageKey: getTravelerKeepsakeStorageKey,
        generateId: generateTravelerKeepsakeId,
        load: loadTravelerKeepsake,
        save: saveTravelerKeepsake
    };

    global.TravelerKeepsake = api;
    global.createDefaultTravelerKeepsake = createDefaultTravelerKeepsake;
    global.loadTravelerKeepsake = loadTravelerKeepsake;
    global.saveTravelerKeepsake = saveTravelerKeepsake;
    global.generateTravelerKeepsakeId = generateTravelerKeepsakeId;
})(typeof window !== 'undefined' ? window : globalThis);

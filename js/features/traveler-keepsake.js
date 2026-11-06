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
    const TEMPLATE_PLACEHOLDERS = ['人物','人物A','人物B','地点','来处','做了什么','发现物','遭遇','活动'];
    const SYSTEM_COMPOSITION_TEMPLATES = [
        { id:'composition_system_encounter', title:'旅途遭遇', content:'{人物}在{地点}{做了什么}。' },
        { id:'composition_system_guest', title:'远方来客', content:'来自{来处}的{人物}出现在{地点}。' },
        { id:'composition_system_discovery', title:'偶然发现', content:'{人物}在{地点}发现了{发现物}。' },
        { id:'composition_system_accident', title:'意外插曲', content:'当{人物}经过{地点}时，遭遇了{遭遇}。' },
        { id:'composition_system_activity', title:'共同活动', content:'{人物A}和{人物B}在{地点}{活动}。' },
        { id:'composition_system_mishap', title:'旅途中的意外', content:'{人物}原本打算在{地点}{做了什么}，却意外遇到了{遭遇}。' }
    ];
    const SYSTEM_TEMPLATES = [
        { id: 'event_system_herb', title: '{角色名}的林间发现', content: '{角色名}在林间发现了一株罕见的草药，决定仔细观察它的生长环境。', participants: 'character', categoryId: 'category_exploration', weight: 'normal', tags: ['森林', '采集'], cooldownDays: 3 },
        { id: 'event_system_campfire', title: '篝火旁的一段闲谈', content: '夜色降临，篝火映亮了营地，也为两人留出一段安静交谈的时光。', participants: 'both', categoryId: 'category_camp', weight: 'common', tags: ['营地', '交谈'], cooldownDays: 1 },
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
        { id: 'event_system_druid_advice', title: '德鲁伊的天气建议', content: '一位路过的德鲁伊提醒旅人，山谷里的云影正在改变方向，并顺手分享了一个辨认晴雨的简单方法。', participants: 'daily', categoryId: 'category_conversation', weight: 'common', tags: ['德鲁伊', '天气'], cooldownDays: 4 }
    ];
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

    function generateDailyEvents(data, date, settings) {
        const normalized = migrateTravelerKeepsake(data);
        const day = localDateKey(date);
        if (normalized.eventGeneration.lastCheckedDate === day) return { data: normalized, generated: false, count: 0 };
        const now = Date.now();
        const candidates = normalized.eventTemplates.filter((item) => item && item.enabled !== false && ['daily', 'character', 'user', 'both'].includes(item.participants) && Object.prototype.hasOwnProperty.call(WEIGHT_VALUES, item.weight));
        const eligible = candidates.filter((template) => {
            const cooldown = Math.max(0, Number(template.cooldownDays) || 0);
            if (!cooldown) return true;
            return !normalized.observations.some((observation) => {
                if (observation.templateId !== template.id || !observation.date) return false;
                const then = new Date(`${observation.date}T00:00:00`);
                const nowDay = new Date(`${day}T00:00:00`);
                const days = Math.round((nowDay - then) / 86400000);
                return days >= 0 && days <= cooldown;
            });
        });
        const selected = [];
        const target = Math.min(chooseDailyCount(), eligible.length);
        let pool = eligible.slice();
        while (selected.length < target && pool.length) { const picked = weightedPick(pool); if (!picked) break; selected.push(picked); pool = pool.filter((item) => item.id !== picked.id); }
        selected.forEach((template) => normalized.observations.push({ id: generateTravelerKeepsakeId('observation'), templateId: template.id, date: day, occurredAt: now, title: replaceEventNames(template.title, settings), content: replaceEventNames(template.content, settings), participants: template.participants, categoryId: template.categoryId || null, tags: Array.isArray(template.tags) ? template.tags.slice() : [], createdAt: now }));
        normalized.eventGeneration = { ...normalized.eventGeneration, lastCheckedDate: day };
        return { data: normalized, generated: true, count: selected.length };
    }

    function generateActiveEvent(data, date, settings) {
        const normalized = migrateTravelerKeepsake(data);
        const day = localDateKey(date);
        const candidates = normalized.eventTemplates.filter((item) => item && item.enabled !== false && ['daily', 'character', 'user', 'both'].includes(item.participants) && Object.prototype.hasOwnProperty.call(WEIGHT_VALUES, item.weight));
        const eligible = candidates.filter((template) => {
            const cooldown = Math.max(0, Number(template.cooldownDays) || 0);
            return !cooldown || !normalized.observations.some((observation) => {
                if (observation.templateId !== template.id || !observation.date) return false;
                const days = Math.round((new Date(`${day}T00:00:00`) - new Date(`${observation.date}T00:00:00`)) / 86400000);
                return days >= 0 && days <= cooldown;
            });
        });
        const template = weightedPick(eligible);
        if (!template) return { data: normalized, generated: false, count: 0 };
        const now = Date.now();
        normalized.observations.push({ id: generateTravelerKeepsakeId('observation'), templateId: template.id, date: day, occurredAt: now, title: replaceEventNames(template.title, settings), content: replaceEventNames(template.content, settings), participants: template.participants, categoryId: template.categoryId || null, tags: Array.isArray(template.tags) ? template.tags.slice() : [], createdAt: now });
        return { data: normalized, generated: true, count: 1 };
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
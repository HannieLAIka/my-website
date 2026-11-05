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
    const CURRENT_VERSION = 2;
    const CHAPTER_COLLECTION = 'chapters';
    const COLLECTION_NAMES = [
        CHAPTER_COLLECTION,
        'observations',
        'keepsakes',
        'gifts',
        'quotes',
        'chronicles'
    ];
    const RECORD_COLLECTION_NAMES = COLLECTION_NAMES.filter(
        (name) => name !== CHAPTER_COLLECTION
    );

    function createDefaultTravelerKeepsake() {
        return {
            version: CURRENT_VERSION,
            chapters: [],
            observations: [],
            keepsakes: [],
            gifts: [],
            quotes: [],
            chronicles: []
        };
    }

    function cloneDefaultTravelerKeepsake() {
        const defaults = createDefaultTravelerKeepsake();
        return {
            version: defaults.version,
            chapters: defaults.chapters.slice(),
            observations: defaults.observations.slice(),
            keepsakes: defaults.keepsakes.slice(),
            gifts: defaults.gifts.slice(),
            quotes: defaults.quotes.slice(),
            chronicles: defaults.chronicles.slice()
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

        return normalized;
    }

    /**
     * Version migration entry point. v1 data contained the five record
     * collections and no chapters; migration only adds an empty chapters
     * collection and leaves every existing record untouched.
     */
    function migrateTravelerKeepsake(value) {
        const version = assertSupportedVersion(value);
        let migrated = normalizeTravelerKeepsake(value);

        if (version < 2) {
            if (!Array.isArray(migrated.chapters)) migrated.chapters = [];
            migrated.version = 2;
        }

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
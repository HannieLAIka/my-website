/** Traveler's Keepsake UI and chapter management. */
(function (global) {
    'use strict';

    const SECTIONS = {
        chapters: {
            title: '旅途篇章',
            icon: 'fa-map',
            description: '为每一段远行留下名字，也为散落的纪事找到归处。',
            empty: '尚未整理任何旅途篇章。待一段新的旅程开始，你可以在此为它留下名字。'
        },
        observations: {
            title: '旅途见闻',
            icon: 'fa-eye',
            description: '记录沿途发生的事件、遭遇与值得回望的片刻。',
            empty: '旅途尚未留下见闻。下一阵风、一道篝火，或许都会成为值得记下的故事。'
        },
        keepsakes: {
            title: '珍藏之物',
            icon: 'fa-gem',
            description: '收好那些有来处、有故事，值得放进行囊深处的物件。',
            empty: '行囊中尚无特别的收藏。那些值得留存的物件，终会在这里找到自己的位置。'
        },
        gifts: {
            title: '礼物簿',
            icon: 'fa-gift',
            description: '记下收到、送出，以及仍在等待合适时机的心意。',
            empty: '礼物簿还是空白的。愿下一份心意穿过山川，抵达想赠予的人手中。'
        },
        quotes: {
            title: '言语摘录',
            icon: 'fa-quote-left',
            description: '把曾在旅途中听见的话语，保存成不会褪色的回声。',
            empty: '尚未收藏任何话语。总有一句话，会在恰好的时刻被你拾起。'
        },
        chronicles: {
            title: '旅途编年史',
            icon: 'fa-scroll',
            description: '按日期整理重要经历，让共同走过的岁月连成一条长路。',
            empty: '编年史尚未启封。下一页，等待一段值得记住的时光落笔。'
        }
    };

    let activeSection = 'chapters';
    let keepsakeData = null;
    let editingChapterId = null;
    let draftChapterCover = '';
    let editingEventId = null;
    let eventFilter = 'all';
    let eventCategoryFilter = 'all';
    let eventSearch = '';

    function todayString() {
        return new Date().toISOString().slice(0, 10);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
    }

    function formatDate(value) {
        if (!value) return '日期未定';
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
    }

    function showKeepsakeError(error) {
        console.error('[travelerKeepsakeUI]', error);
        if (typeof global.showNotification === 'function') global.showNotification('旅途纪事匣加载或保存失败，请稍后重试', 'error', 5000);
    }

    async function loadKeepsakeData() {
        try {
            keepsakeData = await global.TravelerKeepsake.load();
            const catalogData = global.TravelerKeepsake.initializeEventCatalog(keepsakeData);
            if (catalogData.eventCategories.length !== (keepsakeData.eventCategories || []).length || catalogData.eventTemplates.length !== (keepsakeData.eventTemplates || []).length) {
                keepsakeData = await global.TravelerKeepsake.save(catalogData);
            } else {
                keepsakeData = catalogData;
            }
            return keepsakeData;
        } catch (error) {
            keepsakeData = null;
            showKeepsakeError(error);
            return null;
        }
    }

    function chapterRecordsCount(chapterId) {
        return ['observations', 'keepsakes', 'gifts', 'quotes', 'chronicles'].reduce((total, name) => total + global.TravelerKeepsake.getRecordsForChapter(keepsakeData, name, chapterId).length, 0);
    }

    function renderChapterList() {
        const panel = document.getElementById('traveler-keepsake-panel');
        if (!panel || !keepsakeData) return;
        const chapters = (keepsakeData.chapters || []).slice().sort((a, b) => String(b.startDate || b.createdAt || '').localeCompare(String(a.startDate || a.createdAt || '')));
        const cards = chapters.map((chapter) => `
            <article class="traveler-chapter-card" data-chapter-id="${escapeHtml(chapter.id)}">
                <div class="traveler-chapter-cover">${chapter.cover ? `<img src="${escapeHtml(chapter.cover)}" alt="">` : '<i class="fas fa-map-marked-alt"></i>'}</div>
                <div class="traveler-chapter-main"><div class="traveler-chapter-top"><h3>${escapeHtml(chapter.title || '未命名篇章')}</h3><span class="traveler-chapter-status ${chapter.status === 'completed' ? 'completed' : 'active'}">${chapter.status === 'completed' ? '已结束' : '进行中'}</span></div><p>${escapeHtml(chapter.summary || '这段旅途尚未写下简介。')}</p><div class="traveler-chapter-meta"><span><i class="far fa-calendar"></i>${formatDate(chapter.startDate)}${chapter.endDate ? ` — ${formatDate(chapter.endDate)}` : ''}</span><span>${chapterRecordsCount(chapter.id)} 条纪事</span></div></div>
                <div class="traveler-chapter-actions"><button type="button" class="traveler-chapter-edit" data-chapter-action="edit" aria-label="编辑篇章"><i class="fas fa-pen"></i></button><button type="button" class="traveler-chapter-delete" data-chapter-action="delete" aria-label="删除篇章"><i class="fas fa-trash"></i></button></div>
            </article>`).join('');
        panel.innerHTML = `<div class="traveler-keepsake-panel-heading"><div class="traveler-keepsake-panel-icon"><i class="fas fa-map"></i></div><div><h2>旅途篇章</h2><p>为每一段远行留下名字，也为散落的纪事找到归处。</p></div></div><div class="traveler-chapter-toolbar"><button type="button" class="modal-btn modal-btn-primary" id="open-traveler-chapter-form"><i class="fas fa-plus"></i> 开启新旅程</button></div>${cards || `<div class="traveler-keepsake-empty traveler-chapter-empty"><i class="fas fa-map"></i><p>尚未整理任何旅途篇章。待一段新的旅程开始，你可以在此为它留下名字。</p></div>`}`;
        document.querySelectorAll('.traveler-keepsake-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.keepsakeSection === 'chapters'));
        document.getElementById('open-traveler-chapter-form')?.addEventListener('click', () => openChapterForm());
        panel.querySelectorAll('[data-chapter-action="edit"]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); openChapterForm(button.closest('[data-chapter-id]').dataset.chapterId); }));
        panel.querySelectorAll('[data-chapter-action="delete"]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); deleteChapter(button.closest('[data-chapter-id]').dataset.chapterId); }));
        panel.querySelectorAll('.traveler-chapter-card').forEach((card) => card.addEventListener('click', () => renderChapterDetail(card.dataset.chapterId)));
    }

    function renderEventTemplates() {
        const panel = document.getElementById('traveler-keepsake-panel');
        if (!panel || !keepsakeData) return;
        const all = keepsakeData.eventTemplates || [];
        const categories = keepsakeData.eventCategories || [];
        const filtered = all.filter((item) => {
            const tabMatch = eventFilter === 'all'
                ? true
                : eventFilter === 'system'
                    ? item.source === 'system'
                    : eventFilter === 'enabled'
                        ? item.enabled !== false
                        : eventFilter === 'disabled'
                            ? item.enabled === false
                            : true;
            const categoryMatch = eventCategoryFilter === 'all' || item.categoryId === eventCategoryFilter;
            const searchMatch = !eventSearch || `${item.title || ''} ${item.content || ''}`.toLowerCase().includes(eventSearch.toLowerCase());
            return tabMatch && categoryMatch && searchMatch;
        });
        const cards = filtered.map((item) => {
            const category = categories.find((entry) => entry.id === item.categoryId);
            const isSystem = item.source === 'system';
        const participantLabel = {
                daily: '日常内容', character: '角色联动', user: '用户联动', both: '双方联动', none: '日常内容'
            }[item.participants] || '日常内容';
            const actions = isSystem
                ? `<button type="button" data-event-action="toggle" data-event-id="${escapeHtml(item.id)}" aria-label="切换启用状态"><i class="fas ${item.enabled === false ? 'fa-toggle-off' : 'fa-toggle-on'}"></i></button><button type="button" data-event-action="copy" data-event-id="${escapeHtml(item.id)}" aria-label="复制为自定义事件"><i class="fas fa-copy"></i></button>`
                : `<button type="button" data-event-action="edit" data-event-id="${escapeHtml(item.id)}" aria-label="编辑事件"><i class="fas fa-pen"></i></button><button type="button" data-event-action="toggle" data-event-id="${escapeHtml(item.id)}" aria-label="切换启用状态"><i class="fas ${item.enabled === false ? 'fa-toggle-off' : 'fa-toggle-on'}"></i></button><button type="button" data-event-action="delete" data-event-id="${escapeHtml(item.id)}" aria-label="删除事件"><i class="fas fa-trash"></i></button>`;
            return `<article class="traveler-event-card"><div class="traveler-event-main"><div class="traveler-event-top"><h3>${escapeHtml(item.title || '未命名事件')}</h3><span class="traveler-event-status ${item.enabled === false ? 'disabled' : 'enabled'}">${item.enabled === false ? '已停用' : '已启用'}</span></div><p>${escapeHtml(item.content || '')}</p><div class="traveler-event-meta"><span>${participantLabel}</span><span>${escapeHtml(category?.name || '未分类')}</span><span>权重：${item.weight === 'rare' ? '罕见' : item.weight === 'common' ? '常见' : '普通'}</span><span>冷却 ${Number(item.cooldownDays) || 0} 天</span></div>${Array.isArray(item.tags) && item.tags.length ? `<div class="traveler-event-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}</div><div class="traveler-event-actions">${actions}</div></article>`;
        }).join('');
        const filterButtons = [['all', '全部'], ['system', '系统'], ['enabled', '已启用'], ['disabled', '已停用']].map(([value, label]) => `<button type="button" class="${eventFilter === value ? 'active' : ''}" data-event-filter="${value}">${label}</button>`).join('');
        const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category.id)}" ${eventCategoryFilter === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('');
        const empty = `<div class="traveler-keepsake-empty"><i class="fas fa-feather"></i><p>事件图鉴中还没有词条。添加一些故事，让未来的旅程拥有更多意外。</p><button type="button" class="modal-btn modal-btn-primary" id="open-traveler-event-form-empty"><i class="fas fa-plus"></i> 添加第一条事件</button></div>`;
        panel.innerHTML = `<button type="button" class="traveler-keepsake-back" id="back-to-observations"><i class="fas fa-arrow-left"></i> 返回旅途见闻</button><div class="traveler-keepsake-panel-heading"><div class="traveler-keepsake-panel-icon"><i class="fas fa-book-atlas"></i></div><div><h2>事件图鉴</h2><p>整理未来旅途中可能发生的故事模板；它们不会直接写入已发生的见闻。</p></div></div><div class="traveler-event-toolbar"><div class="traveler-event-summary">共 ${all.length} 条 · 已启用 ${all.filter((item) => item.enabled !== false).length} 条</div><button type="button" class="modal-btn modal-btn-primary" id="open-traveler-event-form"><i class="fas fa-plus"></i> 添加事件</button></div><div class="traveler-event-filters">${filterButtons}</div><div class="traveler-event-tools"><input id="traveler-event-search" value="${escapeHtml(eventSearch)}" placeholder="搜索事件名称或内容"><select id="traveler-event-category-filter"><option value="all">全部类别</option>${categoryOptions}</select><button type="button" class="modal-btn modal-btn-secondary" id="manage-traveler-event-categories">管理类别</button></div>${cards || empty}`;
        document.querySelectorAll('[data-event-filter]').forEach((button) => button.addEventListener('click', () => { eventFilter = button.dataset.eventFilter; renderEventTemplates(); }));
        document.getElementById('traveler-event-search')?.addEventListener('input', (event) => { eventSearch = event.target.value; renderEventTemplates(); });
        document.getElementById('traveler-event-category-filter')?.addEventListener('change', (event) => { eventCategoryFilter = event.target.value; renderEventTemplates(); });
        document.getElementById('manage-traveler-event-categories')?.addEventListener('click', manageEventCategories);
        document.getElementById('open-traveler-event-form')?.addEventListener('click', () => openEventForm());
        document.getElementById('open-traveler-event-form-empty')?.addEventListener('click', () => openEventForm());
        document.getElementById('back-to-observations')?.addEventListener('click', renderObservationsMain);
        panel.querySelectorAll('[data-event-action="edit"]').forEach((button) => button.addEventListener('click', () => openEventForm(button.dataset.eventId)));
        panel.querySelectorAll('[data-event-action="toggle"]').forEach((button) => button.addEventListener('click', () => toggleEvent(button.dataset.eventId)));
        bindEventCatalogDelegation();
        panel.querySelectorAll('[data-event-action="copy"]').forEach((button) => button.addEventListener('click', () => copySystemEvent(button.dataset.eventId)));
        document.querySelectorAll('.traveler-keepsake-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.keepsakeSection === 'observations'));
    }

    function bindEventCatalogDelegation() {
        const panel = document.getElementById('traveler-keepsake-panel');
        if (!panel || panel.dataset.eventDeleteDelegated === 'true') return;
        panel.dataset.eventDeleteDelegated = 'true';
        panel.addEventListener('click', (event) => {
            const button = event.target.closest('[data-event-action="delete"]');
            if (!button || !panel.contains(button)) return;
            event.preventDefault();
            event.stopPropagation();
            const eventId = button.getAttribute('data-event-id');
            console.log('[事件删除] 按钮点击');
            console.log('[事件删除] 获取到的 ID:', eventId);
            if (!eventId) return;
            console.log('[事件删除] 开始执行删除函数');
            console.log('[事件删除] 准备弹出确认框');
            deleteEvent(eventId);
        });
    }
    function resolveNames(text) {
        const partner = (typeof settings !== 'undefined' && settings.partnerName) || '梦角';
        const mine = (typeof settings !== 'undefined' && settings.myName) || '我';
        return String(text || '').replaceAll('{角色名}', partner).replaceAll('{我}', mine).replaceAll('{自己的名字}', mine);
    }

    function updateParticipantOptions(form) {
        const partner = (typeof settings !== 'undefined' && settings.partnerName) || '角色名';
        const mine = (typeof settings !== 'undefined' && settings.myName) || '我';
        const labels = { daily: '日常内容', character: `与${partner}联动`, user: `与${mine}联动`, both: '双方同时联动' };
        Object.keys(labels).forEach((value) => {
            const option = form.elements.participants?.querySelector(`option[value="${value}"]`);
            if (option) option.textContent = labels[value];
        });
    }

    function renderObservationsMain() {
        const panel = document.getElementById('traveler-keepsake-panel');
        if (!panel || !keepsakeData) return;
        const observations = Array.isArray(keepsakeData.observations) ? keepsakeData.observations : [];
        const today = todayString();
        const todayItems = observations.filter((item) => String(item.occurredAt || item.date || '').slice(0, 10) === today);
        const older = observations.filter((item) => !todayItems.includes(item)).slice().sort((a, b) => Number(b.occurredAt || b.createdAt || 0) - Number(a.occurredAt || a.createdAt || 0));
        const renderItems = (items) => items.map((item) => `<article class="traveler-observation-card"><div class="traveler-observation-date">${formatDate(item.occurredAt || item.date)}</div><div><h3>${escapeHtml(item.title || '未命名见闻')}</h3><p>${escapeHtml(item.content || '')}</p></div></article>`).join('');
        panel.innerHTML = `<div class="traveler-keepsake-panel-heading"><div class="traveler-keepsake-panel-icon"><i class="fas fa-eye"></i></div><div><h2>旅途见闻</h2><p>记录已经发生的相遇、意外与沿途故事。事件图鉴只保存未来可能发生的模板。</p></div></div><div class="traveler-observation-actions"><button type="button" class="modal-btn modal-btn-secondary" id="open-traveler-event-catalog"><i class="fas fa-book-atlas"></i> 事件图鉴</button></div><section class="traveler-observation-section"><h3>今日见闻</h3>${renderItems(todayItems) || '<div class="traveler-observation-empty">今日还没有新的见闻。每一次相遇与意外，都可能成为值得珍藏的故事。</div>'}</section><section class="traveler-observation-section"><h3>往日见闻</h3>${renderItems(older) || '<div class="traveler-observation-empty">旅途还没有留下往日记录。</div>'}</section>`;
        document.querySelectorAll('.traveler-keepsake-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.keepsakeSection === 'observations'));
        document.getElementById('open-traveler-event-catalog')?.addEventListener('click', renderEventTemplates);
    }

    function openEventForm(eventId) {
        const form = document.getElementById('traveler-keepsake-event-form');
        const item = eventId ? (keepsakeData.eventTemplates || []).find((entry) => entry.id === eventId) : null;
        if (!form) return;
        editingEventId = eventId || null;
        updateParticipantOptions(form);
        document.getElementById('traveler-keepsake-event-form-title').textContent = item ? '编辑事件' : '添加事件';
        form.elements.title.value = item?.title || '';
        form.elements.content.value = item?.content || '';
        document.getElementById('traveler-event-preview').textContent = resolveNames(item?.content || '');
        form.elements.participants.value = item?.participants === 'none' ? 'daily' : (item?.participants || 'daily');
        form.elements.weight.value = item?.weight || 'normal';
        form.elements.tags.value = Array.isArray(item?.tags) ? item.tags.join('，') : '';
        form.elements.cooldownDays.value = Number.isInteger(item?.cooldownDays) && item.cooldownDays >= 0 ? item.cooldownDays : 0;
        form.elements.enabled.checked = item?.enabled !== false;
        const categorySelect = form.elements.categoryId;
        categorySelect.innerHTML = (keepsakeData.eventCategories || []).map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join('');
        categorySelect.value = item?.categoryId || categorySelect.options[0]?.value || '';
        form.elements.content.oninput = (event) => { document.getElementById('traveler-event-preview').textContent = resolveNames(event.target.value); };
        const modal = document.getElementById('traveler-keepsake-event-form-modal'); modal.setAttribute('aria-hidden', 'false'); if (typeof global.showModal === 'function') global.showModal(modal); else modal.style.display = 'flex';
    }

    function closeEventForm() { const modal = document.getElementById('traveler-keepsake-event-form-modal'); modal.setAttribute('aria-hidden', 'true'); if (typeof global.hideModal === 'function') global.hideModal(modal); else modal.style.display = 'none'; editingEventId = null; }

    async function submitEventForm(event) {
        event.preventDefault();
        const form = event.currentTarget; const title = form.elements.title.value.trim(); const content = form.elements.content.value.trim();
        if (!title || !content) return global.showNotification?.('请填写事件名称和内容', 'warning');
        const cooldownDays = Number(form.elements.cooldownDays.value); if (!Number.isInteger(cooldownDays) || cooldownDays < 0) return global.showNotification?.('冷却天数必须是非负整数', 'warning');
        const now = Date.now(); const wasEditing = Boolean(editingEventId); const fields = { title, content, participants: form.elements.participants.value, categoryId: form.elements.categoryId.value || null, tags: form.elements.tags.value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean), weight: form.elements.weight.value, cooldownDays, enabled: form.elements.enabled.checked, updatedAt: now };
        if (wasEditing) { const item = keepsakeData.eventTemplates.find((entry) => entry.id === editingEventId); if (!item || item.source === 'system') return global.showNotification?.('系统事件只能复制后编辑', 'warning'); Object.assign(item, fields); } else keepsakeData.eventTemplates.push({ id: global.TravelerKeepsake.generateId('event'), ...fields, source: 'user', createdAt: now });
        try { await global.TravelerKeepsake.save(keepsakeData); closeEventForm(); renderEventTemplates(); global.showNotification?.(wasEditing ? '事件已更新' : '事件已添加', 'success'); } catch (error) { showKeepsakeError(error); }
    }

    async function toggleEvent(eventId) { const item = keepsakeData.eventTemplates.find((entry) => entry.id === eventId); if (!item) return; item.enabled = item.enabled === false; item.updatedAt = Date.now(); try { await global.TravelerKeepsake.save(keepsakeData); renderEventTemplates(); } catch (error) { showKeepsakeError(error); } }
    async function copySystemEvent(eventId) { const item = keepsakeData.eventTemplates.find((entry) => entry.id === eventId); if (!item) return; const now = Date.now(); keepsakeData.eventTemplates.push({ ...item, id: global.TravelerKeepsake.generateId('event'), source: 'user', title: `${item.title}（自定义）`, createdAt: now, updatedAt: now }); try { await global.TravelerKeepsake.save(keepsakeData); renderEventTemplates(); global.showNotification?.('已复制为自定义事件', 'success'); } catch (error) { showKeepsakeError(error); } }
    async function deleteEvent(eventId) { const item = keepsakeData.eventTemplates.find((entry) => entry.id === eventId); if (!item || item.source !== 'user' || !global.confirm(`删除事件“${item.title}”吗？这只会删除事件词条，不会影响已经发生的旅途见闻。`)) return; const previous = keepsakeData.eventTemplates; keepsakeData.eventTemplates = previous.filter((entry) => entry.id !== eventId); try { await global.TravelerKeepsake.save(keepsakeData); renderEventTemplates(); global.showNotification?.('事件词条已删除', 'success'); } catch (error) { keepsakeData.eventTemplates = previous; showKeepsakeError(error); } }

    function renderCategoryManager() {
        const list = document.getElementById('traveler-keepsake-category-list'); if (!list) return;
        list.innerHTML = (keepsakeData.eventCategories || []).map((category) => { const count = (keepsakeData.eventTemplates || []).filter((item) => item.categoryId === category.id).length; return `<div class="traveler-category-row"><span>${escapeHtml(category.name)} <small>${count} 条事件</small></span>${category.source === 'system' ? '<em>系统</em>' : `<span class="traveler-category-actions"><button type="button" data-category-edit="${escapeHtml(category.id)}" aria-label="编辑类别"><i class="fas fa-pen"></i></button><button type="button" data-category-delete="${escapeHtml(category.id)}" aria-label="删除类别"><i class="fas fa-trash"></i></button></span>`}</div>`; }).join('');
        list.querySelectorAll('[data-category-edit]').forEach((button) => button.addEventListener('click', () => editCategory(button.dataset.categoryEdit)));
        list.querySelectorAll('[data-category-delete]').forEach((button) => button.addEventListener('click', () => deleteCategory(button.dataset.categoryDelete)));
    }
    async function manageEventCategories() { renderCategoryManager(); const modal = document.getElementById('traveler-keepsake-category-modal'); modal.setAttribute('aria-hidden', 'false'); if (typeof global.showModal === 'function') global.showModal(modal); else modal.style.display = 'flex'; }
    async function addEventCategory() { const name = global.prompt('输入新的自定义事件类别名称：'); if (!name || !name.trim()) return; const clean = name.trim(); if ((keepsakeData.eventCategories || []).some((category) => category.name === clean)) return global.showNotification?.('类别名称已存在', 'warning'); keepsakeData.eventCategories.push({ id: global.TravelerKeepsake.generateId('category'), name: clean, source: 'user', createdAt: Date.now() }); try { await global.TravelerKeepsake.save(keepsakeData); renderCategoryManager(); renderEventTemplates(); global.showNotification?.('自定义类别已添加', 'success'); } catch (error) { showKeepsakeError(error); } }
    async function editCategory(categoryId) { const category = keepsakeData.eventCategories.find((entry) => entry.id === categoryId); if (!category || category.source === 'system') return; const name = global.prompt('修改类别名称：', category.name); if (!name || !name.trim() || name.trim() === category.name) return; const clean = name.trim(); if (keepsakeData.eventCategories.some((entry) => entry.id !== categoryId && entry.name === clean)) return global.showNotification?.('类别名称已存在', 'warning'); category.name = clean; try { await global.TravelerKeepsake.save(keepsakeData); renderCategoryManager(); renderEventTemplates(); global.showNotification?.('类别已更新', 'success'); } catch (error) { showKeepsakeError(error); } }
    async function deleteCategory(categoryId) { const category = keepsakeData.eventCategories.find((entry) => entry.id === categoryId); if (!category || category.source === 'system' || !global.confirm(`删除类别“${category.name}”吗？相关事件会保留，但会解除类别关联。`)) return; keepsakeData.eventTemplates.forEach((item) => { if (item.categoryId === categoryId) item.categoryId = null; }); keepsakeData.eventCategories = keepsakeData.eventCategories.filter((entry) => entry.id !== categoryId); try { await global.TravelerKeepsake.save(keepsakeData); renderCategoryManager(); renderEventTemplates(); global.showNotification?.('类别已删除，事件仍然保留', 'success'); } catch (error) { showKeepsakeError(error); } }

    function renderChapterDetail(chapterId) {
        const chapter = (keepsakeData?.chapters || []).find((item) => item.id === chapterId);
        const panel = document.getElementById('traveler-keepsake-panel');
        if (!chapter || !panel) return;
        const labels = [['observations', '旅途见闻', 'fa-eye'], ['keepsakes', '珍藏之物', 'fa-gem'], ['gifts', '礼物簿', 'fa-gift'], ['quotes', '言语摘录', 'fa-quote-left'], ['chronicles', '旅途编年史', 'fa-scroll']];
        const counts = labels.map(([name, title, icon]) => `<div class="traveler-chapter-count"><i class="fas ${icon}"></i><span>${title}</span><strong>${global.TravelerKeepsake.getRecordsForChapter(keepsakeData, name, chapterId).length}</strong></div>`).join('');
        panel.innerHTML = `<button type="button" class="traveler-keepsake-back" id="back-to-traveler-chapters"><i class="fas fa-arrow-left"></i> 返回旅途篇章</button><div class="traveler-chapter-detail"><div class="traveler-chapter-detail-cover">${chapter.cover ? `<img src="${escapeHtml(chapter.cover)}" alt="">` : '<i class="fas fa-map-marked-alt"></i>'}</div><div class="traveler-chapter-detail-body"><div class="traveler-chapter-top"><h2>${escapeHtml(chapter.title || '未命名篇章')}</h2><span class="traveler-chapter-status ${chapter.status === 'completed' ? 'completed' : 'active'}">${chapter.status === 'completed' ? '已结束' : '进行中'}</span></div><p>${escapeHtml(chapter.summary || '这段旅途尚未写下简介。')}</p><div class="traveler-chapter-detail-meta">开始：${formatDate(chapter.startDate)}<br>结束：${chapter.endDate ? formatDate(chapter.endDate) : '仍在旅途中'}</div></div></div><div class="traveler-chapter-counts">${counts}</div><div class="traveler-keepsake-empty"><i class="fas fa-feather"></i><p>这段篇章还没有关联的纪事。沿途的见闻与收藏，正在等待被写下。</p></div>`;
        document.getElementById('back-to-traveler-chapters').addEventListener('click', renderChapterList);
    }

    function openChapterForm(chapterId) {
        const form = document.getElementById('traveler-keepsake-chapter-form');
        const chapter = chapterId ? (keepsakeData?.chapters || []).find((item) => item.id === chapterId) : null;
        if (!form) return;
        editingChapterId = chapterId || null;
        draftChapterCover = chapter?.cover || '';
        document.getElementById('traveler-keepsake-form-title').textContent = chapter ? '编辑旅途篇章' : '开启新旅程';
        form.elements.title.value = chapter?.title || '';
        form.elements.summary.value = chapter?.summary || '';
        form.elements.startDate.value = chapter?.startDate || todayString();
        form.elements.endDate.value = chapter?.endDate || '';
        form.elements.status.value = chapter?.status === 'completed' ? 'completed' : 'active';
        renderCoverPreview();
        const modal = document.getElementById('traveler-keepsake-form-modal');
        modal.setAttribute('aria-hidden', 'false');
        if (typeof global.showModal === 'function') global.showModal(modal); else modal.style.display = 'flex';
    }

    function closeChapterForm() { const modal = document.getElementById('traveler-keepsake-form-modal'); modal.setAttribute('aria-hidden', 'true'); if (typeof global.hideModal === 'function') global.hideModal(modal); else modal.style.display = 'none'; editingChapterId = null; }

    function renderCoverPreview() {
        const preview = document.getElementById('traveler-keepsake-cover-preview');
        if (!preview) return;
        preview.innerHTML = draftChapterCover
            ? `<img src="${escapeHtml(draftChapterCover)}" alt="当前篇章封面">`
            : '<i class="fas fa-map-marked-alt"></i><span>默认地图装饰</span>';
    }

    async function handleCoverFile(file) {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
            global.showNotification?.('请选择 JPG、PNG 或 WEBP 图片', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            global.showNotification?.('封面图片不能超过 10MB', 'error');
            return;
        }
        try {
            if (typeof global.optimizeImage !== 'function') throw new Error('图片处理工具不可用');
            const processed = await global.optimizeImage(file, 800, 0.7);
            if (typeof processed !== 'string' || !processed.startsWith('data:image/')) throw new Error('图片处理结果无效');
            draftChapterCover = processed;
            renderCoverPreview();
        } catch (error) {
            console.error('[travelerKeepsakeUI] 封面处理失败:', error);
            global.showNotification?.('封面图片读取或处理失败，原封面未改变', 'error', 5000);
        }
    }

    async function submitChapterForm(event) {
        event.preventDefault();
        if (!keepsakeData) return showKeepsakeError(new Error('纪事匣数据尚未加载'));
        const form = event.currentTarget;
        const title = form.elements.title.value.trim();
        if (!title) return global.showNotification?.('请先写下篇章名称', 'warning');
        const now = Date.now();
        const wasEditing = Boolean(editingChapterId);
        if (wasEditing) {
            const chapter = keepsakeData.chapters.find((item) => item.id === editingChapterId);
            if (!chapter) return;
            const preserved = { ...chapter };
            Object.assign(chapter, { title, summary: form.elements.summary.value.trim(), startDate: form.elements.startDate.value || todayString(), endDate: form.elements.status.value === 'completed' ? (form.elements.endDate.value || todayString()) : null, cover: draftChapterCover, status: form.elements.status.value, updatedAt: now });
            Object.keys(preserved).forEach((key) => { if (!['title', 'summary', 'startDate', 'endDate', 'cover', 'status', 'updatedAt'].includes(key)) chapter[key] = preserved[key]; });
        } else {
            keepsakeData.chapters.push({ id: global.TravelerKeepsake.generateId('chapter'), title, summary: form.elements.summary.value.trim(), cover: draftChapterCover, startDate: form.elements.startDate.value || todayString(), endDate: form.elements.status.value === 'completed' ? (form.elements.endDate.value || todayString()) : null, status: form.elements.status.value, createdAt: now, updatedAt: now });
        }
        try { await global.TravelerKeepsake.save(keepsakeData); closeChapterForm(); renderChapterList(); global.showNotification?.(wasEditing ? '篇章已更新' : '新旅程已开启', 'success'); } catch (error) { showKeepsakeError(error); }
    }

    async function deleteChapter(chapterId) {
        if (!keepsakeData) return;
        const chapter = keepsakeData.chapters.find((item) => item.id === chapterId);
        if (!chapter || !global.confirm('删除此篇章后，关联的见闻、珍藏、礼物、言语摘录和编年史将解除关联并保留，不会被删除。\n\n确定删除这个篇章吗？')) return;
        try { keepsakeData = global.TravelerKeepsake.removeChapterAndUnlinkRecords(keepsakeData, chapterId); await global.TravelerKeepsake.save(keepsakeData); renderChapterList(); global.showNotification?.('篇章已删除，关联记录已保留', 'success'); } catch (error) { showKeepsakeError(error); }
    }

    function renderSection(sectionName) {
        const config = SECTIONS[sectionName] || SECTIONS.chapters;
        const panel = document.getElementById('traveler-keepsake-panel');
        if (!panel) return;
        activeSection = SECTIONS[sectionName] ? sectionName : 'chapters';
        if (activeSection === 'chapters' && keepsakeData) { renderChapterList(); return; }
        if (activeSection === 'observations' && keepsakeData) { renderObservationsMain(); return; }
        panel.innerHTML = `
            <div class="traveler-keepsake-panel-heading">
                <div class="traveler-keepsake-panel-icon"><i class="fas ${config.icon}" aria-hidden="true"></i></div>
                <div>
                    <h2>${config.title}</h2>
                    <p>${config.description}</p>
                </div>
            </div>
            <div class="traveler-keepsake-empty">
                <i class="fas ${config.icon}" aria-hidden="true"></i>
                <p>${config.empty}</p>
            </div>
        `;
        document.querySelectorAll('.traveler-keepsake-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.keepsakeSection === activeSection);
        });
    }

    function openTravelerKeepsake() {
        const modal = document.getElementById('traveler-keepsake-modal');
        if (!modal) return;
        loadKeepsakeData().then((data) => { if (!data) return; renderSection(activeSection); modal.setAttribute('aria-hidden', 'false'); if (typeof global.showModal === 'function') global.showModal(modal); else modal.style.display = 'flex'; });
    }

    function closeTravelerKeepsake() {
        const modal = document.getElementById('traveler-keepsake-modal');
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        if (typeof global.hideModal === 'function') global.hideModal(modal);
        else modal.style.display = 'none';
    }

    global.openTravelerKeepsake = openTravelerKeepsake;
    global.closeTravelerKeepsake = closeTravelerKeepsake;

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.traveler-keepsake-tab').forEach((tab) => {
            tab.addEventListener('click', () => renderSection(tab.dataset.keepsakeSection));
        });
        document.getElementById('close-traveler-keepsake')?.addEventListener('click', closeTravelerKeepsake);
        document.getElementById('cancel-traveler-keepsake-form')?.addEventListener('click', closeChapterForm);
        document.getElementById('traveler-keepsake-chapter-form')?.addEventListener('submit', submitChapterForm);
        document.getElementById('cancel-traveler-keepsake-event-form')?.addEventListener('click', closeEventForm);
        document.getElementById('traveler-keepsake-event-form')?.addEventListener('submit', submitEventForm);
        document.getElementById('close-traveler-keepsake-category')?.addEventListener('click', () => { const modal = document.getElementById('traveler-keepsake-category-modal'); if (typeof global.hideModal === 'function') global.hideModal(modal); else modal.style.display = 'none'; });
        document.getElementById('add-traveler-keepsake-category')?.addEventListener('click', addEventCategory);
        document.getElementById('choose-traveler-keepsake-cover')?.addEventListener('click', () => document.getElementById('traveler-keepsake-chapter-cover-file')?.click());
        document.getElementById('traveler-keepsake-chapter-cover-file')?.addEventListener('change', (event) => { handleCoverFile(event.target.files?.[0]); event.target.value = ''; });
        document.getElementById('remove-traveler-keepsake-cover')?.addEventListener('click', () => { draftChapterCover = ''; renderCoverPreview(); });
        renderSection(activeSection);
    });
})(typeof window !== 'undefined' ? window : globalThis);

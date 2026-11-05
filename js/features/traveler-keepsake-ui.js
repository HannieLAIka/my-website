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
        document.getElementById('choose-traveler-keepsake-cover')?.addEventListener('click', () => document.getElementById('traveler-keepsake-chapter-cover-file')?.click());
        document.getElementById('traveler-keepsake-chapter-cover-file')?.addEventListener('change', (event) => { handleCoverFile(event.target.files?.[0]); event.target.value = ''; });
        document.getElementById('remove-traveler-keepsake-cover')?.addEventListener('click', () => { draftChapterCover = ''; renderCoverPreview(); });
        renderSection(activeSection);
    });
})(typeof window !== 'undefined' ? window : globalThis);
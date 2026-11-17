/* ==========================================
   culture.js — 药屉百宝格交互逻辑
   功能：点击抽屉展开知识面板、手风琴效果、铜环动画、
         点击视频窗口内嵌 B站 播放器
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* 更新导航登录状态 */
    const user = API.getCurrentUser();
    if (user) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    /* 文化项目数据（增强版）
       ────────────────────────────────────────────
       video：该条目的 B站 科普视频，默认为空（显示“视频待配置”占位）。
       填入链接后，点击视频窗口即可在页面内直接播放，支持以下任意写法：
         1) https://www.bilibili.com/video/BV1xx411c7mD
         2) https://www.bilibili.com/video/av170001/?p=2
         3) https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=1
         4) 只填编号：BV1xx411c7mD / av170001
       注意：内嵌他人视频请确认 UP主 授权并遵守 B站 的平台规范。 */
    var items = [
        {
            id: 1,
            name: '针灸',
            category: '经络',
            image: '/images/culture/zhenjiu.jpg',
            description: '针灸通过刺激穴位，疏通经络，调和气血，可治疗多种疾病，是中医最具代表性的外治法之一。针刺以毫针入体，得气为要；艾灸以温热之力渗透经络，二者相辅相成。',
            reference: '《灵枢·九针十二原》曰："余欲勿使被毒药，无用砭石，欲以微针通其经脉，调其血气，营其逆顺出入之会。"',
            tags: ['外治法', '经络学说', '穴位', '毫针'],
            video: ''
        },
        {
            id: 2,
            name: '推拿',
            category: '经络',
            image: '/images/culture/tuina.jpg',
            description: '推拿通过手法作用于人体体表特定部位，缓解肌肉疲劳，促进气血运行，调节脏腑功能。按、摩、推、拿、揉、捏等手法各有其妙，是中医内病外治的重要方法。',
            reference: '《黄帝内经》云："中央者，其地平以湿……故其病多痿厥寒热，其治宜导引按跷。"按跷即推拿之前身。',
            tags: ['外治法', '手法医学', '经络', '脏腑调理'],
            video: ''
        },
        {
            id: 3,
            name: '拔罐',
            category: '外治',
            image: '/images/culture/baguan.jpg',
            description: '拔罐利用负压吸附于体表，祛风散寒、活血通络，对风寒湿痹、肌肉酸痛有显著疗效。罐具材质多样，有竹罐、陶罐、玻璃罐之分，走罐、留罐、闪罐各有其法。',
            reference: '《肘后备急方》记载："以罐拔之，吸出毒血"，是最早关于拔罐疗法的文献记录，距今已有一千七百余年历史。',
            tags: ['外治法', '祛风散寒', '活血通络', '负压疗法'],
            video: ''
        },
        {
            id: 4,
            name: '艾灸',
            category: '经络',
            image: '/images/culture/aijiu.jpg',
            description: '艾灸以艾绒燃烧产生的热力刺激穴位，温经散寒、扶阳固脱，是"药之不及，针之不到"时的补充疗法。艾叶性温，能通十二经，灸之火气入体，温通之力远胜于针。',
            reference: '《扁鹊心书》云："保命之法，灼艾第一。"又曰："人于无病时常灸关元、气海……虽未得长生，亦可保百余年寿矣。"',
            tags: ['外治法', '温经散寒', '扶阳固脱', '艾绒'],
            video: ''
        },
        {
            id: 5,
            name: '刮痧',
            category: '外治',
            image: '/images/culture/guasha.jpg',
            description: '刮痧使用刮板蘸介质在体表反复刮拭，活血化瘀、排毒祛湿，对感冒、中暑、肌肉酸痛有良效。出痧之色可辨病之深浅，是民间流传甚广的自我保健方法。',
            reference: '《痧胀玉衡》为刮痧专著，详述痧症之辨治："痧在肌肤者，刮之而愈；痧在血肉者，放之而愈。"',
            tags: ['外治法', '活血化瘀', '排毒祛湿', '民间疗法'],
            video: ''
        },
        {
            id: 6,
            name: '中药炮制',
            category: '方剂',
            image: '/images/culture/paozhi.jpg',
            description: '中药炮制是药材加工的传统技艺，通过蒸、炒、炙、煅等方法改变药性，增强疗效降低毒性。同一药材经不同方法炮制，功效迥异，体现了中医用药的精细与智慧。',
            reference: '《雷公炮炙论》为最早的炮制学专著，系统总结了三百余种药材的炮制方法，奠定了中药炮制学的理论基础。',
            tags: ['方剂学', '药材加工', '减毒增效', '传统技艺'],
            video: ''
        },
        {
            id: 7,
            name: '中医四诊',
            category: '诊断',
            image: '/images/culture/zhongyisizhen.jpg',
            description: '望闻问切是中医诊断的四种基本方法——望其神色形态，闻其声音气味，问其病状所苦，切其脉象虚实。四诊合参，方能准确辨证，为施治之根基。',
            reference: '《难经·六十一难》曰："望而知之谓之神，闻而知之谓之圣，问而知之谓之工，切脉而知之谓之巧。"',
            tags: ['诊断学', '望闻问切', '辨证论治', '脉诊'],
            video: ''
        },
        {
            id: 8,
            name: '太极养生',
            category: '导引',
            image: '/images/culture/taijiyangs.jpg',
            description: '太极拳融合阴阳哲学与身体运动，以柔克刚、动静结合，是中华传统养生文化的瑰宝。长期练习可调和气血、强健筋骨、宁心安神，被联合国列为人类非物质文化遗产。',
            reference: '太极拳之理源于《易经》阴阳学说与道家思想，王宗岳《太极拳论》云："太极者，无极而生，动静之机，阴阳之母也。"',
            tags: ['导引术', '阴阳哲学', '非物质文化遗产', '养生运动'],
            video: ''
        },
        {
            id: 9,
            name: '八段锦',
            category: '导引',
            image: '/images/culture/baduanjin.jpg',
            description: '八段锦是传统导引养生功法，共八组动作，每组针对不同脏腑经络进行调理。两手托天理三焦、左右开弓似射雕……动作舒缓优美，适合各年龄段日常练习。',
            reference: '八段锦起源于宋代，至今已有八百余年历史。明代《遵生八笺》收录其完整功法，古人赞誉其为"锦"，取其动作之华美、功效之卓著。',
            tags: ['导引术', '脏腑调理', '日常养生', '传统功法'],
            video: ''
        },
        {
            id: 10,
            name: '药膳食疗',
            category: '方剂',
            image: '/images/culture/yaoshishangliao.jpg',
            description: '药膳食疗将中药与食材巧妙结合，既有食物的美味又有药物的功效，是中医"治未病"理念在日常生活中的生动体现。四季有别，体质各异，药膳配伍亦随之变化。',
            reference: '《饮膳正要》为元代忽思慧所著，是我国最早的营养学专著："善养性者，先饥而食，食勿令饱；先渴而饮，饮勿令过。"',
            tags: ['方剂学', '治未病', '食药同源', '营养学'],
            video: ''
        }
    ];

    var activeDrawerId = null;
    var releaseDrawerFocus = null;

    const cabinetGrid = document.getElementById('cabinet_grid');
    const drawerPanel = document.getElementById('drawer_panel');

    /* 构建药屉网格；数据为本地同步数据，不引入额外请求 */
    function buildCabinet() {
        if (!cabinetGrid) return;

        cabinetGrid.innerHTML = items.map(item => `
            <button type="button" class="drawer_item" data-id="${UI.escapeHtml(item.id)}"
                    aria-controls="drawer_panel" aria-expanded="false" aria-label="打开${UI.escapeHtml(item.name)}详情">
                <span class="drawer_face">
                    <span class="drawer_stamp">${UI.escapeHtml(item.category)}</span>
                    <span class="drawer_ring_wrap">
                        <span class="drawer_ring" aria-hidden="true"></span>
                    </span>
                    <span class="drawer_label">${UI.escapeHtml(item.name)}</span>
                </span>
            </button>
        `).join('');

        /* 原生按钮让抽屉天然支持 Tab、Enter 与空格 */
        cabinetGrid.querySelectorAll('.drawer_item').forEach(drawer => {
            drawer.addEventListener('click', () => {
                toggleDrawer(parseInt(drawer.dataset.id, 10), drawer);
            });
        });
    }

    /* 切换抽屉面板：先更新选中与展开状态，再填充内容，保证点击即时反馈 */
    function toggleDrawer(id, trigger) {
        if (activeDrawerId === id) {
            closePanel();
            return;
        }

        const item = items.find(i => i.id === id);
        if (!item || !trigger) return;

        if (releaseDrawerFocus) {
            releaseDrawerFocus();
            releaseDrawerFocus = null;
        }
        trigger.focus({ preventScroll: true });

        /* 立即反馈，不等待图片或视频等任何后续资源 */
        cabinetGrid.querySelectorAll('.drawer_item').forEach(drawer => {
            const selected = drawer === trigger;
            drawer.classList.toggle('pressed', selected);
            drawer.setAttribute('aria-expanded', String(selected));
        });
        activeDrawerId = id;
        drawerPanel.classList.add('open');
        drawerPanel.setAttribute('aria-hidden', 'false');
        drawerPanel.removeAttribute('inert');

        /* 填充内容，保持现有内容顺序 */
        document.getElementById('drawer_image').src = item.image;
        document.getElementById('drawer_image').alt = item.name;
        document.getElementById('drawer_name').textContent = item.name;
        document.getElementById('drawer_category').textContent = item.category;
        document.getElementById('drawer_desc').textContent = item.description;
        document.getElementById('drawer_quote').textContent = item.reference;
        document.getElementById('drawer_tags').innerHTML = item.tags.map(t =>
            `<span class="meta_tag">${UI.escapeHtml(t)}</span>`
        ).join('');

        /* 切换视频：先销毁上一条的播放器，再按新条目重置占位画面 */
        setupVideo(item);

        releaseDrawerFocus = UI.trapFocus(drawerPanel, {
            onEscape: closePanel,
            initialFocus: document.getElementById('drawer_close')
        });

        /* 滚动面板到视野；减少动态效果时改为即时定位 */
        setTimeout(() => {
            if (activeDrawerId !== id || !drawerPanel.classList.contains('open')) return;
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            drawerPanel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
        }, 100);
    }

    /* 关闭面板并返回触发抽屉 */
    function closePanel() {
        const wasOpen = drawerPanel.classList.contains('open') || activeDrawerId !== null;
        stopVideo();
        drawerPanel.classList.remove('open');
        drawerPanel.setAttribute('aria-hidden', 'true');
        cabinetGrid.querySelectorAll('.drawer_item').forEach(drawer => {
            drawer.classList.remove('pressed');
            drawer.setAttribute('aria-expanded', 'false');
        });
        activeDrawerId = null;

        if (releaseDrawerFocus) {
            const release = releaseDrawerFocus;
            releaseDrawerFocus = null;
            release();
        }
        drawerPanel.setAttribute('inert', '');
        return wasOpen;
    }

    /* ==========================================
       科普教学视频（内嵌 B站 播放器）
       ------------------------------------------
       · 链接留空：保留暗色占位画面与“视频暂未配置”角标，点击会明确提示；
       · 填好链接：点击画面才注入 iframe（首屏不加载播放器，省流量）；
       · 切换条目 / 收起面板：直接移除 iframe，声音立即停止。
       ========================================== */

    const BILI_PLAYER = 'https://player.bilibili.com/player.html';
    const MAX_EMBED_LENGTH = 2000;   /* 防止误填超长内容 */

    const videoFrame = document.getElementById('drawer_video_frame');
    const videoPlayer = document.getElementById('drawer_video_player');
    const videoBadge = document.getElementById('drawer_video_badge');
    const videoTitle = document.getElementById('drawer_video_title');
    const videoDesc = document.getElementById('drawer_video_desc');
    const videoActions = document.getElementById('drawer_video_actions');
    const videoLink = document.getElementById('drawer_video_link');
    const videoReset = document.getElementById('drawer_video_reset');
    const videoStop = document.getElementById('drawer_video_stop');

    let currentVideo = null;      /* { embed, page }，null 表示未配置 */
    let currentItemName = '';

    /* 把各种写法的 B站 地址解析成可内嵌的播放器地址与站内地址 */
    function parseBiliVideo(input) {
        const raw = String(input || '').trim();
        if (!raw || raw.length > MAX_EMBED_LENGTH) return null;

        /* 只识别 bilibili.com 来源，避免被填进任意第三方页面 */
        const isBiliUrl = /^(?:https?:)?\/\//i.test(raw)
            ? /^(?:https?:)?\/\/(?:[\w-]+\.)*bilibili\.com(?::\d+)?\//i.test(raw)
            : true;   /* 只填编号（BVxxx / avxxx）时没有协议头 */
        if (!isBiliUrl) return null;

        const bvid = ((raw.match(/BV[0-9A-Za-z]{10}/i) || [])[0] || '').replace(/^bv/i, 'BV');
        const aidMatch = raw.match(/(?:^|[^\dA-Za-z])(?:av|aid=)(\d+)/i);
        const aid = aidMatch ? aidMatch[1] : '';
        const pageMatch = raw.match(/[?&](?:page|p)=(\d+)/i);
        const page = Math.max(1, parseInt(pageMatch ? pageMatch[1] : '1', 10) || 1);

        /* 已经是播放器地址、但解析不出编号（ep / ss / 合集等）：原样内嵌 */
        if (!bvid && !aid) {
            if (!/^(?:https?:)?\/\/player\.bilibili\.com\/player\.html/i.test(raw)) return null;
            return { embed: raw.replace(/^(?:https?:)?\/\//i, 'https://'), page: '' };
        }

        return {
            embed: BILI_PLAYER + '?' + (bvid ? 'bvid=' + bvid : 'aid=' + aid) +
                   '&page=' + page + '&high_quality=1&danmaku=1&as_wide=1',
            page: 'https://www.bilibili.com/video/' + (bvid || 'av' + aid) +
                  (page > 1 ? '/?p=' + page : '')
        };
    }

    /* 拼接查询参数（地址里可能已经有 ? ） */
    function withQuery(url, query) {
        if (!url) return url;
        return url + (url.indexOf('?') > -1 ? '&' : '?') + query;
    }

    /* 销毁 iframe：只隐藏的话音频会继续播放 */
    function stopVideo() {
        if (videoPlayer) videoPlayer.innerHTML = '';
        if (videoFrame) videoFrame.classList.remove('is_playing');
        if (videoActions) videoActions.hidden = true;
    }

    function notifyMissingVideo() {
        const message = '该视频暂未配置';
        if (videoDesc) {
            videoDesc.textContent = message + (currentItemName ? '：「' + currentItemName + '」' : '') + '的科普教学视频正在整理中。';
        }
        UI.toast(message, 'info');
    }

    function activateVideo() {
        if (currentVideo) playVideo();
        else notifyMissingVideo();
    }

    /* 点击画面后注入播放器 */
    function playVideo() {
        if (!currentVideo || !currentVideo.embed || !videoPlayer || !videoFrame) return;
        if (videoFrame.classList.contains('is_playing')) return;

        const iframe = document.createElement('iframe');
        /* 用户点击后才创建 iframe，这里带 autoplay 让播放器直接开始 */
        iframe.src = withQuery(currentVideo.embed, 'autoplay=1');
        iframe.title = (currentItemName ? currentItemName + ' · ' : '') + '科普教学视频';
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('scrolling', 'no');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        iframe.setAttribute('tabindex', '0');

        videoPlayer.innerHTML = '';
        videoPlayer.appendChild(iframe);

        videoFrame.classList.add('is_playing');
        if (videoActions) videoActions.hidden = false;
        if (videoLink) {
            videoLink.hidden = !currentVideo.page;
            if (currentVideo.page) videoLink.href = currentVideo.page;
        }
    }

    /* 按条目重置视频区（无论有没有配置都能安全调用） */
    function setupVideo(item) {
        stopVideo();
        currentItemName = item ? item.name : '';
        currentVideo = parseBiliVideo(item && item.video);

        if (!videoFrame) return;

        /* 没有配置链接：保留键盘可达的说明入口，点击与回车都会明确提示 */
        if (!currentVideo) {
            videoFrame.classList.add('is_empty');
            videoFrame.classList.remove('has_poster', 'is_playing');
            videoFrame.style.removeProperty('--video-poster');
            videoFrame.setAttribute('role', 'button');
            videoFrame.setAttribute('tabindex', '0');
            videoFrame.removeAttribute('aria-disabled');
            videoFrame.setAttribute('aria-label', '该视频暂未配置，激活查看说明');
            if (videoBadge) {
                videoBadge.hidden = false;
                videoBadge.textContent = '视频暂未配置';
            }
            if (videoTitle) videoTitle.textContent = '「' + item.name + '」视频暂未配置';
            if (videoDesc) videoDesc.textContent = '该视频暂未配置：「' + item.name + '」的科普教学视频正在整理中。';
            if (videoLink) videoLink.hidden = true;
            if (videoActions) videoActions.hidden = true;
            return;
        }

        /* 已配置：恢复可点击状态，并用条目配图作封面 */
        videoFrame.classList.remove('is_empty');
        videoFrame.classList.add('has_poster');
        videoFrame.style.setProperty('--video-poster', 'url("' + item.image + '")');
        videoFrame.setAttribute('role', 'button');
        videoFrame.setAttribute('tabindex', '0');
        videoFrame.removeAttribute('aria-disabled');
        videoFrame.setAttribute('aria-label', '播放「' + item.name + '」科普教学视频');
        if (videoBadge) videoBadge.hidden = true;
        if (videoTitle) videoTitle.textContent = '相关科普教学视频';
        if (videoDesc) {
            videoDesc.textContent = '点击上方画面，即可在此内嵌播放「' + item.name +
                '」的历史渊源、操作演示与临床应用讲解；播放中可随时收起或前往 B站 观看完整视频。';
        }
        if (videoLink) videoLink.hidden = true;
        if (videoActions) videoActions.hidden = true;
    }

    /* 点击画面播放或说明未配置状态（键盘 Enter / 空格同样可用） */
    if (videoFrame) {
        videoFrame.addEventListener('click', activateVideo);
        videoFrame.addEventListener('keydown', (e) => {
            if (UI.isComposing(e)) return;
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                activateVideo();
            }
        });
    }

    /* 重新加载：销毁后重建，卡住时可以直接点 */
    if (videoReset) {
        videoReset.addEventListener('click', () => {
            stopVideo();
            playVideo();
        });
    }

    /* 收起：回到占位画面，避免面板内继续播放 */
    if (videoStop) {
        videoStop.addEventListener('click', () => {
            stopVideo();
        });
    }

    /* 关闭按钮 */
    document.getElementById('drawer_close').addEventListener('click', closePanel);

    /* 初始化 */
    buildCabinet();
});

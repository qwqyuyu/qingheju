/* ==========================================
   api.js — 后端接口层
   对接 Express + MySQL 后端，使用 fetch() 通信
   ========================================== */

const API = (() => {

    const BASE = '';  /* 同源，使用相对路径 */

    /* 本地日期（优先复用 common.js 的 localDate） */
    function localDateStr(date) {
        if (typeof window !== 'undefined' && typeof window.localDate === 'function') {
            return window.localDate(date);
        }
        const d = date instanceof Date ? date : new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    /* 获取存储的 token */
    function getToken() {
        return localStorage.getItem('auth_token') || '';
    }

    /* 通用请求封装 */
    async function request(method, url, body) {
        const headers = { 'Content-Type': 'application/json' };
        const token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(BASE + url, opts);
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('API error:', url, err);
            return { success: false, message: '网络错误，请稍后重试' };
        }
    }

    function get(url)  { return request('GET', url); }
    function post(url, body) { return request('POST', url, body); }
    function put(url, body)  { return request('PUT', url, body); }
    function del(url)  { return request('DELETE', url); }

    /* ============ 用户模块 ============ */

    async function register(username, email, password) {
        const result = await post('/api/register', { username, email, password });
        if (result.success) {
            localStorage.setItem('auth_token', result.data.token);
            localStorage.setItem('current_user', JSON.stringify({
                id: result.data.id, username: result.data.username,
                avatar: result.data.avatar || 'images/ui/default_avatar.svg',
                is_admin: false
            }));
        }
        return result;
    }

    async function login(username, password) {
        const result = await post('/api/login', { username, password });
        if (result.success) {
            localStorage.setItem('auth_token', result.data.token);
            localStorage.setItem('current_user', JSON.stringify({
                id: result.data.id, username: result.data.username,
                avatar: result.data.avatar, is_admin: !!result.data.is_admin
            }));
        }
        return result;
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem('current_user') || 'null');
    }

    async function getUser() {
        return await get('/api/user');
    }

    function logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
    }

    async function updateAvatar(imageData) {
        const result = await put('/api/user/avatar', { avatar: imageData });
        if (result.success) {
            const user = getCurrentUser();
            if (user) {
                /* 服务端返回带版本的 URL；回退到本地预览图 */
                user.avatar = (result.data && result.data.avatar) || imageData;
                localStorage.setItem('current_user', JSON.stringify(user));
            }
        }
        return result;
    }

    async function updateUsername(newUsername) {
        const result = await put('/api/user/username', { username: newUsername });
        if (result.success) {
            const user = getCurrentUser();
            user.username = newUsername;
            localStorage.setItem('current_user', JSON.stringify(user));
        }
        return result;
    }

    async function updatePassword(oldPassword, newPassword) {
        return await put('/api/user/password', { oldPassword, newPassword });
    }

    /* ============ 药材模块（暂保留本地数据） ============ */

    var HERBS_DATA = [
        { id: 1, name: '枸杞', pinyin: 'gouqi', category: '补血类', image: 'images/herbs/gouqi.png', nature: '性平，味甘', meridian: '归肝、肾经', effect: '滋补肝肾，益精明目。用于虚劳精亏、腰膝酸痛、眩晕耳鸣、目昏不明。', seasonalTips: { spring: '春季可与菊花配伍泡茶，养肝明目', summer: '夏季可与银耳、莲子煲汤，滋阴润燥', autumn: '秋季可与雪梨炖食，润肺止咳', winter: '冬季可与羊肉炖汤，温补肾阳' }, reference: '《中国药典》2020年版' },
        { id: 2, name: '当归', pinyin: 'danggui', category: '补血类', image: 'images/herbs/danggui.jpg', nature: '性温，味甘辛', meridian: '归肝、心、脾经', effect: '补血活血，调经止痛，润肠通便。用于血虚萎黄、眩晕心悸、月经不调、经闭痛经。', seasonalTips: { spring: '春季可与黄芪炖鸡，气血双补', summer: '夏季少量使用，可配红枣煮水饮用', autumn: '秋季可与党参、黄芪炖汤补气血', winter: '冬季制作当归生姜羊肉汤，温经散寒' }, reference: '《中国药典》2020年版' },
        { id: 3, name: '黄芪', pinyin: 'huangqi', category: '补气类', image: 'images/herbs/huangqi.jpg', nature: '性温，味甘', meridian: '归肺、脾经', effect: '补气升阳，固表止汗，利水消肿。用于气虚乏力、食少便溏、中气下陷。', seasonalTips: { spring: '春季可与防风、白术配伍，益气固表', summer: '夏季可与西洋参泡水，补气不燥', autumn: '秋季可与山药炖汤，补脾益肺', winter: '冬季可与当归炖鸡，气血双补暖身' }, reference: '《中国药典》2020年版' },
        { id: 4, name: '菊花', pinyin: 'juhua', category: '清热类', image: 'images/herbs/juhua.jpg', nature: '性微寒，味甘苦', meridian: '归肺、肝经', effect: '散风清热，平肝明目，清热解毒。用于风热感冒、头痛眩晕、目赤肿痛。', seasonalTips: { spring: '春季可与枸杞泡茶，养肝明目首选', summer: '夏季可与金银花泡茶，清热解暑', autumn: '秋季可搭配蜂蜜饮用，润燥明目', winter: '冬季可少量搭配红枣中和寒性饮用' }, reference: '《中国药典》2020年版' },
        { id: 5, name: '金银花', pinyin: 'jinyinhua', category: '清热类', image: 'images/herbs/jinyinhua.jpg', nature: '性寒，味甘', meridian: '归肺、心、胃经', effect: '清热解毒，疏散风热。用于痈肿疔疮、喉痹、丹毒、风热感冒、温病发热。', seasonalTips: { spring: '春季可预防流感，与甘草泡水饮用', summer: '夏季与菊花泡茶，清热消暑效果佳', autumn: '秋季可用于缓解秋燥引起的咽喉不适', winter: '冬季可少量使用，与生姜搭配中和寒性' }, reference: '《中国药典》2020年版' },
        { id: 6, name: '山药', pinyin: 'shanyao', category: '补气类', image: 'images/herbs/shanyao.jpg', nature: '性平，味甘', meridian: '归脾、肺、肾经', effect: '补脾养胃，生津益肺，补肾涩精。用于脾虚食少、久泻不止、肺虚喘咳。', seasonalTips: { spring: '春季可与红枣煮粥，健脾养胃', summer: '夏季可与薏米煲汤，健脾祛湿', autumn: '秋季可与百合炖食，润肺生津', winter: '冬季可与排骨炖汤，健脾补肾' }, reference: '《中国药典》2020年版' },
        { id: 7, name: '茯苓', pinyin: 'fuling', category: '祛湿类', image: 'images/herbs/fuling.jpg', nature: '性平，味甘淡', meridian: '归心、肺、脾、肾经', effect: '利水渗湿，健脾宁心。用于水肿尿少、痰饮眩悸、脾虚食少、便溏泄泻。', seasonalTips: { spring: '春季可与白术煮水，健脾祛湿', summer: '夏季可与薏米、赤小豆煲汤，祛暑湿', autumn: '秋季可与山药煮粥，健脾润燥', winter: '冬季可少量使用，与温性食材搭配' }, reference: '《中国药典》2020年版' },
        { id: 8, name: '薏苡仁', pinyin: 'yiyiren', category: '祛湿类', image: 'images/herbs/yiyiren.jpg', nature: '性凉，味甘淡', meridian: '归脾、胃、肺经', effect: '利水渗湿，健脾止泻，清热排脓。用于水肿、脚气、小便不利、脾虚泄泻。', seasonalTips: { spring: '春季可与红豆煮粥，健脾祛湿', summer: '夏季与冬瓜煲汤，清热利湿消水肿', autumn: '秋季可与百合煮粥，润燥健脾', winter: '冬季可少量使用，与红枣搭配中和凉性' }, reference: '《中国药典》2020年版' },
        { id: 9, name: '桂圆（龙眼肉）', pinyin: 'guiyuan', category: '补血类', image: 'images/herbs/guiyuan.jpg', nature: '性温，味甘', meridian: '归心、脾经', effect: '补益心脾，养血安神。用于气血不足、心悸怔忡、健忘失眠、血虚萎黄。', seasonalTips: { spring: '春季可与红枣泡茶，补血养心', summer: '夏季可少量食用，与莲子煮汤安神', autumn: '秋季可与银耳炖食，滋阴养血', winter: '冬季可与生姜红糖煮水，暖宫驱寒' }, reference: '《中国药典》2020年版' },
        { id: 10, name: '百合', pinyin: 'baihe', category: '滋阴类', image: 'images/herbs/baihe.jpg', nature: '性微寒，味甘', meridian: '归心、肺经', effect: '养阴润肺，清心安神。用于阴虚燥咳、劳嗽咳血、虚烦惊悸、失眠多梦。', seasonalTips: { spring: '春季可与银耳炖汤，润肺养颜', summer: '夏季可与绿豆煮汤，清心安神', autumn: '秋季与雪梨炖食，润肺止咳效果佳', winter: '冬季可少量使用，与桂圆搭配安神助眠' }, reference: '《中国药典》2020年版' },
        { id: 11, name: '麦冬', pinyin: 'maidong', category: '滋阴类', image: 'images/herbs/maidong.jpg', nature: '性微寒，味甘微苦', meridian: '归心、肺、胃经', effect: '养阴生津，润肺清心。用于肺燥干咳、阴虚劳嗽、津伤口渴、心烦失眠。', seasonalTips: { spring: '春季可与沙参泡水，滋阴润肺', summer: '夏季可与西洋参泡水，益气生津', autumn: '秋季可与雪梨炖食，润燥生津效果好', winter: '冬季可少量使用，与枸杞搭配滋阴' }, reference: '《中国药典》2020年版' },
        { id: 12, name: '莲子', pinyin: 'lianzi', category: '补气类', image: 'images/herbs/lianzi.jpg', nature: '性平，味甘涩', meridian: '归脾、肾、心经', effect: '补脾止泻，益肾涩精，养心安神。用于脾虚泄泻、遗精、心悸失眠。', seasonalTips: { spring: '春季可与山药煮粥，健脾养胃', summer: '夏季与百合、银耳炖汤，清心安神', autumn: '秋季可与芡实煮粥，补脾固肾', winter: '冬季可与桂圆煮汤，温补心脾' }, reference: '《中国药典》2020年版' },
        { id: 13, name: '陈皮', pinyin: 'chenpi', category: '祛湿类', image: 'images/herbs/chenpi.jpg', nature: '性温，味辛苦', meridian: '归肺、脾经', effect: '理气健脾，燥湿化痰。用于脘腹胀满、食少吐泻、咳嗽痰多。', seasonalTips: { spring: '春季可与普洱茶同泡，理气化痰', summer: '夏季与绿豆汤同煮，解暑化湿', autumn: '秋季与雪梨炖食，润肺化痰', winter: '冬季与生姜煮水，温中散寒化痰' }, reference: '《中国药典》2020年版' },
        { id: 14, name: '红枣', pinyin: 'hongzao', category: '补血类', image: 'images/herbs/hongzao.jpg', nature: '性温，味甘', meridian: '归脾、胃、心经', effect: '补中益气，养血安神。用于脾虚食少、乏力便溏、妇人脏躁。', seasonalTips: { spring: '春季可与枸杞泡茶，益气养血', summer: '夏季可与绿豆同煮，中和凉性', autumn: '秋季与银耳炖汤，滋阴润燥', winter: '冬季与生姜红糖同煮，暖身驱寒' }, reference: '《中国药典》2020年版' },
        { id: 15, name: '生姜', pinyin: 'shengjiang', category: '温阳类', image: 'images/herbs/shengjiang.jpg', nature: '性微温，味辛', meridian: '归肺、脾、胃经', effect: '解表散寒，温中止呕，化痰止咳。用于风寒感冒、胃寒呕吐、寒痰咳嗽。', seasonalTips: { spring: '春季可泡红糖姜茶，驱散春寒', summer: '夏季可少量使用', autumn: '秋季可与陈皮煮水，驱寒暖胃', winter: '冬季与红枣红糖煮茶，暖身驱寒首选' }, reference: '《中国药典》2020年版' },
        { id: 16, name: '山楂', pinyin: 'shanzha', category: '清热类', image: 'images/herbs/shanzha.jpg', nature: '性微温，味酸甘', meridian: '归脾、胃、肝经', effect: '消食健胃，行气散瘀，化浊降脂。用于肉食积滞、胃脘胀满、高脂血症。', seasonalTips: { spring: '春季可泡山楂蜂蜜水，开胃消食', summer: '夏季可与荷叶泡茶，消暑降脂', autumn: '秋季饭后食用，助消化解油腻', winter: '冬季炖肉时加入，去腥解腻助消化' }, reference: '《中国药典》2020年版' },
        { id: 17, name: '肉桂', pinyin: 'rougui', category: '温阳类', image: 'images/herbs/rougui.jpg', nature: '性大热，味辛甘', meridian: '归肾、脾、心、肝经', effect: '补火助阳，引火归元，散寒止痛，温通经脉。用于阳痿宫冷、腰膝冷痛。', seasonalTips: { spring: '春季少量使用，避免上火', summer: '夏季不宜多用，易上火伤阴', autumn: '秋季可少量加入炖品，温中散寒', winter: '冬季炖羊肉时加入，温补肾阳效果好' }, reference: '《中国药典》2020年版' },
        { id: 18, name: '银耳', pinyin: 'yiner', category: '滋阴类', image: 'images/herbs/yiner.jpg', nature: '性平，味甘淡', meridian: '归肺、胃经', effect: '滋阴润肺，养胃生津。用于虚劳咳嗽、痰中带血、津少口渴、病后体虚。', seasonalTips: { spring: '春季可与红枣炖汤，滋阴养颜', summer: '夏季可与莲子百合炖，清润消暑', autumn: '秋季与雪梨炖食，润肺防燥最佳', winter: '冬季与枸杞炖汤，滋阴润燥养颜' }, reference: '《中国药典》2020年版' },
        { id: 19, name: '党参', pinyin: 'dangshen', category: '补气类', image: 'images/herbs/dangshen.jpg', nature: '性平，味甘', meridian: '归脾、肺经', effect: '健脾益肺，养血生津。用于脾肺气虚、食少倦怠、咳嗽虚喘、气血不足。', seasonalTips: { spring: '春季可与黄芪炖鸡，补气健脾', summer: '夏季少量使用，与麦冬搭配益气生津', autumn: '秋季与山药炖汤，补脾益肺', winter: '冬季与当归炖汤，气血双补暖身' }, reference: '《中国药典》2020年版' },
        { id: 20, name: '杜仲', pinyin: 'duzhong', category: '温阳类', image: 'images/herbs/duzhong.jpg', nature: '性温，味甘', meridian: '归肝、肾经', effect: '补肝肾，强筋骨，安胎。用于肝肾不足、腰膝酸痛、筋骨无力、头晕目眩。', seasonalTips: { spring: '春季可与枸杞泡酒，补肝肾强筋骨', summer: '夏季少量使用，煲汤时加入', autumn: '秋季可与核桃炖汤，强筋健骨', winter: '冬季与牛膝炖汤，温补肾阳强腰膝' }, reference: '《中国药典》2020年版' }
    ];

    async function getHerbs(category) {
        if (!category || category === 'all') return { success: true, data: HERBS_DATA };
        return { success: true, data: HERBS_DATA.filter(function(h) { return h.category === category; }) };
    }

    /* ============ 帖子模块 ============ */

    async function getPosts(options) {
        const params = new URLSearchParams();
        if (options) {
            if (options.page) params.set('page', options.page);
            if (options.pageSize) params.set('pageSize', options.pageSize);
            if (options.username) params.set('username', options.username);
        }
        const qs = params.toString();
        return await get('/api/posts' + (qs ? '?' + qs : ''));
    }

    async function getPost(postId) {
        return await get('/api/posts/' + postId);
    }

    async function createPost(title, content, image, imageThumb) {
        return await post('/api/posts', {
            title,
            content,
            image: image || '',
            imageThumb: imageThumb || ''
        });
    }

    async function deletePost(postId) {
        return await del('/api/posts/' + postId);
    }

    async function likePost(postId) {
        return await post('/api/posts/' + postId + '/like');
    }

    async function setFeatured(postId, featured) {
        return await put('/api/posts/' + postId + '/feature', { featured: !!featured });
    }

    async function addComment(postId, content) {
        return await post('/api/posts/' + postId + '/comments', { content });
    }

    async function deleteComment(postId, commentId) {
        return await del('/api/comments/' + commentId);
    }

    async function getComments(postId) {
        return await get('/api/posts/' + postId + '/comments');
    }

    /* ============ 签到模块 ============ */

    async function checkin() {
        return await post('/api/checkin');
    }

    async function getCheckinHistory() {
        return await get('/api/checkin');
    }

    /* ============ 节气模块 ============ */

    async function getSolarTerms(year) {
        var url = '/api/solarterms';
        if (year) url += '?year=' + encodeURIComponent(year);
        return await get(url);
    }

    async function getCurrentSolarTerm() {
        var result = await getSolarTerms();
        var terms = result.data;
        if (!terms || terms.length === 0) return null;
        var today = localDateStr();
        for (var i = terms.length - 1; i >= 0; i--) {
            if (terms[i].date <= today) return terms[i];
        }
        return terms[0];
    }

    /* ============ AI 聊天模块 ============ */

    async function aiChat(messages) {
        return await post('/api/ai/chat', { messages: messages });
    }

    /* 流式 AI：服务端返回 SSE 时逐段回调 onDelta；AI_STREAM=false 时自动按 JSON 处理 */
    async function aiChatStream(messages, onDelta) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        };
        const token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        let res;
        try {
            res = await fetch(BASE + '/api/ai/chat', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ messages: messages })
            });
        } catch (e) {
            return { success: false, msg: '网络错误，请稍后重试' };
        }

        /* 未登录 / token 过期：交给页面跳转登录 */
        if (res.status === 401) {
            const data = await res.json().catch(function () { return null; });
            return { success: false, needLogin: true, msg: (data && data.message) || '请先登录' };
        }

        const type = (res.headers.get('content-type') || '').toLowerCase();

        /* 服务端关闭流式时，按普通 JSON 处理 */
        if (type.indexOf('application/json') >= 0) {
            const data = await res.json().catch(function () { return null; });
            if (data && data.code === 200 && data.data) {
                if (typeof onDelta === 'function') onDelta(data.data.reply || '');
                return { success: true, data: data.data };
            }
            return { success: false, msg: (data && data.msg) || 'AI 服务暂时不可用' };
        }

        if (!res.body || typeof res.body.getReader !== 'function') {
            return { success: false, msg: '当前浏览器不支持流式输出' };
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let reply = '';
        let meta = {};
        let errorMsg = '';

        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                buffer += decoder.decode(chunk.value, { stream: true });

                let index;
                while ((index = buffer.indexOf('\n\n')) >= 0) {
                    const block = buffer.slice(0, index);
                    buffer = buffer.slice(index + 2);

                    for (const line of block.split('\n')) {
                        if (line.indexOf('data:') !== 0) continue;
                        const payload = line.slice(5).trim();
                        if (!payload) continue;

                        let event;
                        try { event = JSON.parse(payload); } catch (e) { continue; }

                        if (event.delta) {
                            reply += event.delta;
                            if (typeof onDelta === 'function') onDelta(event.delta);
                        } else if (event.error) {
                            errorMsg = event.error;
                        } else if (event.done) {
                            meta = event;
                        }
                    }
                }
            }
        } catch (e) {
            errorMsg = '网络中断，请稍后重试';
        }

        if (errorMsg && !reply) return { success: false, msg: errorMsg };
        if (!reply) return { success: false, msg: errorMsg || 'AI 返回内容为空' };

        return {
            success: true,
            data: { reply: reply, model: meta.model, format: meta.format }
        };
    }

    function isTodaySolarTerm(solarTerms) {
        var today = localDateStr();
        return solarTerms.find(function(t) { return t.date === today; }) || null;
    }

    /* 暴露接口 */
    return {
        register, login, logout, getCurrentUser, getUser,
        updateAvatar, updateUsername, updatePassword,
        getHerbs,
        getPosts, getPost, createPost, deletePost, likePost, setFeatured,
        addComment, deleteComment, getComments,
        checkin, getCheckinHistory,
        getSolarTerms, getCurrentSolarTerm, isTodaySolarTerm,
        aiChat, aiChatStream
    };
})();

/* ==========================================
   recipe.js — 食谱养生交互逻辑
   板块一：药材百科（API数据 + 分类筛选 + 搜索 + 详情弹窗）
   板块二：时令食谱（内嵌12道夏季食谱 + 分类筛选 + 详情弹窗）
   ========================================== */

/* ══════════════════════════════════════════
   内嵌食谱数据（板块二）
   ══════════════════════════════════════════ */
var RECIPES = [
    /* ── 汤羹 ── */
    {
        id: 1,
        name: '绿豆百合汤',
        category: '汤羹',
        difficulty: '简单',
        time: '45分钟',
        season: ['summer'],
        image: '/images/recipes/lvdoubaihetang.jpg',
        desc: '清热解暑，养心安神，是夏季消暑的经典甜汤',
        ingredients: [
            { name: '绿豆', amount: '100g' },
            { name: '百合（干）', amount: '30g' },
            { name: '冰糖', amount: '适量' },
            { name: '清水', amount: '1.5L' }
        ],
        steps: [
            '绿豆洗净，用清水浸泡2小时；百合干洗净泡发30分钟。',
            '锅中加足量清水，放入绿豆，大火煮沸后转小火煮30分钟。',
            '待绿豆开花、汤色碧绿，加入泡发好的百合，继续煮10分钟。',
            '加入适量冰糖调味，搅匀至冰糖融化即可关火。',
            '温热或放凉后饮用皆可，冷藏后风味更佳。'
        ],
        benefit: '绿豆性寒味甘，清热解毒、消暑利水；百合养阴润肺、清心安神。两味合用，是夏季暑热天气的理想饮品，尤其适合口干舌燥、心烦失眠者。脾胃虚寒者不宜过量。'
    },
    {
        id: 2,
        name: '冬瓜薏米排骨汤',
        category: '汤羹',
        difficulty: '中等',
        time: '90分钟',
        season: ['summer'],
        image: '/images/recipes/dongguayimipaigu.jpg',
        desc: '健脾祛湿，清热利尿，夏季祛湿消肿的经典靓汤',
        ingredients: [
            { name: '冬瓜', amount: '500g' },
            { name: '薏米', amount: '50g' },
            { name: '排骨', amount: '300g' },
            { name: '生姜', amount: '3片' },
            { name: '盐', amount: '适量' },
            { name: '清水', amount: '2L' }
        ],
        steps: [
            '薏米提前用清水浸泡2小时；排骨冷水下锅焯水，撇去浮沫，捞出冲洗干净。',
            '冬瓜去皮去瓤，切成大块（皮也可以保留，利水效果更好）。',
            '锅中加足量清水，放入排骨、薏米、姜片，大火煮沸后转小火煲45分钟。',
            '加入冬瓜块，继续小火煲30分钟至冬瓜透明软烂。',
            '加适量盐调味即可，无需过多调料，保持汤的清香本味。'
        ],
        benefit: '冬瓜性凉味甘淡，清热利水、消肿解毒；薏米健脾渗湿、清热排脓；排骨补中益气。此汤适合夏季湿气重、身体困重、水肿的人群，是祛湿健脾的食疗佳品。'
    },
    {
        id: 3,
        name: '苦瓜黄豆瘦肉汤',
        category: '汤羹',
        difficulty: '简单',
        time: '60分钟',
        season: ['summer'],
        image: '/images/recipes/kuguahuangdoushourou.jpg',
        desc: '清热消暑，明目解毒，苦后回甘的夏日清补汤',
        ingredients: [
            { name: '苦瓜', amount: '1根（约300g）' },
            { name: '黄豆', amount: '50g' },
            { name: '瘦肉', amount: '200g' },
            { name: '生姜', amount: '3片' },
            { name: '盐', amount: '适量' },
            { name: '清水', amount: '1.5L' }
        ],
        steps: [
            '黄豆提前浸泡4小时以上；瘦肉切块，冷水焯水后捞出备用。',
            '苦瓜对半切开，去瓤去籽，切成大块。用盐腌制10分钟后冲洗，可减轻苦味。',
            '锅中加清水，放入黄豆、瘦肉、姜片，大火煮沸后转小火煲40分钟。',
            '加入苦瓜块，继续煲15-20分钟至苦瓜变软。',
            '加适量盐调味即可。汤味先苦后甘，回甘悠长。'
        ],
        benefit: '苦瓜性寒味苦，清热解毒、明目降糖；黄豆健脾利湿、补虚强体；瘦肉滋阴润燥。此汤适合夏季暑热引起的口干、目赤、烦躁，也是辅助控糖的食疗汤品。'
    },

    /* ── 粥品 ── */
    {
        id: 4,
        name: '荷叶莲子粥',
        category: '粥品',
        difficulty: '简单',
        time: '50分钟',
        season: ['summer'],
        image: '/images/recipes/heyelianzizhou.jpg',
        desc: '清暑化湿，养心安神，带着荷叶清香的消暑粥品',
        ingredients: [
            { name: '大米', amount: '100g' },
            { name: '莲子', amount: '30g' },
            { name: '干荷叶', amount: '1张（或鲜荷叶半张）' },
            { name: '冰糖', amount: '适量' },
            { name: '清水', amount: '1.2L' }
        ],
        steps: [
            '莲子去芯，用温水浸泡1小时；大米洗净备用。',
            '干荷叶洗净，剪成小块，用纱布袋装好。',
            '锅中加清水，放入大米、莲子、荷叶纱布袋，大火煮沸后转小火。',
            '小火熬煮约40分钟，期间不时搅拌防止粘锅。',
            '粥煮至粘稠后，取出荷叶袋丢弃，加入冰糖调味即可。'
        ],
        benefit: '荷叶清热解暑、升发清阳、凉血止血；莲子补脾止泻、益肾固精、养心安神。此粥清香宜人，适合夏季暑热引起的心烦失眠、食欲不振。'
    },
    {
        id: 5,
        name: '山药枸杞粥',
        category: '粥品',
        difficulty: '简单',
        time: '40分钟',
        season: ['summer', 'autumn', 'winter'],
        image: '/images/recipes/shanyaogouqizhou.jpg',
        desc: '健脾益气，滋阴润燥，四季皆宜的温补粥品',
        ingredients: [
            { name: '大米', amount: '100g' },
            { name: '山药（铁棍山药）', amount: '150g' },
            { name: '枸杞', amount: '15g' },
            { name: '清水', amount: '1L' }
        ],
        steps: [
            '大米洗净，清水浸泡30分钟；山药去皮切小块（戴手套防止过敏发痒）。',
            '锅中加清水，放入大米，大火煮沸后转小火煮20分钟。',
            '加入山药块，继续小火煮15分钟至山药软烂、粥变浓稠。',
            '关火前撒入枸杞，搅匀焖2分钟即可。',
            '根据个人口味可加少许盐或冰糖调味。'
        ],
        benefit: '山药健脾补肺、固肾益精，为平补脾胃之要药；枸杞滋补肝肾、益精明目。此粥平和温润，适合脾胃虚弱、食欲不振者长期食用。'
    },

    /* ── 炒菜 ── */
    {
        id: 6,
        name: '苦瓜炒蛋',
        category: '炒菜',
        difficulty: '简单',
        time: '15分钟',
        season: ['summer'],
        image: '/images/recipes/kuguachaodang.jpg',
        desc: '清热下火，简单快手，夏季家常餐桌的经典菜式',
        ingredients: [
            { name: '苦瓜', amount: '1根（约250g）' },
            { name: '鸡蛋', amount: '3个' },
            { name: '大蒜', amount: '2瓣' },
            { name: '盐', amount: '适量' },
            { name: '食用油', amount: '适量' }
        ],
        steps: [
            '苦瓜对半切开，去瓤去籽，切成薄片。加少许盐抓匀腌制5分钟，挤去苦水后冲洗沥干。',
            '鸡蛋打入碗中，加少许盐打散备用；大蒜切片。',
            '热锅凉油，倒入蛋液，炒至凝固成型后盛出。',
            '锅中再加少许油，爆香蒜片，放入苦瓜片大火快炒1-2分钟。',
            '倒入炒好的鸡蛋，翻炒均匀，加盐调味即可出锅。'
        ],
        benefit: '苦瓜清热解毒、降血糖血脂；鸡蛋滋阴养血、补充优质蛋白。这道快手小菜既保留了苦瓜的清热功效，又被蛋香中和了部分苦味，老少皆宜。'
    },
    {
        id: 7,
        name: '山药木耳炒肉片',
        category: '炒菜',
        difficulty: '中等',
        time: '25分钟',
        season: ['summer', 'autumn'],
        image: '/images/recipes/shanyaomuerchaoroupian.jpg',
        desc: '健脾润肺，脆嫩爽口，荤素搭配的养生小炒',
        ingredients: [
            { name: '山药', amount: '200g' },
            { name: '干木耳', amount: '15g' },
            { name: '猪里脊肉', amount: '150g' },
            { name: '青椒', amount: '1个' },
            { name: '生姜', amount: '2片' },
            { name: '盐', amount: '适量' },
            { name: '生抽', amount: '1勺' },
            { name: '淀粉', amount: '少许' },
            { name: '食用油', amount: '适量' }
        ],
        steps: [
            '干木耳提前用温水泡发，洗净撕成小朵；山药去皮切薄片，泡入清水中防氧化。',
            '猪里脊肉切薄片，加少许生抽、淀粉抓匀腌制10分钟。',
            '青椒去籽切片，生姜切丝。',
            '热锅凉油，先将肉片滑炒至变色，盛出备用。',
            '锅中留底油，爆香姜丝，放入山药片、木耳翻炒2分钟。',
            '加入青椒片和炒好的肉片，翻炒均匀，加盐调味即可出锅。'
        ],
        benefit: '山药补脾养胃、生津益肺；木耳活血化瘀、润肺养颜；瘦肉补虚益气。此菜口感层次丰富，山药脆滑、木耳爽脆，是夏季健脾养胃的食疗菜品。'
    },

    /* ── 凉拌 ── */
    {
        id: 8,
        name: '凉拌黄瓜木耳',
        category: '凉拌',
        difficulty: '简单',
        time: '15分钟',
        season: ['summer'],
        image: '/images/recipes/liangbanhuangguamuer.jpg',
        desc: '清脆爽口，开胃解腻，夏季消暑必备凉菜',
        ingredients: [
            { name: '黄瓜', amount: '2根' },
            { name: '干木耳', amount: '10g' },
            { name: '大蒜', amount: '3瓣' },
            { name: '香醋', amount: '2勺' },
            { name: '生抽', amount: '1勺' },
            { name: '芝麻油', amount: '少许' },
            { name: '盐', amount: '适量' },
            { name: '白芝麻', amount: '少许' }
        ],
        steps: [
            '干木耳提前用温水泡发，洗净后入沸水焯烫1分钟，捞出过凉水，撕成小朵。',
            '黄瓜洗净，用刀拍裂后切成小段（拍黄瓜比切的口感更好）。',
            '大蒜捣成蒜泥，加香醋、生抽、盐、芝麻油调成调味汁。',
            '将黄瓜、木耳放入大碗，淋入调味汁，拌匀。',
            '装盘后撒上白芝麻即可。冷藏15分钟后食用风味更佳。'
        ],
        benefit: '黄瓜清热利水、生津止渴；木耳活血润燥、清理肠道。此凉菜低脂清爽，适合夏季食欲不振、口干舌燥者，也是减脂期的理想配菜。'
    },
    {
        id: 9,
        name: '蒜泥茄子',
        category: '凉拌',
        difficulty: '简单',
        time: '20分钟',
        season: ['summer'],
        image: "/images/recipes/suanniqiezi'.jpg",
        desc: '软糯入味，蒜香浓郁，蒸制做法的经典家常凉菜',
        ingredients: [
            { name: '长茄子', amount: '2根' },
            { name: '大蒜', amount: '4瓣' },
            { name: '生抽', amount: '2勺' },
            { name: '香醋', amount: '1勺' },
            { name: '芝麻油', amount: '少许' },
            { name: '盐', amount: '适量' },
            { name: '小葱花', amount: '少许' },
            { name: '红椒碎', amount: '少许（可选）' }
        ],
        steps: [
            '茄子洗净，切成5cm长的段，放入蒸锅，水开后大火蒸8-10分钟至软烂。',
            '取出茄子放凉，用手撕成细条（蒸茄子手撕比刀切更入味）。',
            '大蒜捣成蒜泥，加入生抽、香醋、盐、芝麻油调成蒜泥汁。',
            '将蒜泥汁均匀淋在撕好的茄子上。',
            '撒上小葱花和红椒碎点缀，食用前拌匀即可。'
        ],
        benefit: '茄子性凉味甘，清热活血、消肿止痛；大蒜温中健胃、消食理气。蒸制做法少油健康，蒜泥的温性也中和了茄子的凉性，适合大多数体质。'
    },

    /* ── 茶饮 ── */
    {
        id: 10,
        name: '酸梅汤',
        category: '茶饮',
        difficulty: '简单',
        time: '40分钟',
        season: ['summer'],
        image: '/images/recipes/suanmeitang.jpg',
        desc: '生津止渴，消食开胃，传统京味消暑饮品',
        ingredients: [
            { name: '乌梅', amount: '8-10颗' },
            { name: '山楂干', amount: '15g' },
            { name: '甘草', amount: '3-4片' },
            { name: '陈皮', amount: '1小片' },
            { name: '桂花', amount: '少许' },
            { name: '冰糖', amount: '80g（根据口味调整）' },
            { name: '清水', amount: '2L' }
        ],
        steps: [
            '乌梅、山楂干、甘草、陈皮用清水冲洗干净。',
            '将所有材料（桂花和冰糖除外）放入锅中，加清水浸泡30分钟。',
            '大火煮沸后转小火，加盖慢煮30分钟，让药材味道充分释放。',
            '加入冰糖搅拌至融化，关火前撒入桂花增香。',
            '滤去药渣，晾凉后冷藏饮用。冰镇后口感最佳，消暑解渴。'
        ],
        benefit: '乌梅敛肺生津、涩肠安蛔；山楂消食化积、活血散瘀；甘草补脾益气、清热解毒；陈皮理气健脾。酸梅汤生津止渴效果卓越，是夏季出汗过多后补充津液的佳品。'
    },
    {
        id: 11,
        name: '金银花薄荷茶',
        category: '茶饮',
        difficulty: '简单',
        time: '10分钟',
        season: ['summer'],
        image: '/images/recipes/jinyinhuabohecha.jpg',
        desc: '疏风散热，清利咽喉，夏季解暑的清香花草茶',
        ingredients: [
            { name: '金银花', amount: '5g' },
            { name: '薄荷叶（干）', amount: '3g' },
            { name: '蜂蜜', amount: '适量' },
            { name: '开水', amount: '500ml' }
        ],
        steps: [
            '金银花和薄荷叶用清水快速冲洗一下。',
            '放入茶壶或大杯中，冲入刚烧开的沸水。',
            '加盖焖泡5-8分钟，待花香充分释放。',
            '待茶水温热不烫时，加入适量蜂蜜调味（水温过高会破坏蜂蜜营养）。',
            '可多次冲泡续饮，也可放凉后加冰块冷饮。'
        ],
        benefit: '金银花清热解毒、疏散风热，为治疗暑热感冒的常用药；薄荷疏风散热、清利头目咽喉。此茶适合夏季暑热引起的咽喉肿痛、口干口苦、轻微风热感冒。脾胃虚寒者少饮。'
    },

    /* ── 甜品 ── */
    {
        id: 12,
        name: '银耳莲子羹',
        category: '甜品',
        difficulty: '简单',
        time: '60分钟',
        season: ['summer', 'autumn', 'winter'],
        image: '/images/recipes/yinerlianzigeng.jpg',
        desc: '滋阴润肺，养心安神，四季皆宜的滋补甜品',
        ingredients: [
            { name: '银耳', amount: '1朵（约20g）' },
            { name: '莲子', amount: '30g' },
            { name: '红枣', amount: '6-8颗' },
            { name: '枸杞', amount: '10g' },
            { name: '冰糖', amount: '适量' },
            { name: '清水', amount: '1.5L' }
        ],
        steps: [
            '银耳提前用冷水泡发2-3小时，去蒂撕成小朵；莲子去芯泡发1小时。',
            '将银耳、莲子、红枣放入锅中，加足量清水。',
            '大火煮沸后转小火，加盖慢炖40-50分钟，至银耳软糯出胶、汤汁粘稠。',
            '加入冰糖和枸杞，再炖5分钟至冰糖融化。',
            '可热食也可放凉后冷藏食用。冷食口感更Q弹，热食暖胃舒心。'
        ],
        benefit: '银耳滋阴润肺、养胃生津，有"平民燕窝"之称；莲子养心安神、健脾止泻；红枣补中益气、养血安神。此羹尤其适合阴虚燥咳、皮肤干燥、心烦失眠者。'
    }
];

/* ══════════════════════════════════════════
   页面初始化
   ══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

    /* 更新导航登录状态 */
    const user = API.getCurrentUser();
    if (user) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    /* 两个数据区独立初始化，局部失败不会阻断另一板块 */
    initHerbSection();
    initRecipeSection();

    function syncBodyModalLock() {
        const hasOpenModal = document.querySelector('.modal_overlay.show, .recipe_modal_overlay.show');
        document.body.style.overflow = hasOpenModal ? 'hidden' : '';
    }

    /* ──────────────────────────────────────
       板块一：药材百科
       ────────────────────────────────────── */
    async function initHerbSection() {
        var allHerbs = [];
        var currentHerbCategory = 'all';
        var herbSearchTimeout;
        var herbLoading = false;
        var releaseHerbFocus = null;

        const grid = document.getElementById('herb_grid');
        const searchInput = document.getElementById('herb_search_input');
        const resultCount = document.getElementById('herb_result_count');
        const filterButtons = Array.from(document.querySelectorAll('#herb_filter_categories .herb_filter_btn'));
        const modal = document.getElementById('herb_modal');
        const modalCard = modal.querySelector('.modal_card');

        /* 当前季节 */
        const currentSeason = getSeason();
        const seasonNames = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
        const seasonIcons = {
            spring: UI.icon('sprout', 20),
            summer: UI.icon('sun', 20),
            autumn: UI.icon('leaf', 20),
            winter: UI.icon('snowflake', 20)
        };
        document.getElementById('herb_season_icon').innerHTML = seasonIcons[currentSeason];
        document.getElementById('herb_season_text').textContent = '当前' + seasonNames[currentSeason] + '：以下展示' + seasonNames[currentSeason] + '时令建议';

        /* 状态块按钮：错误时重试；筛选无结果时恢复全部 */
        UI.bindRetry(grid, () => {
            if (grid.querySelector('.state_error')) {
                loadHerbs().then(() => {
                    const target = grid.querySelector('.herb_card, [data-ui-retry]');
                    if (target) target.focus();
                });
                return;
            }
            clearHerbFilters();
            const allButton = filterButtons.find(btn => btn.dataset.category === 'all');
            if (allButton) allButton.focus();
        });

        /* 卡片使用原生按钮， click 同时覆盖鼠标、触摸与键盘激活 */
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.herb_card');
            if (!card || !grid.contains(card)) return;
            const id = parseInt(card.dataset.id, 10);
            const herb = allHerbs.find(h => h.id === id);
            if (herb) {
                card.focus({ preventScroll: true });
                showHerbModal(herb);
            }
        });

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                currentHerbCategory = btn.dataset.category;
                updateHerbFilterButtons();
                herbFilterAndRender();
            });
        });

        searchInput.addEventListener('input', () => {
            clearTimeout(herbSearchTimeout);
            herbSearchTimeout = setTimeout(herbFilterAndRender, 300);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (UI.isComposing(e)) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(herbSearchTimeout);
                herbFilterAndRender();
            } else if (e.key === 'Escape' && searchInput.value) {
                e.preventDefault();
                searchInput.value = '';
                clearTimeout(herbSearchTimeout);
                herbFilterAndRender();
            }
        });

        document.getElementById('herb_modal_close').addEventListener('click', closeHerbModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeHerbModal();
        });

        updateHerbFilterButtons();
        await loadHerbs();

        async function loadHerbs() {
            if (herbLoading) return;
            herbLoading = true;
            grid.setAttribute('aria-busy', 'true');
            grid.innerHTML = UI.stateHTML('loading', { text: '正在加载药材数据…' });
            resultCount.textContent = '正在加载药材…';

            try {
                /* 保持 API 模块现有的本地数据获取方式 */
                const result = await API.getHerbs();
                if (!result || !result.success || !Array.isArray(result.data)) {
                    throw new Error((result && result.msg) || '药材数据不可用');
                }
                allHerbs = result.data;
                herbFilterAndRender();
            } catch (error) {
                resultCount.textContent = '药材暂未加载';
                grid.innerHTML = UI.stateHTML('error', {
                    text: '药材数据加载失败',
                    hint: '筛选条件已保留，请重试',
                    actionText: '重试'
                });
            } finally {
                grid.removeAttribute('aria-busy');
                herbLoading = false;
            }
        }

        function updateHerbFilterButtons() {
            filterButtons.forEach(btn => {
                const selected = btn.dataset.category === currentHerbCategory;
                btn.classList.toggle('active', selected);
                btn.setAttribute('aria-pressed', String(selected));
            });
        }

        function clearHerbFilters() {
            clearTimeout(herbSearchTimeout);
            currentHerbCategory = 'all';
            searchInput.value = '';
            updateHerbFilterButtons();
            herbFilterAndRender();
        }

        function renderHerbs(herbs) {
            const list = Array.isArray(herbs) ? herbs : [];
            resultCount.textContent = '共 ' + list.length + ' 味药材';

            if (!list.length) {
                const hasFilters = currentHerbCategory !== 'all' || !!searchInput.value.trim();
                grid.innerHTML = UI.stateHTML('empty', {
                    text: hasFilters ? '没有找到匹配的药材' : '暂无药材数据',
                    hint: hasFilters ? '可更换分类或搜索词，也可以清除筛选' : '药材数据暂未收录',
                    actionText: hasFilters ? '清除筛选' : undefined
                });
                return;
            }

            grid.innerHTML = list.map(h => {
                const seasonTip = h.seasonalTips ? h.seasonalTips[currentSeason] || '' : '';
                const imgSrc = h.image || ('/images/herbs/' + h.pinyin + '.svg');
                const name = UI.escapeHtml(h.name);

                return `
                    <button type="button" class="herb_card card_interactive" data-id="${UI.escapeHtml(h.id)}" data-category="${UI.escapeHtml(h.category)}" aria-label="查看${name}详情">
                        <span class="herb_card_photo"><img class="herb_card_image" src="${UI.escapeHtml(imgSrc)}" alt="${name}" loading="lazy"></span>
                        <span class="herb_card_body">
                            <span class="herb_card_name">${name}</span>
                            <span class="herb_card_nature">${UI.escapeHtml(h.nature)} · ${UI.escapeHtml(h.meridian)}</span>
                            <span class="herb_card_effect">${UI.escapeHtml(h.effect)}</span>
                            ${seasonTip ? '<span class="herb_card_season">' + seasonNames[currentSeason] + '：' + UI.escapeHtml(seasonTip) + '</span>' : ''}
                            <span class="herb_card_detail" aria-hidden="true">查看详情 →</span>
                        </span>
                    </button>
                `;
            }).join('');
        }

        function showHerbModal(herb) {
            const imgPath = herb.image || ('/images/herbs/' + herb.pinyin + '.svg');
            document.getElementById('herb_modal_image').src = imgPath;
            document.getElementById('herb_modal_image').alt = herb.name;
            document.getElementById('herb_modal_image').style.display = 'block';
            document.getElementById('herb_modal_name').textContent = herb.name;
            document.getElementById('herb_modal_nature').textContent = herb.nature + ' · ' + herb.meridian;
            document.getElementById('herb_modal_effect').textContent = herb.effect;

            const seasonDiv = document.getElementById('herb_modal_season');
            seasonDiv.innerHTML = '';
            if (herb.seasonalTips) {
                const sIcons = {
                    spring: UI.icon('sprout', 18),
                    summer: UI.icon('sun', 18),
                    autumn: UI.icon('leaf', 18),
                    winter: UI.icon('snowflake', 18)
                };
                seasonDiv.innerHTML = Object.entries(herb.seasonalTips).map(([s, tip]) =>
                    '<div class="modal_season_item">' + (sIcons[s] || '') + ' ' + seasonNames[s] + '：' + UI.escapeHtml(tip) + '</div>'
                ).join('');
            }

            document.getElementById('herb_modal_ref').textContent = '参考来源：' + (herb.reference || '《中国药典》');
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            syncBodyModalLock();
            if (releaseHerbFocus) releaseHerbFocus();
            releaseHerbFocus = UI.trapFocus(modalCard, {
                onEscape: closeHerbModal,
                initialFocus: document.getElementById('herb_modal_close')
            });
        }

        function closeHerbModal() {
            if (!modal.classList.contains('show')) return;
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            if (releaseHerbFocus) {
                releaseHerbFocus();
                releaseHerbFocus = null;
            }
            syncBodyModalLock();
        }

        function herbFilterAndRender() {
            const keyword = searchInput.value.trim().toLowerCase();
            var filtered = allHerbs;

            if (currentHerbCategory !== 'all') {
                filtered = filtered.filter(h => h.category === currentHerbCategory);
            }
            if (keyword) {
                filtered = filtered.filter(h =>
                    String(h.name || '').toLowerCase().includes(keyword) ||
                    String(h.effect || '').toLowerCase().includes(keyword) ||
                    String(h.nature || '').toLowerCase().includes(keyword) ||
                    String(h.pinyin || '').toLowerCase().includes(keyword)
                );
            }
            renderHerbs(filtered);
        }
    }

    /* ──────────────────────────────────────
       板块二：时令食谱
       ────────────────────────────────────── */
    function initRecipeSection() {
        var currentRecipeCategory = 'all';
        var recipeSearchTimeout;
        var releaseRecipeFocus = null;

        const grid = document.getElementById('recipe_grid');
        const searchInput = document.getElementById('recipe_search_input');
        const resultCount = document.getElementById('recipe_result_count');
        const filterButtons = Array.from(document.querySelectorAll('#recipe_filter_categories .recipe_filter_btn'));
        const modal = document.getElementById('recipe_modal');
        const modalCard = modal.querySelector('.recipe_modal_card');

        /* 更新时令推荐栏 */
        const m = new Date().getMonth() + 1;
        var icon, label, desc;
        if (m >= 3 && m <= 5) {
            icon = UI.icon('sprout', 20); label = '春季生发'; desc = '宜养肝护肝、升发阳气，推荐以下时令食谱';
        } else if (m >= 6 && m <= 8) {
            icon = UI.icon('sun', 20); label = '夏季暑热'; desc = '宜清热解暑、健脾祛湿，推荐以下时令食谱';
        } else if (m >= 9 && m <= 11) {
            icon = UI.icon('leaf', 20); label = '秋季干燥'; desc = '宜滋阴润燥、养肺生津，推荐以下时令食谱';
        } else {
            icon = UI.icon('snowflake', 20); label = '冬季寒冷'; desc = '宜温补阳气、补肾藏精，推荐以下时令食谱';
        }
        document.getElementById('recipe_season_icon').innerHTML = icon;
        document.getElementById('recipe_season_label').textContent = label;
        document.getElementById('recipe_season_desc').textContent = desc;

        /* 本地食谱同步渲染，仍使用共享状态块统一加载、空结果与异常反馈 */
        grid.innerHTML = UI.stateHTML('loading', { text: '正在准备时令食谱…' });
        updateRecipeFilterButtons();
        recipeFilterAndRender();
        initDailyPush();

        UI.bindRetry(grid, () => {
            if (grid.querySelector('.state_error')) {
                recipeFilterAndRender();
            } else {
                clearRecipeFilters();
            }
            const target = grid.querySelector('.recipe_card, [data-ui-retry]') ||
                filterButtons.find(btn => btn.dataset.category === 'all');
            if (target) target.focus();
        });

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.recipe_card');
            if (!card || !grid.contains(card)) return;
            const id = parseInt(card.dataset.id, 10);
            const recipe = RECIPES.find(r => r.id === id);
            if (recipe) {
                card.focus({ preventScroll: true });
                showRecipeModal(recipe);
            }
        });

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                currentRecipeCategory = btn.dataset.category;
                updateRecipeFilterButtons();
                recipeFilterAndRender();
            });
        });

        searchInput.addEventListener('input', () => {
            clearTimeout(recipeSearchTimeout);
            recipeSearchTimeout = setTimeout(recipeFilterAndRender, 300);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (UI.isComposing(e)) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(recipeSearchTimeout);
                recipeFilterAndRender();
            } else if (e.key === 'Escape' && searchInput.value) {
                e.preventDefault();
                searchInput.value = '';
                clearTimeout(recipeSearchTimeout);
                recipeFilterAndRender();
            }
        });

        document.getElementById('recipe_modal_close').addEventListener('click', closeRecipeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeRecipeModal();
        });

        /* 每日推荐 — 基于日期确定性选取一道食谱 */
        function initDailyPush() {
            const dayNum = new Date().getDate();
            const dailyRecipe = RECIPES[dayNum % RECIPES.length];
            const dailyPush = document.getElementById('daily_push');
            const dailyButton = document.getElementById('daily_push_btn');

            document.getElementById('daily_push_image').src = dailyRecipe.image || '/images/recipes/placeholder.svg';
            document.getElementById('daily_push_image').alt = dailyRecipe.name;
            document.getElementById('daily_push_name').textContent = dailyRecipe.name;
            document.getElementById('daily_push_desc').textContent = dailyRecipe.desc;
            document.getElementById('daily_push_diff').textContent = dailyRecipe.difficulty;
            document.getElementById('daily_push_time').textContent = '⏱ ' + dailyRecipe.time;
            document.getElementById('daily_push_season').textContent = getRecipeSeasonLabel(dailyRecipe.season);

            dailyButton.addEventListener('click', (e) => {
                e.stopPropagation();
                dailyButton.focus({ preventScroll: true });
                showRecipeModal(dailyRecipe);
            });

            /* 点击整个推送条也可查看 */
            dailyPush.addEventListener('click', () => {
                dailyPush.focus({ preventScroll: true });
                showRecipeModal(dailyRecipe);
            });
            dailyPush.addEventListener('keydown', (e) => {
                if (e.target !== dailyPush || UI.isComposing(e)) return;
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    showRecipeModal(dailyRecipe);
                }
            });
        }

        function updateRecipeFilterButtons() {
            filterButtons.forEach(btn => {
                const selected = btn.dataset.category === currentRecipeCategory;
                btn.classList.toggle('active', selected);
                btn.setAttribute('aria-pressed', String(selected));
            });
        }

        function clearRecipeFilters() {
            clearTimeout(recipeSearchTimeout);
            currentRecipeCategory = 'all';
            searchInput.value = '';
            updateRecipeFilterButtons();
            recipeFilterAndRender();
        }

        function renderRecipes(recipes) {
            const list = Array.isArray(recipes) ? recipes : [];
            resultCount.textContent = '共 ' + list.length + ' 道食谱';
            if (!list.length) {
                const hasFilters = currentRecipeCategory !== 'all' || !!searchInput.value.trim();
                grid.innerHTML = UI.stateHTML('empty', {
                    text: hasFilters ? '没有找到匹配的食谱' : '暂无食谱数据',
                    hint: hasFilters ? '可更换分类或搜索词，也可以清除筛选' : '食谱正在整理中',
                    actionText: hasFilters ? '清除筛选' : undefined
                });
                return;
            }

            grid.innerHTML = list.map(r => {
                var imgSrc = r.image || '/images/recipes/placeholder.svg';
                const name = UI.escapeHtml(r.name);
                return `
                    <button type="button" class="recipe_card card_interactive" data-id="${UI.escapeHtml(r.id)}" aria-label="查看${name}的详细做法">
                        <span class="recipe_card_photo"><img class="recipe_card_image" src="${UI.escapeHtml(imgSrc)}" alt="${name}" loading="lazy"></span>
                        <span class="recipe_card_body">
                            <span class="recipe_card_name">${name}</span>
                            <span class="recipe_card_meta">
                                <span class="recipe_difficulty">${UI.escapeHtml(r.difficulty)}</span>
                                <span class="recipe_time">⏱ ${UI.escapeHtml(r.time)}</span>
                                <span class="recipe_season_tag">${getRecipeSeasonLabel(r.season)}</span>
                            </span>
                            <span class="recipe_card_desc">${UI.escapeHtml(r.desc)}</span>
                            <span class="recipe_card_arrow" aria-hidden="true">查看详细做法 →</span>
                        </span>
                    </button>
                `;
            }).join('');
        }

        function recipeFilterAndRender() {
            grid.setAttribute('aria-busy', 'true');
            try {
                const keyword = searchInput.value.trim().toLowerCase();
                var filtered = RECIPES;

                if (currentRecipeCategory !== 'all') {
                    filtered = filtered.filter(r => r.category === currentRecipeCategory);
                }
                if (keyword) {
                    filtered = filtered.filter(r =>
                        String(r.name || '').toLowerCase().includes(keyword) ||
                        String(r.desc || '').toLowerCase().includes(keyword) ||
                        String(r.benefit || '').toLowerCase().includes(keyword) ||
                        r.ingredients.some(ing => String(ing.name || '').toLowerCase().includes(keyword))
                    );
                }
                renderRecipes(filtered);
            } catch (error) {
                resultCount.textContent = '食谱暂未加载';
                grid.innerHTML = UI.stateHTML('error', {
                    text: '食谱渲染失败',
                    hint: '筛选条件已保留，请重试',
                    actionText: '重试'
                });
            } finally {
                grid.removeAttribute('aria-busy');
            }
        }

        function showRecipeModal(recipe) {
            document.getElementById('recipe_modal_image').src = recipe.image || '/images/recipes/placeholder.svg';
            document.getElementById('recipe_modal_image').alt = recipe.name;
            document.getElementById('recipe_modal_name').textContent = recipe.name;
            document.getElementById('recipe_modal_difficulty').textContent = recipe.difficulty;
            document.getElementById('recipe_modal_time').textContent = '⏱ ' + recipe.time;
            document.getElementById('recipe_modal_season_tag').textContent = getRecipeSeasonLabel(recipe.season);

            document.getElementById('recipe_modal_ingredients').innerHTML = recipe.ingredients.map(ing =>
                '<li><span class="ingredient_name">' + UI.escapeHtml(ing.name) + '</span><span class="ingredient_amount">' + UI.escapeHtml(ing.amount) + '</span></li>'
            ).join('');

            document.getElementById('recipe_modal_steps').innerHTML = recipe.steps.map(step =>
                '<li>' + UI.escapeHtml(step) + '</li>'
            ).join('');

            document.getElementById('recipe_modal_benefit').textContent = recipe.benefit;

            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            syncBodyModalLock();
            if (releaseRecipeFocus) releaseRecipeFocus();
            releaseRecipeFocus = UI.trapFocus(modalCard, {
                onEscape: closeRecipeModal,
                initialFocus: document.getElementById('recipe_modal_close')
            });
        }

        function closeRecipeModal() {
            if (!modal.classList.contains('show')) return;
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            if (releaseRecipeFocus) {
                releaseRecipeFocus();
                releaseRecipeFocus = null;
            }
            syncBodyModalLock();
        }

        function getRecipeSeasonLabel(seasons) {
            const map = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
            if (!seasons || seasons.length === 0) return '四季';
            return seasons.map(s => map[s] || '').join('·') + '季';
        }
    }

    /* ──────────────────────────────────────
       通用工具
       ────────────────────────────────────── */
    function getSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return 'spring';
        if (month >= 6 && month <= 8) return 'summer';
        if (month >= 9 && month <= 11) return 'autumn';
        return 'winter';
    }

    /* ──────────────────────────────────────
       板块内导航：平滑滚动 + 滚动监听
       ────────────────────────────────────── */
    const subNavLinks = document.querySelectorAll('.sub_nav_link');
    const herbSection = document.getElementById('herb_section');
    const recipeSection = document.getElementById('recipe_section');
    const navBarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) || 64;

    /* 点击平滑滚动 */
    subNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                const top = target.getBoundingClientRect().top + window.pageYOffset - navBarHeight - 52;
                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
        });
    });

    /* 滚动监听 - 高亮当前板块 */
    var scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            requestAnimationFrame(() => {
                updateSubNavActive();
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    });

    function updateSubNavActive() {
        const scrollTop = window.pageYOffset + navBarHeight + 60;
        const recipeTop = recipeSection.getBoundingClientRect().top + window.pageYOffset;

        subNavLinks.forEach(link => {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        });

        const activeLink = scrollTop >= recipeTop ? subNavLinks[1] : subNavLinks[0];
        activeLink.classList.add('active');
        activeLink.setAttribute('aria-current', 'location');
    }

    /* 弹窗 Esc、Tab 循环与焦点返回均由 UI.trapFocus 管理 */
});

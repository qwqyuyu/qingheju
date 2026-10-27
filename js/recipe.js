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
document.addEventListener('DOMContentLoaded', async () => {

    /* 更新导航登录状态 */
    const user = API.getCurrentUser();
    if (user) {
        const navLink = document.getElementById('nav_user_link');
        if (navLink) { navLink.textContent = '我的'; navLink.href = 'profile.html'; }
    }

    /* 初始化板块一：药材百科 */
    await initHerbSection();

    /* 初始化板块二：时令食谱 */
    initRecipeSection();

    /* ──────────────────────────────────────
       板块一：药材百科
       ────────────────────────────────────── */
    async function initHerbSection() {
        var allHerbs = [];
        var currentHerbCategory = 'all';

        /* 当前季节 */
        const currentSeason = getSeason();
        const seasonNames = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
        const seasonIcons = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };

        /* 显示季节提示 */
        document.getElementById('herb_season_icon').textContent = seasonIcons[currentSeason];
        document.getElementById('herb_season_text').textContent = '当前' + seasonNames[currentSeason] + '：以下展示' + seasonNames[currentSeason] + '时令建议';

        /* 加载药材数据 */
        await loadHerbs();

        /* 分类筛选 */
        document.querySelectorAll('#herb_filter_categories .herb_filter_btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#herb_filter_categories .herb_filter_btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentHerbCategory = btn.getAttribute('data-category');
                herbFilterAndRender();
            });
        });

        /* 搜索 */
        var herbSearchTimeout;
        document.getElementById('herb_search_input').addEventListener('input', () => {
            clearTimeout(herbSearchTimeout);
            herbSearchTimeout = setTimeout(() => {
                herbFilterAndRender();
            }, 300);
        });

        /* 弹窗关闭 */
        document.getElementById('herb_modal_close').addEventListener('click', closeHerbModal);
        document.getElementById('herb_modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('herb_modal')) {
                closeHerbModal();
            }
        });

        async function loadHerbs() {
            document.getElementById('herb_loading').style.display = 'block';
            document.getElementById('herb_grid').innerHTML = '';

            try {
                const result = await API.getHerbs();
                if (result.success) {
                    allHerbs = result.data;
                    renderHerbs(allHerbs);
                } else {
                    document.getElementById('herb_grid').innerHTML = '<p class="herb_no_result">暂无药材数据</p>';
                }
            } catch (e) {
                document.getElementById('herb_grid').innerHTML = '<p class="herb_no_result">暂无药材数据</p>';
            }

            document.getElementById('herb_loading').style.display = 'none';
        }

        function renderHerbs(herbs) {
            const grid = document.getElementById('herb_grid');

            if (!herbs || herbs.length === 0) {
                grid.innerHTML = '<p class="herb_no_result">没有找到匹配的药材</p>';
                return;
            }

            grid.innerHTML = herbs.map(h => {
                const seasonTip = h.seasonalTips ? h.seasonalTips[currentSeason] || '' : '';
                const imgSrc = h.image || ('/images/herbs/' + h.pinyin + '.svg');

                return `
                    <div class="herb_card" data-id="${h.id}" data-category="${h.category}">
                        <img class="herb_card_image" src="${imgSrc}" alt="${h.name}">
                        <div class="herb_card_body">
                            <h3 class="herb_card_name">${h.name}</h3>
                            <p class="herb_card_nature">${h.nature} · ${h.meridian}</p>
                            <p class="herb_card_effect">${h.effect}</p>
                            ${seasonTip ? '<p class="herb_card_season">' + seasonNames[currentSeason] + '：' + seasonTip + '</p>' : ''}
                            <span class="herb_card_detail" data-id="${h.id}">查看详情 →</span>
                        </div>
                    </div>
                `;
            }).join('');

            /* 绑定事件 */
            grid.querySelectorAll('.herb_card_detail').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(link.getAttribute('data-id'));
                    const herb = allHerbs.find(h => h.id === id);
                    if (herb) showHerbModal(herb);
                });
            });

            grid.querySelectorAll('.herb_card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = parseInt(card.getAttribute('data-id'));
                    const herb = allHerbs.find(h => h.id === id);
                    if (herb) showHerbModal(herb);
                });
            });
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
            if (herb.seasonalTips) {
                const sIcons = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
                seasonDiv.innerHTML = Object.entries(herb.seasonalTips).map(([s, tip]) =>
                    '<div class="modal_season_item">' + (sIcons[s] || '') + ' ' + seasonNames[s] + '：' + tip + '</div>'
                ).join('');
            }

            document.getElementById('herb_modal_ref').textContent = '参考来源：' + (herb.reference || '《中国药典》');
            document.getElementById('herb_modal').classList.add('show');
        }

        function closeHerbModal() {
            document.getElementById('herb_modal').classList.remove('show');
        }

        function herbFilterAndRender() {
            const keyword = document.getElementById('herb_search_input').value.trim().toLowerCase();
            var filtered = allHerbs;

            if (currentHerbCategory !== 'all') {
                filtered = filtered.filter(h => h.category === currentHerbCategory);
            }
            if (keyword) {
                filtered = filtered.filter(h =>
                    h.name.includes(keyword) ||
                    h.effect.includes(keyword) ||
                    h.nature.includes(keyword) ||
                    h.pinyin.includes(keyword)
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

        /* 更新时令推荐栏 */
        const m = new Date().getMonth() + 1;
        var icon, label, desc;
        if (m >= 3 && m <= 5) {
            icon = '🌸'; label = '春季生发'; desc = '宜养肝护肝、升发阳气，推荐以下时令食谱';
        } else if (m >= 6 && m <= 8) {
            icon = '☀️'; label = '夏季暑热'; desc = '宜清热解暑、健脾祛湿，推荐以下时令食谱';
        } else if (m >= 9 && m <= 11) {
            icon = '🍂'; label = '秋季干燥'; desc = '宜滋阴润燥、养肺生津，推荐以下时令食谱';
        } else {
            icon = '❄️'; label = '冬季寒冷'; desc = '宜温补阳气、补肾藏精，推荐以下时令食谱';
        }
        document.getElementById('recipe_season_icon').textContent = icon;
        document.getElementById('recipe_season_label').textContent = label;
        document.getElementById('recipe_season_desc').textContent = desc;

        /* 渲染食谱卡片 */
        renderRecipes(RECIPES);
        document.getElementById('recipe_loading').style.display = 'none';

        /* 每日推荐食谱推送 */
        initDailyPush();

        /* 分类筛选 */
        document.querySelectorAll('#recipe_filter_categories .recipe_filter_btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#recipe_filter_categories .recipe_filter_btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentRecipeCategory = btn.getAttribute('data-category');
                recipeFilterAndRender();
            });
        });

        /* 搜索 */
        var recipeSearchTimeout;
        document.getElementById('recipe_search_input').addEventListener('input', () => {
            clearTimeout(recipeSearchTimeout);
            recipeSearchTimeout = setTimeout(() => {
                recipeFilterAndRender();
            }, 300);
        });

        /* 弹窗关闭 */
        document.getElementById('recipe_modal_close').addEventListener('click', closeRecipeModal);
        document.getElementById('recipe_modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('recipe_modal')) {
                closeRecipeModal();
            }
        });

        /* 每日推荐 — 基于日期确定性选取一道食谱 */
        function initDailyPush() {
            const dayNum = new Date().getDate();
            const dailyRecipe = RECIPES[dayNum % RECIPES.length];

            document.getElementById('daily_push_image').src = dailyRecipe.image || '/images/recipes/placeholder.svg';
            document.getElementById('daily_push_image').alt = dailyRecipe.name;
            document.getElementById('daily_push_name').textContent = dailyRecipe.name;
            document.getElementById('daily_push_desc').textContent = dailyRecipe.desc;
            document.getElementById('daily_push_diff').textContent = dailyRecipe.difficulty;
            document.getElementById('daily_push_time').textContent = '⏱ ' + dailyRecipe.time;
            document.getElementById('daily_push_season').textContent = getRecipeSeasonLabel(dailyRecipe.season);

            document.getElementById('daily_push_btn').addEventListener('click', (e) => {
                e.stopPropagation();
                showRecipeModal(dailyRecipe);
            });

            /* 点击整个推送条也可查看 */
            document.getElementById('daily_push').addEventListener('click', () => {
                showRecipeModal(dailyRecipe);
            });
        }

        function renderRecipes(recipes) {
            const grid = document.getElementById('recipe_grid');
            if (!recipes || recipes.length === 0) {
                grid.innerHTML = '<p class="recipe_no_result">暂无该分类的食谱，敬请期待</p>';
                return;
            }

            grid.innerHTML = recipes.map(r => {
                var imgSrc = r.image || '/images/recipes/placeholder.svg';
                return `
                    <div class="recipe_card" data-id="${r.id}">
                        <img class="recipe_card_image" src="${imgSrc}" alt="${r.name}" loading="lazy">
                        <div class="recipe_card_body">
                            <h3 class="recipe_card_name">${r.name}</h3>
                            <div class="recipe_card_meta">
                                <span class="recipe_difficulty">${r.difficulty}</span>
                                <span class="recipe_time">⏱ ${r.time}</span>
                                <span class="recipe_season_tag">${getRecipeSeasonLabel(r.season)}</span>
                            </div>
                            <p class="recipe_card_desc">${r.desc}</p>
                            <span class="recipe_card_arrow">查看详细做法 →</span>
                        </div>
                    </div>
                `;
            }).join('');

            grid.querySelectorAll('.recipe_card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = parseInt(card.getAttribute('data-id'));
                    const recipe = RECIPES.find(r => r.id === id);
                    if (recipe) showRecipeModal(recipe);
                });
            });
        }

        function recipeFilterAndRender() {
            const keyword = document.getElementById('recipe_search_input').value.trim().toLowerCase();
            var filtered = RECIPES;

            if (currentRecipeCategory !== 'all') {
                filtered = filtered.filter(r => r.category === currentRecipeCategory);
            }
            if (keyword) {
                filtered = filtered.filter(r =>
                    r.name.includes(keyword) ||
                    r.desc.includes(keyword) ||
                    r.benefit.includes(keyword) ||
                    r.ingredients.some(ing => ing.name.includes(keyword))
                );
            }
            renderRecipes(filtered);
        }

        function showRecipeModal(recipe) {
            document.getElementById('recipe_modal_image').src = recipe.image || '/images/recipes/placeholder.svg';
            document.getElementById('recipe_modal_image').alt = recipe.name;
            document.getElementById('recipe_modal_name').textContent = recipe.name;
            document.getElementById('recipe_modal_difficulty').textContent = recipe.difficulty;
            document.getElementById('recipe_modal_time').textContent = '⏱ ' + recipe.time;
            document.getElementById('recipe_modal_season_tag').textContent = getRecipeSeasonLabel(recipe.season);

            document.getElementById('recipe_modal_ingredients').innerHTML = recipe.ingredients.map(ing =>
                '<li><span class="ingredient_name">' + ing.name + '</span><span class="ingredient_amount">' + ing.amount + '</span></li>'
            ).join('');

            document.getElementById('recipe_modal_steps').innerHTML = recipe.steps.map(step =>
                '<li>' + step + '</li>'
            ).join('');

            document.getElementById('recipe_modal_benefit').textContent = recipe.benefit;

            document.getElementById('recipe_modal').classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function closeRecipeModal() {
            document.getElementById('recipe_modal').classList.remove('show');
            document.body.style.overflow = '';
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
                window.scrollTo({ top: top, behavior: 'smooth' });
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

        subNavLinks.forEach(link => link.classList.remove('active'));

        if (scrollTop >= recipeTop) {
            /* 滚动到食谱区域 */
            subNavLinks[1].classList.add('active');
        } else {
            /* 还在药材区域 */
            subNavLinks[0].classList.add('active');
        }
    }

    /* ESC 键关闭弹窗 */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const herbModal = document.getElementById('herb_modal');
            if (herbModal.classList.contains('show')) {
                herbModal.classList.remove('show');
            }
            const recipeModal = document.getElementById('recipe_modal');
            if (recipeModal.classList.contains('show')) {
                recipeModal.classList.remove('show');
                document.body.style.overflow = '';
            }
        }
    });
});

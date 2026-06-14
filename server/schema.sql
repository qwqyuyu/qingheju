-- ==========================================
-- 清和居 - 数据库初始化脚本
-- ==========================================

CREATE DATABASE IF NOT EXISTS qingheju
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE qingheju;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id         INT           AUTO_INCREMENT PRIMARY KEY,
    username   VARCHAR(20)   NOT NULL UNIQUE,
    email      VARCHAR(100)  NOT NULL DEFAULT '',
    password   VARCHAR(255)  NOT NULL,
    avatar     VARCHAR(500)  NOT NULL DEFAULT 'images/ui/default_avatar.svg',
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    user_id     INT           NOT NULL,
    title       VARCHAR(100)  NOT NULL,
    content     TEXT          NOT NULL,
    image       MEDIUMTEXT   NOT NULL,  -- 支持最大16MB的base64图片
    likes_count INT           NOT NULL DEFAULT 0,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
    id         INT           AUTO_INCREMENT PRIMARY KEY,
    post_id    INT           NOT NULL,
    user_id    INT           NOT NULL,
    content    VARCHAR(500)  NOT NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_post_id (post_id)
) ENGINE=InnoDB;

-- 点赞表
CREATE TABLE IF NOT EXISTS likes (
    id         INT      AUTO_INCREMENT PRIMARY KEY,
    user_id    INT      NOT NULL,
    post_id    INT      NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_post (user_id, post_id)
) ENGINE=InnoDB;

-- 签到表
CREATE TABLE IF NOT EXISTS checkins (
    id           INT      AUTO_INCREMENT PRIMARY KEY,
    user_id      INT      NOT NULL,
    checkin_date DATE     NOT NULL,
    streak       INT      NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_date (user_id, checkin_date),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- 24节气表
CREATE TABLE IF NOT EXISTS solar_terms (
    id          INT           AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(10)   NOT NULL,
    pinyin      VARCHAR(30)   NOT NULL DEFAULT '',
    term_date   DATE          NOT NULL,
    lunar_date  VARCHAR(20)   NOT NULL DEFAULT '',
    image       VARCHAR(200)  NOT NULL DEFAULT '',
    description TEXT          NOT NULL,
    health_tip  TEXT          NOT NULL
) ENGINE=InnoDB;

-- ==========================================
-- 插入24节气初始数据
-- ==========================================
INSERT INTO solar_terms (name, pinyin, term_date, lunar_date, image, description, health_tip) VALUES
('立春', 'lichun', '2026-02-04', '腊月十七', 'images/solarterms/lichun.jpg', '立春是二十四节气之首，标志着春季的开始。东风解冻，蛰虫始振，阳气生发，万物复苏。此时宜养肝护肝，保持心情舒畅。', '宜早睡早起，适当运动，饮食宜清淡，多食新鲜蔬菜，少食酸味多食辛甘以养肝。'),
('雨水', 'yushui', '2026-02-18', '正月初二', 'images/solarterms/yushui.jpg', '雨水节气降水量渐增，冰雪融化，草木萌动。此时湿气渐重，养生应注重调养脾胃，祛风除湿。', '注意保暖防潮，饮食宜健脾祛湿，可多食山药、薏米、红枣等，少食生冷油腻。'),
('惊蛰', 'jingzhe', '2026-03-05', '正月十七', 'images/solarterms/jingzhe.jpg', '春雷乍动，惊醒蛰伏的昆虫，万物生机盎然。此时人体阳气上升，新陈代谢加快，是养肝护肝的关键时期。', '保持心情愉悦，避免发怒伤肝，可饮菊花茶清肝明目，饮食以清淡为主。'),
('春分', 'chunfen', '2026-03-20', '二月初二', 'images/solarterms/chunfen.jpg', '昼夜平分，阴阳平衡。春分时节人体气血运行趋于调和，养生重在保持阴阳平衡。', '饮食宜寒热均衡，可食用荠菜、香椿等时令蔬菜，适当进行户外运动。'),
('清明', 'qingming', '2026-04-05', '二月十八', 'images/solarterms/qingming.jpg', '天气清澈明朗，万物生长旺盛。清明既是节气也是传统节日，有扫墓祭祖与踏青郊游的习俗。', '宜多到户外活动，呼吸新鲜空气，饮食可食青团、荠菜等时令食物，注意防过敏。'),
('谷雨', 'guyu', '2026-04-20', '三月初四', 'images/solarterms/guyu.jpg', '雨生百谷，是春季最后一个节气。雨水增多，谷物生长，气温升高，湿气渐重。', '注意祛湿健脾，可饮谷雨茶清火明目，食用山药、茯苓、薏米等健脾祛湿食物。'),
('立夏', 'lixia', '2026-05-05', '三月十九', 'images/solarterms/lixia.jpg', '夏季的开始，万物繁茂。气温明显升高，雷雨增多，人体新陈代谢加快，心脏负荷增加。', '注意养心安神，饮食宜清淡，可食苦瓜、莲子等清心去火，适当午休养心。'),
('小满', 'xiaoman', '2026-05-21', '四月初五', 'images/solarterms/xiaoman.jpg', '麦类等夏熟作物籽粒开始饱满但未成熟。气温升高，湿度增大，湿热交加。', '饮食宜清热利湿，可食冬瓜、苦瓜、绿豆等，注意防暑降温，避免贪凉伤脾胃。'),
('芒种', 'mangzhong', '2026-06-05', '四月二十', 'images/solarterms/mangzhong.jpg', '有芒的麦子快收，有芒的稻子可种。天气炎热，雨水充沛，湿热最重时期。', '宜清补为主，可食鸭肉、鱼等凉性蛋白质，多饮酸梅汤解暑生津，注意防暑祛湿。'),
('夏至', 'xiazhi', '2026-06-21', '五月初七', 'images/solarterms/xiazhi.jpg', '一年中白昼最长的一天，阳气最盛。此后阴气始生，养生需注意保护初生的阴气。', '饮食宜清淡，可食绿豆汤、冬瓜汤解暑，午间小憩养心，避免过度出汗伤津。'),
('小暑', 'xiaoshu', '2026-07-07', '五月廿三', 'images/solarterms/xiaoshu.jpg', '暑为炎热之意，小暑即天气开始炎热但尚未到最热。此时人体出汗多，易耗气伤津。', '注意防暑降温，多饮水补充津液，可饮菊花茶、薄荷茶清热解暑，饮食宜清补。'),
('大暑', 'dashu', '2026-07-22', '六月初九', 'images/solarterms/dashu.jpg', '一年中最热的时期，湿热交蒸达到顶点。人体阳气浮于体表，内里反而虚寒。', '切忌贪凉饮冷伤脾胃，可食生姜温中散寒，饮绿豆汤、酸梅汤解暑，注意防暑降温。'),
('立秋', 'liqiu', '2026-08-07', '六月廿五', 'images/solarterms/liqiu.jpg', '秋季的开始，暑去凉来。但立秋后暑气难消，有秋老虎之说。气候由热转凉。', '逐渐调整饮食，适当增加滋阴润燥食物，可食银耳、百合、雪梨等，注意养肺。'),
('处暑', 'chushu', '2026-08-23', '七月十一', 'images/solarterms/chushu.jpg', '暑气消退，秋意渐浓。此时气候干燥，人体容易出现口干舌燥、皮肤干燥等秋燥症状。', '注意滋阴润燥，多饮温水，可食蜂蜜、银耳、百合等润肺生津食物，少吃辛辣。'),
('白露', 'bailu', '2026-09-07', '七月廿六', 'images/solarterms/bailu.jpg', '天气转凉，清晨露水凝结。昼夜温差加大，秋燥更加明显，是养肺润燥的关键时期。', '早晚注意添衣保暖，饮食以滋阴润肺为主，可食雪梨、银耳、蜂蜜，多饮温水。'),
('秋分', 'qiufen', '2026-09-23', '八月十三', 'images/solarterms/qiufen.jpg', '昼夜平分，秋色平分。秋分后寒气日渐增强，万物开始凋零，人体也应收敛神气。', '保持内心平静，收敛神气，饮食宜温润，可食核桃、芝麻等滋润食物，早卧早起。'),
('寒露', 'hanlu', '2026-10-08', '八月廿八', 'images/solarterms/hanlu.jpg', '露水更冷，即将结冰。气温下降明显，寒气增长，万物随寒气增长而逐渐萧瑟。', '注意足部保暖，可热水泡脚驱寒，饮食宜温补，多食红枣、桂圆等温热食物。'),
('霜降', 'shuangjiang', '2026-10-23', '九月十四', 'images/solarterms/shuangjiang.jpg', '天气渐冷，开始有霜。秋季最后一个节气，是秋冬交替的过渡期。', '注意防寒保暖，尤其保护好关节部位，饮食可增加温补食物，如牛肉、羊肉等。'),
('立冬', 'lidong', '2026-11-07', '九月廿九', 'images/solarterms/lidong.jpg', '冬季的开始，万物收藏。阳气潜藏，阴气盛极，草木凋零，蛰虫伏藏。', '宜早卧晚起，待日光而出，注意保暖，饮食宜温补，可食羊肉、核桃等补肾食物。'),
('小雪', 'xiaoxue', '2026-11-22', '十月十四', 'images/solarterms/xiaoxue.jpg', '开始降雪但还不到大雪纷飞之时。寒气加重，阳气继续潜藏，阴气盛。', '注意保暖防寒，保持心情愉悦防抑郁，饮食宜温补，可食黑豆、黑芝麻等黑色食物补肾。'),
('大雪', 'daxue', '2026-12-07', '十月廿九', 'images/solarterms/daxue.jpg', '降雪量增大，天寒地冻。阴气最盛时期，人体阳气潜藏于内，是进补的好时节。', '适合温补，可食羊肉、牛肉等温性食物，注意头部和脚部保暖，早卧晚起。'),
('冬至', 'dongzhi', '2026-12-21', '十一月十四', 'images/solarterms/dongzhi.jpg', '一年中白昼最短的一天，阴极之至，阳气始生。冬至大如年，是重要的节气兼传统节日。', '宜食饺子、汤圆等传统食物，适当进补如当归生姜羊肉汤，注意保暖，静养以待阳气生发。'),
('小寒', 'xiaohan', '2027-01-05', '十一月廿九', 'images/solarterms/xiaohan.jpg', '进入一年中最寒冷的时段。寒气凛冽，万物潜藏，人体阳气内敛。', '注意防寒保暖，减少户外活动，饮食宜温热，可食当归生姜羊肉汤等温补驱寒。'),
('大寒', 'dahan', '2027-01-20', '腊月十三', 'images/solarterms/dahan.jpg', '一年中最寒冷的节气。寒气逆极，万物蛰藏。大寒过后便是立春，是新旧交替之时。', '继续温补防寒，但不宜大补，可逐渐转为平补，为春季养生做好准备，保持心情平和。');

mysqldump: [Warning] Using a password on the command line interface can be insecure.
-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: qingheju
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `checkins`
--

DROP TABLE IF EXISTS `checkins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checkins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `checkin_date` date NOT NULL,
  `streak` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`,`checkin_date`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `checkins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `checkins`
--

LOCK TABLES `checkins` WRITE;
/*!40000 ALTER TABLE `checkins` DISABLE KEYS */;
INSERT INTO `checkins` VALUES (1,1,'2026-06-12',1,'2026-06-12 13:19:06'),(2,2,'2026-06-14',1,'2026-06-14 18:44:45');
/*!40000 ALTER TABLE `checkins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `content` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_post_id` (`post_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `likes`
--

DROP TABLE IF EXISTS `likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `post_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_post` (`user_id`,`post_id`),
  KEY `post_id` (`post_id`),
  CONSTRAINT `likes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `likes_ibfk_2` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `likes`
--

LOCK TABLES `likes` WRITE;
/*!40000 ALTER TABLE `likes` DISABLE KEYS */;
/*!40000 ALTER TABLE `likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `image` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `likes_count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `solar_terms`
--

DROP TABLE IF EXISTS `solar_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `solar_terms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pinyin` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `term_date` date NOT NULL,
  `lunar_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `image` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `health_tip` text COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `solar_terms`
--

LOCK TABLES `solar_terms` WRITE;
/*!40000 ALTER TABLE `solar_terms` DISABLE KEYS */;
INSERT INTO `solar_terms` VALUES (1,'立春','lichun','2026-02-04','腊月十七','images/solarterms/lichun.jpg','立春是二十四节气之首，标志着春季的开始。东风解冻，蛰虫始振，阳气生发，万物复苏。此时宜养肝护肝，保持心情舒畅。','宜早睡早起，适当运动，饮食宜清淡，多食新鲜蔬菜，少食酸味多食辛甘以养肝。'),(2,'雨水','yushui','2026-02-18','正月初二','images/solarterms/yushui.jpg','雨水节气降水量渐增，冰雪融化，草木萌动。此时湿气渐重，养生应注重调养脾胃，祛风除湿。','注意保暖防潮，饮食宜健脾祛湿，可多食山药、薏米、红枣等，少食生冷油腻。'),(3,'惊蛰','jingzhe','2026-03-05','正月十七','images/solarterms/jingzhe.jpg','春雷乍动，惊醒蛰伏的昆虫，万物生机盎然。此时人体阳气上升，新陈代谢加快，是养肝护肝的关键时期。','保持心情愉悦，避免发怒伤肝，可饮菊花茶清肝明目，饮食以清淡为主。'),(4,'春分','chunfen','2026-03-20','二月初二','images/solarterms/chunfen.jpg','昼夜平分，阴阳平衡。春分时节人体气血运行趋于调和，养生重在保持阴阳平衡。','饮食宜寒热均衡，可食用荠菜、香椿等时令蔬菜，适当进行户外运动。'),(5,'清明','qingming','2026-04-05','二月十八','images/solarterms/qingming.jpg','天气清澈明朗，万物生长旺盛。清明既是节气也是传统节日，有扫墓祭祖与踏青郊游的习俗。','宜多到户外活动，呼吸新鲜空气，饮食可食青团、荠菜等时令食物，注意防过敏。'),(6,'谷雨','guyu','2026-04-20','三月初四','images/solarterms/guyu.jpg','雨生百谷，是春季最后一个节气。雨水增多，谷物生长，气温升高，湿气渐重。','注意祛湿健脾，可饮谷雨茶清火明目，食用山药、茯苓、薏米等健脾祛湿食物。'),(7,'立夏','lixia','2026-05-05','三月十九','images/solarterms/lixia.jpg','夏季的开始，万物繁茂。气温明显升高，雷雨增多，人体新陈代谢加快，心脏负荷增加。','注意养心安神，饮食宜清淡，可食苦瓜、莲子等清心去火，适当午休养心。'),(8,'小满','xiaoman','2026-05-21','四月初五','images/solarterms/xiaoman.jpg','麦类等夏熟作物籽粒开始饱满但未成熟。气温升高，湿度增大，湿热交加。','饮食宜清热利湿，可食冬瓜、苦瓜、绿豆等，注意防暑降温，避免贪凉伤脾胃。'),(9,'芒种','mangzhong','2026-06-05','四月二十','images/solarterms/mangzhong.jpg','有芒的麦子快收，有芒的稻子可种。天气炎热，雨水充沛，湿热最重时期。','宜清补为主，可食鸭肉、鱼等凉性蛋白质，多饮酸梅汤解暑生津，注意防暑祛湿。'),(10,'夏至','xiazhi','2026-06-21','五月初七','images/solarterms/xiazhi.jpg','一年中白昼最长的一天，阳气最盛。此后阴气始生，养生需注意保护初生的阴气。','饮食宜清淡，可食绿豆汤、冬瓜汤解暑，午间小憩养心，避免过度出汗伤津。'),(11,'小暑','xiaoshu','2026-07-07','五月廿三','images/solarterms/xiaoshu.jpg','暑为炎热之意，小暑即天气开始炎热但尚未到最热。此时人体出汗多，易耗气伤津。','注意防暑降温，多饮水补充津液，可饮菊花茶、薄荷茶清热解暑，饮食宜清补。'),(12,'大暑','dashu','2026-07-22','六月初九','images/solarterms/dashu.jpg','一年中最热的时期，湿热交蒸达到顶点。人体阳气浮于体表，内里反而虚寒。','切忌贪凉饮冷伤脾胃，可食生姜温中散寒，饮绿豆汤、酸梅汤解暑，注意防暑降温。'),(13,'立秋','liqiu','2026-08-07','六月廿五','images/solarterms/liqiu.jpg','秋季的开始，暑去凉来。但立秋后暑气难消，有秋老虎之说。气候由热转凉。','逐渐调整饮食，适当增加滋阴润燥食物，可食银耳、百合、雪梨等，注意养肺。'),(14,'处暑','chushu','2026-08-23','七月十一','images/solarterms/chushu.jpg','暑气消退，秋意渐浓。此时气候干燥，人体容易出现口干舌燥、皮肤干燥等秋燥症状。','注意滋阴润燥，多饮温水，可食蜂蜜、银耳、百合等润肺生津食物，少吃辛辣。'),(15,'白露','bailu','2026-09-07','七月廿六','images/solarterms/bailu.jpg','天气转凉，清晨露水凝结。昼夜温差加大，秋燥更加明显，是养肺润燥的关键时期。','早晚注意添衣保暖，饮食以滋阴润肺为主，可食雪梨、银耳、蜂蜜，多饮温水。'),(16,'秋分','qiufen','2026-09-23','八月十三','images/solarterms/qiufen.jpg','昼夜平分，秋色平分。秋分后寒气日渐增强，万物开始凋零，人体也应收敛神气。','保持内心平静，收敛神气，饮食宜温润，可食核桃、芝麻等滋润食物，早卧早起。'),(17,'寒露','hanlu','2026-10-08','八月廿八','images/solarterms/hanlu.jpg','露水更冷，即将结冰。气温下降明显，寒气增长，万物随寒气增长而逐渐萧瑟。','注意足部保暖，可热水泡脚驱寒，饮食宜温补，多食红枣、桂圆等温热食物。'),(18,'霜降','shuangjiang','2026-10-23','九月十四','images/solarterms/shuangjiang.jpg','天气渐冷，开始有霜。秋季最后一个节气，是秋冬交替的过渡期。','注意防寒保暖，尤其保护好关节部位，饮食可增加温补食物，如牛肉、羊肉等。'),(19,'立冬','lidong','2026-11-07','九月廿九','images/solarterms/lidong.jpg','冬季的开始，万物收藏。阳气潜藏，阴气盛极，草木凋零，蛰虫伏藏。','宜早卧晚起，待日光而出，注意保暖，饮食宜温补，可食羊肉、核桃等补肾食物。'),(20,'小雪','xiaoxue','2026-11-22','十月十四','images/solarterms/xiaoxue.jpg','开始降雪但还不到大雪纷飞之时。寒气加重，阳气继续潜藏，阴气盛。','注意保暖防寒，保持心情愉悦防抑郁，饮食宜温补，可食黑豆、黑芝麻等黑色食物补肾。'),(21,'大雪','daxue','2026-12-07','十月廿九','images/solarterms/daxue.jpg','降雪量增大，天寒地冻。阴气最盛时期，人体阳气潜藏于内，是进补的好时节。','适合温补，可食羊肉、牛肉等温性食物，注意头部和脚部保暖，早卧晚起。'),(22,'冬至','dongzhi','2026-12-21','十一月十四','images/solarterms/dongzhi.jpg','一年中白昼最短的一天，阴极之至，阳气始生。冬至大如年，是重要的节气兼传统节日。','宜食饺子、汤圆等传统食物，适当进补如当归生姜羊肉汤，注意保暖，静养以待阳气生发。'),(23,'小寒','xiaohan','2027-01-05','十一月廿九','images/solarterms/xiaohan.jpg','进入一年中最寒冷的时段。寒气凛冽，万物潜藏，人体阳气内敛。','注意防寒保暖，减少户外活动，饮食宜温热，可食当归生姜羊肉汤等温补驱寒。'),(24,'大寒','dahan','2027-01-20','腊月十三','images/solarterms/dahan.jpg','一年中最寒冷的节气。寒气逆极，万物蛰藏。大寒过后便是立春，是新旧交替之时。','继续温补防寒，但不宜大补，可逐渐转为平补，为春季养生做好准备，保持心情平和。'),(25,'立春','lichun','2026-02-04','腊月十七','images/solarterms/lichun.jpg','立春是二十四节气之首，标志着春季的开始。东风解冻，蛰虫始振，阳气生发，万物复苏。此时宜养肝护肝，保持心情舒畅。','宜早睡早起，适当运动，饮食宜清淡，多食新鲜蔬菜，少食酸味多食辛甘以养肝。'),(26,'雨水','yushui','2026-02-18','正月初二','images/solarterms/yushui.jpg','雨水节气降水量渐增，冰雪融化，草木萌动。此时湿气渐重，养生应注重调养脾胃，祛风除湿。','注意保暖防潮，饮食宜健脾祛湿，可多食山药、薏米、红枣等，少食生冷油腻。'),(27,'惊蛰','jingzhe','2026-03-05','正月十七','images/solarterms/jingzhe.jpg','春雷乍动，惊醒蛰伏的昆虫，万物生机盎然。此时人体阳气上升，新陈代谢加快，是养肝护肝的关键时期。','保持心情愉悦，避免发怒伤肝，可饮菊花茶清肝明目，饮食以清淡为主。'),(28,'春分','chunfen','2026-03-20','二月初二','images/solarterms/chunfen.jpg','昼夜平分，阴阳平衡。春分时节人体气血运行趋于调和，养生重在保持阴阳平衡。','饮食宜寒热均衡，可食用荠菜、香椿等时令蔬菜，适当进行户外运动。'),(29,'清明','qingming','2026-04-05','二月十八','images/solarterms/qingming.jpg','天气清澈明朗，万物生长旺盛。清明既是节气也是传统节日，有扫墓祭祖与踏青郊游的习俗。','宜多到户外活动，呼吸新鲜空气，饮食可食青团、荠菜等时令食物，注意防过敏。'),(30,'谷雨','guyu','2026-04-20','三月初四','images/solarterms/guyu.jpg','雨生百谷，是春季最后一个节气。雨水增多，谷物生长，气温升高，湿气渐重。','注意祛湿健脾，可饮谷雨茶清火明目，食用山药、茯苓、薏米等健脾祛湿食物。'),(31,'立夏','lixia','2026-05-05','三月十九','images/solarterms/lixia.jpg','夏季的开始，万物繁茂。气温明显升高，雷雨增多，人体新陈代谢加快，心脏负荷增加。','注意养心安神，饮食宜清淡，可食苦瓜、莲子等清心去火，适当午休养心。'),(32,'小满','xiaoman','2026-05-21','四月初五','images/solarterms/xiaoman.jpg','麦类等夏熟作物籽粒开始饱满但未成熟。气温升高，湿度增大，湿热交加。','饮食宜清热利湿，可食冬瓜、苦瓜、绿豆等，注意防暑降温，避免贪凉伤脾胃。'),(33,'芒种','mangzhong','2026-06-05','四月二十','images/solarterms/mangzhong.jpg','有芒的麦子快收，有芒的稻子可种。天气炎热，雨水充沛，湿热最重时期。','宜清补为主，可食鸭肉、鱼等凉性蛋白质，多饮酸梅汤解暑生津，注意防暑祛湿。'),(34,'夏至','xiazhi','2026-06-21','五月初七','images/solarterms/xiazhi.jpg','一年中白昼最长的一天，阳气最盛。此后阴气始生，养生需注意保护初生的阴气。','饮食宜清淡，可食绿豆汤、冬瓜汤解暑，午间小憩养心，避免过度出汗伤津。'),(35,'小暑','xiaoshu','2026-07-07','五月廿三','images/solarterms/xiaoshu.jpg','暑为炎热之意，小暑即天气开始炎热但尚未到最热。此时人体出汗多，易耗气伤津。','注意防暑降温，多饮水补充津液，可饮菊花茶、薄荷茶清热解暑，饮食宜清补。'),(36,'大暑','dashu','2026-07-22','六月初九','images/solarterms/dashu.jpg','一年中最热的时期，湿热交蒸达到顶点。人体阳气浮于体表，内里反而虚寒。','切忌贪凉饮冷伤脾胃，可食生姜温中散寒，饮绿豆汤、酸梅汤解暑，注意防暑降温。'),(37,'立秋','liqiu','2026-08-07','六月廿五','images/solarterms/liqiu.jpg','秋季的开始，暑去凉来。但立秋后暑气难消，有秋老虎之说。气候由热转凉。','逐渐调整饮食，适当增加滋阴润燥食物，可食银耳、百合、雪梨等，注意养肺。'),(38,'处暑','chushu','2026-08-23','七月十一','images/solarterms/chushu.jpg','暑气消退，秋意渐浓。此时气候干燥，人体容易出现口干舌燥、皮肤干燥等秋燥症状。','注意滋阴润燥，多饮温水，可食蜂蜜、银耳、百合等润肺生津食物，少吃辛辣。'),(39,'白露','bailu','2026-09-07','七月廿六','images/solarterms/bailu.jpg','天气转凉，清晨露水凝结。昼夜温差加大，秋燥更加明显，是养肺润燥的关键时期。','早晚注意添衣保暖，饮食以滋阴润肺为主，可食雪梨、银耳、蜂蜜，多饮温水。'),(40,'秋分','qiufen','2026-09-23','八月十三','images/solarterms/qiufen.jpg','昼夜平分，秋色平分。秋分后寒气日渐增强，万物开始凋零，人体也应收敛神气。','保持内心平静，收敛神气，饮食宜温润，可食核桃、芝麻等滋润食物，早卧早起。'),(41,'寒露','hanlu','2026-10-08','八月廿八','images/solarterms/hanlu.jpg','露水更冷，即将结冰。气温下降明显，寒气增长，万物随寒气增长而逐渐萧瑟。','注意足部保暖，可热水泡脚驱寒，饮食宜温补，多食红枣、桂圆等温热食物。'),(42,'霜降','shuangjiang','2026-10-23','九月十四','images/solarterms/shuangjiang.jpg','天气渐冷，开始有霜。秋季最后一个节气，是秋冬交替的过渡期。','注意防寒保暖，尤其保护好关节部位，饮食可增加温补食物，如牛肉、羊肉等。'),(43,'立冬','lidong','2026-11-07','九月廿九','images/solarterms/lidong.jpg','冬季的开始，万物收藏。阳气潜藏，阴气盛极，草木凋零，蛰虫伏藏。','宜早卧晚起，待日光而出，注意保暖，饮食宜温补，可食羊肉、核桃等补肾食物。'),(44,'小雪','xiaoxue','2026-11-22','十月十四','images/solarterms/xiaoxue.jpg','开始降雪但还不到大雪纷飞之时。寒气加重，阳气继续潜藏，阴气盛。','注意保暖防寒，保持心情愉悦防抑郁，饮食宜温补，可食黑豆、黑芝麻等黑色食物补肾。'),(45,'大雪','daxue','2026-12-07','十月廿九','images/solarterms/daxue.jpg','降雪量增大，天寒地冻。阴气最盛时期，人体阳气潜藏于内，是进补的好时节。','适合温补，可食羊肉、牛肉等温性食物，注意头部和脚部保暖，早卧晚起。'),(46,'冬至','dongzhi','2026-12-21','十一月十四','images/solarterms/dongzhi.jpg','一年中白昼最短的一天，阴极之至，阳气始生。冬至大如年，是重要的节气兼传统节日。','宜食饺子、汤圆等传统食物，适当进补如当归生姜羊肉汤，注意保暖，静养以待阳气生发。'),(47,'小寒','xiaohan','2027-01-05','十一月廿九','images/solarterms/xiaohan.jpg','进入一年中最寒冷的时段。寒气凛冽，万物潜藏，人体阳气内敛。','注意防寒保暖，减少户外活动，饮食宜温热，可食当归生姜羊肉汤等温补驱寒。'),(48,'大寒','dahan','2027-01-20','腊月十三','images/solarterms/dahan.jpg','一年中最寒冷的节气。寒气逆极，万物蛰藏。大寒过后便是立春，是新旧交替之时。','继续温补防寒，但不宜大补，可逐渐转为平补，为春季养生做好准备，保持心情平和。');
/*!40000 ALTER TABLE `solar_terms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'images/ui/default_avatar.svg',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'testuser','test@test.com','$2b$10$rCZY2nW7o/s1kN6N33NzC.V58RHxVGAx26seUq9E5dgNzNRKThY/y','images/ui/default_avatar.svg','2026-06-12 13:19:06'),(2,'admin','2969711886@qq.com','$2b$10$nAQ2x1m335iY8NRxSFkr3.nkuf.7/R62mLJw0WN.OTDO.RbFvtyvy','images/ui/default_avatar.svg','2026-06-12 13:21:18');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'qingheju'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-14 19:31:28
